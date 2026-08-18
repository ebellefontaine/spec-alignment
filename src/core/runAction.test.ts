import { describe, expect, it, vi } from 'vitest';
import { runAction } from './runAction.js';
import type { Adapters, Config, DiffFile, JudgeResult, SourceDocument } from './types.js';

function baseConfig(overrides: Partial<Config> = {}): Config {
  return {
    provider: 'anthropic',
    apiKey: 'key',
    sourceDocuments: [{ convention: 'domain-modeling' }],
    strictness: 'balanced',
    immutableSpec: false,
    commentOnPr: true,
    inlineReviewComments: false,
    excludePaths: [],
    bypassLabel: 'spec-check:skip',
    failClosedOnError: false,
    autoApprove: false,
    isDraft: false,
    prLabels: [],
    fileTree: ['CONTEXT.md', 'src/app.ts'],
    ...overrides,
  };
}

function fakeAdapters(overrides: Partial<Adapters> = {}): Adapters {
  return {
    getDiff: vi.fn(async () => [{ path: 'src/app.ts', status: 'modified', patch: '+ change' }] satisfies DiffFile[]),
    readSourceDocument: vi.fn(async () => [
      { convention: 'domain-modeling', path: 'CONTEXT.md', content: '# Glossary' },
    ] satisfies SourceDocument[]),
    llmJudge: {
      judge: vi.fn(async () => ({
        verdict: 'pass',
        summary: 'all good',
        findings: [],
        specSelfModified: false,
      } satisfies JudgeResult)),
      filterRelevance: vi.fn(async () => ({ selectedSourceDocumentPaths: ['CONTEXT.md'] })),
    },
    githubClient: {
      upsertCheckRun: vi.fn(async () => {}),
      upsertPrComment: vi.fn(async () => {}),
      postInlineReviewComments: vi.fn(async () => {}),
      approvePr: vi.fn(async () => {}),
    },
    ...overrides,
  };
}

