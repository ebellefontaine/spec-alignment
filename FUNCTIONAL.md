# Spec-Alignment Functional Requirements

## User Stories

### Story 1: Automatic Specification Alignment Validation
**As a** project maintainer  
**I want** pull requests to be automatically validated against my project specifications  
**So that** I can ensure code changes align with documented design decisions and architectural patterns

**Acceptance Criteria:**
- [ ] When a PR is opened targeting the main branch, the spec-alignment action runs automatically
- [ ] The action reads the source specifications from configured paths (SYSTEM.md, ARCHITECTURE.md, etc.)
- [ ] The action analyzes the diff and identifies changes
- [ ] The action generates a verdict (pass, pass_with_drift, fail, or skip)
- [ ] The verdict is reported back to the PR via a Check Run with a clear conclusion

**Example:**
```
PR #123 modifies authentication.ts
- Changes: Added new OAuth provider
- Spec check: PASS_WITH_DRIFT (implementation detail drift, no breaking change)
- Summary: Implementation follows security pattern but differs from documented example
```

---

### Story 2: Contributor Feedback on Specification Alignment
**As a** code contributor  
**I want** to receive clear feedback about whether my changes align with project specifications  
**So that** I can understand what I might have missed and adjust my PR accordingly

**Acceptance Criteria:**
- [ ] When a PR fails spec alignment, a comment is posted explaining the misalignment
- [ ] The comment includes specific files and lines where drift was detected
- [ ] The comment suggests how to resolve the misalignment
- [ ] Inline review comments are posted on the actual changed lines (if enabled)
- [ ] The contributor can see the original specification being checked against

**Example:**
```
@contributor Your PR modifies the database schema in a way that conflicts with 
the immutability requirement in SYSTEM.md section 3.2.

Changed file: src/db/schema.ts:42
Issue: Schema version field is being modified post-initialization
Expected: Schema must be immutable after creation (per SYSTEM.md §3.2)

Suggested fix: Create a new schema version instead of modifying existing one.
See SYSTEM.md for the versioning pattern.
```

---

### Story 3: Specification Drift Detection and Logging
**As a** project lead  
**I want** to detect when pull requests introduce drift between code and specifications  
**So that** I can proactively address technical debt and prevent specification rot

**Acceptance Criteria:**
- [ ] The action distinguishes between "pass" (full alignment) and "pass_with_drift" (acceptable drift)
- [ ] The action logs all detected drift issues in the Check Run summary
- [ ] Each drift item includes: file path, line number, what changed, what spec says, severity level
- [ ] Drift can be categorized by severity: notice, warning, or failure
- [ ] Maintainers can configure strictness level (strict, balanced, lenient) to control what counts as drift

**Drift Detection Examples:**
- **NOTICE**: Implementation uses a pattern not mentioned in spec but compatible
- **WARNING**: Implementation takes a shortcut that works but violates a guideline  
- **FAILURE**: Implementation directly contradicts a documented requirement

---

### Story 4: Multiple Specification Conventions Support
**As a** project maintainer with diverse teams  
**I want** to support multiple specification conventions (SpecKit, OpenSpec, Kiro, BMAD, etc.)  
**So that** different teams and projects can use the tool with their preferred documentation format

**Acceptance Criteria:**
- [ ] The action accepts a list of source documents with convention types
- [ ] Each convention is mapped to an LLM prompt that understands that spec format
- [ ] The action can analyze code against multiple specs simultaneously
- [ ] Results are aggregated with a single overall verdict
- [ ] Developers see which convention flagged each issue
- [ ] Simple file paths (without convention prefix) are auto-detected and treated as custom specs

**Supported Conventions:**
- `speckit`: SpecKit format specifications
- `openspec`: OpenSpec format specifications  
- `kiro`: Kiro format specifications
- `bmad`: BMAD format specifications
- `domain-modeling`: Domain-Driven Design modeling specs
- `other` (explicit): Custom specifications with explicit path override (e.g., `other:/path/to/spec.md`)
- Auto-detected paths: Plain file paths containing `.` or `/` are automatically treated as custom specs (e.g., `FUNCTIONAL.md`, `docs/ARCHITECTURE.md`)

---

### Story 5: Automatic PR Approval for Specification-Aligned Changes
**As a** project maintainer running CI/CD  
**I want** to automatically approve PRs that fully align with specifications  
**So that** I can speed up the review process for routine changes

**Acceptance Criteria:**
- [ ] When a PR verdict is "pass" (full alignment), the action can auto-approve it (if enabled)
- [ ] Auto-approval requires an explicit approval token with permission
- [ ] Auto-approval logs which specification checks passed
- [ ] Maintainers can disable auto-approval for specific PRs using a bypass label
- [ ] Auto-approval only works if `autoApprove` input is true and `approvalToken` is provided

**Workflow:**
```
1. PR opened → spec-alignment action runs
2. Verdict: PASS (fully aligned with specifications)
3. Auto-approval enabled → GitHub API approves with review comment
4. Review workflow continues (other reviewers can still request changes)
```

