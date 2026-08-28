# Spec-Alignment System Specification

## Architecture Overview

Spec-alignment is a GitHub Action that validates pull requests against project specifications using multi-provider LLM analysis. It provides automated feedback when code changes drift from documented specifications.

### High-Level Flow

```
PR Event
    ↓
Read Configuration (action.yml inputs)
    ↓
Load Source Specifications (from repository)
    ↓
Fetch PR Diff (git diff)
    ↓
LLM Judgment (Anthropic/OpenAI/Google)
    ↓
Report Results
    ├─ Check Run (GitHub Checks API)
    ├─ PR Comment (Summary + inline review)
    └─ Auto-Approval (optional)
```

---

## 1. Input Configuration

### Required Inputs
| Input | Type | Description | Default |
|-------|------|-------------|---------|
| `provider` | string | LLM provider (anthropic, openai, google) | - |
| `api_key` | string | API key for LLM provider | - |
| `source_documents` | string | Multi-line list of specs with conventions | - |

### Optional Inputs
| Input | Type | Description | Default |
|-------|------|-------------|---------|
| `model` | string | Specific model ID (overrides provider default) | provider default |
| `strictness` | string | Check level (strict, balanced, lenient) | balanced |
| `immutable_spec` | boolean | Specs cannot be modified in PR | true |
| `comment_on_pr` | boolean | Post summary comment | true |
| `inline_review_comments` | boolean | Post line-level review comments | false |
| `exclude_paths` | string | Glob patterns to skip (one per line) | dist/\*, node_modules/\* |
| `bypass_label` | string | Label to bypass all checks | - |
| `fail_closed_on_error` | boolean | Fail rather than skip on errors | false |
| `auto_approve` | boolean | Auto-approve passing PRs | false |
| `approval_token` | string | GitHub token for approvals (required if auto_approve=true) | - |

### Input Formats

**source_documents** (multi-line YAML-like):
```
speckit:docs/spec.md
openspec:docs/api-spec.json
domain-modeling:docs/domain.md
other:/absolute/path/to/custom.md
```

**exclude_paths** (minimatch patterns):
```
dist/**
node_modules/**
*.generated.ts
src/protobuf/**
```

---

## 2. Output Specification

### Check Run Reporting

The action creates/updates a GitHub Check Run with:

```json
{
  "name": "spec-alignment",
  "conclusion": "success | failure | neutral",
  "summary": "Overall verdict and key findings",
  "annotations": [
    {
      "path": "src/file.ts",
      "start_line": 42,
      "end_line": 45,
      "annotation_level": "notice | warning | failure",
      "message": "Description of drift"
    }
  ]
}
```

**Conclusions:**
- `success`: Verdict is "pass" (full alignment)
- `failure`: Verdict is "fail" (significant drift)
- `neutral`: Verdict is "pass_with_drift" or "skip" (acceptable drift or skipped)

### PR Comment

Posted when `comment_on_pr` is true:

```markdown
## Spec-Alignment Report

**Verdict:** `pass` | `pass_with_drift` | `fail` | `skip`

### Summary
Brief explanation of the verdict and key findings.

### Checks Performed
- [x] SYSTEM.md: Architectural patterns
- [x] FUNCTIONAL.md: Feature requirements

### Issues Found
If drift/failures detected, list them here.

---
*Posted by spec-alignment v0.1.0-beta*
```

### Inline Review Comments

Posted when `inline_review_comments` is true on specific lines:

```
Why: Line 42 modifies schema after initialization
Spec: SYSTEM.md §3.2 - "Schema must be immutable"
Severity: failure

Suggested: Create new schema version instead.
```

### Action Outputs

| Output | Type | Description |
|--------|------|-------------|
| `verdict` | string | pass \| pass_with_drift \| fail \| skip \| error |
| `summary` | string | JSON-serialized EvaluationResult |

**Output Example:**
```json
{
  "verdict": "fail",
  "summary": {
    "verdict": "fail",
    "summary": "Implementation introduces data schema changes...",
    "findings": [
      {
        "file": "src/db/schema.ts",
        "line": 42,
        "message": "Schema modification post-initialization",
        "severity": "failure"
      }
    ],
    "specSelfModified": false
  }
}
```

---

## 3. Verdict Logic

### Verdict Definitions

**PASS**
- All specifications reviewed
- No drift detected
- Code fully aligns with documented behavior

**PASS_WITH_DRIFT**
- Minor drift detected in implementation patterns
- Drift is acceptable under configured strictness
- No breaking changes or security concerns
- Examples: Different variable naming, alternative algorithm

