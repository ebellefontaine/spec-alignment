# spec-alignment GitHub Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, TypeScript GitHub Action that checks whether a PR's diff stays consistent with configured source-of-truth documents (Spec Kit, OpenSpec, Kiro, BMAD-METHOD, domain-modeling, or an arbitrary file), using an LLM, and reports the result via the Checks API.

**Architecture:** A single TypeScript package with one seam: `runAction(adapters, config)`. Everything effectful (git diff, filesystem reads, the LLM call, the GitHub API) is pushed behind four injected adapters (`getDiff`, `readSourceDocument`, `llmJudge`, `githubClient`). Everything else — convention resolution, discovery, relevance filtering, the `immutable_spec` pre-check, prompt construction, verdict mapping — is pure and tested directly with plain fixtures. `index.ts` is a thin, unit-untested shell that reads real action inputs, builds real adapters, and calls the seam.

**Tech Stack:** TypeScript 5.x, Vitest, `@actions/core`, `@actions/github`, `@actions/exec`, Vercel AI SDK (`ai` + `@ai-sdk/anthropic` + `@ai-sdk/openai` + `@ai-sdk/google`), `zod`, `minimatch`, `fast-glob`, `@vercel/ncc` (bundling).

**Spec:** `docs/superpowers/specs/2026-08-16-spec-alignment-action-design.md`

## Global Constraints

- Node.js 20 runtime (`runs.using: node20` in `action.yml`) — matches GitHub Actions' current supported runtime.
- Same-repo PRs only for v1 — no `pull_request_target` handling, no fork-specific logic anywhere in this plan.
- Narrative spec formats only — no OpenAPI/AsyncAPI/TypeSpec contract-conformance logic.
- One LLM provider per run — no fallback-chain logic.
- `domain/*` modules must be pure (no I/O, no `Date.now()`/`Math.random()` — deterministic given their inputs) so they're testable with plain fixtures.
- `adapters/*` are implemented but not unit tested, per the design doc's explicit decision — verified via the manual checklist in Task 13's deliverable instead.
- Every pure function must have its own direct unit test, even if its only caller is inside an untested adapter (e.g. `verdictMapper.mapVerdictToConclusion` is consumed by `adapters/github.ts` but tested in `domain/verdictMapper.test.ts`, independent of that adapter).

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/core/types.ts` (empty placeholder export, filled in Task 2)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a working `npm test`, `npm run typecheck` toolchain every later task builds on

- [ ] **Step 1: Initialize package.json**

```bash
npm init -y
npm pkg set name="spec-alignment" type="module" private=true
```

- [ ] **Step 2: Install runtime and dev dependencies**

```bash
npm install @actions/core @actions/github @actions/exec ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google zod minimatch fast-glob
npm install --save-dev typescript vitest @types/node @vercel/ncc
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "build",
    "rootDir": "src",
    "noUncheckedIndexedAccess": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Write .gitignore**

```
node_modules/
build/
```

(`dist/` is intentionally NOT ignored — the bundled action output is committed, per Task 16.)

- [ ] **Step 6: Add npm scripts**

```bash
npm pkg set scripts.test="vitest run"
npm pkg set scripts.typecheck="tsc --noEmit"
npm pkg set scripts.build="ncc build src/index.ts -o dist --minify"
```

- [ ] **Step 7: Create placeholder types file so the toolchain has something to compile**

```typescript
// src/core/types.ts
export {};
```

- [ ] **Step 8: Verify the toolchain works**

Run: `npm run typecheck && npm test`
Expected: `typecheck` passes with no output; `test` reports "No test files found" (not an error — Vitest exits 0 with this message when no `*.test.ts` files exist yet).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src/core/types.ts
git commit -m "chore: scaffold TypeScript project"
```

---

## Task 2: Core Types

**Files:**
- Modify: `src/core/types.ts`

**Interfaces:**
- Consumes: nothing
- Produces: every type referenced by every later task. This is the contract all other modules share — get names and shapes exactly right here.

- [ ] **Step 1: Write the full type definitions**

```typescript
// src/core/types.ts

export type Provider = 'anthropic' | 'openai' | 'google';
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
```

Note: `readSourceDocument` takes `convention` alongside the glob because `runAction` reads many globs from different conventions and needs to know which convention each resulting `SourceDocument` came from (used later to label documents in the judge prompt) — the convention isn't recoverable from the glob or file path alone.

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: passes with no output.

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat: define core domain types"
```

---

## Task 3: Convention Resolution (`domain/conventions.ts`)

**Files:**
- Create: `src/domain/conventions.ts`
- Test: `src/domain/conventions.test.ts`

**Interfaces:**
- Consumes: `ConventionName`, `SourceDocumentEntry` from `src/core/types.ts`
- Produces: `parseSourceDocumentsInput(input: string): SourceDocumentEntry[]`, `resolveGlobs(entry: SourceDocumentEntry): string[]` — consumed by Task 4 (discovery)

Note on OpenSpec: the design doc's default includes the matching `openspec/changes/<name>/specs/**` delta "when the PR touches an in-flight change." This plan resolves that by always including `openspec/changes/*/specs/**` in the default glob set (covers every in-flight change, not just the touched one) and letting `relevanceFilter` (Task 6) — which is already diff-aware — narrow it down. This keeps convention resolution diff-agnostic and pure, and achieves the same practical outcome through the general relevance mechanism instead of a special case here.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/domain/conventions.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- conventions`
Expected: FAIL — `Cannot find module './conventions.js'`

- [ ] **Step 3: Implement conventions.ts**

```typescript
// src/domain/conventions.ts
import type { ConventionName, SourceDocumentEntry } from '../core/types.js';

const KNOWN_CONVENTIONS: ConventionName[] = ['speckit', 'openspec', 'kiro', 'bmad', 'domain-modeling'];

export function parseSourceDocumentEntry(line: string): SourceDocumentEntry {
  const separatorIndex = line.indexOf(' - ');
  const rawConvention = (separatorIndex === -1 ? line : line.slice(0, separatorIndex)).trim();
  const explicitPath = separatorIndex === -1 ? undefined : line.slice(separatorIndex + 3).trim();

  if (rawConvention.toLowerCase() === 'other') {
    if (!explicitPath) {
      throw new Error(`"Other" source_documents entry requires a path: "${line}"`);
    }
    return { convention: 'other', explicitPath };
  }

  const convention = KNOWN_CONVENTIONS.find((c) => c === rawConvention.toLowerCase());
  if (!convention) {
    throw new Error(
      `Unknown source_documents convention "${rawConvention}". Expected one of: ${KNOWN_CONVENTIONS.join(', ')}, or "Other - <path>".`
    );
  }
  return explicitPath ? { convention, explicitPath } : { convention };
}

export function parseSourceDocumentsInput(input: string): SourceDocumentEntry[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseSourceDocumentEntry);
}

const CONVENTION_DEFAULT_GLOBS: Record<Exclude<ConventionName, 'other'>, string[]> = {
  speckit: ['.specify/memory/constitution.md', 'specs/*/spec.md'],
  openspec: ['openspec/specs/**', 'openspec/changes/*/specs/**'],
  kiro: ['.kiro/specs/*/requirements.md', '.kiro/specs/*/design.md', '.kiro/specs/*/tasks.md'],
  bmad: ['docs/prd.md', 'docs/architecture.md', 'docs/stories/*.story.md'],
  'domain-modeling': ['CONTEXT.md', 'docs/adr/**'],
};

export function resolveGlobs(entry: SourceDocumentEntry): string[] {
  if (entry.convention === 'other') {
    return [entry.explicitPath as string];
  }
  if (entry.explicitPath) {
    return [entry.explicitPath];
  }
  return CONVENTION_DEFAULT_GLOBS[entry.convention];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- conventions`
