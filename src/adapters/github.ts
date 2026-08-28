import * as core from '@actions/core';
import { context as ambientContext, getOctokit } from '@actions/github';
import type { EvaluationResult, Finding, GithubClient, Verdict } from '../core/types.js';
import { mapVerdictToConclusion } from '../domain/verdictMapper.js';

/** The Actions context shape, taken from the ambient instance so no deep import is needed. */
type ActionsContext = typeof ambientContext;

/** The hydrated Octokit returned by `getOctokit`. */
type Octokit = ReturnType<typeof getOctokit>;

/**
 * Stable Check Run name. Must not change between releases: `upsertCheckRun`
 * finds the run to update by matching this name against the head SHA.
 */
const CHECK_RUN_NAME = 'spec-alignment';

/**
 * Hidden marker embedded in every PR summary comment this action posts.
 * Used to find prior comments so they can be minimized before a fresh one
 * is posted (see the reporting section of the design doc).
 */
const COMMENT_MARKER = '<!-- spec-alignment-action:summary -->';

/** The Checks API accepts at most 50 annotations per request. */
const MAX_ANNOTATIONS_PER_REQUEST = 50;

/** `output.summary` and `output.text` are capped at 65535 characters by the Checks API. */
const MAX_OUTPUT_CHARS = 65_535;

/**
 * Upper bound on comments in a single review request. GitHub does not document
 * a hard cap, but very large review payloads are rejected; truncating loudly
 * beats having the whole review fail.
 */
const MAX_INLINE_COMMENTS = 50;

/** Human-readable Check Run title per verdict. */
const CHECK_TITLES: Record<Verdict, string> = {
  pass: 'Aligned with source documents',
  pass_with_drift: 'Aligned, with drift',
  fail: 'Misaligned with source documents',
  skip: 'Skipped',
  error: 'Check could not complete',
};

interface CheckAnnotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: 'notice' | 'warning' | 'failure';
  message: string;
}

export interface GithubClientOptions {
  /**
   * Token used for the Check Run, the PR summary comment, and inline review
   * comments. Defaults to `$GITHUB_TOKEN`. Note that PR approval deliberately
   * does not use this token — `approvePr` takes its own, because GITHUB_TOKEN
   * is not permitted to approve pull requests.
   */
  token?: string;
  /** Actions context. Defaults to the ambient `@actions/github` context. */
  context?: ActionsContext;
}

/**
 * RealGithubClient: writes evaluation results back to GitHub.
 *
 * Failure policy differs per method, deliberately:
 *
 * - `upsertCheckRun` is the action's primary output and rethrows on failure.
 *   The design doc requires the Check Run to always be produced, so a caller
 *   must not be able to mistake a missing check for a passing one.
 * - `upsertPrComment`, `postInlineReviewComments` and `approvePr` are
 *   supplementary and degrade to a `core.warning` when the token lacks the
 *   necessary permission — the common case for pull requests from forks,
 *   where the default token is read-only. Every degraded path logs what was
 *   skipped and why; nothing is swallowed silently.
 */
class RealGithubClient implements GithubClient {
  private readonly octokit: Octokit;
  private readonly ctx: ActionsContext;

  constructor(token: string, ctx: ActionsContext) {
    this.octokit = getOctokit(token);
    this.ctx = ctx;
  }

