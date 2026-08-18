import { describe, expect, it } from 'vitest';
import { estimateTokens, filterByRelevance } from './relevanceFilter.js';
import type { DiffFile, SourceDocument } from '../core/types.js';

describe('estimateTokens', () => {
  it('estimates roughly 4 characters per token across diff and doc content', () => {
    const diffFiles: DiffFile[] = [{ path: 'a.ts', status: 'modified', patch: 'x'.repeat(400) }];
    const docs: SourceDocument[] = [{ convention: 'other', path: 'SYSTEM.md', content: 'y'.repeat(400) }];
    expect(estimateTokens(diffFiles, docs)).toBe(200);
  });
});

describe('filterByRelevance', () => {
  it('returns everything unfiltered when already within budget', () => {
    const diffFiles: DiffFile[] = [{ path: 'src/a.ts', status: 'modified', patch: 'small' }];
    const docs: SourceDocument[] = [{ convention: 'other', path: 'SYSTEM.md', content: 'small' }];
    const result = filterByRelevance(diffFiles, docs, 1_000_000);
    expect(result).toEqual({ diffFiles, sourceDocuments: docs, withinBudget: true });
  });

  it('narrows to documents sharing a directory/path segment with changed files when over budget', () => {
    const bigPatch = 'x'.repeat(1000);
    const diffFiles: DiffFile[] = [{ path: 'src/billing/invoice.ts', status: 'modified', patch: bigPatch }];
    const docs: SourceDocument[] = [
      { convention: 'domain-modeling', path: 'src/billing/CONTEXT.md', content: 'y'.repeat(1000) },
      { convention: 'domain-modeling', path: 'src/shipping/CONTEXT.md', content: 'z'.repeat(1000) },
    ];
    const result = filterByRelevance(diffFiles, docs, 300);
    expect(result.sourceDocuments).toEqual([docs[0]]);
  });

  it('falls back to the full document set when nothing shares a path segment', () => {
    const bigPatch = 'x'.repeat(1000);
    const diffFiles: DiffFile[] = [{ path: 'src/billing/invoice.ts', status: 'modified', patch: bigPatch }];
    const docs: SourceDocument[] = [{ convention: 'other', path: 'unrelated/dir/SYSTEM.md', content: 'z'.repeat(1000) }];
    const result = filterByRelevance(diffFiles, docs, 300);
    expect(result.sourceDocuments).toEqual(docs);
    expect(result.withinBudget).toBe(false);
  });

  it('reports withinBudget false when even the narrowed set exceeds the budget', () => {
    const bigPatch = 'x'.repeat(10_000);
    const diffFiles: DiffFile[] = [{ path: 'src/billing/invoice.ts', status: 'modified', patch: bigPatch }];
    const docs: SourceDocument[] = [{ convention: 'domain-modeling', path: 'src/billing/CONTEXT.md', content: 'y'.repeat(10_000) }];
    const result = filterByRelevance(diffFiles, docs, 100);
    expect(result.withinBudget).toBe(false);
  });
});
