# Versioning Strategy

spec-alignment follows [Semantic Versioning](https://semver.org/).

## Version Format

`MAJOR.MINOR.PATCH` (e.g., `1.2.3`)

### MAJOR Version
Incremented for breaking changes that require workflow updates:
- Removing or renaming action inputs
- Changing output format/content in incompatible ways
- Removing support for spec formats or LLM providers
- Changing GitHub token requirements (e.g., requiring new permissions)

When a major version is released, the previous major version branch (`v1`, `v2`, etc.) is frozen for backports only.

### MINOR Version
Incremented for backwards-compatible new features:
- Adding new action inputs (with sensible defaults)
- Adding new spec format support
- Adding new LLM provider support
- Adding optional outputs

All workflows using the previous MINOR version continue to work unchanged.

### PATCH Version
Incremented for bug fixes and non-breaking improvements:
- Security fixes
- Bug fixes in judgment logic
- Performance improvements
- Documentation improvements
- Test improvements

All workflows are unaffected.

## Pre-Release Versions

The action uses pre-release versions during experimental phases (e.g., `0.1.0`, `0.2.0-beta.1`). Once v1.0.0 is released, all versions follow semver strictly.

## Backporting Policy

- **Critical bugs/security fixes:** Backported to previous MAJOR versions if still actively used
- **MINOR/PATCH features:** Only released forward; no backports
- **Documentation:** Backported to all supported versions

## GitHub Branch Strategy

- **main:** Development branch; all PRs merge here
- **v1, v2, v3, ...:** Major version branches; point to latest patch for that major version
  - e.g., `v1` points to `v1.5.3` (latest v1.x.x)
  - Updated by release workflow after tagging
  - Allows consumers to use `@v1` to get latest v1.x patches
- **Release tags:** `v1.5.3` tags identify exact releases; immutable

## Release Process Checklist

See [RELEASE.md](./RELEASE.md) for step-by-step maintainer instructions.
