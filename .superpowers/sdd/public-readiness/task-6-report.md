# Task 6 Report: GitHub Adapter (`src/adapters/github.ts`)

**Base commit:** 8db3926
**Commit:** 62a2047
**Status:** DONE_WITH_CONCERNS

## What was built

`src/adapters/github.ts` (498 lines) implementing `GithubClient` from `src/core/types.ts`:

- `RealGithubClient.upsertCheckRun(result, failClosedOnError)`
- `RealGithubClient.upsertPrComment(result)`
- `RealGithubClient.postInlineReviewComments(result)`
- `RealGithubClient.approvePr(token)`
- `createGithubClient(options?)` factory
- `chunkArray(items, size)` exported utility (named in the plan's Task 6 deliverables)

### API surface verification

Every Octokit call was verified against the *installed* packages rather than from memory, since
`@actions/github` is at 9.1.1:

| Call | Verified in |
|---|---|
| `getOctokit`, `context` | `node_modules/@actions/github/lib/github.d.ts` |
| `checks.create` / `checks.update` / `checks.listForRef` | `plugin-rest-endpoint-methods/.../method-types.d.ts:3097,3249,3171` |
| annotation shape (`path`/`start_line`/`end_line`/`annotation_level`/`message`) | `@octokit/openapi-types` `"checks/create"` @ 105231 |
| `pulls.createReview` (`event`, `comments[].line/side/path/body`) | `@octokit/openapi-types` `"pulls/create-review"` @ 114846 |
| `octokit.graphql` | `@octokit/core/dist-types/index.d.ts:21` |
| `core.warning/info/debug` | `@actions/core/lib/core.d.ts` |

`Context` is typed as `typeof ambientContext` rather than deep-imported from
`@actions/github/lib/context.js` — the package's `exports` map only exposes `.` and `./lib/utils`,
so a deep import would not resolve under `moduleResolution: Bundler`.

### Design decisions

**Verdict mapping reuses the domain.** `mapVerdictToConclusion` in `src/domain/verdictMapper.ts`
already existed but had no production caller (only tests). This adapter is its first real consumer,
which is what the design doc intends ("`verdictMapper` maps it to a Check conclusion").

**Check Run upsert.** `checks.listForRef` filtered by `check_name` finds an existing run for the
head SHA; found → `checks.update`, otherwise `checks.create`. This matches the design doc's "updated
in place (PATCH by ID) rather than recreated".

**Annotation chunking.** The Checks API caps annotations at 50 per request and *appends* on update.
The first chunk rides along with the create/update that sets the conclusion; each remaining chunk is
appended by a follow-up PATCH.

**Head SHA.** Uses `payload.pull_request.head.sha` when present, falling back to `context.sha`. On
`pull_request` events `context.sha` is the ephemeral merge commit, which would attach the check to a
commit that does not exist on the branch.

**Annotations require a line.** Only findings with both `file` and an integer `line >= 1` become
annotations. Fabricating line 1 for an unlocated finding would point the reader at unrelated code.
All findings — located or not — still appear in the check run's `output.text` markdown, so nothing
is lost.

**Comment marker.** `<!-- spec-alignment-action:summary -->` is prepended to every summary comment.
`upsertPrComment` lists comments (paginated), filters on the marker, minimizes each via the GraphQL
`minimizeComment` mutation with `classifier: OUTDATED`, then posts fresh — the hide-then-repost
behaviour the design doc specifies, not edit-in-place.

### Failure policy (deliberately non-uniform)

- **`upsertCheckRun` rethrows.** The design doc requires the Check Run to always be produced; a
  caller must not be able to mistake a missing check for a passing one. The one exception is
  *supplementary* annotation batches after the conclusion is already recorded — those warn with an
  explicit dropped-count rather than discarding an otherwise-complete check.
- **`upsertPrComment` warns on 401/403, rethrows otherwise.** A read-only token is the normal case
  for fork PRs; hard-failing every fork PR would be wrong. Non-permission errors are real bugs and
  propagate.
- **`postInlineReviewComments` never throws.** A 422 (line outside the diff) is the common failure,
  and the same findings are already published as check annotations, so the information is not lost.
- **`approvePr` never throws.** Explicitly required by the brief ("safe no-op if not authorized").

Nothing is swallowed silently — every degraded path logs what was skipped and why.

## Verification

- `npm run typecheck` — PASSED
- `npm test` — 53/53 passing, 7 files (no regressions)
- Runtime smoke test (temporary, removed before commit): module imports cleanly under Node ESM,
  `createGithubClient()` throws the expected error with no token, returns an object with all four
  methods with a token, and `chunkArray` produces `[50, 50, 20]` for 120 items.

No unit tests were added, consistent with the design doc ("`adapters/*` are not unit tested; a
manual verification checklist covers them before release") and with Tasks 3, 4 and 5.

## Concerns

1. **No `github_token` input in `action.yml`.** This is the reason for DONE_WITH_CONCERNS. `action.yml`
   (shipped in Task 1) has no token input, so the adapter falls back to `process.env.GITHUB_TOKEN`,
   which only works if the consumer sets it in the workflow step's `env:`. Every comparable action
   exposes `github_token` with `default: ${{ github.token }}` so it works out of the box. The factory
   takes an explicit `options.token` so **Task 7 can supply it without touching this file**, but
   `action.yml` and the README example need a decision. Recommend adding the input.

2. **Annotations duplicate on re-run of the same SHA.** The Checks API appends annotations on update
   and offers no way to clear them. A first run followed by a re-run of the same commit will show
   each annotation twice. New commits are unaffected (new head SHA → new check run). Low impact,
   no clean API-level fix; flagged rather than worked around.

3. **`checks: write` on fork PRs.** `upsertCheckRun` rethrows on failure by design, so a fork PR with
   a default read-only token will hard-fail the action rather than degrade. This is the correct
   default (a missing check must not read as a pass) but is worth documenting in the README's
   permissions section alongside the required `checks: write` / `pull-requests: write`.

4. **`MAX_INLINE_COMMENTS = 50` is invented.** GitHub does not document a hard cap on review comments;
   50 is a defensive bound to stop a pathological finding count from getting the whole review
   rejected. Truncation warns with the real count.

5. **Unsigned commit.** Same environment issue Task 5 recorded: `commit.gpgsign=true` in
   `~/.gitconfig` but no secret key present and `gpg` not on PATH. Committed with
   `-c commit.gpgsign=false` to match every prior commit on this branch. Worth resolving before the
   repo goes public if signed commits are intended.

## Parked / follow-ups

- `chunkArray` is pure and exported; if the team relaxes the no-adapter-tests rule, it and
  `buildAnnotations` / `buildFindingsMarkdown` are the parts worth covering.
- The manual verification checklist referenced by the design doc does not exist yet. It should cover,
  against a real test PR: check run appears with correct conclusion per verdict, >50 findings produce
  all annotations, re-push minimizes the old comment, inline comments land on the right lines, and
  auto-approve no-ops cleanly with GITHUB_TOKEN.