---

### Story 6: Graceful Handling of Specification Unavailability
**As a** a project with intermittent spec availability  
**I want** the action to handle missing or unavailable specifications gracefully  
**So that** CI pipelines don't break when specs are temporarily inaccessible

**Acceptance Criteria:**
- [ ] When source specs cannot be read, the action skips validation and returns "skip" verdict
- [ ] When LLM service is unavailable, the action respects `failClosedOnError` setting
- [ ] If `failClosedOnError` is true, unavailable LLM causes failure to be conservative
- [ ] If `failClosedOnError` is false, unavailable LLM results in "skip" verdict  
- [ ] Clear error message is posted explaining why validation was skipped
- [ ] Maintainers can see transient vs. permanent failures

**Error Scenarios:**
- Specification files not found → skip with explanation
- LLM API timeout → fail or skip based on setting
- Invalid API key → fail with clear error  
- GitHub API permission denied → fail with permission error

---

### Story 7: Customizable Path Exclusion for Generated/Vendor Code
**As a** a project maintainer  
**I want** to exclude certain paths from specification validation  
**So that** generated code, vendored dependencies, and non-business-logic don't trigger false positives

**Acceptance Criteria:**
- [ ] The action accepts an `excludePaths` input with glob patterns
- [ ] Matched paths are completely skipped from the PR diff
- [ ] Exclusions use minimatch syntax for flexibility (*, **, ?, [abc])
- [ ] At least these paths are excluded by default: dist/*, node_modules/*, *.generated.ts
- [ ] Exclusions are applied during diff retrieval (before token counting)
- [ ] If a PR only touches excluded paths, the verdict is "skip" with clear explanation
- [ ] When non-excluded files exist alongside excluded ones, only non-excluded files are analyzed

**How It Works:**
1. Action retrieves PR diff between base and head
2. Excludes files matching any pattern in `excludePaths`
3. If only excluded files changed → verdict is "skip" (no business logic changed)
4. If other files changed → analyzes only those files
5. This prevents large generated files (like bundled dist/index.js) from inflating token counts

**Examples:**
```yaml
excludePaths: |
  dist/**
  node_modules/**
  *.generated.ts
  src/protobuf/**
  build/**
  .next/**
```

---

### Story 8: Draft PR Handling
**As a** a maintainer reviewing early-stage PRs  
**I want** draft PRs to be skipped from strict specification checking  
**So that** contributors can iterate on design before final alignment

**Acceptance Criteria:**
- [ ] When a PR is marked as draft, spec-alignment returns "skip" verdict
- [ ] Draft verdict is clearly documented in the Check Run
- [ ] Contributors can still see what checks would fail if converted to ready-for-review
- [ ] Once converted from draft, checks run on the full PR
- [ ] Maintainers cannot override draft behavior

---

## Acceptance Testing Scenarios

### Scenario A: Successful Alignment Check
```gherkin
Given a project with SYSTEM.md specification
And a PR that modifies code in alignment with SYSTEM.md
When the spec-alignment action runs
Then the Check Run verdict is "pass"
And no comments are posted
And the PR can be merged without spec concerns
```

### Scenario B: Drift Detection with Corrective Feedback
```gherkin
Given a project with SYSTEM.md requiring immutable schema
And a PR that modifies the schema after initialization
When the spec-alignment action runs
Then the Check Run verdict is "fail"
And a comment explains the immutability requirement
And inline review comments point to the problematic lines
And the comment provides guidance on how to fix it
```

### Scenario C: Auto-Approval of Aligned Changes
```gherkin
Given auto-approval is enabled with a valid approval token
And a PR aligns perfectly with all specifications
When the spec-alignment action runs with verdict "pass"
Then the action automatically approves the PR
And a review comment explains which specs passed
```

### Scenario D: Skip Verdict for Draft PR
```gherkin
Given a PR is in draft status
When the spec-alignment action runs
Then the verdict is "skip"
And the PR is not blocked
And no validation comments are posted
```

### Scenario E: Graceful Degradation when Specs Unavailable
```gherkin
Given specifications cannot be found in the repository
When the spec-alignment action runs
Then the verdict is "skip"
And a clear message explains why specs were not found
And the PR is not blocked
```

---

## Non-Functional Requirements

### Performance
- Action should complete within 30 seconds for typical PRs (< 50 files)
- LLM inference should be cached when possible
- GitHub API calls should be batched (max 50 annotations per request)

### Reliability
- Action should handle transient LLM API failures with exponential backoff (3 retries)
- Failed LLM calls should not block PR (respecting failClosedOnError)
- All errors should be logged with context for debugging

### Usability
- Check Run output should be readable and actionable
- Error messages should suggest corrective actions
- Documentation should be clear for first-time users

### Security
- API keys should be handled as secrets (never logged)
- Approval tokens should be restricted to approval scope
- Spec files should be read from trusted repository context only
