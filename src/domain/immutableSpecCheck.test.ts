import { describe, expect, it } from 'vitest';
import { findImmutableSpecViolation } from './immutableSpecCheck.js';
import type { DiffFile } from '../core/types.js';

describe('findImmutableSpecViolation', () => {
  it('returns an empty array when the diff does not touch any source document path', () => {
    const diffFiles: DiffFile[] = [{ path: 'src/app.ts', status: 'modified', patch: '' }];
    expect(findImmutableSpecViolation(diffFiles, ['CONTEXT.md', 'docs/adr/**'])).toEqual([]);
  });

  it('returns the touched paths when the diff modifies a source document', () => {
    const diffFiles: DiffFile[] = [
      { path: 'src/app.ts', status: 'modified', patch: '' },
      { path: 'CONTEXT.md', status: 'modified', patch: '' },
    ];
    expect(findImmutableSpecViolation(diffFiles, ['CONTEXT.md', 'docs/adr/**'])).toEqual(['CONTEXT.md']);
  });

  it('matches glob patterns, not just exact paths', () => {
    const diffFiles: DiffFile[] = [{ path: 'docs/adr/0001-decision.md', status: 'added', patch: '' }];
    expect(findImmutableSpecViolation(diffFiles, ['docs/adr/**'])).toEqual(['docs/adr/0001-decision.md']);
  });
});
