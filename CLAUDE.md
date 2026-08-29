# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**spec-alignment** is a GitHub Action that validates whether code changes in pull requests align with project specifications using LLM-based judgment. It reads configured spec documents (Spec Kit, OpenSpec, Kiro, BMAD-METHOD, domain-modeling, or custom files), analyzes a PR's diff, and uses an LLM to determine if changes are consistent with and in scope of those specs. Results are reported via GitHub's Checks API with optional PR comments.

## Common Commands

```bash
# Install dependencies
npm install

# Run tests (Vitest)
npm test                 # Run all tests once
npm test -- --watch      # Run in watch mode

# Type checking
npm typecheck            # Check TypeScript types without emitting

# Build distribution bundle
npm run build            # Compile and bundle with @vercel/ncc to dist/
```

**Important**: After any code changes, run `npm run build` to update the `dist/` bundle before committing, since the action consumers run the bundled version.

## Project Structure

```
src/
  index.ts                    # Action entrypoint: reads inputs, builds adapters, calls runAction
  
  core/
    runAction.ts              # Main orchestration seam (single point where all I/O is coordinated)
    types.ts                  # Config, SourceDocument, DiffFile, Verdict, EvaluationResult types
  
  domain/                     # Pure domain logic (all testable without I/O)
    conventions.ts            # Resolves spec format conventions to concrete file globs
    discovery.ts              # Discovers and reads source documents
    relevanceFilter.ts        # Deterministic path/keyword filtering, escalates to LLM when needed
    immutableSpecCheck.ts     # Pure check: are both code and spec being modified?
    promptBuilder.ts          # Constructs the LLM judge prompt
    verdictMapper.ts          # Maps LLM verdict to GitHub Check conclusion
  
  adapters/                   # I/O layer (swappable for testing)
    git.ts                    # Git integration: get PR diff
    fs.ts                     # Filesystem: read source documents
    llm.ts                    # LLM provider bridge (Vercel AI SDK)
    github.ts                 # GitHub API: Checks, comments, reviews
    index.ts                  # Adapter types and factory
  
  tests/                      # Integration/functional tests
    action-schema.test.ts     # Input validation
    documentation.test.ts     # Spec format examples
    functional.test.ts        # End-to-end flows

dist/                        # Bundled output (committed; what GitHub Actions runs)
docs/
  PROVIDERS.md               # LLM provider setup guide
  superpowers/specs/         # Design documents
  superpowers/agents/        # Agent configuration
```

## Architecture

**Single seam design**: `runAction(adapters, config)` coordinates all logic.
- All I/O (git, filesystem, LLM, GitHub API) flows through injected adapters
- Domain logic (`src/domain/`) is pure and testable with fixtures
- Adapters are swappable, making tests deterministic and fast

**Data flow**:
1. Parse and validate `Config` from action inputs
2. Build real adapters (git, fs, LLM, GitHub)
3. Run discovery: resolve spec conventions → read source documents from PR head ref
4. Skip-condition checks (draft PR, no docs found, excluded paths only, bypass label)
5. If `immutable_spec` enabled, check if diff touches spec files (deterministic fail)
6. Relevance filter: deterministic path/keyword matching, escalate to LLM filter if over budget
7. Prompt construction: format hints, strictness level
8. LLM judgment → verdict mapping → GitHub reporting
9. Write results via GitHub Checks API (and optionally as PR comments)

**Key invariant**: Process always exits 0, verdict lives in the GitHub Check conclusion.

## Key Concepts

### Spec Formats (Conventions)

| Format | Default Paths | Example |
|--------|---------------|---------|
| `speckit` | `.specify/memory/constitution.md`, `specs/*/spec.md` | Spec Kit native format |
| `openspec` | `openspec/specs/**`, delta: `openspec/changes/<name>/specs/**` | Open-source OpenSpec |
| `kiro` | `.kiro/specs/<feature>/{requirements,design,tasks}.md` | Kiro format |
| `bmad` | `docs/prd.md`, `docs/architecture.md`, `docs/stories/*.story.md` | BMAD-METHOD |
| `domain-modeling` | `CONTEXT.md`, `docs/adr/**` | mattpocock-skills convention |
| `Other` | User-provided explicit path | Custom files/directories |

Specs are always read from the PR's **head ref**, handling both "spec unchanged" and "spec modified in this PR" uniformly.

### Relevance Filtering

Large PRs are filtered deterministically first (path/keyword matching against changed files), escalating to LLM-based filtering only if still over token budget. This keeps token usage predictable and avoids unnecessary LLM calls on obviously relevant/irrelevant diffs.

### Strictness Levels

`strict`, `balanced` (default), or `lenient` — folded into the judge prompt to calibrate where the `pass_with_drift` vs. `fail` boundary falls. Not a numeric threshold, since LLM severity scores aren't reliably calibrated.

### Immutable Spec Mode

When enabled (`immutable_spec: true`), a deterministic pre-check blocks any PR that touches both code and spec files simultaneously. No LLM call — it's an un-appealable file-path check. Ensures spec and code changes land in separate PRs.

