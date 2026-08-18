import { describe, expect, it } from 'vitest';
import { parseSourceDocumentEntry, parseSourceDocumentsInput, resolveGlobs } from './conventions.js';

describe('parseSourceDocumentEntry', () => {
  it('parses a bare convention name', () => {
    expect(parseSourceDocumentEntry('speckit')).toEqual({ convention: 'speckit' });
  });

  it('parses a convention with an explicit path override', () => {
    expect(parseSourceDocumentEntry('speckit - my/custom/path')).toEqual({
      convention: 'speckit',
      explicitPath: 'my/custom/path',
    });
  });

  it('parses "Other - <path>" case-insensitively on the keyword', () => {
    expect(parseSourceDocumentEntry('Other - SYSTEM.md')).toEqual({
      convention: 'other',
      explicitPath: 'SYSTEM.md',
    });
  });

  it('throws when "Other" has no path', () => {
    expect(() => parseSourceDocumentEntry('Other')).toThrow(/requires a path/);
  });

  it('throws on an unknown convention name', () => {
    expect(() => parseSourceDocumentEntry('not-a-real-convention')).toThrow(/Unknown source_documents convention/);
  });
});

describe('parseSourceDocumentsInput', () => {
  it('parses multiple newline-delimited entries, skipping blank lines', () => {
    const input = 'speckit\n\nOther - PRD.md\n  openspec  ';
    expect(parseSourceDocumentsInput(input)).toEqual([
      { convention: 'speckit' },
      { convention: 'other', explicitPath: 'PRD.md' },
      { convention: 'openspec' },
    ]);
  });

  it('returns an empty array for blank input', () => {
    expect(parseSourceDocumentsInput('   \n  \n')).toEqual([]);
  });
});

describe('resolveGlobs', () => {
  it('returns built-in defaults for a bare convention', () => {
    expect(resolveGlobs({ convention: 'domain-modeling' })).toEqual(['CONTEXT.md', 'docs/adr/**']);
  });

  it('returns the explicit path override instead of defaults when present', () => {
    expect(resolveGlobs({ convention: 'speckit', explicitPath: 'my/custom/path' })).toEqual(['my/custom/path']);
  });

  it('returns the explicit path for "other"', () => {
    expect(resolveGlobs({ convention: 'other', explicitPath: 'SYSTEM.md' })).toEqual(['SYSTEM.md']);
  });

  it('includes the openspec changes-delta glob by default', () => {
    expect(resolveGlobs({ convention: 'openspec' })).toEqual(['openspec/specs/**', 'openspec/changes/*/specs/**']);
  });
});
