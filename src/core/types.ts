export type Provider = 'anthropic' | 'openai' | 'google' | 'openrouter';
export type Strictness = 'strict' | 'balanced' | 'lenient';
export type Verdict = 'pass' | 'pass_with_drift' | 'fail' | 'skip' | 'error';
export type ConventionName = 'speckit' | 'openspec' | 'kiro' | 'bmad' | 'domain-modeling' | 'other';

export interface SourceDocumentEntry {
  convention: ConventionName;
  /** Explicit path override. Required when convention is 'other'. */
  explicitPath?: string;
}

/**
 * Parsed action inputs, plus PR/repo context gathered by index.ts from the
 * GitHub event payload and local filesystem. Plain data by the time it
 * reaches runAction — every field here is already resolved, nothing in
 * this type triggers I/O when read.
 */
export interface Config {
  provider: Provider;
  apiKey: string;
  model?: string;
  sourceDocuments: SourceDocumentEntry[];
  strictness: Strictness;
  immutableSpec: boolean;
  commentOnPr: boolean;
  inlineReviewComments: boolean;
  excludePaths: string[];
  bypassLabel: string;
  failClosedOnError: boolean;
  autoApprove: boolean;
  approvalToken?: string;
  isDraft: boolean;
  prLabels: string[];
  fileTree: string[];
}

export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  patch: string;
}

export interface SourceDocument {
  convention: ConventionName;
  path: string;
  content: string;
}

export interface Finding {
  file?: string;
  line?: number;
  message: string;
  severity: 'notice' | 'warning' | 'failure';
}

export interface JudgeResult {
  verdict: 'pass' | 'pass_with_drift' | 'fail';
  summary: string;
  findings: Finding[];
  specSelfModified: boolean;
}

export interface EvaluationResult {
  verdict: Verdict;
  summary: string;
  findings: Finding[];
  specSelfModified: boolean;
}

export interface JudgeRequest {
  provider: Provider;
  apiKey: string;
  model?: string;
  prompt: string;
}

export interface FilterRequest {
  provider: Provider;
  apiKey: string;
  model?: string;
  prompt: string;
}

export interface FilterSelection {
  selectedSourceDocumentPaths: string[];
}

export interface LlmJudgeAdapter {
  judge(request: JudgeRequest): Promise<JudgeResult>;
  filterRelevance(request: FilterRequest): Promise<FilterSelection>;
}

export interface GithubClient {
  upsertCheckRun(result: EvaluationResult, failClosedOnError: boolean): Promise<void>;
  upsertPrComment(result: EvaluationResult): Promise<void>;
  postInlineReviewComments(result: EvaluationResult): Promise<void>;
  approvePr(token: string): Promise<void>;
}

export interface Adapters {
  getDiff(): Promise<DiffFile[]>;
  readSourceDocument(globPattern: string, convention: ConventionName): Promise<SourceDocument[]>;
  llmJudge: LlmJudgeAdapter;
  githubClient: GithubClient;
}
