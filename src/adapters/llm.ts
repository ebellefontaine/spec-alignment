import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { APICallError, generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import type {
  Finding,
  FilterRequest,
  FilterSelection,
  JudgeRequest,
  JudgeResult,
  LlmJudgeAdapter,
  Provider,
} from '../core/types.js';

/**
 * Default model per provider, used when `model` is not configured.
 * Kept in one place so action.yml's "per-provider default" promise has a
 * single source of truth.
 */
const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-opus-5',
  openai: 'gpt-5.6',
  google: 'gemini-pro-latest',
  openrouter: 'openai/gpt-4-turbo',
};

/** Total attempts (initial call + retries) for a transient failure. */
const MAX_ATTEMPTS = 3;

/** Base delay for exponential backoff: 1s, then 2s, then 4s. */
const BASE_RETRY_DELAY_MS = 1_000;

/**
 * Structured verdict returned by the judge call.
 *
 * `file`/`line` are nullable rather than optional: some providers reject
 * JSON schemas with optional properties under strict structured output, so
 * the model is required to emit the key and use `null` when it cannot
 * attribute a finding to a specific location.
 */
const FindingSchema = z.object({
  file: z.string().nullable().describe('Repository-relative path the finding applies to, or null.'),
  line: z.number().int().nullable().describe('Line number within the file, or null.'),
  message: z.string().describe('What drifted from the source-of-truth documents.'),
  severity: z.enum(['notice', 'warning', 'failure']),
});

const VerdictSchema = z.object({
  verdict: z.enum(['pass', 'pass_with_drift', 'fail']),
  summary: z.string().describe('Reasoning for the verdict, written for a PR author.'),
  findings: z.array(FindingSchema),
  specSelfModified: z
    .boolean()
    .describe('True when the diff modifies one of the source-of-truth documents it is judged against.'),
});

const FilterSelectionSchema = z.object({
  selectedSourceDocumentPaths: z
    .array(z.string())
    .describe('Paths of the source documents to keep, copied verbatim from the provided list.'),
});

/**
 * RealLlmJudgeAdapter: Runs the spec-alignment judgment and the relevance
 * filtering fallback against a configured LLM provider.
 *
 * Every call goes through `withRetry`, which retries only transient
 * failures (rate limits, timeouts, connection errors, 5xx). Provider
 * retries are disabled (`maxRetries: 0`) so this loop is the only place
 * that decides how many times a request is issued.
 */
class RealLlmJudgeAdapter implements LlmJudgeAdapter {
  async judge(request: JudgeRequest): Promise<JudgeResult> {
    const model = resolveModel(request.provider, request.apiKey, request.model);

    const { object } = await withRetry(() =>
      generateObject({
        model,
        schema: VerdictSchema,
        prompt: request.prompt,
        maxRetries: 0,
      })
    );

    return {
      verdict: object.verdict,
      summary: object.summary,
      findings: object.findings.map(toFinding),
      specSelfModified: object.specSelfModified,
    };
  }

  async filterRelevance(request: FilterRequest): Promise<FilterSelection> {
    const model = resolveModel(request.provider, request.apiKey, request.model);

    const { object } = await withRetry(() =>
      generateObject({
        model,
        schema: FilterSelectionSchema,
        prompt: request.prompt,
        maxRetries: 0,
      })
    );

    return { selectedSourceDocumentPaths: object.selectedSourceDocumentPaths };
  }
}

/**
 * Converts a schema finding into the domain `Finding`, dropping the nulls
 * the schema requires the model to emit.
 */
function toFinding(raw: z.infer<typeof FindingSchema>): Finding {
  const finding: Finding = { message: raw.message, severity: raw.severity };
  if (raw.file !== null) {
    finding.file = raw.file;
  }
  if (raw.line !== null) {
    finding.line = raw.line;
  }
  return finding;
}

/**
 * Instantiates a language model for the configured provider.
 *
 * The API key is passed explicitly rather than read from the ambient
 * environment: the action receives it as an input, and a run only ever has
 * one provider credential available.
 */
function resolveModel(provider: Provider, apiKey: string, modelId?: string): LanguageModel {
  const resolvedModelId = modelId ?? DEFAULT_MODELS[provider];

  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(resolvedModelId);
    case 'openai':
      return createOpenAI({ apiKey })(resolvedModelId);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(resolvedModelId);
    case 'openrouter':
      return createOpenRouter({ apiKey })(resolvedModelId);
  }
}

/**
 * Runs `operation`, retrying transient failures with exponential backoff.
 * Non-transient failures (bad API key, malformed request, schema violation)
 * are rethrown immediately so the caller reports them without delay.
 */
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === MAX_ATTEMPTS - 1;
      if (isLastAttempt || !isTransientError(error)) {
        throw error;
      }
      await sleep(BASE_RETRY_DELAY_MS * 2 ** attempt);
    }
  }

  throw lastError;
}

const TRANSIENT_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

/**
 * Classifies an error as worth retrying: rate limits (429), request
 * timeouts (408), conflicts (409), server errors (5xx), and connection-level
 * failures. Anything else — 401, 403, 400, schema validation — is permanent
 * for the lifetime of this run and retrying only burns time.
 *
 * Auth errors (401/403) are logged as warnings to help debugging provider
 * credential issues per SYSTEM.md error handling requirements.
 */
function isTransientError(error: unknown): boolean {
  if (APICallError.isInstance(error)) {
    if (error.isRetryable) {
      return true;
    }
    const status = error.statusCode;
    if (status !== undefined) {
      // Auth errors: permanent, but worth logging explicitly
      if (status === 401 || status === 403) {
        console.warn(`Provider authentication failed (HTTP ${status}). Check api_key and provider configuration.`);
        return false;
      }
      return status === 408 || status === 409 || status === 429 || status >= 500;
    }
  }

  if (hasTransientErrorCode(error)) {
    return true;
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return true;
    }
    if (/\btimed? ?out\b/i.test(error.message)) {
      return true;
    }
    if (error.cause !== undefined && error.cause !== error) {
      return isTransientError(error.cause);
    }
  }

  return false;
}

function hasTransientErrorCode(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  const code = (error as { code: unknown }).code;
  return typeof code === 'string' && TRANSIENT_ERROR_CODES.has(code);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Factory function to create an LlmJudgeAdapter instance.
 *
 * Provider, model, and API key are supplied per request (they come from the
 * action's inputs and travel with `JudgeRequest`/`FilterRequest`), so the
 * adapter itself is stateless.
 */
export function createLlmJudgeAdapter(): LlmJudgeAdapter {
  return new RealLlmJudgeAdapter();
}

export { DEFAULT_MODELS };
