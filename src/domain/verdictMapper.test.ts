// src/domain/verdictMapper.test.ts
import { describe, expect, it } from 'vitest';
import {
  errorResult,
  immutableSpecViolationResult,
  mapJudgeResultToEvaluation,
  mapVerdictToConclusion,
  skipResult,
} from './verdictMapper.js';
import type { JudgeResult } from '../core/types.js';

describe('mapJudgeResultToEvaluation', () => {
  it('carries the judge result through unchanged in shape', () => {
    const judgeResult: JudgeResult = {
      verdict: 'pass_with_drift',
      summary: 'looks fine, minor drift',
      findings: [{ message: 'unused export added', severity: 'notice' }],
      specSelfModified: false,
    };
    expect(mapJudgeResultToEvaluation(judgeResult)).toEqual(judgeResult);
  });
});

describe('skipResult', () => {
  it('produces a skip verdict with the given reason as the summary', () => {
    expect(skipResult('PR is a draft')).toEqual({
      verdict: 'skip',
      summary: 'PR is a draft',
      findings: [],
      specSelfModified: false,
    });
  });
});

describe('immutableSpecViolationResult', () => {
  it('produces a fail verdict naming the touched paths', () => {
    const result = immutableSpecViolationResult(['CONTEXT.md']);
    expect(result.verdict).toBe('fail');
    expect(result.summary).toContain('CONTEXT.md');
    expect(result.specSelfModified).toBe(true);
  });
});

describe('errorResult', () => {
  it('produces an error verdict with the given message', () => {
    expect(errorResult('provider timed out')).toEqual({
      verdict: 'error',
      summary: 'provider timed out',
      findings: [],
      specSelfModified: false,
    });
  });
});

describe('mapVerdictToConclusion', () => {
  it('maps pass and pass_with_drift to success', () => {
    expect(mapVerdictToConclusion('pass', false)).toBe('success');
    expect(mapVerdictToConclusion('pass_with_drift', false)).toBe('success');
  });

  it('maps fail to failure', () => {
    expect(mapVerdictToConclusion('fail', false)).toBe('failure');
  });

  it('maps skip to skipped', () => {
    expect(mapVerdictToConclusion('skip', false)).toBe('skipped');
  });

  it('maps error to neutral by default (fail-open)', () => {
    expect(mapVerdictToConclusion('error', false)).toBe('neutral');
  });

  it('maps error to failure when failClosedOnError is true', () => {
    expect(mapVerdictToConclusion('error', true)).toBe('failure');
  });
});
