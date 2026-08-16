# spec-alignment GitHub Action — Design

## Problem

Teams write specs (feature specs, PRDs, functional requirements docs) using a variety of tools and conventions, but nothing checks whether a pull request's actual code changes stay consistent with — or in scope of — those specs. Drift between spec and implementation is discovered late, if at all, usually by a human reviewer who has to hold the whole spec in their head while reading a diff.

## Solution

A public, TypeScript-based GitHub Action that reads one or more configured source-of-truth documents (in a variety of spec-tool conventions, or an arbitrary file/directory), reads a pull request's diff, and uses an LLM (user's choice of provider) to judge whether the diff is consistent with and in scope of those documents. Results are reported via GitHub's Checks API (and, optionally, PR review comments), with configurable strictness and an optional, off-by-default auto-approval path.

## Scope

**In scope for v1:**
- Same-repo PRs only (no fork-PR support — see Out of Scope)
- Narrative/feature-intent spec formats (Spec Kit, OpenSpec, Kiro, BMAD-METHOD, the mattpocock-skills domain-modeling convention, or an arbitrary `Other` file/directory)
- Single LLM provider per run (Anthropic, OpenAI, or Google, via the Vercel AI SDK)
- Checks API as the primary reporting surface, with optional PR review comments
- Optional, off-by-default auto-approval via a user-supplied PAT or GitHub App token
- Deterministic-first relevance filtering for large PRs/large doc sets
- An `immutable_spec` mode that deterministically blocks PRs that touch both code and spec in one change

**Out of scope for v1 (documented as future work):**
- Fork-PR support (`pull_request_target` / two-workflow patterns)
- Contract-format specs (OpenAPI, AsyncAPI, TypeSpec) and any contract-conformance judgment mode
- Issue-tracker-based source documents (e.g. specs that live in GitHub Issues rather than repo files)
- Multi-provider fallback chains within a single run
- Cost/spend guardrails beyond the relevance-filtering budget
- Active reviewer-routing (requesting specific humans/teams) — the action reports a verdict and steps aside; branch protection and existing review assignment handle the rest
- Ambient repo context beyond the configured source documents, the diff, and the repo file tree (e.g. README, manifests) as LLM input

## Architecture

Single TypeScript package, one seam. All effectful operations are pushed behind four injected adapters into one orchestration function; everything else is pure and tested directly.

```
src/
  index.ts                 # entrypoint: reads action inputs, builds real adapters, calls runAction
  core/
    runAction.ts            # the one seam
    types.ts                # Config, SourceDocument, DiffFile, Verdict, EvaluationResult
  domain/
    conventions.ts           # resolves convention/path DSL entries into concrete file globs per built-in convention
    discovery.ts              # applies conventions + exclude-paths + skip conditions -> documents/paths to read
    relevanceFilter.ts        # deterministic path/keyword matching; escalates to LLM-filter fallback only when still over budget
    immutableSpecCheck.ts     # pure pre-check: did the diff touch a configured source-document path while immutable_spec=true?
    promptBuilder.ts           # builds the judge prompt (format hint, strictness, multi-doc conflict framing)
    verdictMapper.ts            # maps the LLM's structured verdict -> Check Run conclusion + annotation levels
  adapters/
    git.ts                    # real getDiff (git diff via actions/exec)
    fs.ts                      # real readSourceDocument
    llm.ts                       # real llmJudge (Vercel AI SDK, provider-selected)
    github.ts                     # real githubClient (Octokit: Checks API, comments, reviews)
```

**The seam:** `runAction(adapters, config): Promise<EvaluationResult>`, where `adapters = { getDiff, readSourceDocument, llmJudge, githubClient }`. Everything under `domain/` is pure and tested directly with plain fixtures. Everything under `adapters/` is real I/O, verified manually/in integration testing, not by the unit suite.

## Data Flow

