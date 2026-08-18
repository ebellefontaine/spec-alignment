import { describe, expect, it } from 'vitest';
import { decideDiscovery } from './discovery.js';
import type { Config, DiffFile } from '../core/types.js';

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
    fileTree: [],
    ...overrides,
  };
}

const oneDiffFile: DiffFile[] = [{ path: 'src/app.ts', status: 'modified', patch: '+ change' }];

describe('decideDiscovery', () => {
  it('skips draft PRs', () => {
    const result = decideDiscovery(baseConfig({ isDraft: true }), oneDiffFile);
    expect(result).toEqual({ skip: true, skipReason: 'PR is a draft' });
  });

  it('skips when the bypass label is present', () => {
    const result = decideDiscovery(baseConfig({ prLabels: ['spec-check:skip'] }), oneDiffFile);
    expect(result).toEqual({ skip: true, skipReason: 'PR has the bypass label "spec-check:skip"' });
  });

  it('skips when no source_documents are configured', () => {
    const result = decideDiscovery(baseConfig({ sourceDocuments: [] }), oneDiffFile);
    expect(result).toEqual({ skip: true, skipReason: 'No source_documents configured' });
  });

  it('skips when the diff only touches excluded paths', () => {
    const result = decideDiscovery(
      baseConfig({ excludePaths: ['**/*.lock'] }),
      [{ path: 'package-lock.lock', status: 'modified', patch: '+ change' }]
    );
    expect(result).toEqual({ skip: true, skipReason: 'PR only touches excluded paths' });
  });

  it('does not skip when at least one changed file is not excluded', () => {
    const result = decideDiscovery(
      baseConfig({ excludePaths: ['**/*.lock'] }),
      [
        { path: 'package-lock.lock', status: 'modified', patch: '+ change' },
        { path: 'src/app.ts', status: 'modified', patch: '+ change' },
      ]
    );
    expect(result.skip).toBe(false);
  });

  it('resolves documentsToRead from every configured entry', () => {
    const result = decideDiscovery(
      baseConfig({ sourceDocuments: [{ convention: 'domain-modeling' }, { convention: 'other', explicitPath: 'PRD.md' }] }),
      oneDiffFile
    );
    expect(result).toEqual({
      skip: false,
      documentsToRead: [
        { convention: 'domain-modeling', glob: 'CONTEXT.md' },
        { convention: 'domain-modeling', glob: 'docs/adr/**' },
        { convention: 'other', glob: 'PRD.md' },
      ],
    });
  });
});
