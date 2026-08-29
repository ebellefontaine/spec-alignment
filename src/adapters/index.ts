import type {
  Config,
  DiffFile,
  EvaluationResult,
  FilterRequest,
  FilterSelection,
  JudgeRequest,
  JudgeResult,
  SourceDocument,
  ConventionName,
  LlmJudgeAdapter,
  GithubClient,
} from '../core/types.js';

/**
 * GitAdapter: Provides git diff operations for the current PR.
 * Reads the unified diff between the base and head refs.
 */
export interface GitAdapter {
  /**
   * Get the unified diff for the PR (base...head).
   * Returns an array of changed files with their complete patches.
   * @param excludePatterns - Glob patterns of files to exclude from the diff
   */
  getDiff(excludePatterns?: string[]): Promise<DiffFile[]>;
}

/**
 * FilesystemAdapter: Reads source documents (specs) from the repository.
 * Supports reading files/directories matching configured paths and conventions.
 */
export interface FilesystemAdapter {
  /**
   * Read source document(s) from disk matching a glob pattern and convention.
   * @param globPattern - File glob pattern to match (e.g. specs directory)
   * @param convention - The spec convention type (speckit, openspec, kiro, etc.)
   * @returns Array of source documents with their content read from disk
   */
  readSourceDocument(globPattern: string, convention: ConventionName): Promise<SourceDocument[]>;
}

// Re-export adapter interfaces from core/types
export type { LlmJudgeAdapter, GithubClient } from '../core/types.js';
