# Release Guide

This guide walks through the process of releasing a new version of spec-alignment.

## Pre-Release Checklist

- [ ] All intended changes are merged to `main`
- [ ] `npm test` passes locally
- [ ] `npm typecheck` passes
- [ ] `npm run build` succeeds and dist/ is up-to-date
- [ ] Code review checklist passed
- [ ] No outstanding bugs blocking this release

## Determine Version Number

Check [VERSIONING.md](./VERSIONING.md) to determine MAJOR.MINOR.PATCH:

```bash
# Check last release tag
git tag -l | sort -V | tail -5

# Check unreleased changes in CHANGELOG.md
# Decide: is this PATCH, MINOR, or MAJOR?
```

## Update Files

### 1. Update CHANGELOG.md

Move "Unreleased" section to new version with today's date:

```markdown
## [1.2.0] - 2026-08-29

### Added
- New feature X
- New feature Y

### Fixed
- Bug fix Z

## [Unreleased]

### Added

### Changed

### Fixed
...

---

[Unreleased]: https://github.com/ebellefontaine/spec-alignment/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/ebellefontaine/spec-alignment/compare/v1.1.0...v1.2.0
[1.1.0]: ...
```

### 2. Update package.json Version

```bash
npm version minor  # or patch, or major
# This updates package.json and package-lock.json, creates a git tag
# OR manually edit package.json "version" field
```

### 3. Verify action.yml Points to Correct Version (Optional)

The action.yml version field is informational. Update if you want to track it:

```yaml
# Optional: update version comment if action.yml has one
name: spec-alignment
description: Validates PR code changes against specification documents using LLM judgment
# version: "1.2.0"  (Optional; not parsed by GitHub)
```

## Create Release Commit

```bash
git add package.json package-lock.json CHANGELOG.md action.yml docs/VERSIONING.md
git commit -m "chore: release v1.2.0"
```

## Tag the Release

```bash
git tag -a v1.2.0 -m "Release v1.2.0"
# Verify tag
git tag -l | tail -1
git show v1.2.0 | head -20
```

## Push to GitHub

```bash
git push origin main
git push origin v1.2.0
```

This automatically triggers the release workflow (`.github/workflows/release.yml`), which:
1. Creates a GitHub Release with changelog notes
2. Updates the major version branch (e.g., `v1` → `v1.2.0`)
3. (Optional) Publishes to GitHub Marketplace if configured

## Post-Release

- Monitor GitHub Actions for any workflow failures
- Verify GitHub Release was created and has correct notes
- Verify major version branch was updated (check `git branch -av`)
- Optionally announce release in project discussions or changelog

## Rollback (If Needed)

If a release has a critical issue:

```bash
# Delete the tag locally and on GitHub
git tag -d v1.2.0
git push origin --delete v1.2.0

# Fix the issue, update CHANGELOG, and re-release
git commit -m "fix: critical issue in v1.2.0"
git tag -a v1.2.0 -m "Release v1.2.0 (fixed)"
git push origin v1.2.0
```

---

## GitHub Release Notes Template

The release workflow creates a GitHub Release with this format:

```
## Release Notes

**What's New in v1.2.0**

[Changelog excerpt copied from CHANGELOG.md]

## Installation

Update your workflow to use the latest version:

```yaml
- uses: ebellefontaine/spec-alignment@v1
  with:
    provider: anthropic
    api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    source_documents: domain-modeling
```

Or pin to this exact version:

```yaml
- uses: ebellefontaine/spec-alignment@v1.2.0
```

## Upgrading

See [VERSIONING.md](../docs/VERSIONING.md) for breaking changes and migration guides.
```
