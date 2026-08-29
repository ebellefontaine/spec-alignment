import * as core from '@actions/core';
import { context as actionsContext } from '@actions/github';
import { glob } from 'fast-glob';
import { z } from 'zod';

import { runAction } from './core/runAction.js';
import { parseSourceDocumentsInput } from './domain/conventions.js';
import { gitAdapter } from './adapters/git.js';
import { createFilesystemAdapter } from './adapters/fs.js';
import { createLlmJudgeAdapter } from './adapters/llm.js';
import { createGithubClient } from './adapters/github.js';
import type { Adapters, Config } from './core/types.js';

/**
 * Directories that are never useful as spec-alignment context and would
 * otherwise dominate the file tree passed to the judge prompt.
 */
const FILE_TREE_IGNORE = ['node_modules/**', '.git/**', 'dist/**', 'build/**'];

/**
 * Every value arriving from `action.yml` is a string — GitHub Actions has no
 * other input type. `getInput` returns `''` for an absent input, which is
 * indistinguishable from an explicitly blank one, so `''` is treated
 * throughout as "use the documented default".
 */

/** A `'true'`/`'false'` input, falling back to `fallback` when left blank. */
function booleanInput(fallback: boolean) {
  return z
    .string()
    .transform((raw) => raw.trim().toLowerCase())
    .refine((value) => value === '' || value === 'true' || value === 'false', {
      message: 'must be "true" or "false"',
    })
    .transform((value) => (value === '' ? fallback : value === 'true'));
}

/** A string input that becomes `undefined` when blank. */
function optionalStringInput() {
  return z
    .string()
    .transform((raw) => raw.trim())
    .transform((value) => (value.length === 0 ? undefined : value));
}

/** A string input that falls back to `fallback` when blank. */
function stringInputWithDefault(fallback: string) {
  return z
    .string()
    .transform((raw) => raw.trim())
    .transform((value) => (value.length === 0 ? fallback : value));
}

/** Split a multi-line input into trimmed, non-empty entries. */
function parseMultilineList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Schema for the raw `action.yml` inputs.
 *
 * Validation happens in one pass over every input rather than input-by-input,
 * so a misconfigured workflow surfaces all of its problems in a single run
 * instead of one per re-run.
 */
const InputSchema = z
  .object({
    provider: z
      .string()
      .transform((raw) => raw.trim().toLowerCase())
      .pipe(
        z.enum(['anthropic', 'openai', 'google', 'openrouter'], {
          message: 'must be one of: anthropic, openai, google, openrouter',
        })
      ),

    api_key: z
      .string()
      .transform((raw) => raw.trim())
      .refine((value) => value.length > 0, { message: 'is required and must not be blank' }),

    model: optionalStringInput(),

    // Parsed rather than merely validated: `parseSourceDocumentsInput` owns the
    // convention grammar, and its errors are already user-facing.
    source_documents: z
      .string()
      .refine((raw) => parseMultilineList(raw).length > 0, {
        message: 'is required and must list at least one convention',
      })
      .transform((raw, ctx) => {
        try {
          return parseSourceDocumentsInput(raw);
        } catch (err) {
          ctx.addIssue({ code: 'custom', message: (err as Error).message });
          return z.NEVER;
        }
      }),

    strictness: stringInputWithDefault('balanced').pipe(
      z.enum(['strict', 'balanced', 'lenient'], {
        message: 'must be one of: strict, balanced, lenient',
      })
    ),

    immutable_spec: booleanInput(false),
    comment_on_pr: booleanInput(true),
    inline_review_comments: booleanInput(false),
    exclude_paths: z.string().transform(parseMultilineList),
    bypass_label: stringInputWithDefault('spec-check:skip'),
    fail_closed_on_error: booleanInput(false),
    auto_approve: booleanInput(false),
    approval_token: optionalStringInput(),
  })
  .superRefine((inputs, ctx) => {
    // GITHUB_TOKEN cannot approve pull requests, so auto-approval is inert
    // without a separate token. Failing here beats a silent no-op at the end
    // of an otherwise successful run.
    if (inputs.auto_approve && inputs.approval_token === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['approval_token'],
        message: 'is required when auto_approve is true (GITHUB_TOKEN cannot approve pull requests)',
      });
    }
  });

type ValidatedInputs = z.infer<typeof InputSchema>;

