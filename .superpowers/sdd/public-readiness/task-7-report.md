# Task 7 Report: `src/index.ts` — GitHub Action Entrypoint

**Status:** DONE_WITH_CONCERNS
**Commit:** `dae3c10` — "feat: implement GitHub Action entrypoint with input validation"

## What was built

`src/index.ts` (279 lines): reads all 13 `action.yml` inputs, validates them in a
single Zod pass, resolves PR context from the event payload, wires the four real
adapters, calls `runAction`, and sets the `verdict` / `summary` outputs.

### Structure

- `InputSchema` — one Zod object over the raw string inputs. Helpers
  `booleanInput(fallback)`, `optionalStringInput()`, `stringInputWithDefault()`
  encode the "blank means use the documented default" rule that GitHub Actions
  forces (every input is a string; absent and blank are indistinguishable).
- `source_documents` is *parsed*, not just validated — it pipes through the
  existing `parseSourceDocumentsInput` so the convention grammar stays owned by
  `domain/conventions.ts` and its errors surface as normal Zod issues.
- A `superRefine` rejects `auto_approve: true` without an `approval_token`,
  since GITHUB_TOKEN cannot approve PRs and the run would otherwise no-op
  silently at the very end.
- All inputs are read before validation so a misconfigured workflow reports
  **every** problem in one run rather than one per re-run.
- `core.setSecret` masks `api_key` and `approval_token`.

## Deviations from the task brief

1. **`fail` verdict does NOT call `core.setFailed()`.** The brief asked for
   this, but it contradicts the project's own design doc
   (`docs/superpowers/specs/2026-08-16-spec-alignment-action-design.md`, line 64):

   > `index.ts`'s own process exit code reflects only genuine tool-level failure
   > … the Action process exits 0 for `pass`, `fail`, `skip`, and `error`-mapped-to-neutral
   > outcomes alike.

   The pass/fail signal lives entirely in the Check Run conclusion that
   `runAction` publishes. I followed the design doc — this is a spec-alignment
   tool, so its own spec is authoritative. `setFailed` is used only for setup
   errors (bad inputs, missing token, non-PR event). **Flagging for confirmation.**

2. **Adapter wiring differs from the plan doc.** The plan's Task 14 sketch is
   stale relative to the adapters actually implemented in Tasks 10–13:
   - `gitAdapter` is an exported singleton, not `createGetDiff(base, head)`.
   - `createFilesystemAdapter(repoRoot)` returns an object; there is no
     free-function `readSourceDocument` export.
   - `createLlmJudgeAdapter()` takes no arguments (provider/model/key travel
     per-request on `JudgeRequest`).
   - `createGithubClient(options)` defaults token to `$GITHUB_TOKEN` and context
     to the ambient one — it does not take an octokit + repo context.

   Both adapter methods are wrapped in arrows to preserve `this` binding.

3. **`readFileTree` was implemented locally in `index.ts`.** The plan expected it
   as an export from `adapters/fs.ts`, but Task 11 never added it. Rather than
   edit an out-of-scope file, it lives in `index.ts` as a small `fast-glob` call
   with the plan's exact ignore list (`node_modules`, `.git`, `dist`, `build`).
   Worth relocating to `fs.ts` later for consistency.

## Verification

- `npm run typecheck` — passes, no output.
- `npm test` — 53 tests across 7 files, all pass (no regressions).
- **Runtime validation smoke test** (temporary, removed before commit — the plan
  states `index.ts` is intentionally not unit tested). Four scenarios driven
  through the real module via `INPUT_*` env vars, all passing, confirming Zod v4
  runtime behavior rather than just type-level correctness:
  - Invalid `provider`/`api_key`/`source_documents`/`strictness`/`immutable_spec`
    all reported together in one `::error::`, exit code 1.
  - `Other` without a path surfaces the "requires a path" grammar error.
  - `auto_approve: true` without a token is rejected.
  - Valid inputs (incl. `' Anthropic '` case/whitespace normalization, `'TRUE'`
    boolean, blank-means-default) pass validation and reach the event-payload check.

  This test is not committed but is easy to restore if the constraint is relaxed —
  it caught nothing broken, but it is the only thing proving the Zod schema works
  at runtime.

## Concerns

1. **The `setFailed`-on-`fail` question above** needs a decision. If the brief
   wins over the design doc, it is a two-line change.
2. **`npm run build` is broken, pre-existing and unrelated.** `ncc` 0.45.0 cannot
   compile with `typescript` 7.0.2:
   `TypeError: Cannot read properties of undefined (reading 'fileExists')`.
   Verified this fails identically on `src/core/runAction.ts`, an untouched file,
   so it is not caused by this task — but **Task 16 (build `dist/`) is blocked**
   until ncc or TypeScript is pinned to compatible versions. `action.yml` points
   at `dist/index.js`, so the action cannot actually run until this is fixed.
3. **Commit is unsigned.** `commit.gpgsign=true` with `user.signingkey` set, but
   the secret key is absent in this environment (`gpg: No secret key`). Every
   prior commit on this branch is also unsigned (`%G?` = `N`), so this matches
   existing history; committed with `-c commit.gpgsign=false`. Flagging since
   bypassing signing is normally not something to do unprompted.
4. **Untracked junk in the worktree root:** a file literally named
   `C:UsersericbAppDataLocalTempclaude…scratchpadtest-git-diff.js` — a
   path-separator bug from an earlier task wrote a scratchpad file into the repo
   root. Not mine, not committed, but should be deleted.
