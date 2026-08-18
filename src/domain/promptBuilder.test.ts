import { describe, expect, it } from 'vitest';
import { buildFilterPrompt, buildJudgePrompt } from './promptBuilder.js';
import type { DiffFile, SourceDocument } from '../core/types.js';

const diffFiles: DiffFile[] = [{ path: 'src/app.ts', status: 'modified', patch: '+ added a line' }];
const docs: SourceDocument[] = [{ convention: 'domain-modeling', path: 'CONTEXT.md', content: '# Glossary\n\nWidget: a thing.' }];

describe('buildJudgePrompt', () => {
  it('includes the diff, the document content, the file tree, and a strictness-specific instruction', () => {
    const prompt = buildJudgePrompt(diffFiles, docs, 'strict', ['src/app.ts', 'CONTEXT.md']);
    expect(prompt).toContain('src/app.ts');
    expect(prompt).toContain('+ added a line');
    expect(prompt).toContain('CONTEXT.md');
    expect(prompt).toContain('# Glossary');
    expect(prompt).toContain('even if it does not contradict them directly');
  });

  it('uses a different instruction per strictness level', () => {
    const strict = buildJudgePrompt(diffFiles, docs, 'strict', []);
    const lenient = buildJudgePrompt(diffFiles, docs, 'lenient', []);
    expect(strict).not.toEqual(lenient);
    expect(lenient).toContain('directly contradicts');
  });

  it('instructs the model to surface disagreement between multiple documents rather than resolve it', () => {
    const prompt = buildJudgePrompt(diffFiles, docs, 'balanced', []);
    expect(prompt).toContain('note the disagreement as a finding');
  });
});

describe('buildFilterPrompt', () => {
  it('includes changed file paths and a heading-level summary of each document', () => {
    const prompt = buildFilterPrompt(diffFiles, docs);
    expect(prompt).toContain('src/app.ts');
    expect(prompt).toContain('CONTEXT.md: Glossary');
  });

  it('does not include full document content, only headings', () => {
    const prompt = buildFilterPrompt(diffFiles, docs);
    expect(prompt).not.toContain('Widget: a thing.');
  });
});