/** Read every declared input verbatim, deferring all validation to Zod. */
function readRawInputs(): Record<string, string> {
  return {
    provider: core.getInput('provider'),
    api_key: core.getInput('api_key'),
    model: core.getInput('model'),
    source_documents: core.getInput('source_documents'),
    strictness: core.getInput('strictness'),
    immutable_spec: core.getInput('immutable_spec'),
    comment_on_pr: core.getInput('comment_on_pr'),
    inline_review_comments: core.getInput('inline_review_comments'),
    exclude_paths: core.getInput('exclude_paths'),
    bypass_label: core.getInput('bypass_label'),
    fail_closed_on_error: core.getInput('fail_closed_on_error'),
    auto_approve: core.getInput('auto_approve'),
    approval_token: core.getInput('approval_token'),
  };
}

/** Render Zod issues as one line per offending input, keyed by input name. */
function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const name = issue.path.length > 0 ? String(issue.path[0]) : '(input)';
      return `  - ${name}: ${issue.message}`;
    })
    .join('\n');
}

function validateInputs(): ValidatedInputs {
  const parsed = InputSchema.safeParse(readRawInputs());
  if (!parsed.success) {
    throw new Error(`Invalid action inputs:\n${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}

/**
 * The repository's tracked file layout, given to the judge so it can tell an
 * omission apart from a file that simply lives elsewhere in the tree.
 */
async function readFileTree(): Promise<string[]> {
  return glob('**/*', {
    cwd: process.cwd(),
    dot: false,
    onlyFiles: true,
    ignore: FILE_TREE_IGNORE,
  });
}

/** PR facts that `decideDiscovery` needs, pulled from the event payload. */
interface PullRequestContext {
  isDraft: boolean;
  prLabels: string[];
}

function readPullRequestContext(): PullRequestContext {
  const pullRequest = actionsContext.payload.pull_request;
  if (pullRequest === undefined) {
    throw new Error(
      `This action must run on a pull_request-triggered event, but the payload for ` +
        `'${actionsContext.eventName}' contains no pull request. Add 'pull_request' ` +
        `(or 'pull_request_target') to the workflow's 'on:' triggers.`
    );
  }

  const rawLabels = Array.isArray(pullRequest.labels) ? pullRequest.labels : [];
  const prLabels = rawLabels
    .map((label: unknown) => (label as { name?: unknown }).name)
    .filter((name: unknown): name is string => typeof name === 'string');

  return { isDraft: Boolean(pullRequest.draft), prLabels };
}

async function buildConfig(): Promise<Config> {
  const inputs = validateInputs();

  // Mask credentials so nothing that echoes config can leak them into the log.
  core.setSecret(inputs.api_key);
  if (inputs.approval_token !== undefined) {
    core.setSecret(inputs.approval_token);
  }

  const { isDraft, prLabels } = readPullRequestContext();

  return {
    provider: inputs.provider,
    apiKey: inputs.api_key,
    model: inputs.model,
    sourceDocuments: inputs.source_documents,
    strictness: inputs.strictness,
    immutableSpec: inputs.immutable_spec,
    commentOnPr: inputs.comment_on_pr,
    inlineReviewComments: inputs.inline_review_comments,
    excludePaths: inputs.exclude_paths,
    bypassLabel: inputs.bypass_label,
    failClosedOnError: inputs.fail_closed_on_error,
    autoApprove: inputs.auto_approve,
    approvalToken: inputs.approval_token,
    isDraft,
    prLabels,
    fileTree: await readFileTree(),
  };
}

function buildAdapters(): Adapters {
  const filesystemAdapter = createFilesystemAdapter(process.cwd());
  return {
    getDiff: () => gitAdapter.getDiff(),
    readSourceDocument: (globPattern, convention) =>
      filesystemAdapter.readSourceDocument(globPattern, convention),
    llmJudge: createLlmJudgeAdapter(),
    githubClient: createGithubClient(),
  };
}

/**
 * Setup failures (bad inputs, missing token, wrong event) fail the step: no
 * check was published, so the workflow must not read as green.
 *
 * A completed evaluation never fails the step, whatever the verdict. The
 * pass/fail signal lives entirely in the Check Run conclusion that
 * `runAction` publishes — a `fail` verdict is a red check, not a broken
 * action — so this process exits 0 for every verdict it manages to reach.
 */
async function main(): Promise<void> {
  let config: Config;
  let adapters: Adapters;
  try {
    config = await buildConfig();
    adapters = buildAdapters();
  } catch (err) {
    core.setFailed(`Configuration error: ${(err as Error).message}`);
    return;
  }

  const result = await runAction(adapters, config);

  core.setOutput('verdict', result.verdict);
  core.setOutput('summary', result.summary);
  core.info(`Spec alignment verdict: ${result.verdict}`);
  core.info(result.summary);
}

main().catch((err: unknown) => {
  core.setFailed(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
});
