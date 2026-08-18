# Contributing to spec-alignment

Thanks for your interest in contributing! This project is in early stages and we welcome contributions — bug reports, feature ideas, and pull requests.

## Getting Started

### Prerequisites

- Node.js 18+ (check `.nvmrc` or `package.json` for the exact version)
- npm or your preferred Node package manager

### Development Setup

```bash
# Clone the repo
git clone https://github.com/ebellefontaine/spec-alignment.git
cd spec-alignment

# Install dependencies
npm install

# Run tests
npm test
```

## What to Work On

### Good First Issues

If you're new to the project:
- Read the [design document](docs/superpowers/specs/2026-08-16-spec-alignment-action-design.md) to understand the architecture
- Look through open issues tagged `good-first-issue` or `documentation`
- Improve docs, add examples, or clarify error messages

### Bug Reports

Found a bug? 
1. Check [existing issues](https://github.com/ebellefontaine/spec-alignment/issues) to see if it's already reported
2. Open a [new issue](https://github.com/ebellefontaine/spec-alignment/issues/new?template=bug_report.md) with:
   - What you expected vs. what happened
   - Steps to reproduce
   - Your configuration (provider, spec format, etc.)
   - Any error logs or output

### Feature Requests

Have an idea?
1. Check [existing issues](https://github.com/ebellefontaine/spec-alignment/issues) to see if it's already been discussed
2. Open a [feature request](https://github.com/ebellefontaine/spec-alignment/issues/new?template=feature_request.md) describing:
   - The use case you're solving
   - The proposed behavior
   - Any alternatives you've considered

## Before You Submit a PR

### Testing

All changes should include tests. We use [Vitest](https://vitest.dev/).

```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test domain/discovery.test.ts
```

### Code Style

This project uses:
- **TypeScript** for type safety
- **Prettier** for formatting (run `npm run format`)
- **ESLint** for linting (run `npm run lint`)

```bash
npm run lint          # Check linting
npm run lint:fix      # Fix linting issues
npm run format        # Format code
```

### Documentation

If you're adding a feature or changing behavior:
- Update the [design document](docs/superpowers/specs/2026-08-16-spec-alignment-action-design.md) if the architecture changes
- Update [README.md](README.md) if it affects usage
- Add code comments if the intent isn't obvious from the code itself

## PR Workflow

1. **Fork the repo** and create a branch off `main`:
   ```bash
   git checkout -b fix/issue-description
   # or
   git checkout -b feature/feature-name
   ```

2. **Make your changes** and add tests

3. **Run checks locally**:
   ```bash
   npm test           # Tests must pass
   npm run lint:fix   # Fix linting
   npm run format     # Format code
   ```

4. **Commit with clear messages**:
   ```bash
   git commit -m "Fix: prevent LLM filter from exceeding token budget"
   ```

5. **Push and open a PR**:
   - Link to any related issues
   - Describe what the change does and why

6. **Wait for feedback**. A maintainer will review, and the CI checks must pass before merging.

## Code Organization

### Pure domain logic (`src/domain/`)

These modules are pure functions with no side effects. They're tested directly with fixture data:

- `discovery.ts` — Find spec documents based on conventions
- `relevanceFilter.ts` — Narrow docs and diff to stay within token budget
- `immutableSpecCheck.ts` — Check for spec + code changes in one PR
- `promptBuilder.ts` — Build the LLM judgment prompt
- `verdictMapper.ts` — Map LLM output to GitHub Checks conclusions

Add tests by creating a `.test.ts` file in the same directory with plain fixtures (no mocks).

### Adapters (`src/adapters/`)

These handle I/O: Git, filesystem, LLM providers, GitHub API. They're injected into `runAction` and verified manually before release, not via unit tests.

### The seam (`src/core/runAction.ts`)

One orchestration function that coordinates adapters and domain logic. Tested with fake adapters and fixture data.

## Questions?

- Open an issue to discuss before starting large changes
- Ask in the issue comments if you get stuck
- Review the [design document](docs/superpowers/specs/2026-08-16-spec-alignment-action-design.md) for architecture context

Thanks for contributing! 🎉
