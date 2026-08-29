## Claude Code Guidance

This file provides configuration and guidance for Claude Code when working with this repository. See [CLAUDE.md](CLAUDE.md) (symlinked from this file) for the full guidance.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/` at the repo root). See `docs/agents/domain.md`.

## Development Patterns

### Testing Strategy

- Unit tests use Vitest with fixtures for pure domain logic
- All domain functions in `src/domain/` have corresponding `.test.ts` files
- Adapters (`src/adapters/`) are tested manually/in integration, not by unit suite
- Run tests with `npm test` or `npm test -- --watch` for watch mode

### Architecture Decisions

- **Single orchestration seam**: All I/O flows through `runAction()` in `src/core/runAction.ts`
- **Injected adapters**: Git, filesystem, LLM provider, GitHub API are all swappable for testing
- **Deterministic-first filtering**: Large PRs use path/keyword matching before escalating to LLM-based filtering
- **Pure domain logic**: Everything in `src/domain/` is testable without I/O

### Building & Bundling

- TypeScript compilation to `build/` (not checked in)
- Distribution bundle built with `@vercel/ncc` into `dist/` (committed for GitHub Actions)
- Always run `npm run build` before committing dist changes
- The built dist bundle is what GitHub Actions consumers actually run