**FAIL**
- Significant drift detected
- Code violates documented requirements
- Potential breaking changes or security risks
- Requires maintainer review or changes

**SKIP**
- Specifications unavailable
- PR is in draft status
- All changed files are in exclude_paths
- Validation not applicable

**ERROR**
- LLM API failed and failClosedOnError=true
- GitHub API permission issue
- Configuration error
- Specification reading failed

### Strictness Levels

**STRICT**
- Applies high standards to code-spec alignment
- Algorithm consistency must match spec examples exactly
- Variable naming conventions are enforced
- Any deviation results in FAIL verdict

**BALANCED** (default)
- Allows reasonable implementation variations
- Core behavior must match spec requirements
- Minor pattern deviations acceptable
- Deviation results in PASS_WITH_DRIFT (not FAIL)

**LENIENT**
- Focuses on correctness, not pattern matching
- As long as functionality is correct, PASS verdict
- Only major architectural violations trigger FAIL
- Preferred for rapid iteration phases

---

## 4. Adapter Architecture

The action uses a dependency-injection adapter pattern for testability:

### GitAdapter
**Responsibility:** Retrieve and parse PR diffs

**Interface:**
```typescript
interface GitAdapter {
  getDiff(): Promise<DiffFile[]>;
}

interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  patch: string;  // Unified diff format
}
```

**Implementation:** `RealGitAdapter`
- Executes `git diff origin/HEAD...HEAD --unified=3`
- Parses unified diff format
- Handles quoted paths (with spaces)
- Returns DiffFile array

### FilesystemAdapter
**Responsibility:** Read specification documents from repository

**Interface:**
```typescript
interface FilesystemAdapter {
  readSourceDocument(
    globPattern: string,
    convention: ConventionName
  ): Promise<SourceDocument[]>;
}

interface SourceDocument {
  convention: ConventionName;
  path: string;
  content: string;
}
```

**Implementation:** `RealFilesystemAdapter`
- Uses fast-glob for pattern matching
- Reads .md and .mdx files
- Parses YAML front matter if present
- Returns SourceDocument array

### LlmJudgeAdapter
**Responsibility:** Analyze code against specifications using LLM

**Interface:**
```typescript
interface LlmJudgeAdapter {
  judge(request: JudgeRequest): Promise<JudgeResult>;
  filterRelevance(request: FilterRequest): Promise<FilterSelection>;
}

interface JudgeRequest {
  provider: Provider;
  apiKey: string;
  model?: string;
  prompt: string;
}

interface JudgeResult {
  verdict: 'pass' | 'pass_with_drift' | 'fail';
  summary: string;
  findings: Finding[];
  specSelfModified: boolean;
}
```

**Implementation:** `RealLlmJudgeAdapter`
- Uses Vercel AI SDK (`generateObject`)
- Validates output with Zod schemas
- Implements retry logic (3 attempts, exponential backoff)
- Transient error detection (408, 429, 5xx, timeouts)
- Supports: Anthropic (claude-opus-5), OpenAI (gpt-5.6), Google (gemini-pro-latest)

### GithubClient
**Responsibility:** Report results back to GitHub

**Interface:**
```typescript
interface GithubClient {
  upsertCheckRun(
    result: EvaluationResult,
    failClosedOnError: boolean
  ): Promise<void>;
  upsertPrComment(result: EvaluationResult): Promise<void>;
  postInlineReviewComments(result: EvaluationResult): Promise<void>;
  approvePr(token: string): Promise<void>;
}
```

**Implementation:** `RealGithubClient`
- Creates/updates Check Run via Checks API
- Posts PR comments with Octokit
- Posts review comments via Pulls Review API
- Handles annotation batching (max 50 per request)
- Approves PR with provided token

---

## 5. LLM Prompting Strategy

### Judgment Prompt Template

The action constructs an LLM prompt with:

1. **Specification Context** - Full text of source documents
2. **Code Changes** - Unified diff of the PR
3. **Strictness Instructions** - Guidelines for drift tolerance
4. **Output Schema** - Zod-validated JSON structure

**Prompt Structure:**
```
You are a code specification compliance reviewer.

# Project Specifications
[Full content of SYSTEM.md, FUNCTIONAL.md, etc.]

# Pull Request Changes
[Unified diff with line numbers]

# Review Instructions
- Strictness: [STRICT|BALANCED|LENIENT]
- Evaluate if code changes align with specifications
- For each finding, note: file, line, issue, severity

# Output Format
Return valid JSON matching this schema:
{
  "verdict": "pass" | "pass_with_drift" | "fail",
  "reasoning": "...",
  "findings": [...]
}
```