  /**
   * Create the Check Run, or update the existing one for this head SHA.
   *
   * Annotations are chunked at 50 per request: the first chunk rides along
   * with the create/update that sets the conclusion, and each remaining chunk
   * is appended by a follow-up PATCH (the Checks API appends rather than
   * replaces annotations on update).
   */
  async upsertCheckRun(result: EvaluationResult, failClosedOnError: boolean): Promise<void> {
    const { owner, repo } = this.ctx.repo;
    const headSha = this.headSha();
    const conclusion = mapVerdictToConclusion(result.verdict, failClosedOnError);
    const annotationChunks = chunkArray(buildAnnotations(result.findings), MAX_ANNOTATIONS_PER_REQUEST);
    const [firstChunk = [], ...remainingChunks] = annotationChunks;

    const output = {
      title: CHECK_TITLES[result.verdict],
      summary: truncate(result.summary, MAX_OUTPUT_CHARS),
      text: truncate(buildFindingsMarkdown(result), MAX_OUTPUT_CHARS),
      annotations: firstChunk,
    };

    const existingCheckRunId = await this.findExistingCheckRunId(headSha);
    let checkRunId: number;

    if (existingCheckRunId === undefined) {
      const created = await this.octokit.rest.checks.create({
        owner,
        repo,
        name: CHECK_RUN_NAME,
        head_sha: headSha,
        status: 'completed',
        conclusion,
        completed_at: new Date().toISOString(),
        output,
      });
      checkRunId = created.data.id;
    } else {
      await this.octokit.rest.checks.update({
        owner,
        repo,
        check_run_id: existingCheckRunId,
        status: 'completed',
        conclusion,
        completed_at: new Date().toISOString(),
        output,
      });
      checkRunId = existingCheckRunId;
    }

    // The conclusion is recorded at this point. Remaining annotation batches
    // are supplementary detail, so a failure here warns rather than discarding
    // an otherwise-complete check.
    for (const chunk of remainingChunks) {
      try {
        await this.octokit.rest.checks.update({
          owner,
          repo,
          check_run_id: checkRunId,
          output: { ...output, annotations: chunk },
        });
      } catch (err) {
        core.warning(
          `Check run ${checkRunId} was published, but ${chunk.length} additional annotation(s) ` +
            `could not be appended: ${describeError(err)}`
        );
      }
    }
  }