describe('runAction', () => {
  it('short-circuits to skip without calling the LLM when a skip condition is hit', async () => {
    const adapters = fakeAdapters();
    const result = await runAction(adapters, baseConfig({ isDraft: true }));
    expect(result.verdict).toBe('skip');
    expect(adapters.llmJudge.judge).not.toHaveBeenCalled();
    expect(adapters.githubClient.upsertCheckRun).toHaveBeenCalledTimes(1);
  });

  it('short-circuits to skip when no source documents are found on disk', async () => {
    const adapters = fakeAdapters({ readSourceDocument: vi.fn(async () => []) });
    const result = await runAction(adapters, baseConfig());
    expect(result.verdict).toBe('skip');
    expect(result.summary).toContain('No source documents found');
    expect(adapters.llmJudge.judge).not.toHaveBeenCalled();
  });

  it('fails via the deterministic immutable_spec pre-check without calling the LLM', async () => {
    const adapters = fakeAdapters({
      getDiff: vi.fn(async (): Promise<DiffFile[]> => [{ path: 'CONTEXT.md', status: 'modified', patch: '+ change' }]),
    });
    const result = await runAction(adapters, baseConfig({ immutableSpec: true }));
    expect(result.verdict).toBe('fail');
    expect(result.summary).toContain('CONTEXT.md');
    expect(adapters.llmJudge.judge).not.toHaveBeenCalled();
  });

  it('does not trip the immutable_spec check when the toggle is off, even if the spec changed', async () => {
    const adapters = fakeAdapters({
      getDiff: vi.fn(async (): Promise<DiffFile[]> => [{ path: 'CONTEXT.md', status: 'modified', patch: '+ change' }]),
    });
    const result = await runAction(adapters, baseConfig({ immutableSpec: false }));
    expect(result.verdict).toBe('pass');
    expect(adapters.llmJudge.judge).toHaveBeenCalledTimes(1);
  });

  it('runs the normal judge flow and writes back a pass result', async () => {
    const adapters = fakeAdapters();
    const result = await runAction(adapters, baseConfig());
    expect(result).toEqual({ verdict: 'pass', summary: 'all good', findings: [], specSelfModified: false });
    expect(adapters.githubClient.upsertCheckRun).toHaveBeenCalledWith(result, false);
    expect(adapters.githubClient.upsertPrComment).toHaveBeenCalledTimes(1);
  });

  it('writes back a fail result with findings and posts inline review comments when enabled', async () => {
    const failJudge: JudgeResult = {
      verdict: 'fail',
      summary: 'contradicts the spec',
      findings: [{ file: 'src/app.ts', line: 3, message: 'removes required validation', severity: 'failure' }],
      specSelfModified: false,
    };
    const adapters = fakeAdapters({ llmJudge: { judge: vi.fn(async () => failJudge), filterRelevance: vi.fn() } });
    const result = await runAction(adapters, baseConfig({ inlineReviewComments: true }));
    expect(result.verdict).toBe('fail');
    expect(adapters.githubClient.postInlineReviewComments).toHaveBeenCalledWith(result);
  });

  it('does not post inline review comments when disabled, even on fail', async () => {
    const failJudge: JudgeResult = { verdict: 'fail', summary: 'no', findings: [{ message: 'bad', severity: 'failure' }], specSelfModified: false };
    const adapters = fakeAdapters({ llmJudge: { judge: vi.fn(async () => failJudge), filterRelevance: vi.fn() } });
    const result = await runAction(adapters, baseConfig({ inlineReviewComments: false }));
    expect(result.verdict).toBe('fail');
    expect(adapters.githubClient.postInlineReviewComments).not.toHaveBeenCalled();
  });

  it('maps an LLM judge failure to an error verdict and still writes back (fail-open by default)', async () => {
    const adapters = fakeAdapters({
      llmJudge: { judge: vi.fn(async () => { throw new Error('provider timeout'); }), filterRelevance: vi.fn() },
    });
    const result = await runAction(adapters, baseConfig());
    expect(result.verdict).toBe('error');
    expect(result.summary).toContain('provider timeout');
    expect(adapters.githubClient.upsertCheckRun).toHaveBeenCalledWith(result, false);
  });

  it('passes failClosedOnError through to upsertCheckRun so the adapter can map it to failure', async () => {
    const adapters = fakeAdapters({
      llmJudge: { judge: vi.fn(async () => { throw new Error('provider timeout'); }), filterRelevance: vi.fn() },
    });
    const result = await runAction(adapters, baseConfig({ failClosedOnError: true }));
    expect(adapters.githubClient.upsertCheckRun).toHaveBeenCalledWith(result, true);
  });

  it('auto-approves only when auto_approve is on, a token is set, and the verdict is exactly pass', async () => {
    const adapters = fakeAdapters();
    await runAction(adapters, baseConfig({ autoApprove: true, approvalToken: 'tok' }));
    expect(adapters.githubClient.approvePr).toHaveBeenCalledWith('tok');
  });

  it('does not auto-approve a pass_with_drift verdict', async () => {
    const driftJudge: JudgeResult = { verdict: 'pass_with_drift', summary: 'drift', findings: [], specSelfModified: false };
    const adapters = fakeAdapters({ llmJudge: { judge: vi.fn(async () => driftJudge), filterRelevance: vi.fn() } });
    await runAction(adapters, baseConfig({ autoApprove: true, approvalToken: 'tok' }));
    expect(adapters.githubClient.approvePr).not.toHaveBeenCalled();
  });

  it('does not auto-approve when auto_approve is off', async () => {
    const adapters = fakeAdapters();
    await runAction(adapters, baseConfig({ autoApprove: false }));
    expect(adapters.githubClient.approvePr).not.toHaveBeenCalled();
  });

  it('escalates to an LLM relevance-filter pass when the deterministic filter is still over budget, then proceeds', async () => {
    // Sized so the full set (100k + 100k + 500k chars = 175,000 estimated tokens) exceeds the
    // 150,000 token budget and the deterministic filter can't narrow it (no path overlap between
    // 'src/app.ts' and either doc), but the LLM-selected single doc (100k + 100k chars = 50,000
    // estimated tokens) comfortably fits — so the judge call is actually reached.
    const bigPatch = 'x'.repeat(100_000);
    const adapters = fakeAdapters({
      getDiff: vi.fn(async (): Promise<DiffFile[]> => [{ path: 'src/app.ts', status: 'modified', patch: bigPatch }]),
      readSourceDocument: vi.fn(async (): Promise<SourceDocument[]> => [
        { convention: 'domain-modeling', path: 'CONTEXT.md', content: 'y'.repeat(100_000) },
        { convention: 'domain-modeling', path: 'docs/adr/0001.md', content: 'z'.repeat(500_000) },
      ]),
    });
    const result = await runAction(adapters, baseConfig());
    expect(adapters.llmJudge.filterRelevance).toHaveBeenCalledTimes(1);
    expect(result.verdict).toBe('pass');
  });

  it('produces an error verdict when still over budget after the LLM filter fallback', async () => {
    const bigPatch = 'x'.repeat(1_000_000);
    const adapters = fakeAdapters({
      getDiff: vi.fn(async (): Promise<DiffFile[]> => [{ path: 'src/app.ts', status: 'modified', patch: bigPatch }]),
      readSourceDocument: vi.fn(async (): Promise<SourceDocument[]> => [
        { convention: 'domain-modeling', path: 'CONTEXT.md', content: 'y'.repeat(1_000_000) },
      ]),
      llmJudge: {
        judge: vi.fn(),
        filterRelevance: vi.fn(async () => ({ selectedSourceDocumentPaths: ['CONTEXT.md'] })),
      },
    });
    const result = await runAction(adapters, baseConfig());
    expect(result.verdict).toBe('error');
    expect(result.summary).toContain('too large');
    expect(adapters.llmJudge.judge).not.toHaveBeenCalled();
  });
});
