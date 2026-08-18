# spec-alignment

A GitHub Action that validates whether code changes in pull requests align with your project's specifications using LLM-based judgment.

## Problem

Teams write specs (feature specs, PRDs, functional requirements docs) using a variety of tools and conventions, but nothing checks whether a pull request's actual code changes stay consistent with — or in scope of — those specs. Drift between spec and implementation is discovered late, if at all, usually by a human reviewer who has to hold the whole spec in their head while reading a diff.

## Solution

spec-alignment reads your configured spec documents, analyzes the PR's diff, and uses an LLM (your choice of provider) to judge whether the changes are consistent with and in scope of those documents. Results are reported via GitHub's Checks API and optional PR review comments.

## Features

- **Multiple spec formats supported**: Spec Kit, OpenSpec, Kiro, BMAD-METHOD, domain-modeling convention, or arbitrary files/directories
- **Multiple LLM providers**: Anthropic, OpenAI, or Google (via Vercel AI SDK)
- **Configurable strictness**: `strict`, `balanced`, or `lenient` evaluation
- **Large-PR handling**: Deterministic relevance filtering + optional LLM-based filtering to keep token usage predictable
- **Auto-approval**: Optional automatic PR approval when the check passes
- **Immutable spec mode**: Optionally enforce that spec and code changes land in separate PRs
- **GitHub integration**: Reports via Checks API, with optional PR review comments

## Quick Start

### Installation

Add to your workflow file (e.g., `.github/workflows/spec-check.yml`):

```yaml
name: Spec Alignment Check
on: [pull_request]
jobs:
  spec-check:
    runs-on: ubuntu-latest
    permissions:
      checks: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: ebellefontaine/spec-alignment@main
        with:
          provider: anthropic
          api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          source_documents: |
            domain-modeling
            Other - docs/implementation-notes.md
```

### Configuration

Required inputs:
- `provider`: `anthropic`, `openai`, or `google`
- `api_key`: Your LLM provider's API key (store as a GitHub secret)
- `source_documents`: Multi-line spec source locations (see [Design Doc](docs/superpowers/specs/2026-08-16-spec-alignment-action-design.md#specsource-discovery) for format)

Optional inputs:
- `model`: LLM model to use (defaults per provider)
- `strictness`: `strict`, `balanced` (default), or `lenient`
- `comment_on_pr`: Post a summary comment on the PR (default: `true`)
- `inline_review_comments`: Post review comments at specific lines (default: `false`)
- `immutable_spec`: Block PRs that modify both spec and code (default: `false`)
- `auto_approve`: Automatically approve PRs that pass (default: `false`)
- `approval_token`: Required if using `auto_approve` (PAT or GitHub App token)
- `fail_closed_on_error`: Treat LLM errors as failures instead of neutral (default: `false`)

See the [design document](docs/superpowers/specs/2026-08-16-spec-alignment-action-design.md#configuration-surface-actionyml-inputs) for complete details.

## Architecture

- **Pure domain logic**: Spec discovery, relevance filtering, prompt building — all tested directly with fixtures
- **Injected adapters**: Git integration, filesystem, LLM provider, GitHub API — swappable for testing
- **Single seam**: One orchestration function (`runAction`) coordinates everything
- **Deterministic filtering**: Large PRs are handled via deterministic path/keyword matching first, with LLM filtering only as a fallback

See [Architecture](docs/superpowers/specs/2026-08-16-spec-alignment-action-design.md#architecture) in the design document for details.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get started.

## Development

### Setup

```bash
npm install
npm test
```

### Running Tests

```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
```

### Code Structure

```
src/
  index.ts                  # Action entrypoint
  core/
    runAction.ts            # Main orchestration
    types.ts                # TypeScript types
  domain/
    conventions.ts          # Spec format resolution
    discovery.ts            # Document discovery
    relevanceFilter.ts      # Token budget filtering
    immutableSpecCheck.ts   # Pre-check for immutable mode
    promptBuilder.ts        # LLM prompt construction
    verdictMapper.ts        # Result mapping to GitHub Checks
  adapters/
    git.ts                  # Git integration
    fs.ts                   # Filesystem operations
    llm.ts                  # LLM provider integration
    github.ts               # GitHub API client
```

## License

MIT — See [LICENSE](LICENSE) for details.

## Status

**v0.1.0 — Early experimental**. Breaking changes may occur. See [design document](docs/superpowers/specs/2026-08-16-spec-alignment-action-design.md) for the full scope and future work.

## Acknowledgments

Built with the [Vercel AI SDK](https://sdk.vercel.ai/) for multi-provider LLM support.
