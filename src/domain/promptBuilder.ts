import type { DiffFile, SourceDocument, Strictness } from '../core/types.js';

const STRICTNESS_INSTRUCTIONS: Record<Strictness, string> = {
  strict:
    'Treat any code addition or behavior not described by the source documents as a failure, even if it does not contradict them directly.',
  balanced:
    'Treat additions that go beyond the source documents as drift worth noting, but only fail the PR when it contradicts or removes something the source documents require.',
  lenient:
    'Only fail the PR when it directly contradicts the source documents. Do not flag additions or extensions as drift unless they conflict with stated requirements.',
};

export function buildJudgePrompt(
  diffFiles: DiffFile[],
  sourceDocuments: SourceDocument[],
  strictness: Strictness,
  fileTree: string[]
): string {
  const docsSection = sourceDocuments
    .map((doc) => `### ${doc.path} (${doc.convention})\n\n${doc.content}`)
    .join('\n\n');
  const diffSection = diffFiles.map((file) => `### ${file.path} (${file.status})\n\n${file.patch}`).join('\n\n');

  return [
    "You are reviewing a pull request diff against a project's source-of-truth documents.",
    STRICTNESS_INSTRUCTIONS[strictness],
    'If multiple source documents disagree with each other, note the disagreement as a finding rather than silently picking one.',
    '',
    '## Repository file tree (for navigation only, not authoritative content)',
    fileTree.join('\n'),
    '',
    '## Source-of-truth documents',
    docsSection,
    '',
    '## Pull request diff',
    diffSection,
    '',
    'Return a verdict of "pass", "pass_with_drift", or "fail". Set specSelfModified to true if the diff itself modifies one of the source-of-truth documents listed above. List findings with file/line where identifiable.',
  ].join('\n');
}

export function buildFilterPrompt(diffFiles: DiffFile[], sourceDocuments: SourceDocument[]): string {
  const docSummaries = sourceDocuments
    .map((doc) => `- ${doc.path}: ${extractHeadings(doc.content).join(', ') || '(no headings found)'}`)
    .join('\n');
  const diffPaths = diffFiles.map((file) => `- ${file.path}`).join('\n');

  return [
    'A pull request is too large to check against every source document in full.',
    'Given the changed files below and a summary of each source document, select only the source documents plausibly relevant to these changes.',
    '',
    '## Changed files',
    diffPaths,
    '',
    '## Source documents (path: headings)',
    docSummaries,
    '',
    'Return the list of source document paths to keep.',
  ].join('\n');
}

function extractHeadings(content: string): string[] {
  return content
    .split('\n')
    .filter((line) => /^#{1,6}\s/.test(line))
    .map((line) => line.replace(/^#{1,6}\s/, '').trim());
}
