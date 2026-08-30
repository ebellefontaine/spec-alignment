# Issue Labels

This document describes the recommended labels for organizing issues and pull requests in the spec-alignment repository.

## Priority

- **priority: critical** — Breaks existing functionality or prevents releases
- **priority: high** — Important feature or significant bug affecting user experience
- **priority: medium** — Nice-to-have improvements or minor bugs
- **priority: low** — Polish, edge cases, or future enhancements

## Type

- **type: bug** — Report of something broken or not working as expected
- **type: feature** — New capability or enhancement to existing features
- **type: enhancement** — Improvement to existing code, docs, or processes
- **type: documentation** — Documentation improvements, guides, or examples
- **type: refactor** — Internal improvements without user-facing changes
- **type: test** — Test coverage improvements or test infrastructure

## Status

- **status: needs-review** — Ready for review; waiting on maintainer
- **status: in-progress** — Actively being worked on
- **status: blocked** — Blocked by another issue or decision
- **status: on-hold** — Intentionally paused; will resume later
- **status: wontfix** — Closed with decision not to implement

## Contributor Experience

- **good-first-issue** — Great starting point for new contributors
- **help-wanted** — Contributions welcome; maintainer cannot prioritize
- **discussion** — Needs discussion before implementation
- **question** — User asking for help or clarification

## Area

- **area: cli** — Relates to command-line interface or action inputs
- **area: lm** — Relates to LLM provider integration or prompting
- **area: specs** — Relates to spec format detection and parsing
- **area: github** — Relates to GitHub API integration
- **area: performance** — Relates to speed, efficiency, or resource usage
- **area: testing** — Relates to test suite or test infrastructure

## Provider

- **provider: anthropic** — Specific to Anthropic API integration
- **provider: openai** — Specific to OpenAI API integration
- **provider: google** — Specific to Google API integration
- **provider: openrouter** — Specific to OpenRouter integration

## Format

- **format: speckit** — Spec Kit format support
- **format: openspec** — OpenSpec format support
- **format: kiro** — Kiro format support
- **format: bmad** — BMAD-METHOD format support
- **format: domain-modeling** — Domain modeling convention support

## How to Use

When creating an issue or pull request:

1. Assign a **type** label (what is this?)
2. Assign a **priority** label if it's an issue (when should it be addressed?)
3. Add **area** labels if applicable (what parts of the code?)
4. Add **provider** or **format** labels if relevant to specific integrations
5. Use **status** labels only on pull requests (what's the current state?)
6. Use **good-first-issue** or **help-wanted** to invite contributions

## Suggested Emoji

Add these as label colors/descriptions in GitHub:

- 🐛 bug — `#d73a49` (red)
- ✨ feature — `#28a745` (green)
- 📚 documentation — `#0366d6` (blue)
- 🔨 enhancement — `#a2eeef` (cyan)
- 🧪 test — `#bfd4f2` (light blue)
- ♻️ refactor — `#fbca04` (yellow)
- ❓ question — `#ffd6a5` (orange)
- 🆘 help-wanted — `#f29513` (dark orange)
- 🚀 good-first-issue — `#7057ff` (purple)