1. `index.ts` reads action `with:` inputs and validates them into a typed `Config`. A config error (missing required field, unknown `provider`, unparseable `source_documents` entry) fails the run immediately, before any adapters are constructed — it's a setup error, not a check result.
2. `index.ts` constructs real adapters and calls `runAction(adapters, config)`.
3. Inside `runAction`: skip conditions are checked first (draft PR, no source document found, PR touches only excluded paths, bypass label present) — any hit short-circuits to a `skip` result with no LLM call.
4. If `immutable_spec` is enabled, the deterministic pre-check runs against the diff's changed paths. A violation short-circuits to a `fail` result with no LLM call.
5. Otherwise: discovery resolves and reads source documents (via head ref) → relevance filtering narrows diff + docs deterministically, escalating to an LLM filter pass (same provider/model as the main judgment) only if still over budget, then to a hard size-ceiling `error` result if still too large → prompt construction (format hint: narrative for all v1 conventions; strictness enum folded in) → `adapters.llmJudge` produces the verdict → `verdictMapper` maps it to a Check conclusion, annotations, and messaging → `runAction` writes back via `adapters.githubClient`.
6. `index.ts`'s own process exit code reflects only genuine tool-level failure (e.g., an unrecoverable config error) — the actual pass/fail signal lives entirely in the GitHub Check conclusion, so the Action process exits 0 for `pass`, `fail`, `skip`, and `error`-mapped-to-neutral outcomes alike.

## Spec/Source Discovery

`source_documents` is a required multi-line input; each line is one entry in the form `<convention>`, `<convention> - <path>`, or `Other - <path>`. Multiple entries are allowed, weighted equally — the LLM is expected to surface disagreement between documents as a finding, not resolve it silently.

Built-in conventions and their default paths:

| Convention | Default paths |
|---|---|
| `speckit` | `.specify/memory/constitution.md` + `specs/*/spec.md` |
| `openspec` | `openspec/specs/**`, plus the matching `openspec/changes/<name>/specs/**` delta when the PR touches an in-flight change |
| `kiro` | `.kiro/specs/<feature>/{requirements,design,tasks}.md` |
| `bmad` | `docs/prd.md` + `docs/architecture.md` + `docs/stories/*.story.md` |
| `domain-modeling` | root `CONTEXT.md` + `docs/adr/**` |
| `Other` | requires an explicit path |

An explicit path after `-` overrides the convention's default. Superpowers (`writing-plans`, whose output points at a spec elsewhere via a `Spec:` header rather than defining one itself) and Augment Cosmos (spec lives in platform/session state, not the repo) are documented as not auto-detectable — users on those tools configure `Other` pointing at wherever the real spec content lives.

Spec content is always read from the PR's **head ref**. This handles both "spec unchanged" (head equals base) and "spec changed in this PR" (head has the update) with one mechanism: the check always evaluates the code against whatever the PR itself claims should be true. When a PR modifies its own source document, that's surfaced as a non-blocking note in the output, not an automatic violation — unless `immutable_spec` is enabled (see below).

## `immutable_spec` Mode

An opt-in boolean input, **default `false`**. When `true`, `immutableSpecCheck` runs a pure, deterministic check: does the PR's diff touch any path resolved from `source_documents`? If so, the result is an immediate `fail`, with a message explaining that spec and code changes must land in separate PRs under this repo's configuration — no LLM call is made for this determination. This is a hard file-path check specifically because it needs to be un-talkable-around; an LLM judgment could in principle be argued with, a diff path match cannot.

## Verdict & Reporting Model

Two independent axes:

- **Verdict** (LLM-judged, except for the two deterministic short-circuits above): `pass`, `pass_with_drift`, `fail`, `skip`, or `error` (provider/infra failure).
- **Reporting mode** (user-configured, applied regardless of verdict): the Check Run's summary and annotations are always produced. `comment_on_pr` (default `true`) additionally posts/updates a PR summary comment. `inline_review_comments` (default `false`) additionally posts PR review comments with inline annotations at specific lines, on top of the Check annotations that are always present.

`verdictMapper` maps verdicts to Check conclusions: `pass` → `success`; `pass_with_drift` → `success` with warning-level annotations and drift noted in the summary (does not block merge); `fail` → `failure`, with annotations at specific lines when the judge identified them; `skip` → `skipped`; `error` → `neutral` (default) or `failure` when `fail_closed_on_error` is `true`.

`strictness` (`strict` | `balanced` | `lenient`, default `balanced`) is folded into the judge prompt as a categorical instruction shaping where the `pass_with_drift` vs. `fail` boundary falls — not a numeric threshold, since LLM-produced severity scores aren't reliably calibrated enough to threshold against.

## Large-PR Handling

`relevanceFilter` runs a deterministic pass first: match changed file paths against document structure/keywords to narrow both the diff and the source documents to what's plausibly related, keeping the common case to exactly one LLM call (the judgment call) with no added cost or latency. If the deterministic pass can't get the combined context under the configured token budget, a filtering pass runs once as a fallback, using the same configured `provider`/`model` as the main judgment call — v1 has only one provider credential available (per the one-provider-per-run decision), so there's no separate "cheaper model" config to introduce for this. If the context is still too large after that fallback, the result is `verdict: "error"` with a "PR too large to check" message, mapped through the same `fail_closed_on_error` logic as a provider failure (this is, structurally, the same class of situation: the tool couldn't produce a real judgment) — rather than guessing via chunked/map-reduce judgment, which risks producing a falsely confident aggregate verdict.