  /**
   * Minimize this action's previous summary comments, then post a fresh one.
   *
   * Hide-then-repost (rather than edit-in-place) is the behaviour the design
   * doc specifies: it keeps the conversation tab from accumulating a stale
   * comment trail across pushes while still surfacing the latest result at
   * the bottom of the thread.
   */
  async upsertPrComment(result: EvaluationResult): Promise<void> {
    const prNumber = this.prNumber();
    if (prNumber === undefined) {
      core.warning(
        `Skipping PR summary comment: no pull request found in the '${this.ctx.eventName}' event payload.`
      );
      return;
    }

    const { owner, repo } = this.ctx.repo;
    const body = `${COMMENT_MARKER}\n${buildCommentMarkdown(result)}`;

    await this.minimizePreviousComments(prNumber);

    try {
      await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
      });
    } catch (err) {
      if (isPermissionError(err)) {
        core.warning(
          `Skipping PR summary comment: the token lacks 'pull-requests: write' permission ` +
            `(expected for pull requests from forks). ${describeError(err)}`
        );
        return;
      }
      throw err;
    }
  }

  /**
   * Post a review carrying one inline comment per located finding.
   *
   * Only findings with both a file and a line can be placed inline. Everything
   * else already appears in the Check Run summary, which is always produced,
   * so this method never fails the run — a rejected review (commonly a 422
   * because a line falls outside the diff) downgrades to a warning.
   */
  async postInlineReviewComments(result: EvaluationResult): Promise<void> {
    const prNumber = this.prNumber();
    if (prNumber === undefined) {
      core.warning(
        `Skipping inline review comments: no pull request found in the '${this.ctx.eventName}' event payload.`
      );
      return;
    }

    const locatable = result.findings.filter(hasLocation);
    const unlocatable = result.findings.length - locatable.length;
    if (unlocatable > 0) {
      core.info(
        `${unlocatable} finding(s) had no file/line and cannot be posted inline; ` +
          `they remain in the check run summary.`
      );
    }
    if (locatable.length === 0) {
      return;
    }

    const comments = locatable.slice(0, MAX_INLINE_COMMENTS).map((finding) => ({
      path: finding.file,
      line: finding.line,
      side: 'RIGHT',
      body: `**${severityLabel(finding.severity)}**: ${finding.message}`,
    }));
    if (locatable.length > MAX_INLINE_COMMENTS) {
      core.warning(
        `Only the first ${MAX_INLINE_COMMENTS} of ${locatable.length} inline comments were posted; ` +
          `all findings remain in the check run summary.`
      );
    }

    try {
      await this.octokit.rest.pulls.createReview({
        owner: this.ctx.repo.owner,
        repo: this.ctx.repo.repo,
        pull_number: prNumber,
        commit_id: this.headSha(),
        event: 'COMMENT',
        body: 'Specification alignment findings.',
        comments,
      });
    } catch (err) {
      core.warning(
        `Could not post inline review comments (findings are still reported as check run ` +
          `annotations): ${describeError(err)}`
      );
    }
  }

  /**
   * Approve the PR using a caller-supplied token.
   *
   * A separate token is required: GITHUB_TOKEN cannot approve pull requests,
   * and no token can approve a PR its own identity opened. Both rejections are
   * expected configurations rather than bugs, so they warn and no-op.
   */
  async approvePr(token: string): Promise<void> {
    const prNumber = this.prNumber();
    if (prNumber === undefined) {
      core.warning(
        `Skipping auto-approval: no pull request found in the '${this.ctx.eventName}' event payload.`
      );
      return;
    }

    try {
      await getOctokit(token).rest.pulls.createReview({
        owner: this.ctx.repo.owner,
        repo: this.ctx.repo.repo,
        pull_number: prNumber,
        event: 'APPROVE',
        body: 'Automatically approved: the diff is aligned with the configured source documents.',
      });
    } catch (err) {
      core.warning(
        `Auto-approval was skipped. The approval_token must be a PAT or GitHub App installation ` +
          `token with 'pull-requests: write' that did not author this PR; GITHUB_TOKEN cannot ` +
          `approve pull requests. ${describeError(err)}`
      );
    }
  }

  /** The commit the check and review comments attach to. */
  private headSha(): string {
    const prHeadSha = this.ctx.payload.pull_request?.head?.sha;
    // On `pull_request` events `context.sha` is the ephemeral merge commit, so
    // the PR head SHA is preferred whenever the payload carries one.
    return typeof prHeadSha === 'string' && prHeadSha.length > 0 ? prHeadSha : this.ctx.sha;
  }

  /** The pull request number, or undefined when not running against a PR. */
  private prNumber(): number | undefined {
    const number = this.ctx.payload.pull_request?.number;
    return typeof number === 'number' ? number : undefined;
  }

  private async findExistingCheckRunId(headSha: string): Promise<number | undefined> {
    try {
      const { data } = await this.octokit.rest.checks.listForRef({
        owner: this.ctx.repo.owner,
        repo: this.ctx.repo.repo,
        ref: headSha,
        check_name: CHECK_RUN_NAME,
        per_page: 100,
      });
      return data.check_runs[0]?.id;
    } catch (err) {
      // Listing is only an optimization; on failure fall through to creating a
      // new run, which is correct but may leave a duplicate check entry.
      core.debug(`Could not list existing check runs for ${headSha}: ${describeError(err)}`);
      return undefined;
    }
  }

  /**
   * Minimize prior summary comments from this action. Purely cosmetic, so
   * every failure mode here degrades to a log line rather than blocking the
   * new comment from being posted.
   */
  private async minimizePreviousComments(prNumber: number): Promise<void> {
    let previous: { node_id: string }[];
    try {
      previous = (
        await this.octokit.paginate(this.octokit.rest.issues.listComments, {
          owner: this.ctx.repo.owner,
          repo: this.ctx.repo.repo,
          issue_number: prNumber,
          per_page: 100,
        })
      ).filter((comment) => comment.body?.includes(COMMENT_MARKER));
    } catch (err) {
      core.warning(`Could not list previous comments to minimize: ${describeError(err)}`);
      return;
    }

    for (const comment of previous) {
      try {
        await this.octokit.graphql(
          `mutation ($subjectId: ID!) {
             minimizeComment(input: { subjectId: $subjectId, classifier: OUTDATED }) {
               minimizedComment { isMinimized }
             }
           }`,
          { subjectId: comment.node_id }
        );
      } catch (err) {
        const message = describeError(err);
        if (message.toLowerCase().includes('already minimized')) {
          core.debug(`Comment ${comment.node_id} was already minimized.`);
        } else {
          core.warning(`Could not minimize previous comment ${comment.node_id}: ${message}`);
        }
      }
    }
  }
}