## Development Workflow

### Adding a New Spec Convention

1. Add resolver logic to `src/domain/conventions.ts` (pure function mapping convention name to file globs)
2. Add tests in `src/domain/conventions.test.ts` with fixture examples
3. Document in `docs/PROVIDERS.md` or architecture docs
4. Update `README.md` feature list

### Modifying the Judge Prompt

Edit `src/domain/promptBuilder.ts`:
- Adjust format hints for different spec types
- Fold in strictness level changes
- Keep prompt deterministic (no randomness, same inputs = same prompt)
- Test with `src/domain/promptBuilder.test.ts`

### Adding LLM Provider Support

1. Update `src/adapters/llm.ts` to wire up the new provider via Vercel AI SDK
2. Add provider-specific config to `Config` type in `src/core/types.ts`
3. Document API key retrieval and model selection in `docs/PROVIDERS.md`
4. Test with provider credentials in integration tests

### Testing Domain Logic

All pure domain functions are tested directly with fixtures:
```typescript
// Example from src/domain/relevanceFilter.test.ts
const changedFiles = [/* diff files */];
const docs = [/* source documents */];
const filtered = filterRelevantDocs(changedFiles, docs, config);
expect(filtered).toEqual(/* expected subset */);
```

Run tests with `npm test -- --watch` while developing.

## Bundling & Deployment

The action is distributed as a pre-bundled JavaScript file (GitHub Actions best practice):

```bash
npm run build    # Outputs dist/index.js
```

This runs `@vercel/ncc`, which:
- Transpiles TypeScript
- Bundles all dependencies
- Minifies the output
- Creates a single `dist/index.js` that GitHub Actions can execute directly

**Always commit `dist/` changes** after modifying code. GitHub Actions consumers don't run `npm install`; they run the bundled dist directly.

## Testing Patterns

### Unit Tests (Pure Domain)

Located in `src/domain/*.test.ts`. Use plain fixtures, no mocks:
```typescript
const result = discoveryResolve(['domain-modeling'], config);
expect(result).toEqual(['CONTEXT.md', 'docs/adr/...']);
```

### Functional Tests

Located in `src/tests/*.test.ts`. Test end-to-end flows with fixture data simulating real GitHub events.

### Manual Integration Testing

When testing against real LLM providers or GitHub:
1. Set environment variables for API keys (e.g., `ANTHROPIC_API_KEY`)
2. Create a test branch with realistic changes
3. Run the action locally via `act` (GitHub Actions simulator) or a test workflow
4. Verify Check output and PR comments

## Debugging Tips

- **Type errors**: Run `npm typecheck` to catch issues before testing
- **Prompt construction**: Add `console.log(prompt)` in `promptBuilder.ts` to see what the LLM sees
- **Diff analysis**: Check `relevanceFilter.ts` logic when filtering seems wrong
- **GitHub API**: Verify `adapters/github.ts` is posting to the right Check/comment endpoints
- **Provider issues**: Check `adapters/llm.ts` is passing the right model/config to Vercel AI SDK

## Release Management

The action follows semantic versioning and maintains major version branches for easy consumer updates.

**Release Files & Documentation:**
- `CHANGELOG.md` — Keep a Changelog format; source of truth for release notes
- `docs/VERSIONING.md` — Versioning strategy and breaking change policy
- `docs/RELEASE.md` — Step-by-step release checklist for maintainers
- `.github/workflows/release.yml` — Automated release workflow (triggered by version tags)

**Release Process Overview:**

1. **Prepare changes** on `main` branch; all tests passing
2. **Update CHANGELOG.md** with changes for this release
3. **Create release commit:** `git commit -m "chore: release v1.2.0"`
4. **Tag release:** `git tag -a v1.2.0 -m "Release v1.2.0"`
5. **Push to GitHub:** `git push origin main && git push origin v1.2.0`
6. **Workflow runs automatically:**
   - Creates GitHub Release with changelog notes
   - Updates major version branch (e.g., `v1` → `v1.2.0`)
   - Consumers using `@v1` get latest v1.x.x automatically

**Version Scheme:**
- `v1.2.3` (MAJOR.MINOR.PATCH)
- MAJOR: Breaking changes (input removal, output format change)
- MINOR: New backwards-compatible features
- PATCH: Bug fixes and non-breaking improvements
- Major version branches (`v1`, `v2`, etc.) point to latest patch in that series

**Key Maintainer Considerations:**
- Always update `dist/index.js` via `npm run build` before releasing
- Major version branches are auto-updated by release workflow; do not edit manually
- Pre-release versions (0.1.0) precede v1.0.0; afterwards all versions use semver strictly
- See `docs/RELEASE.md` for detailed step-by-step instructions

## References

- **Design document**: `docs/superpowers/specs/2026-08-16-spec-alignment-action-design.md` — full specification
- **Providers guide**: `docs/PROVIDERS.md` — LLM provider setup and comparison
- **Agent setup**: See `AGENTS.md` for agent skills and workflows