### Relevance Filtering

To optimize token usage, the action can filter specs:

1. Extract key terms from PR diff
2. Use LLM to identify relevant specification sections
3. Only pass relevant specs to full judgment

**Relevance Prompt:**
```
Given these code changes, which specification sections are relevant?
Return a JSON array of spec file paths to review.
```

---

## 6. Configuration Examples

### Minimal Configuration
```yaml
- uses: ebellefontaine/spec-alignment@v0.1.0
  with:
    provider: anthropic
    api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    source_documents: speckit:docs/SYSTEM.md
```

### Full Configuration
```yaml
- uses: ebellefontaine/spec-alignment@v0.1.0
  with:
    provider: anthropic
    api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    model: claude-opus-5
    source_documents: |
      speckit:docs/SYSTEM.md
      domain-modeling:docs/domain.md
    strictness: balanced
    immutable_spec: true
    comment_on_pr: true
    inline_review_comments: true
    exclude_paths: |
      dist/**
      *.generated.ts
    bypass_label: skip-spec-check
    fail_closed_on_error: false
    auto_approve: true
    approval_token: ${{ secrets.GITHUB_TOKEN }}
```

---

## 7. Error Handling

### Transient Errors (Retry with Backoff)
- HTTP 408 (Request Timeout)
- HTTP 429 (Rate Limited)
- HTTP 5xx (Server Error)
- Connection timeouts
- DNS resolution failures

**Backoff Strategy:**
```
Attempt 1: immediate
Attempt 2: wait 1s, retry
Attempt 3: wait 2s, retry
Attempt 4: wait 4s, retry
If all fail: return error verdict (respect failClosedOnError)
```

### Permanent Errors (Fail Immediately)
- HTTP 401 (Unauthorized - bad API key)
- HTTP 403 (Forbidden - permission denied)
- Configuration errors (invalid strictness, provider)
- Specification files not found

**Error Verdict:**
```
failClosedOnError=true  → verdict: error (blocks PR)
failClosedOnError=false → verdict: skip (doesn't block)
```

---

## 8. Security Considerations

### Secret Handling
- API keys never logged to stdout/stderr
- Secrets are redacted from Check Run output
- GitHub Actions secret masking applies
- Use `@actions/core.setSecret()` for sensitive outputs

### Approval Authorization
- Approval token must have explicit `pull-requests:write` scope
- Approval token should be repository-scoped, not org-wide
- Approval is auditable in GitHub (shows as "spec-alignment" reviewer)

### Specification Trust
- Specs are read from current repository checkout
- No external spec URLs are fetched
- Spec modifications in PR are detected and flagged
- `immutable_spec: true` blocks PR if specs are changed

---

## 9. Data Flow & State

### PR Event Trigger
1. PR opened/synchronize event received
2. GitHub Actions runner checks out code
3. Action entrypoint (index.js) invoked

### Orchestration (runAction)
1. Read adapters: GitAdapter, FilesystemAdapter, LlmJudgeAdapter, GithubClient
2. Get PR diff (adapter: git)
3. Load specs (adapter: filesystem)
4. Filter specs by relevance (optional optimization)
5. Call LLM judgment (adapter: llm)
6. Post results to GitHub (adapter: github)

### State & Context
- All context gathered before LLM call
- No state persisted between runs
- Each PR event is independent
- GitHub provides: PR number, base/head refs, event payload

---

## 10. Testing Strategy

### Unit Tests
- DiffFile parsing (quoted paths, mode changes)
- SourceDocument filtering
- Verdict logic
- Schema validation

### Integration Tests
- Real LLM calls (with retry logic)
- Real GitHub API interactions
- Mock PR event payloads

### E2E Tests
- Test workflow creates actual test PR
- Runs real action against test specs
- Validates Check Run creation
- Verifies PR comments

---

## 11. Future Enhancements

### v0.2.0 (Post-Beta)
- [ ] Fork PR support
- [ ] Batch judgment for multiple specs
- [ ] Spec versioning support
- [ ] Custom LLM model tuning
- [ ] Marketplace publication

### v0.3.0
- [ ] Spec mutation detection (alerting when specs change)
- [ ] Historical tracking (drift trends over time)
- [ ] Custom adapter plugins
- [ ] Webhook support for external spec sources

---

## Version Information
- **Current Version:** 0.1.0-beta
- **Status:** Experimental - Production ready with limitations
- **Node Runtime:** 20+ (18+ for compatibility)
- **GitHub:** Requires access to PR diffs and Check Run API