## Auto-Approval & Human Delegation

`auto_approve` (default `false`) requires `approval_token` (a user-supplied PAT or GitHub App installation token — the action does not provision either, but documents how in the README). `GITHUB_TOKEN` cannot approve PRs by GitHub's own design, which is why a separate token is required at all. When `auto_approve` is `true` and the verdict is `pass` (not `pass_with_drift`, `fail`, `skip`, or `error`), `runAction` calls the Pulls Review API with the provided token to approve. If the token's identity isn't recognized as a valid approver under the repo's branch protection rules, the approval simply won't satisfy the requirement — the action doesn't attempt to detect or work around this. When `auto_approve` is off, or the verdict doesn't qualify, the action's role ends at reporting the verdict via the Check conclusion; existing branch protection and human review processes take it from there.

## Error Handling

`adapters.llmJudge` retries transient provider errors (rate limits, timeouts) a small bounded number of times with backoff internally — `runAction` only sees the final outcome. A failure after retries, and the large-PR size-ceiling case described above, both produce `verdict: "error"`, mapped per `fail_closed_on_error` as described above — this is the only place fail-open/fail-closed logic lives, and it's shared by every reason the tool might fail to produce a real judgment. The `immutable_spec` short-circuit never reaches the LLM call, so it's unaffected by provider availability.

## Configuration Surface (`action.yml` inputs)

| Input | Type | Default | Notes |
|---|---|---|---|
| `provider` | enum: `anthropic`\|`openai`\|`google` | required | one provider per run |
| `api_key` | string (secret) | required | paired with `provider` |
| `model` | string | per-provider default | logs a notice when the default is used |
| `source_documents` | multi-line string | required | convention/path DSL, one entry per line |
| `strictness` | enum: `strict`\|`balanced`\|`lenient` | `balanced` | |
| `immutable_spec` | boolean | `false` | |
| `comment_on_pr` | boolean | `true` | hide-previous-then-repost on new commits |
| `inline_review_comments` | boolean | `false` | additive; Checks annotations always present regardless |
| `exclude_paths` | multi-line string | common lockfiles/generated dirs | contributes to auto-skip |
| `bypass_label` | string | `spec-check:skip` | manual override |
| `fail_closed_on_error` | boolean | `false` | |
| `auto_approve` | boolean | `false` | requires `approval_token` |
| `approval_token` | string (secret) | optional | PAT or GitHub App installation token |

Required permissions (documented in the README): `checks: write` always; `pull-requests: write` when `comment_on_pr`, `inline_review_comments`, or `auto_approve` is enabled; `contents: read` for checkout.

## Idempotency

On new commits to an already-checked PR: the existing Check Run is updated in place (`PATCH` by ID) rather than recreated — Checks don't clutter the conversation view, so there's no spam risk either way. The PR summary comment, in contrast, is hidden/minimized (tagged with a hidden marker identifying it as this action's prior output) and a fresh comment posted, rather than edited in place — keeping the PR conversation tab from accumulating an increasingly stale, hard-to-follow comment trail across many pushes.

## Testing Strategy

Vitest. `domain/*` modules are pure and tested directly with plain fixtures — no mocking. `core/runAction.test.ts` exercises the seam with fake adapters (canned diff fixtures, canned document content, a scriptable fake `llmJudge`, a spy `githubClient`), covering: skip conditions, the `immutable_spec` short-circuit, normal pass/fail/drift flow, LLM-error → fail-open/fail-closed mapping, and idempotent update-vs-hide-repost behavior. Assertions target `EvaluationResult` and what the fake `githubClient` was called with — never `domain/` internals from within a `runAction` test. `adapters/*` are not unit tested; a manual verification checklist (run against a real test repo/PR) covers them before release.

## Out of Scope (Future Work)

- Fork-PR support, via either `pull_request_target` with API-based (never `git checkout`-based) diff retrieval, or the two-workflow `pull_request` + `workflow_run` pattern
- Contract-format specs (OpenAPI/AsyncAPI/TypeSpec) with a dedicated contract-conformance prompt mode
- Issue-tracker-based source documents
- Multi-provider fallback chains
- Cost/spend guardrails beyond relevance-filtering
- Active reviewer-routing
- Chunked/map-reduce judgment for PRs too large even after relevance filtering
