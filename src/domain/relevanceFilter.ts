import type { DiffFile, SourceDocument } from '../core/types.js';

export interface RelevanceFilterResult {
  diffFiles: DiffFile[];
  sourceDocuments: SourceDocument[];
  withinBudget: boolean;
}

const CHARS_PER_TOKEN_ESTIMATE = 4;

export function estimateTokens(diffFiles: DiffFile[], sourceDocuments: SourceDocument[]): number {
  const diffChars = diffFiles.reduce((sum, file) => sum + file.patch.length, 0);
  const docChars = sourceDocuments.reduce((sum, doc) => sum + doc.content.length, 0);
  return Math.ceil((diffChars + docChars) / CHARS_PER_TOKEN_ESTIMATE);
}

export function filterByRelevance(
  diffFiles: DiffFile[],
  sourceDocuments: SourceDocument[],
  tokenBudget: number
): RelevanceFilterResult {
  const fullEstimate = estimateTokens(diffFiles, sourceDocuments);
  if (fullEstimate <= tokenBudget) {
    return { diffFiles, sourceDocuments, withinBudget: true };
  }

  const changedDirs = diffFiles.map((file) => dirname(file.path));
  const relevantDocs = sourceDocuments.filter((doc) => {
    const docDir = dirname(doc.path);
    return changedDirs.some((dir) => dir.startsWith(docDir) || docDir.startsWith(dir));
  });
  const narrowedDocs = relevantDocs.length > 0 ? relevantDocs : sourceDocuments;
  const narrowedEstimate = estimateTokens(diffFiles, narrowedDocs);

  return {
    diffFiles,
    sourceDocuments: narrowedDocs,
    withinBudget: narrowedEstimate <= tokenBudget,
  };
}

function dirname(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '.' : path.slice(0, idx);
}
