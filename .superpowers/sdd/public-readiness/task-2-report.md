# Task 2 Report: Create Adapter Type Definitions

## Summary

Successfully created `src/adapters/index.ts` with comprehensive TypeScript interface definitions for the four core adapters and the combined Adapters interface. All interfaces export from a single file to establish the contract that adapter implementations (Tasks 3-6) must follow.

## File Created

**Path:** `src/adapters/index.ts` (105 lines)

## Interfaces Defined

### 1. GitAdapter
- **Method:** `getDiff(): Promise<DiffFile[]>`
- **Purpose:** Retrieves the unified diff for the PR (base...head)
- **Returns:** Array of changed files with their complete patches
- **Note:** Provides the source diff data needed for all downstream operations

### 2. FilesystemAdapter
- **Method:** `readSourceDocument(globPattern: string, convention: ConventionName): Promise<SourceDocument[]>`
- **Purpose:** Reads spec files/directories matching configured paths and conventions
- **Returns:** Array of source documents with content read from disk
- **Note:** Supports multiple spec convention formats (speckit, openspec, kiro, bmad, domain-modeling, other)

### 3. LLMAdapter
- **Methods:**
  - `judge(request: JudgeRequest): Promise<JudgeResult>` - Main LLM judgment call for spec alignment
  - `filterRelevance(request: FilterRequest): Promise<FilterSelection>` - Relevance filtering fallback for large PRs
- **Purpose:** Integrates with configured LLM provider for spec validation and filtering
- **Note:** Handles retries for transient errors internally; escalates to filtering when deterministic pass can't fit within token budget

### 4. GitHubAdapter
- **Methods:**
  - `upsertCheckRun(result: EvaluationResult, failClosedOnError: boolean): Promise<void>` - Create/update Check Run with conclusion, title, summary, and annotations
  - `upsertPrComment(result: EvaluationResult): Promise<void>` - Create/update PR summary comment (hides prior comment on new commits)
  - `postInlineReviewComments(result: EvaluationResult): Promise<void>` - Post line-level review comments when findings exist
  - `approvePr(token: string): Promise<void>` - Auto-approve PR via provided PAT or GitHub App token
- **Purpose:** Reports check results and interacts with GitHub APIs
- **Note:** Provides multiple reporting surfaces (Checks API, PR comments, inline reviews, auto-approval)

### 5. Adapters
- **Type:** Interface combining the four adapters above
- **Properties:**
  - `getDiff: GitAdapter['getDiff']`
  - `readSourceDocument: FilesystemAdapter['readSourceDocument']`
  - `llmJudge: LLMAdapter`
  - `githubClient: GitHubAdapter`
- **Purpose:** Complete dependency injection interface for the `runAction` orchestration function
- **Note:** Each property represents one of the four I/O boundaries (git, filesystem, LLM, GitHub)

## Design Decisions

1. **Separate Interface Per Adapter:** Each adapter has its own interface to allow independent implementation and testing. This follows the Adapter pattern and dependency injection principles.

2. **Composition Over Inheritance:** The `Adapters` interface uses property-based composition rather than extending individual interfaces, allowing flexibility in how implementations are structured.

3. **Direct Method References for Simple Adapters:** `GitAdapter` and `FilesystemAdapter` have their methods directly referenced in the `Adapters` interface using mapped types (`GitAdapter['getDiff']`), while complex adapters (`LLMAdapter`, `GitHubAdapter`) are embedded as object types. This avoids unnecessary wrapping.

4. **JSDoc Comments:** All interfaces include comprehensive JSDoc comments explaining:
   - Purpose of each adapter
   - Parameters and return types
   - When methods are called (e.g., `filterRelevance` only called when over token budget)
   - Special requirements (e.g., `approvePr` requires PAT token, not GITHUB_TOKEN)

5. **Type Imports:** All types imported from `src/core/types.ts` to maintain single source of truth for domain types (Config, DiffFile, SourceDocument, Verdict, etc.)

## TypeScript Compilation

**Status:** PASSED

```
npm run typecheck
> spec-alignment@1.0.0 typecheck
> tsc --noEmit

[No errors]
```

### Compilation Notes
- Initial attempts failed due to `*/` sequence in JSDoc comments being interpreted as comment termination
- Resolved by avoiding glob pattern examples (e.g., "specs/*/spec.md") in comment blocks
- File uses ASCII encoding with proper TypeScript formatting

## Git Commit

**Commit Hash:** `077957c`

**Message:**
```
feat: add adapter interface definitions

Create src/adapters/index.ts with TypeScript interface definitions for the four core adapters (GitAdapter, FilesystemAdapter, LLMAdapter, GitHubAdapter) and the combined Adapters interface. These interfaces define the contract that adapter implementations must follow for git operations, filesystem reads, LLM judgment calls, and GitHub API interactions.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

## Status

**DONE**

All deliverables for Task 2 have been completed:
- ✅ Five TypeScript interfaces defined with comprehensive JSDoc
- ✅ Proper imports from `src/core/types.ts`
- ✅ TypeScript compilation verified (no errors)
- ✅ Git commit created
- ✅ Report file generated

## Next Steps (Tasks 3-6)

The adapter interfaces now provide a clear contract for:
- **Task 3:** Implement `src/adapters/git.ts` (GitAdapter)
- **Task 4:** Implement `src/adapters/fs.ts` (FilesystemAdapter)
- **Task 5:** Implement `src/adapters/llm.ts` (LLMAdapter)
- **Task 6:** Implement `src/adapters/github.ts` (GitHubAdapter)

Each implementation must satisfy its corresponding interface definition.