Expected: PASS, all 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/conventions.ts src/domain/conventions.test.ts
git commit -m "feat: resolve source_documents convention/path DSL"
```

---

## Task 4: Discovery & Skip Conditions (`domain/discovery.ts`)

**Files:**
- Create: `src/domain/discovery.ts`
- Test: `src/domain/discovery.test.ts`

**Interfaces:**
- Consumes: `Config`, `DiffFile` from `src/core/types.ts`; `resolveGlobs` from `src/domain/conventions.ts`
- Produces: `DiscoveryDecision` (discriminated union), `decideDiscovery(config: Config, diffFiles: DiffFile[]): DiscoveryDecision` — consumed by Task 9 (`runAction`)

This covers the *configuration-time* half of skip detection (draft, bypass label, no entries configured, PR touches only excluded paths). The *runtime* half (configured entries found nothing on disk) is decided in `runAction` after adapters read files, since it requires the read to have already happened — see Task 9.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/domain/discovery.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- discovery`
Expected: FAIL — `Cannot find module './discovery.js'`

- [ ] **Step 3: Implement discovery.ts**

```typescript
// src/domain/discovery.ts
import { minimatch } from 'minimatch';
import type { Config, ConventionName, DiffFile } from '../core/types.js';
import { resolveGlobs } from './conventions.js';

export type DiscoveryDecision =
  | { skip: true; skipReason: string }
  | { skip: false; documentsToRead: { convention: ConventionName; glob: string }[] };

export function decideDiscovery(config: Config, diffFiles: DiffFile[]): DiscoveryDecision {
  if (config.isDraft) {
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- discovery`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/discovery.ts src/domain/discovery.test.ts
git commit -m "feat: add config-time skip conditions and document discovery"
```

---

## Task 5: Immutable Spec Pre-Check (`domain/immutableSpecCheck.ts`)

**Files:**
- Create: `src/domain/immutableSpecCheck.ts`
- Test: `src/domain/immutableSpecCheck.test.ts`

**Interfaces:**
- Consumes: `DiffFile` from `src/core/types.ts`
- Produces: `findImmutableSpecViolation(diffFiles: DiffFile[], sourceDocumentGlobs: string[]): string[]` — consumed by Task 9 (`runAction`)

- [ ] **Step 1: Write the failing tests**

```typescript
// src/domain/immutableSpecCheck.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- immutableSpecCheck`
Expected: FAIL — `Cannot find module './immutableSpecCheck.js'`

- [ ] **Step 3: Implement immutableSpecCheck.ts**

```typescript
// src/domain/immutableSpecCheck.ts
import { minimatch } from 'minimatch';
import type { DiffFile } from '../core/types.js';

export function findImmutableSpecViolation(diffFiles: DiffFile[], sourceDocumentGlobs: string[]): string[] {
  return diffFiles
    .map((file) => file.path)
    .filter((path) => sourceDocumentGlobs.some((glob) => minimatch(path, glob)));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- immutableSpecCheck`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/immutableSpecCheck.ts src/domain/immutableSpecCheck.test.ts
git commit -m "feat: add immutable_spec deterministic pre-check"
```

---

## Task 6: Relevance Filtering (`domain/relevanceFilter.ts`)

**Files:**
- Create: `src/domain/relevanceFilter.ts`
- Test: `src/domain/relevanceFilter.test.ts`

**Interfaces:**
- Consumes: `DiffFile`, `SourceDocument` from `src/core/types.ts`
- Produces: `estimateTokens(diffFiles, sourceDocuments): number`, `filterByRelevance(diffFiles, sourceDocuments, tokenBudget): RelevanceFilterResult` — consumed by Task 9 (`runAction`)

- [ ] **Step 1: Write the failing tests**

```typescript
// src/domain/relevanceFilter.test.ts
import { describe, expect, it } from 'vitest';
import { estimateTokens, filterByRelevance } from './relevanceFilter.js';
import type { DiffFile, SourceDocument } from '../core/types.js';

describe('estimateTokens', () => {
  it('estimates roughly 4 characters per token across diff and doc content', () => {
    const diffFiles: DiffFile[] = [{ path: 'a.ts', status: 'modified', patch: 'x'.repeat(400) }];
    const docs: SourceDocument[] = [{ convention: 'other', path: 'SYSTEM.md', content: 'y'.repeat(400) }];
    expect(estimateTokens(diffFiles, docs)).toBe(200);
  });
});