/** Split an array into fixed-size chunks. Returns `[]` for empty input. */
export function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) {
    throw new Error(`chunkArray requires a positive size, received ${size}`);
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** A finding that can be placed at a specific line in a specific file. */
type LocatedFinding = Finding & { file: string; line: number };

function hasLocation(finding: Finding): finding is LocatedFinding {
  return (
    typeof finding.file === 'string' &&
    finding.file.length > 0 &&
    typeof finding.line === 'number' &&
    Number.isInteger(finding.line) &&
    finding.line >= 1
  );
}

/**
 * Build Check Run annotations from findings.
 *
 * Only located findings become annotations — the Checks API requires a path
 * and a line, and inventing line 1 for an unlocated finding would point the
 * reader at unrelated code. Unlocated findings are still reported in full via
 * the check output text.
 */
function buildAnnotations(findings: readonly Finding[]): CheckAnnotation[] {
  return findings.filter(hasLocation).map((finding) => ({
    path: finding.file,
    start_line: finding.line,
    end_line: finding.line,
    annotation_level: finding.severity,
    message: finding.message,
  }));
}

function severityLabel(severity: Finding['severity']): string {
  switch (severity) {
    case 'failure':
      return 'Failure';
    case 'warning':
      return 'Warning';
    case 'notice':
      return 'Notice';
  }
}

/** Markdown list of every finding, located or not. Used for check output text. */
function buildFindingsMarkdown(result: EvaluationResult): string {
  if (result.findings.length === 0) {
    return result.specSelfModified
      ? '_This pull request also modifies one of the source documents it is judged against._'
      : '_No specific findings were reported._';
  }

  const lines = ['### Findings', ''];
  for (const finding of result.findings) {
    const location = finding.file
      ? finding.line !== undefined
        ? ` \`${finding.file}:${finding.line}\``
        : ` \`${finding.file}\``
      : '';
    lines.push(`- **${severityLabel(finding.severity)}**${location} — ${finding.message}`);
  }

  if (result.specSelfModified) {
    lines.push('', '_This pull request also modifies one of the source documents it is judged against._');
  }
  return lines.join('\n');
}

/** Full PR summary comment body (marker is prepended by the caller). */
function buildCommentMarkdown(result: EvaluationResult): string {
  return [
    `## Spec alignment: ${CHECK_TITLES[result.verdict]}`,
    '',
    result.summary,
    '',
    buildFindingsMarkdown(result),
  ].join('\n');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const suffix = '\n\n_(truncated)_';
  return `${text.slice(0, max - suffix.length)}${suffix}`;
}

/** True for HTTP statuses that mean "this token may not do that". */
function isPermissionError(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  return status === 401 || status === 403;
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    const status = (err as { status?: unknown }).status;
    return typeof status === 'number' ? `HTTP ${status}: ${err.message}` : err.message;
  }
  return String(err);
}

/**
 * Factory for the GitHub client.
 *
 * @param options.token   Token for checks/comments/reviews. Defaults to `$GITHUB_TOKEN`.
 * @param options.context Actions context. Defaults to the ambient one.
 * @throws if no token is available — every method needs one, so failing here
 *         surfaces the misconfiguration before any work is done.
 */
export function createGithubClient(options: GithubClientOptions = {}): GithubClient {
  const token = options.token ?? process.env['GITHUB_TOKEN'];
  if (token === undefined || token.length === 0) {
    throw new Error(
      'A GitHub token is required to report results. Set the GITHUB_TOKEN environment variable ' +
        "in the workflow step (env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}), and grant the job " +
        "'checks: write' and 'pull-requests: write' permissions."
    );
  }
  return new RealGithubClient(token, options.context ?? ambientContext);
}
