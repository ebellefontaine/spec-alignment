import type { EvaluationResult, JudgeResult, Verdict } from '../core/types.js';

export type CheckConclusion = 'success' | 'failure' | 'neutral' | 'skipped';

export function mapJudgeResultToEvaluation(judgeResult: JudgeResult): EvaluationResult {
  return {
    verdict: judgeResult.verdict,
    summary: judgeResult.summary,
    findings: judgeResult.findings,
    specSelfModified: judgeResult.specSelfModified,
  };
}

export function skipResult(reason: string): EvaluationResult {
  return { verdict: 'skip', summary: reason, findings: [], specSelfModified: false };
}

export function immutableSpecViolationResult(touchedPaths: string[]): EvaluationResult {
  return {
    verdict: 'fail',
    summary: `This PR modifies both code and a configured source document (${touchedPaths.join(', ')}), but immutable_spec is enabled. Spec changes must land in a separate PR.`,
    findings: [],
    specSelfModified: true,
  };
}

export function errorResult(message: string): EvaluationResult {
  return { verdict: 'error', summary: message, findings: [], specSelfModified: false };
}

export function mapVerdictToConclusion(verdict: Verdict, failClosedOnError: boolean): CheckConclusion {
  switch (verdict) {
    case 'pass':
    case 'pass_with_drift':
      return 'success';
    case 'fail':
      return 'failure';
    case 'skip':
      return 'skipped';
    case 'error':
      return failClosedOnError ? 'failure' : 'neutral';
  }
}