describe('filterByRelevance', () => {
  it('returns everything unfiltered when already within budget', () => {
    const diffFiles: DiffFile[] = [{ path: 'src/a.ts', status: 'modified', patch: 'small' }];
    const docs: SourceDocument[] = [{ convention: 'other', path: 'SYSTEM.md', content: 'small' }];
    const result = filterByRelevance(diffFiles, docs, 1_000_000);
    expect(result).toEqual({ diffFiles, sourceDocuments: docs, withinBudget: true });
  });

  it('narrows to documents sharing a directory/path segment with changed files when over budget', () => {
    const bigPatch = 'x'.repeat(1000);
    const diffFiles: DiffFile[] = [{ path: 'src/billing/invoice.ts', status: 'modified', patch: bigPatch }];
    const docs: SourceDocument[] = [
      { convention: 'domain-modeling', path: 'src/billing/CONTEXT.md', content: 'y'.repeat(1000) },
      { convention: 'domain-modeling', path: 'src/shipping/CONTEXT.md', content: 'z'.repeat(1000) },
    ];
    const result = filterByRelevance(diffFiles, docs, 300);
    expect(result.sourceDocuments).toEqual([docs[0]]);
  });

  it('falls back to the full document set when nothing shares a path segment', () => {
    const bigPatch = 'x'.repeat(1000);
    const diffFiles: DiffFile[] = [{ path: 'src/billing/invoice.ts', status: 'modified', patch: bigPatch }];
    const docs: SourceDocument[] = [{ convention: 'other', path: 'unrelated/dir/SYSTEM.md', content: 'z'.repeat(1000) }];
    const result = filterByRelevance(diffFiles, docs, 300);
    expect(result.sourceDocuments).toEqual(docs);
    expect(result.withinBudget).toBe(false);
  });

  it('reports withinBudget false when even the narrowed set exceeds the budget', () => {
    const bigPatch = 'x'.repeat(10_000);
    const diffFiles: DiffFile[] = [{ path: 'src/billing/invoice.ts', status: 'modified', patch: bigPatch }];
    const docs: SourceDocument[] = [{ convention: 'domain-modeling', path: 'src/billing/CONTEXT.md', content: 'y'.repeat(10_000) }];
    const result = filterByRelevance(diffFiles, docs, 100);
    expect(result.withinBudget).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- relevanceFilter`
Expected: FAIL — `Cannot find module './relevanceFilter.js'`

- [ ] **Step 3: Implement relevanceFilter.ts**

```typescript
// src/domain/relevanceFilter.ts
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
    return changedDirs.some(
      (dir) => dir.startsWith(docDir) || docDir.startsWith(dir) || sharesPathSegment(dir, docDir)
    );
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

function sharesPathSegment(a: string, b: string): boolean {
  const segmentsA = a.split('/').filter(Boolean);
  const segmentsB = b.split('/').filter(Boolean);
  return segmentsA.some((segment) => segmentsB.includes(segment));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- relevanceFilter`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/relevanceFilter.ts src/domain/relevanceFilter.test.ts
git commit -m "feat: add deterministic relevance filtering for large PRs"
```

---

## Task 7: Prompt Construction (`domain/promptBuilder.ts`)

**Files:**
- Create: `src/domain/promptBuilder.ts`
- Test: `src/domain/promptBuilder.test.ts`

**Interfaces:**
- Consumes: `DiffFile`, `SourceDocument`, `Strictness` from `src/core/types.ts`
- Produces: `buildJudgePrompt(diffFiles, sourceDocuments, strictness, fileTree): string`, `buildFilterPrompt(diffFiles, sourceDocuments): string` — consumed by Task 9 (`runAction`)

- [ ] **Step 1: Write the failing tests**

```typescript
// src/domain/promptBuilder.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- promptBuilder`
Expected: FAIL — `Cannot find module './promptBuilder.js'`

- [ ] **Step 3: Implement promptBuilder.ts**

```typescript
// src/domain/promptBuilder.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- promptBuilder`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/promptBuilder.ts src/domain/promptBuilder.test.ts
git commit -m "feat: build judge and relevance-filter prompts"
```

---

## Task 8: Verdict Mapping (`domain/verdictMapper.ts`)

**Files:**
- Create: `src/domain/verdictMapper.ts`
- Test: `src/domain/verdictMapper.test.ts`

**Interfaces:**
- Consumes: `EvaluationResult`, `JudgeResult`, `Verdict` from `src/core/types.ts`
- Produces: `mapJudgeResultToEvaluation`, `skipResult`, `immutableSpecViolationResult`, `errorResult`, `mapVerdictToConclusion` — consumed by Task 9 (`runAction`) and Task 13 (`adapters/github.ts`)

- [ ] **Step 1: Write the failing tests**

```typescript
// src/domain/verdictMapper.test.ts
import { describe, expect, it } from 'vitest';
import {
  errorResult,
  immutableSpecViolationResult,
  mapJudgeResultToEvaluation,
  mapVerdictToConclusion,
  skipResult,
} from './verdictMapper.js';
import type { JudgeResult } from '../core/types.js';

describe('mapJudgeResultToEvaluation', () => {
  it('carries the judge result through unchanged in shape', () => {
    const judgeResult: JudgeResult = {
      verdict: 'pass_with_drift',
      summary: 'looks fine, minor drift',
      findings: [{ message: 'unused export added', severity: 'notice' }],
      specSelfModified: false,
    };
    expect(mapJudgeResultToEvaluation(judgeResult)).toEqual(judgeResult);
  });
});

describe('skipResult', () => {
  it('produces a skip verdict with the given reason as the summary', () => {
    expect(skipResult('PR is a draft')).toEqual({
      verdict: 'skip',
      summary: 'PR is a draft',
      findings: [],
      specSelfModified: false,
    });
  });
});

describe('immutableSpecViolationResult', () => {
  it('produces a fail verdict naming the touched paths', () => {
    const result = immutableSpecViolationResult(['CONTEXT.md']);
    expect(result.verdict).toBe('fail');
    expect(result.summary).toContain('CONTEXT.md');
    expect(result.specSelfModified).toBe(true);
  });
});

describe('errorResult', () => {
  it('produces an error verdict with the given message', () => {
    expect(errorResult('provider timed out')).toEqual({
      verdict: 'error',
      summary: 'provider timed out',
      findings: [],
      specSelfModified: false,
    });
  });
});

describe('mapVerdictToConclusion', () => {
  it('maps pass and pass_with_drift to success', () => {
    expect(mapVerdictToConclusion('pass', false)).toBe('success');
    expect(mapVerdictToConclusion('pass_with_drift', false)).toBe('success');
  });

  it('maps fail to failure', () => {
    expect(mapVerdictToConclusion('fail', false)).toBe('failure');
  });

  it('maps skip to skipped', () => {
    expect(mapVerdictToConclusion('skip', false)).toBe('skipped');
  });

  it('maps error to neutral by default (fail-open)', () => {
    expect(mapVerdictToConclusion('error', false)).toBe('neutral');
  });

  it('maps error to failure when failClosedOnError is true', () => {
    expect(mapVerdictToConclusion('error', true)).toBe('failure');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- verdictMapper`
Expected: FAIL — `Cannot find module './verdictMapper.js'`

- [ ] **Step 3: Implement verdictMapper.ts**

```typescript
// src/domain/verdictMapper.ts
import type { EvaluationResult, JudgeResult, Verdict } from '../core/types.js';

export type CheckConclusion = 'success' | 'failure' | 'neutral' | 'skipped';

export function mapJudgeResultToEvaluation(judgeResult: JudgeResult): EvaluationResult {
  return {
    verdict: judgeResult.verdict,
    summary: judgeResult.summary,
    findings: judgeResult.findings,
    specSelfModified: judgeResult.specSelfModified,
  };
}

export function skipResult(reason: string): EvaluationResult {
  return { verdict: 'skip', summary: reason, findings: [], specSelfModified: false };
}

export function immutableSpecViolationResult(touchedPaths: string[]): EvaluationResult {
  return {
    verdict: 'fail',
    summary: `This PR modifies both code and a configured source document (${touchedPaths.join(', ')}), but immutable_spec is enabled. Spec changes must land in a separate PR.`,
    findings: [],
    specSelfModified: true,
  };
}

export function errorResult(message: string): EvaluationResult {
  return { verdict: 'error', summary: message, findings: [], specSelfModified: false };
}

export function mapVerdictToConclusion(verdict: Verdict, failClosedOnError: boolean): CheckConclusion {
  switch (verdict) {
    case 'pass':
    case 'pass_with_drift':
      return 'success';
    case 'fail':
      return 'failure';
    case 'skip':
      return 'skipped';
    case 'error':
      return failClosedOnError ? 'failure' : 'neutral';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- verdictMapper`
Expected: PASS, all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/verdictMapper.ts src/domain/verdictMapper.test.ts
git commit -m "feat: map judge results and verdicts to Check conclusions"
```

---

## Task 9: The Seam (`core/runAction.ts`)

**Files:**
- Create: `src/core/runAction.ts`
- Test: `src/core/runAction.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–8: `Adapters`, `Config`, `EvaluationResult` (types.ts); `decideDiscovery` (discovery.ts); `findImmutableSpecViolation` (immutableSpecCheck.ts); `filterByRelevance`, `estimateTokens` (relevanceFilter.ts); `buildJudgePrompt`, `buildFilterPrompt` (promptBuilder.ts); `skipResult`, `immutableSpecViolationResult`, `errorResult`, `mapJudgeResultToEvaluation` (verdictMapper.ts)
- Produces: `runAction(adapters: Adapters, config: Config): Promise<EvaluationResult>` — consumed by Task 14 (`index.ts`)

Note on idempotency testing: `runAction`'s job is to call `githubClient.upsertCheckRun` / `upsertPrComment` — methods whose names carry an idempotency *contract* (find-existing-then-update, not blind-create). This test suite verifies `runAction` calls them (and calls them exactly once per invocation, with the right arguments) — it does not simulate real GitHub state transitions across multiple runs, since that logic lives inside the untested `adapters/github.ts` (Task 13) and is covered by that task's manual verification checklist instead.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/core/runAction.test.ts
import { describe, expect, it, vi } from 'vitest';
import { runAction } from './runAction.js';
import type { Adapters, Config, DiffFile, JudgeResult, SourceDocument } from './types.js';

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
    fileTree: ['CONTEXT.md', 'src/app.ts'],
    ...overrides,
  };
}

function fakeAdapters(overrides: Partial<Adapters> = {}): Adapters {
  return {
    getDiff: vi.fn(async () => [{ path: 'src/app.ts', status: 'modified', patch: '+ change' }] satisfies DiffFile[]),
    readSourceDocument: vi.fn(async () => [
      { convention: 'domain-modeling', path: 'CONTEXT.md', content: '# Glossary' },
    ] satisfies SourceDocument[]),
    llmJudge: {
      judge: vi.fn(async () => ({
        verdict: 'pass',
        summary: 'all good',
        findings: [],
        specSelfModified: false,
      } satisfies JudgeResult)),
      filterRelevance: vi.fn(async () => ({ selectedSourceDocumentPaths: ['CONTEXT.md'] })),
    },
    githubClient: {
      upsertCheckRun: vi.fn(async () => {}),
      upsertPrComment: vi.fn(async () => {}),
      postInlineReviewComments: vi.fn(async () => {}),
      approvePr: vi.fn(async () => {}),
    },
    ...overrides,
  };
}

describe('runAction', () => {
  it('short-circuits to skip without calling the LLM when a skip condition is hit', async () => {
    const adapters = fakeAdapters();
    const result = await runAction(adapters, baseConfig({ isDraft: true }));
    expect(result.verdict).toBe('skip');
    expect(adapters.llmJudge.judge).not.toHaveBeenCalled();
    expect(adapters.githubClient.upsertCheckRun).toHaveBeenCalledTimes(1);
  });

  it('short-circuits to skip when no source documents are found on disk', async () => {
    const adapters = fakeAdapters({ readSourceDocument: vi.fn(async () => []) });
    const result = await runAction(adapters, baseConfig());
    expect(result.verdict).toBe('skip');
    expect(result.summary).toContain('No source documents found');
    expect(adapters.llmJudge.judge).not.toHaveBeenCalled();
  });

  it('fails via the deterministic immutable_spec pre-check without calling the LLM', async () => {
    const adapters = fakeAdapters({
      getDiff: vi.fn(async () => [{ path: 'CONTEXT.md', status: 'modified', patch: '+ change' }]),
    });
    const result = await runAction(adapters, baseConfig({ immutableSpec: true }));
    expect(result.verdict).toBe('fail');
    expect(result.summary).toContain('CONTEXT.md');
    expect(adapters.llmJudge.judge).not.toHaveBeenCalled();
  });

  it('does not trip the immutable_spec check when the toggle is off, even if the spec changed', async () => {
    const adapters = fakeAdapters({
      getDiff: vi.fn(async () => [{ path: 'CONTEXT.md', status: 'modified', patch: '+ change' }]),
    });
    const result = await runAction(adapters, baseConfig({ immutableSpec: false }));
    expect(result.verdict).toBe('pass');
    expect(adapters.llmJudge.judge).toHaveBeenCalledTimes(1);
  });

  it('runs the normal judge flow and writes back a pass result', async () => {
    const adapters = fakeAdapters();
    const result = await runAction(adapters, baseConfig());
    expect(result).toEqual({ verdict: 'pass', summary: 'all good', findings: [], specSelfModified: false });
    expect(adapters.githubClient.upsertCheckRun).toHaveBeenCalledWith(result, false);
    expect(adapters.githubClient.upsertPrComment).toHaveBeenCalledTimes(1);
  });

  it('writes back a fail result with findings and posts inline review comments when enabled', async () => {
    const failJudge: JudgeResult = {
      verdict: 'fail',
      summary: 'contradicts the spec',
      findings: [{ file: 'src/app.ts', line: 3, message: 'removes required validation', severity: 'failure' }],
      specSelfModified: false,
    };
    const adapters = fakeAdapters({ llmJudge: { judge: vi.fn(async () => failJudge), filterRelevance: vi.fn() } });
    const result = await runAction(adapters, baseConfig({ inlineReviewComments: true }));
    expect(result.verdict).toBe('fail');
    expect(adapters.githubClient.postInlineReviewComments).toHaveBeenCalledWith(result);
  });

  it('does not post inline review comments when disabled, even on fail', async () => {
    const failJudge: JudgeResult = { verdict: 'fail', summary: 'no', findings: [{ message: 'bad', severity: 'failure' }], specSelfModified: false };
    const adapters = fakeAdapters({ llmJudge: { judge: vi.fn(async () => failJudge), filterRelevance: vi.fn() } });
    const result = await runAction(adapters, baseConfig({ inlineReviewComments: false }));
    expect(result.verdict).toBe('fail');
    expect(adapters.githubClient.postInlineReviewComments).not.toHaveBeenCalled();
  });

  it('maps an LLM judge failure to an error verdict and still writes back (fail-open by default)', async () => {
    const adapters = fakeAdapters({
      llmJudge: { judge: vi.fn(async () => { throw new Error('provider timeout'); }), filterRelevance: vi.fn() },
    });
    const result = await runAction(adapters, baseConfig());
    expect(result.verdict).toBe('error');
    expect(result.summary).toContain('provider timeout');
    expect(adapters.githubClient.upsertCheckRun).toHaveBeenCalledWith(result, false);
  });

  it('passes failClosedOnError through to upsertCheckRun so the adapter can map it to failure', async () => {
    const adapters = fakeAdapters({
      llmJudge: { judge: vi.fn(async () => { throw new Error('provider timeout'); }), filterRelevance: vi.fn() },
    });
    const result = await runAction(adapters, baseConfig({ failClosedOnError: true }));
    expect(adapters.githubClient.upsertCheckRun).toHaveBeenCalledWith(result, true);
  });

  it('auto-approves only when auto_approve is on, a token is set, and the verdict is exactly pass', async () => {
    const adapters = fakeAdapters();
    await runAction(adapters, baseConfig({ autoApprove: true, approvalToken: 'tok' }));
    expect(adapters.githubClient.approvePr).toHaveBeenCalledWith('tok');
  });

  it('does not auto-approve a pass_with_drift verdict', async () => {
    const driftJudge: JudgeResult = { verdict: 'pass_with_drift', summary: 'drift', findings: [], specSelfModified: false };
    const adapters = fakeAdapters({ llmJudge: { judge: vi.fn(async () => driftJudge), filterRelevance: vi.fn() } });
    await runAction(adapters, baseConfig({ autoApprove: true, approvalToken: 'tok' }));
    expect(adapters.githubClient.approvePr).not.toHaveBeenCalled();
  });

  it('does not auto-approve when auto_approve is off', async () => {
    const adapters = fakeAdapters();
    await runAction(adapters, baseConfig({ autoApprove: false }));
    expect(adapters.githubClient.approvePr).not.toHaveBeenCalled();
  });

  it('escalates to an LLM relevance-filter pass when the deterministic filter is still over budget, then proceeds', async () => {
    const bigPatch = 'x'.repeat(1_000_000);
    const adapters = fakeAdapters({
      getDiff: vi.fn(async () => [{ path: 'src/app.ts', status: 'modified', patch: bigPatch }]),
      readSourceDocument: vi.fn(async () => [
        { convention: 'domain-modeling', path: 'CONTEXT.md', content: 'y'.repeat(1_000_000) },
        { convention: 'domain-modeling', path: 'docs/adr/0001.md', content: 'z'.repeat(1_000_000) },
      ]),
    });
    const result = await runAction(adapters, baseConfig());
    expect(adapters.llmJudge.filterRelevance).toHaveBeenCalledTimes(1);
    expect(result.verdict).toBe('pass');
  });

  it('produces an error verdict when still over budget after the LLM filter fallback', async () => {
    const bigPatch = 'x'.repeat(1_000_000);
    const adapters = fakeAdapters({
      getDiff: vi.fn(async () => [{ path: 'src/app.ts', status: 'modified', patch: bigPatch }]),
      readSourceDocument: vi.fn(async () => [
        { convention: 'domain-modeling', path: 'CONTEXT.md', content: 'y'.repeat(1_000_000) },
      ]),
      llmJudge: {
        judge: vi.fn(),
        filterRelevance: vi.fn(async () => ({ selectedSourceDocumentPaths: ['CONTEXT.md'] })),
      },
    });
    const result = await runAction(adapters, baseConfig());
    expect(result.verdict).toBe('error');
    expect(result.summary).toContain('too large');
    expect(adapters.llmJudge.judge).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- runAction`
Expected: FAIL — `Cannot find module './runAction.js'`

- [ ] **Step 3: Implement runAction.ts**

```typescript
// src/core/runAction.ts
import type { Adapters, Config, EvaluationResult } from './types.js';
import { decideDiscovery } from '../domain/discovery.js';
import { findImmutableSpecViolation } from '../domain/immutableSpecCheck.js';
import { estimateTokens, filterByRelevance } from '../domain/relevanceFilter.js';
import { buildFilterPrompt, buildJudgePrompt } from '../domain/promptBuilder.js';
import {
  errorResult,
  immutableSpecViolationResult,
  mapJudgeResultToEvaluation,
  skipResult,
} from '../domain/verdictMapper.js';

const TOKEN_BUDGET = 150_000;

export async function runAction(adapters: Adapters, config: Config): Promise<EvaluationResult> {
  const diffFiles = await adapters.getDiff();

  const discoveryDecision = decideDiscovery(config, diffFiles);
  if (discoveryDecision.skip) {
    return writeBack(adapters, config, skipResult(discoveryDecision.skipReason));
  }

  const allGlobs = discoveryDecision.documentsToRead.map((doc) => doc.glob);
  if (config.immutableSpec) {
    const violatedPaths = findImmutableSpecViolation(diffFiles, allGlobs);
    if (violatedPaths.length > 0) {
      return writeBack(adapters, config, immutableSpecViolationResult(violatedPaths));
    }
  }

  const sourceDocumentBatches = await Promise.all(
    discoveryDecision.documentsToRead.map((doc) => adapters.readSourceDocument(doc.glob))
  );
  const sourceDocuments = sourceDocumentBatches.flat();

  if (sourceDocuments.length === 0) {
    return writeBack(
      adapters,
      config,
      skipResult('No source documents found on disk matching the configured source_documents entries')
    );
  }

  let filtered = filterByRelevance(diffFiles, sourceDocuments, TOKEN_BUDGET);
  if (!filtered.withinBudget) {
    try {
      const filterPrompt = buildFilterPrompt(filtered.diffFiles, filtered.sourceDocuments);
      const selection = await adapters.llmJudge.filterRelevance({
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        prompt: filterPrompt,
      });
      const narrowedDocs = sourceDocuments.filter((doc) =>
        selection.selectedSourceDocumentPaths.includes(doc.path)
      );
      const narrowedTokens = estimateTokens(diffFiles, narrowedDocs);
      if (narrowedTokens > TOKEN_BUDGET) {
        return writeBack(adapters, config, errorResult('PR too large to check, even after relevance filtering'));
      }
      filtered = { diffFiles, sourceDocuments: narrowedDocs, withinBudget: true };
    } catch (err) {
      return writeBack(
        adapters,
        config,
        errorResult(`Spec check unavailable: relevance-filtering call failed (${(err as Error).message})`)
      );
    }
  }

  let result: EvaluationResult;
  try {
    const prompt = buildJudgePrompt(filtered.diffFiles, filtered.sourceDocuments, config.strictness, config.fileTree);
    const judgeResult = await adapters.llmJudge.judge({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      prompt,
    });
    result = mapJudgeResultToEvaluation(judgeResult);
  } catch (err) {
    result = errorResult(`Spec check unavailable: judge call failed (${(err as Error).message})`);
  }

  return writeBack(adapters, config, result);
}

async function writeBack(adapters: Adapters, config: Config, result: EvaluationResult): Promise<EvaluationResult> {
  await adapters.githubClient.upsertCheckRun(result, config.failClosedOnError);
  if (config.commentOnPr) {
    await adapters.githubClient.upsertPrComment(result);
  }
  if (config.inlineReviewComments && result.findings.length > 0) {
    await adapters.githubClient.postInlineReviewComments(result);
  }
  if (config.autoApprove && result.verdict === 'pass' && config.approvalToken) {
    await adapters.githubClient.approvePr(config.approvalToken);
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- runAction`
Expected: PASS, all 14 tests green.

- [ ] **Step 5: Run the full suite to confirm nothing regressed**

Run: `npm test`
Expected: PASS, all suites green (Tasks 3–9 combined).

- [ ] **Step 6: Commit**

```bash
git add src/core/runAction.ts src/core/runAction.test.ts
git commit -m "feat: implement runAction orchestration seam"
```

---

## Task 10: Git Diff Adapter (`adapters/git.ts`)

**Files:**
- Create: `src/adapters/git.ts`

**Interfaces:**
- Consumes: `DiffFile` from `src/core/types.ts`, `@actions/exec`
- Produces: `createGetDiff(baseSha: string, headSha: string): () => Promise<DiffFile[]>` — consumed by Task 14 (`index.ts`)

Not unit tested, per the Global Constraints — this wraps real `git` invocations. Verified manually per the Task 13 checklist (which covers the full adapter layer together, since a real end-to-end run exercises all four adapters at once).

- [ ] **Step 1: Implement git.ts**

```typescript
// src/adapters/git.ts
import { exec, getExecOutput } from '@actions/exec';
import type { DiffFile } from '../core/types.js';

export function createGetDiff(baseSha: string, headSha: string): () => Promise<DiffFile[]> {
  return async function getDiff(): Promise<DiffFile[]> {
    await exec('git', ['fetch', '--no-tags', '--depth=1', 'origin', baseSha, headSha]);

    const nameStatus = await getExecOutput('git', ['diff', '--name-status', `${baseSha}...${headSha}`]);
    const files: DiffFile[] = [];

    for (const line of nameStatus.stdout.split('\n').filter(Boolean)) {
      const [statusCode, path] = line.split('\t');
      const status = mapStatus(statusCode ?? '');
      const patch = await getExecOutput('git', ['diff', `${baseSha}...${headSha}`, '--', path ?? '']);
      files.push({ path: path ?? '', status, patch: patch.stdout });
    }

    return files;
  };
}

function mapStatus(code: string): DiffFile['status'] {
  if (code.startsWith('A')) return 'added';
  if (code.startsWith('D')) return 'removed';
  if (code.startsWith('R')) return 'renamed';
  return 'modified';
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: passes with no output.

- [ ] **Step 3: Commit**

```bash
git add src/adapters/git.ts
git commit -m "feat: add git diff adapter"
```

---

## Task 11: Filesystem Adapter (`adapters/fs.ts`)

**Files:**
- Create: `src/adapters/fs.ts`

**Interfaces:**
- Consumes: `SourceDocument`, `ConventionName` from `src/core/types.ts`, `fast-glob`, `node:fs/promises`
- Produces: `readSourceDocument(convention: ConventionName): (globPattern: string) => Promise<SourceDocument[]>`, `readFileTree(): Promise<string[]>` — consumed by Task 14 (`index.ts`)

Not unit tested, per the Global Constraints. `readFileTree` is used once by `index.ts` to populate `config.fileTree` before calling `runAction` (see Task 14) — it is not part of the `Adapters` interface itself, since the file tree is precomputed plain data by the time the seam runs, not a repeated effect within it.

- [ ] **Step 1: Implement fs.ts**

```typescript
// src/adapters/fs.ts
import fg from 'fast-glob';
import { readFile } from 'node:fs/promises';
import type { ConventionName, SourceDocument } from '../core/types.js';

export async function readSourceDocument(globPattern: string, convention: ConventionName): Promise<SourceDocument[]> {
  const matches = await fg(globPattern, { dot: true, onlyFiles: true });
  return Promise.all(
    matches.map(async (path) => ({
      convention,
      path,
      content: await readFile(path, 'utf-8'),
    }))
  );
}

export async function readFileTree(): Promise<string[]> {
  return fg('**/*', {
    dot: false,
    onlyFiles: true,
    ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
  });
}
```

This matches `Adapters['readSourceDocument']` from Task 2 exactly — `runAction` (Task 9) already calls `adapters.readSourceDocument(doc.glob, doc.convention)`, so no changes are needed there.

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: passes with no output.

- [ ] **Step 3: Run the full suite to confirm nothing regressed**

Run: `npm test`
Expected: PASS, all suites still green.

- [ ] **Step 4: Commit**

```bash
git add src/adapters/fs.ts
git commit -m "feat: add filesystem adapter and file tree reader"
```

---

## Task 12: LLM Adapter (`adapters/llm.ts`)

**Files:**
- Create: `src/adapters/llm.ts`

**Interfaces:**
- Consumes: `LlmJudgeAdapter`, `JudgeRequest`, `FilterRequest`, `JudgeResult`, `FilterSelection`, `Provider` from `src/core/types.ts`; `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `zod`
- Produces: `createLlmJudgeAdapter(): LlmJudgeAdapter` — consumed by Task 14 (`index.ts`)

Not unit tested, per the Global Constraints — this calls real provider APIs. Per the design doc's model-default policy: a per-provider default is used when `model` is omitted, with a console notice.

- [ ] **Step 1: Implement llm.ts**

```typescript
// src/adapters/llm.ts
import { generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import type { FilterRequest, FilterSelection, JudgeRequest, JudgeResult, LlmJudgeAdapter, Provider } from '../core/types.js';

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-5',
  google: 'gemini-3-pro',
};

const JUDGE_RESULT_SCHEMA = z.object({
  verdict: z.enum(['pass', 'pass_with_drift', 'fail']),
  summary: z.string(),
  findings: z.array(
    z.object({
      file: z.string().optional(),
      line: z.number().optional(),
      message: z.string(),
      severity: z.enum(['notice', 'warning', 'failure']),
    })
  ),
  specSelfModified: z.boolean(),
});

const FILTER_SELECTION_SCHEMA = z.object({
  selectedSourceDocumentPaths: z.array(z.string()),
});

function resolveModel(provider: Provider, apiKey: string, model?: string) {
  const resolvedModelId = model ?? DEFAULT_MODELS[provider];
  if (!model) {
    console.log(`No model specified for provider "${provider}" — using default "${resolvedModelId}". Pin a model input to avoid drift across action versions.`);
  }
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(resolvedModelId);
    case 'openai':
      return createOpenAI({ apiKey })(resolvedModelId);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(resolvedModelId);
  }
}

const MAX_RETRIES = 3;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}

export function createLlmJudgeAdapter(): LlmJudgeAdapter {
  return {
    async judge(request: JudgeRequest): Promise<JudgeResult> {
      const model = resolveModel(request.provider, request.apiKey, request.model);
      const { object } = await withRetry(() =>
        generateObject({ model, schema: JUDGE_RESULT_SCHEMA, prompt: request.prompt })
      );
      return object;
    },
    async filterRelevance(request: FilterRequest): Promise<FilterSelection> {
      const model = resolveModel(request.provider, request.apiKey, request.model);
      const { object } = await withRetry(() =>
        generateObject({ model, schema: FILTER_SELECTION_SCHEMA, prompt: request.prompt })
      );
      return object;
    },
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: passes with no output.

- [ ] **Step 3: Commit**

```bash
git add src/adapters/llm.ts
git commit -m "feat: add Vercel AI SDK judge adapter with retry and model defaults"
```

---

## Task 13: GitHub Adapter (`adapters/github.ts`)

**Files:**
- Create: `src/adapters/github.ts`

**Interfaces:**
- Consumes: `GithubClient`, `EvaluationResult` from `src/core/types.ts`; `mapVerdictToConclusion` from `src/domain/verdictMapper.js`; `@actions/github`'s `Octokit` type
- Produces: `createGithubClient(octokit, repoContext): GithubClient` — consumed by Task 14 (`index.ts`)

Not unit tested, per the Global Constraints — this calls the real GitHub API. This is the task where the design doc's idempotency decisions actually live:

- **Check Runs are naturally idempotent per-commit** — GitHub scopes a PR's visible Checks to its current head SHA, so a fresh SHA (new push) automatically gets a fresh Checks view with no cleanup needed. What `upsertCheckRun` guards against is re-running the *same* SHA twice (e.g. a manual workflow re-run) creating a duplicate check — it looks up an existing check run by name for the current SHA first, and `PATCH`es it if found instead of creating a second one.
- **PR comments are scoped to the PR, not the SHA** — so across multiple pushes they *would* accumulate without explicit handling. `upsertPrComment` finds any prior comment carrying a hidden marker, minimizes it via the GraphQL `minimizeComment` mutation (classified `OUTDATED`), then posts a fresh comment carrying the same marker.

**Manual verification checklist** (run once against a real test repo/PR before each release, covering Tasks 10–13 together as a full adapter layer):
1. Open a PR that violates a configured spec — confirm a Check Run named "spec-alignment" appears with `failure` conclusion and correct annotations at the right file/line.
2. Push a new commit to that PR — confirm a fresh Check Run appears for the new SHA (not a stale one).
3. Re-run the workflow on the same commit (via the Actions UI "Re-run jobs" button) — confirm only one Check Run exists for that SHA afterward, not two.
4. With `comment_on_pr: true`, push two commits in a row — confirm the PR conversation tab shows the first comment collapsed/minimized and only the second comment expanded.
5. With `inline_review_comments: true` and at least one finding with a `file`/`line`, confirm a PR review with inline comments appears at the correct lines.
6. With `auto_approve: true` and a valid `approval_token`, confirm the PR gets an approving review from that token's identity when the verdict is `pass`; confirm no approval is attempted on `fail`/`pass_with_drift`.

- [ ] **Step 1: Implement github.ts**

```typescript
// src/adapters/github.ts
import { getOctokit } from '@actions/github';
import type { EvaluationResult, GithubClient } from '../core/types.js';
import { mapVerdictToConclusion } from '../domain/verdictMapper.js';

const CHECK_NAME = 'spec-alignment';
const COMMENT_MARKER = '<!-- spec-alignment-action -->';

export interface RepoContext {
  owner: string;
  repo: string;
  sha: string;
  prNumber: number;
}

export function createGithubClient(octokit: ReturnType<typeof getOctokit>, repoContext: RepoContext): GithubClient {
  const { owner, repo, sha, prNumber } = repoContext;

  return {
    async upsertCheckRun(result: EvaluationResult, failClosedOnError: boolean): Promise<void> {
      const conclusion = mapVerdictToConclusion(result.verdict, failClosedOnError);
      const annotations = result.findings
        .filter((finding): finding is typeof finding & { file: string; line: number } => Boolean(finding.file && finding.line))
        .slice(0, 50)
        .map((finding) => ({
          path: finding.file,
          start_line: finding.line,
          end_line: finding.line,
          annotation_level: finding.severity === 'failure' ? ('failure' as const) : ('warning' as const),
          message: finding.message,
        }));

      const existing = await octokit.rest.checks.listForRef({ owner, repo, ref: sha, check_name: CHECK_NAME });
      const output = { title: CHECK_NAME, summary: result.summary, annotations };

      if (existing.data.check_runs.length > 0) {
        await octokit.rest.checks.update({
          owner,
          repo,
          check_run_id: existing.data.check_runs[0]!.id,
          status: 'completed',
          conclusion,
          output,
        });
      } else {
        await octokit.rest.checks.create({
          owner,
          repo,
          name: CHECK_NAME,
          head_sha: sha,
          status: 'completed',
          conclusion,
          output,
        });
      }
    },

    async upsertPrComment(result: EvaluationResult): Promise<void> {
      const comments = await octokit.rest.issues.listComments({ owner, repo, issue_number: prNumber });
      const previous = comments.data.find((comment) => comment.body?.includes(COMMENT_MARKER));

      if (previous) {
        await octokit.graphql(
          `mutation($id: ID!) { minimizeComment(input: { subjectId: $id, classifier: OUTDATED }) { clientMutationId } }`,
          { id: previous.node_id }
        );
      }

      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: `${COMMENT_MARKER}\n## Spec Alignment: ${result.verdict}\n\n${result.summary}`,
      });
    },

    async postInlineReviewComments(result: EvaluationResult): Promise<void> {
      const comments = result.findings
        .filter((finding): finding is typeof finding & { file: string; line: number } => Boolean(finding.file && finding.line))
        .map((finding) => ({ path: finding.file, line: finding.line, body: finding.message }));

      if (comments.length === 0) return;

      await octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        event: 'COMMENT',
        comments,
      });
    },

    async approvePr(token: string): Promise<void> {
      const { Octokit } = await import('@octokit/rest');
      const approvalClient = new Octokit({ auth: token });
      await approvalClient.rest.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        event: 'APPROVE',
      });
    },
  };
}
```

- [ ] **Step 2: Install the additional Octokit dependency used for the approval token path**

```bash
npm install @octokit/rest
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: passes with no output.

- [ ] **Step 4: Commit**

```bash
git add src/adapters/github.ts package.json package-lock.json
git commit -m "feat: add GitHub adapter (Checks API, comments, reviews, approval)"
```

---

## Task 14: Entrypoint (`index.ts`)

**Files:**
- Create: `src/index.ts`

**Interfaces:**
- Consumes: everything — `runAction` (Task 9), `createGetDiff` (Task 10), `readSourceDocument`/`readFileTree` (Task 11), `createLlmJudgeAdapter` (Task 12), `createGithubClient` (Task 13), all types (Task 2)
- Produces: the action's actual entrypoint, referenced by `action.yml`'s `main:` field (Task 15)

Not unit tested, per the Global Constraints — this is the thin shell wiring real inputs to real adapters. Verified by running the action for real (Task 13's manual checklist exercises this file too, since there's no other way to invoke the adapters).

- [ ] **Step 1: Implement index.ts**

```typescript
// src/index.ts
import * as core from '@actions/core';
import * as github from '@actions/github';
import { runAction } from './core/runAction.js';
import { parseSourceDocumentsInput } from './domain/conventions.js';
import { createGetDiff } from './adapters/git.js';
import { readSourceDocument, readFileTree } from './adapters/fs.js';
import { createLlmJudgeAdapter } from './adapters/llm.js';
import { createGithubClient } from './adapters/github.js';
import type { Config, Provider, Strictness } from './core/types.js';

function parseBoolean(value: string, fallback: boolean): boolean {
  if (value.trim() === '') return fallback;
  return value.trim().toLowerCase() === 'true';
}

function parseMultilineList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function buildConfig(): Promise<Config> {
  const provider = core.getInput('provider', { required: true }) as Provider;
  if (!['anthropic', 'openai', 'google'].includes(provider)) {
    throw new Error(`Invalid provider "${provider}". Expected one of: anthropic, openai, google.`);
  }

  const sourceDocumentsRaw = core.getInput('source_documents', { required: true });
  const sourceDocuments = parseSourceDocumentsInput(sourceDocumentsRaw);

  const strictness = (core.getInput('strictness') || 'balanced') as Strictness;
  if (!['strict', 'balanced', 'lenient'].includes(strictness)) {
    throw new Error(`Invalid strictness "${strictness}". Expected one of: strict, balanced, lenient.`);
  }

  const pullRequest = github.context.payload.pull_request;
  if (!pullRequest) {
    throw new Error('This action must run on a pull_request-triggered event.');
  }

  return {
    provider,
    apiKey: core.getInput('api_key', { required: true }),
    model: core.getInput('model') || undefined,
    sourceDocuments,
    strictness,
    immutableSpec: parseBoolean(core.getInput('immutable_spec'), false),
    commentOnPr: parseBoolean(core.getInput('comment_on_pr'), true),
    inlineReviewComments: parseBoolean(core.getInput('inline_review_comments'), false),
    excludePaths: parseMultilineList(core.getInput('exclude_paths')),
    bypassLabel: core.getInput('bypass_label') || 'spec-check:skip',
    failClosedOnError: parseBoolean(core.getInput('fail_closed_on_error'), false),
    autoApprove: parseBoolean(core.getInput('auto_approve'), false),
    approvalToken: core.getInput('approval_token') || undefined,
    isDraft: Boolean(pullRequest.draft),
    prLabels: (pullRequest.labels as { name: string }[]).map((label) => label.name),
    fileTree: await readFileTree(),
  };
}

async function main(): Promise<void> {
  let config: Config;
  try {
    config = await buildConfig();
  } catch (err) {
    core.setFailed(`Configuration error: ${(err as Error).message}`);
    return;
  }

  const pullRequest = github.context.payload.pull_request!;
  const octokit = github.getOctokit(core.getInput('github_token') || process.env.GITHUB_TOKEN || '');
  const repoContext = {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    sha: pullRequest.head.sha as string,
    prNumber: pullRequest.number as number,
  };

  const adapters = {
    getDiff: createGetDiff(pullRequest.base.sha as string, pullRequest.head.sha as string),
    readSourceDocument,
    llmJudge: createLlmJudgeAdapter(),
    githubClient: createGithubClient(octokit, repoContext),
  };

  const result = await runAction(adapters, config);
  core.setOutput('verdict', result.verdict);
  core.setOutput('summary', result.summary);
}

main().catch((err) => {
  core.setFailed(`Unexpected error: ${(err as Error).message}`);
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: passes with no output.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire real adapters into the action entrypoint"
```

---

## Task 15: Action Manifest (`action.yml`)

**Files:**
- Create: `action.yml`

**Interfaces:**
- Consumes: nothing (declarative manifest)
- Produces: the public contract consumers write `with:` blocks against; `main: dist/index.js`, which Task 16 produces

- [ ] **Step 1: Write action.yml**

```yaml
name: 'Spec Alignment'
description: 'Checks a pull request diff for consistency with configured source-of-truth documents using an LLM.'
author: 'ebellefontaine'
branding:
  icon: 'check-circle'
  color: 'blue'

inputs:
  provider:
    description: 'LLM provider to use: anthropic, openai, or google.'
    required: true
  api_key:
    description: 'API key for the selected provider.'
    required: true
  model:
    description: 'Model ID to use. Defaults to a per-provider default if omitted (see README).'
    required: false
  source_documents:
    description: >
      One entry per line: "<convention>", "<convention> - <path>", or "Other - <path>".
      Known conventions: speckit, openspec, kiro, bmad, domain-modeling.
    required: true
  strictness:
    description: 'strict, balanced, or lenient. Defaults to balanced.'
    required: false
    default: 'balanced'
  immutable_spec:
    description: 'When true, fails any PR that touches both code and a configured source document.'
    required: false
    default: 'false'
  comment_on_pr:
    description: 'Post/update a summary PR comment in addition to the Check Run.'
    required: false
    default: 'true'
  inline_review_comments:
    description: 'Post PR review comments with inline annotations, in addition to Check annotations.'
    required: false
    default: 'false'
  exclude_paths:
    description: 'Newline-delimited glob patterns to exclude from consideration.'
    required: false
    default: ''
  bypass_label:
    description: 'PR label that bypasses the check entirely.'
    required: false
    default: 'spec-check:skip'
  fail_closed_on_error:
    description: 'When true, provider/infra failures produce a failure conclusion instead of neutral.'
    required: false
    default: 'false'
  auto_approve:
    description: 'When true, approve the PR automatically on a pass verdict, using approval_token.'
    required: false
    default: 'false'
  approval_token:
    description: 'PAT or GitHub App installation token used only for auto_approve. GITHUB_TOKEN cannot approve PRs.'
    required: false
  github_token:
    description: 'Token used for Checks API and comments. Defaults to GITHUB_TOKEN.'
    required: false
    default: '${{ github.token }}'

outputs:
  verdict:
    description: 'One of: pass, pass_with_drift, fail, skip, error.'
  summary:
    description: "The judge's summary text."

runs:
  using: 'node20'
  main: 'dist/index.js'
```

- [ ] **Step 2: Commit**

```bash
git add action.yml
git commit -m "feat: add action.yml manifest"
```

---

## Task 16: Build & Bundle

**Files:**
- Modify: `package.json` (already has the `build` script from Task 1)
- Create: `dist/index.js` (generated, committed)

**Interfaces:**
- Consumes: `src/index.ts` and its full dependency graph
- Produces: `dist/index.js`, the file `action.yml`'s `main:` actually runs

GitHub Actions runs `dist/index.js` directly — it does not run `npm install` for consumers, so the bundle must be self-contained and committed.

- [ ] **Step 1: Run the build**

Run: `npm run build`
Expected: creates `dist/index.js` (and likely `dist/licenses.txt`) with no errors.

- [ ] **Step 2: Smoke-test the bundle loads without throwing on syntax/import errors**

Run: `node -e "require('./dist/index.js')" 2>&1 | head -5`
Expected: it will fail with a configuration error (`Configuration error: Input required and not supplied: provider`) rather than a module-resolution or syntax error — that failure mode confirms the bundle itself is valid and executes up to `core.getInput`.

- [ ] **Step 3: Commit the bundle**

```bash
git add dist
git commit -m "build: bundle dist/index.js"
```

---

## Task 17: README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: nothing
- Produces: the public-facing usage doc for the Marketplace listing

- [ ] **Step 1: Write README.md**

```markdown
# Spec Alignment

A GitHub Action that checks whether a pull request's diff stays consistent with your project's spec — using an LLM.

## What it does

Point it at your source-of-truth document(s) — a [Spec Kit](https://github.com/github/spec-kit) spec, an [OpenSpec](https://github.com/Fission-AI/OpenSpec) change, a [Kiro](https://kiro.dev) spec, a BMAD-METHOD PRD, a `CONTEXT.md`, or any arbitrary file — and it reads the PR's diff, asks an LLM whether the change is consistent with and in scope of that document, and reports the result as a GitHub Check.

## Quick start

```yaml
name: Spec Alignment
on:
  pull_request:

permissions:
  checks: write
  pull-requests: write

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: ebellefontaine/spec-alignment@v1
        with:
          provider: anthropic
          api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          source_documents: |
            domain-modeling
```

## Inputs

See [`action.yml`](./action.yml) for the full list of inputs and defaults.

## `source_documents` syntax

One entry per line:

- `<convention>` — use a known convention's default paths (`speckit`, `openspec`, `kiro`, `bmad`, `domain-modeling`)
- `<convention> - <path>` — override a known convention's default path
- `Other - <path>` — an arbitrary file or directory glob, for anything not covered by a known convention

Multiple entries are allowed and weighted equally.

## Permissions

- `checks: write` — always required.
- `pull-requests: write` — required if `comment_on_pr`, `inline_review_comments`, or `auto_approve` is enabled.
- `contents: read` — required for checkout.

## Auto-approval

`GITHUB_TOKEN` cannot approve pull requests — this is a GitHub platform restriction, not a limitation of this action. To use `auto_approve: true`, supply your own `approval_token`:

- **Personal access token (PAT):** create a [fine-grained PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) on an account with write access to this repo, scoped to Pull Requests: Read and Write, and store it as a repo secret.
- **GitHub App:** create a GitHub App with the `pull_requests: write` permission, install it on this repo, and generate an installation access token in your workflow (e.g. via `actions/create-github-app-token`) to pass as `approval_token`.

Either way, the token's identity must be a valid approver under this repo's branch protection rules (not excluded by "require review from someone other than the last pusher," etc.) for the approval to actually count.

## Scope (v1)

- Same-repo PRs only — no support for PRs from forks yet.
- Narrative/feature-intent spec formats only — no OpenAPI/AsyncAPI/TypeSpec contract checking yet.
- One LLM provider per run.

See the [design doc](./docs/superpowers/specs/2026-08-16-spec-alignment-action-design.md) for the full list of what's deliberately out of scope for v1.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Task 18: CI Workflow for This Repo

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the `test`, `typecheck`, and `build` npm scripts from Task 1
- Produces: a required status check on this repo's own PRs, verifying tests pass and the committed `dist/` matches a fresh build

- [ ] **Step 1: Write ci.yml**

```yaml
name: CI

on:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - name: Verify dist/ is up to date
        run: |
          if ! git diff --exit-code dist; then
            echo "::error::dist/ is out of date. Run 'npm run build' and commit the result."
            exit 1
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add test/typecheck/build/dist-check workflow"
```

- [ ] **Step 3: Push and confirm CI is green**

```bash
git push origin main
```

Then check the Actions tab on the repo to confirm the CI workflow passes on this push.

---

## Self-Review Notes

*(kept here for the executor's context — not a task to perform)*

- **Spec coverage:** every design-doc section maps to at least one task — Architecture/seam → Tasks 2, 9; Data Flow → Task 9 + 14; Spec/Source Discovery → Tasks 3, 4; `immutable_spec` → Task 5; Verdict & Reporting → Tasks 8, 9, 13; Large-PR Handling → Tasks 6, 9; Auto-Approval → Tasks 9, 13; Error Handling → Tasks 9, 12; Configuration Surface → Tasks 14, 15; Idempotency → Task 13; Testing Strategy → woven through every task's TDD steps.
- **Signature refinement found during planning:** the design doc's `Adapters.readSourceDocument(globPattern)` signature (implied by its ASCII architecture diagram, not spelled out to the parameter level) didn't carry enough information for a caller to know which convention a batch of files came from once results were flattened together — needed for the LLM prompt's `### path (convention)` labeling. Task 2 defines the corrected signature `readSourceDocument(globPattern, convention)` from the start, and every later task (9, 11, 14) is written consistently against it — no mid-plan correction needed.
- **Not decided in this plan:** open-source license choice (MIT, Apache-2.0, etc.) for the public repo — flagged to the user separately, not blocking any task above.
