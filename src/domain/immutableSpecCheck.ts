import { minimatch } from 'minimatch';
import type { DiffFile } from '../core/types.js';

export function findImmutableSpecViolation(diffFiles: DiffFile[], sourceDocumentGlobs: string[]): string[] {
  return diffFiles
    .map((file) => file.path)
    .filter((path) => sourceDocumentGlobs.some((glob) => minimatch(path, glob)));
}
