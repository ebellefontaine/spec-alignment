import { minimatch } from 'minimatch';
import * as core from '@actions/core';
import type { Config, ConventionName, DiffFile } from '../core/types.js';
import { resolveGlobs } from './conventions.js';

export type DiscoveryDecision =
  | { skip: true; skipReason: string }
  | { skip: false; documentsToRead: { convention: ConventionName; glob: string }[] };

export function decideDiscovery(config: Config, diffFiles: DiffFile[]): DiscoveryDecision {
  if (config.skipDrafts && config.isDraft) {
    core.debug('Skipping spec-alignment check: PR is in draft state (skip_drafts=true)');
    return { skip: true, skipReason: 'PR is a draft' };
  }
  if (config.prLabels.includes(config.bypassLabel)) {
    return { skip: true, skipReason: `PR has the bypass label "${config.bypassLabel}"` };
  }
  if (config.sourceDocuments.length === 0) {
    return { skip: true, skipReason: 'No source_documents configured' };
  }

  const relevantDiffFiles = diffFiles.filter(
    (file) => !config.excludePaths.some((pattern) => minimatch(file.path, pattern))
  );
  if (relevantDiffFiles.length === 0) {
    return { skip: true, skipReason: 'PR only touches excluded paths' };
  }

  const documentsToRead = config.sourceDocuments.flatMap((entry) =>
    resolveGlobs(entry).map((glob) => ({ convention: entry.convention, glob }))
  );
  return { skip: false, documentsToRead };
}
