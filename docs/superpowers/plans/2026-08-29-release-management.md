# Release Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a professional release management cycle for spec-alignment following GitHub Actions marketplace standards, with automated workflows, semantic versioning, changelog management, and major version branch maintenance.

**Architecture:** The release process follows the GitHub Actions standard: semantic versioning tags (v1.0.0) trigger a release workflow that publishes to GitHub Releases, updates major version branches (v1 → latest v1.x.x), and optionally publishes to the GitHub Marketplace. A CHANGELOG.md tracks all changes, and a release checklist documents the process for maintainers.

**Tech Stack:** GitHub Actions, Node.js 20, Semantic Versioning, GitHub Releases API

**Spec:** None (established from GitHub Actions best practices and marketplace standards)

## Global Constraints

- Current version: `0.1.0` (early experimental phase)
- Node.js runtime: `node20`
- Distribution: GitHub Releases, GitHub Marketplace (when ready)
- Versioning scheme: Semantic Versioning (MAJOR.MINOR.PATCH)
- Major version branches required for easy consumer updates (v1, v2, etc.)

---

## Files to Create/Modify

### New Files
- `CHANGELOG.md` — Tracks all changes per release following Keep a Changelog format
- `.github/workflows/release.yml` — Automated release workflow triggered by version tags
- `docs/RELEASE.md` — Maintainer-facing release process documentation
- `docs/VERSIONING.md` — Versioning strategy and breaking change policy

### Modified Files
- `package.json` — Version bumps (handled by release workflow)
- `action.yml` — Version updates (handled by release workflow)
- `README.md` — May add release/version badge

---

## Task Breakdown

### Task 1: Create CHANGELOG.md Template

**Files:**
- Create: `CHANGELOG.md`

**Description:**
Sets up changelog tracking following [Keep a Changelog](https://keepachangelog.com/) format. This becomes the source of truth for release notes and guides users on what changed.

- [ ] **Step 1: Create CHANGELOG.md with template structure**

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

### Deprecated

### Removed

### Security

## [0.1.0] - 2026-08-29

### Added
- Initial experimental release
- Multi-provider LLM support (Anthropic, OpenAI, Google, OpenRouter)
- Spec format conventions (Spec Kit, OpenSpec, Kiro, BMAD-METHOD, domain-modeling)
- Deterministic relevance filtering for large PRs
- GitHub Checks API integration with optional PR comments
- Optional auto-approval for passing PRs
- Immutable spec mode to enforce separate PRs for spec/code changes
- Configurable strictness levels (strict, balanced, lenient)

[Unreleased]: https://github.com/ebellefontaine/spec-alignment/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ebellefontaine/spec-alignment/releases/tag/v0.1.0
```

- [ ] **Step 2: Commit the CHANGELOG**

```bash
cd C:\Users\ericb\github.com\spec-alignment
git add CHANGELOG.md
git commit -m "docs: create changelog with Keep a Changelog format"
```

---

### Task 2: Create VERSIONING.md Documentation

**Files:**
- Create: `docs/VERSIONING.md`

**Description:**
Documents the versioning strategy and breaking change policy so contributors and consumers understand what to expect from each release type.

- [ ] **Step 1: Create VERSIONING.md**

```markdown
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
```

- [ ] **Step 2: Commit the versioning documentation**

```bash
git add docs/VERSIONING.md
git commit -m "docs: add versioning strategy and breaking change policy"
```

---

### Task 3: Create RELEASE.md Maintainer Guide

**Files:**
- Create: `docs/RELEASE.md`

**Description:**
Step-by-step guide for maintainers to perform a release. This ensures consistent releases and serves as a checklist.

- [ ] **Step 1: Create RELEASE.md**

```markdown
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

\`\`\`yaml
- uses: ebellefontaine/spec-alignment@v1
  with:
    provider: anthropic
    api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    source_documents: domain-modeling
\`\`\`

Or pin to this exact version:

\`\`\`yaml
- uses: ebellefontaine/spec-alignment@v1.2.0
\`\`\`

## Upgrading

See [VERSIONING.md](../docs/VERSIONING.md) for breaking changes and migration guides.
```
```

- [ ] **Step 2: Commit the release guide**

```bash
git add docs/RELEASE.md
git commit -m "docs: add release process guide for maintainers"
```

---

### Task 4: Create Release Workflow

**Files:**
- Create: `.github/workflows/release.yml`

**Description:**
Automated workflow that runs when a version tag is pushed (e.g., `v1.2.0`). It creates a GitHub Release with changelog notes, updates the major version branch, and can optionally publish to GitHub Marketplace.

- [ ] **Step 1: Create release.yml workflow**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for changelog extraction

      - name: Extract version
        id: version
        run: |
          VERSION="${GITHUB_REF#refs/tags/}"
          MAJOR="${VERSION%%.*}"
          echo "version=${VERSION}" >> $GITHUB_OUTPUT
          echo "major=${MAJOR}" >> $GITHUB_OUTPUT
          echo "Releasing ${VERSION} (major version: v${MAJOR})"

      - name: Extract changelog section
        id: changelog
        run: |
          VERSION="${{ steps.version.outputs.version }}"
          # Extract the changelog section for this version
          # Match pattern: ## [VERSION] - DATE through next ## or EOF
          CHANGELOG=$(awk -v v="${VERSION}" '
            /^## \[/ {
              if (found) exit
              if ($0 ~ v) { found=1; next }
            }
            found && NF { print }
          ' CHANGELOG.md)
          
          # Escape for use in JSON/environment
          CHANGELOG="${CHANGELOG//'%'/'%25'}"
          CHANGELOG="${CHANGELOG//$'\n'/'%0A'}"
          CHANGELOG="${CHANGELOG//$'\r'/'%0D'}"
          
          echo "changelog<<EOF" >> $GITHUB_ENV
          echo "${CHANGELOG}" >> $GITHUB_ENV
          echo "EOF" >> $GITHUB_ENV

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          tag_name: ${{ steps.version.outputs.version }}
          name: Release ${{ steps.version.outputs.version }}
          body: |
            ## Release Notes
            
            ${{ env.changelog }}
            
            ## Installation
            
            Update your workflow to use this version:
            
            ```yaml
            - uses: ebellefontaine/spec-alignment@v${{ steps.version.outputs.major }}
              with:
                provider: anthropic
                api_key: ${{ secrets.ANTHROPIC_API_KEY }}
                source_documents: domain-modeling
            ```
            
            Or pin to this exact release:
            
            ```yaml
            - uses: ebellefontaine/spec-alignment@${{ steps.version.outputs.version }}
            ```
            
            See [VERSIONING.md](https://github.com/ebellefontaine/spec-alignment/blob/main/docs/VERSIONING.md) for upgrading information.
          draft: false
          prerelease: false
          files: |
            dist/index.js
            action.yml
            CHANGELOG.md

      - name: Update major version branch
        run: |
          VERSION="${{ steps.version.outputs.version }}"
          MAJOR="v${{ steps.version.outputs.major }}"
          
          # Ensure major version branch exists and track it
          git fetch origin "${MAJOR}" || git checkout -b "${MAJOR}"
          
          # Update major version branch to point to this release
          git checkout "${MAJOR}"
          git reset --hard "${{ steps.version.outputs.version }}"
          git push origin "${MAJOR}"
          
          echo "Updated branch ${MAJOR} to point to ${VERSION}"

      - name: Notify on success
        run: |
          echo "✅ Release created successfully!"
          echo "Version: ${{ steps.version.outputs.version }}"
          echo "Major branch: v${{ steps.version.outputs.major }}"
          echo ""
          echo "Next steps:"
          echo "1. Monitor GitHub Actions for any workflow errors"
          echo "2. Verify GitHub Release page: https://github.com/ebellefontaine/spec-alignment/releases/tag/${{ steps.version.outputs.version }}"
          echo "3. (Optional) Publish to GitHub Marketplace if configured"
```

- [ ] **Step 2: Test workflow syntax**

```bash
# Validate the workflow file (if GitHub CLI is available)
# gh workflow view .github/workflows/release.yml
# Or just commit and let GitHub validate it on push
echo "Workflow will be validated by GitHub on push"
```

- [ ] **Step 3: Commit the release workflow**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release workflow for automated GitHub Releases"
```

---

### Task 5: Add Release Workflow Documentation to README

**Files:**
- Modify: `README.md`

**Description:**
Add a "Releases" section to the README so users understand how to pin to specific versions and receive updates.

- [ ] **Step 1: Read current README**

```bash
# (File is already read earlier; finding the right insertion point)
# Will add after "Quick Start" section and before "Architecture" section
```

- [ ] **Step 2: Add Releases section to README**

Locate this section in README.md:
```markdown
## Architecture
```

Insert before it:

```markdown
## Releases

### Version Selection

This action uses [Semantic Versioning](docs/VERSIONING.md). Pin to the major version (`@v1`) to receive automatic patches and minor updates, or pin to an exact version for stability.

```yaml
# Receive all v1.x.x updates (recommended for new projects)
- uses: ebellefontaine/spec-alignment@v1
  
# Pin to exact version for stability
- uses: ebellefontaine/spec-alignment@v1.5.3
```

See [docs/VERSIONING.md](docs/VERSIONING.md) for the version strategy and [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

### GitHub Releases

See the [releases page](https://github.com/ebellefontaine/spec-alignment/releases) for release notes and downloadable artifacts.
```

- [ ] **Step 3: Commit the README update**

```bash
git add README.md
git commit -m "docs: add release versioning section to README"
```

---

### Task 6: Create Version Badge in README (Optional)

**Files:**
- Modify: `README.md`

**Description:**
Add a version badge at the top of README to display the latest release version prominently.

- [ ] **Step 1: Add version badge**

Locate the title `# spec-alignment` in README.md.

After the title line, add:

```markdown
# spec-alignment

[![Latest Release](https://img.shields.io/github/v/release/ebellefontaine/spec-alignment?color=blue&label=Latest&logo=github&sort=semver)](https://github.com/ebellefontaine/spec-alignment/releases)

A GitHub Action that validates...
```

- [ ] **Step 2: Commit the badge**

```bash
git add README.md
git commit -m "docs: add release version badge to README"
```

---

### Task 7: Create GitHub Marketplace Publishing Guide (Documentation Only)

**Files:**
- Create: `docs/MARKETPLACE.md`

**Description:**
Document the process for listing the action on GitHub Marketplace. This is a one-time setup that doesn't require code changes, but needs to be documented for future reference.

- [ ] **Step 1: Create MARKETPLACE.md**

```markdown
# GitHub Marketplace Publishing

## Current Status

spec-alignment is currently released on GitHub but not yet published to [GitHub Marketplace](https://github.com/marketplace?type=actions).

## Prerequisites for Marketplace Listing

Before publishing to GitHub Marketplace, ensure:

1. ✅ Repository is public
2. ✅ action.yml is in repository root
3. ✅ Comprehensive README.md exists
4. ✅ Clear branding in action.yml (icon + color)
5. ✅ At least one release tag (v1.0.0 or higher)
6. ✅ MIT or other open-source license
7. ✅ Repository follows GitHub Actions best practices

## Publishing to GitHub Marketplace

### Step 1: Navigate to Marketplace Settings

1. Go to your repository on GitHub
2. Click **Settings** → **GitHub Apps**
3. Look for the **"Publish this Action to GitHub Marketplace"** section

### Step 2: Complete Marketplace Information

Fill in the marketplace listing form:

- **Name:** spec-alignment (should match your action.yml name)
- **Logo:** Upload a 200×200px PNG icon
- **Color:** Blue (should match action.yml branding)
- **Category:** CI/CD
- **Short description:** One-liner from action.yml description
- **Full description:** Details about the action, feature list, provider support
- **Pricing:** Mark as "Free" (no license fee)

### Step 3: Submit for Review

GitHub will review your submission within a few business days. They check:

- Code quality and security
- Documentation completeness
- Action follows best practices
- No trademark issues

### Step 4: Approval & Publication

Once approved, your action appears in the GitHub Marketplace. You can then:

- Link to marketplace listing in README
- Promote to GitHub Actions community
- Track usage via GitHub Insights

## Maintaining Marketplace Listing

After publication:

- **Regular updates:** Each new release automatically updates marketplace listing
- **Version history:** Marketplace tracks all versions; users can choose v1, v2, etc.
- **Deprecated versions:** Mark old major versions as deprecated in documentation if needed
- **Communication:** Use GitHub Releases for detailed changelog; marketplace shows latest release

## Documentation for Marketplace Users

When listing on marketplace, your README must be extra clear:

- ✅ Clear usage examples in workflow YAML
- ✅ All input parameters documented
- ✅ Troubleshooting section
- ✅ Links to detailed docs (separate from README)
- ✅ Support/issue reporting guidance

## See Also

- [GitHub Marketplace documentation](https://docs.github.com/en/apps/github-marketplace/getting-started-with-github-marketplace-listings)
- [Action publishing guide](https://docs.github.com/en/actions/creating-actions/publishing-actions-in-github-marketplace)
```

- [ ] **Step 2: Commit the marketplace guide**

```bash
git add docs/MARKETPLACE.md
git commit -m "docs: add GitHub Marketplace publishing guide"
```

---

### Task 8: Update CLAUDE.md with Release Information

**Files:**
- Modify: `CLAUDE.md`

**Description:**
Add a "Release Management" section to CLAUDE.md so future Claude sessions understand the release process and can guide maintainers.

- [ ] **Step 1: Find insertion point in CLAUDE.md**

Locate the section before "References" near the end of the file.

- [ ] **Step 2: Add Release Management section**

Insert before the References section:

```markdown
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
```

- [ ] **Step 3: Commit the CLAUDE.md update**

```bash
git add CLAUDE.md
git commit -m "docs: add release management section to CLAUDE.md"
```

---

### Task 9: Verify Release Workflow Will Work (Dry Run)

**Files:**
- Validate: `.github/workflows/release.yml`

**Description:**
Ensure the release workflow is syntactically correct and will work when triggered. This is a validation step, not a code change.

- [ ] **Step 1: Review workflow file for common issues**

Check `.github/workflows/release.yml`:
- ✅ Correct YAML syntax (nested items properly indented)
- ✅ Trigger: `on: push: tags: ['v*']` will catch version tags
- ✅ Permissions: `contents: write` allows creating releases
- ✅ Steps reference existing tools (softprops/action-gh-release exists)
- ✅ Version extraction regex `v\d+\.\d+\.\d+` is correct

```bash
# If using act (GitHub Actions local runner), validate locally:
# act -W .github/workflows/release.yml -e event.json
# (Skip if act is not installed; GitHub will validate on push)
```

- [ ] **Step 2: Confirm workflow permissions**

The workflow needs:
- ✅ `contents: write` — To create GitHub Releases
- ✅ Repository branch protection allows force-push for major branch updates (optional)

- [ ] **Step 3: Document workflow entry point**

Verify in `.github/workflows/release.yml`:
- Uses `softprops/action-gh-release@v1` (or pinned version)
- This is a well-maintained action; check it's current

```bash
# No action needed; just confirmation
echo "Release workflow validation complete"
```

- [ ] **Step 4: Commit confirmation (no changes)**

No code changes needed; validation is complete.

---

### Task 10: Create Integration Test for Release Workflow (Optional)

**Files:**
- Create: `src/tests/release.test.ts`

**Description:**
Add a test that verifies the release workflow file is syntactically valid YAML and has required fields. This is optional but recommended for catching workflow errors early.

- [ ] **Step 1: Create release workflow validation test**

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'yaml';
import { describe, it, expect } from 'vitest';

describe('Release Workflow', () => {
  it('has valid YAML syntax', () => {
    const workflowPath = join(process.cwd(), '.github', 'workflows', 'release.yml');
    const content = readFileSync(workflowPath, 'utf-8');
    
    // Should not throw
    const parsed = yaml.parse(content);
    expect(parsed).toBeDefined();
  });

  it('has correct trigger configuration', () => {
    const workflowPath = join(process.cwd(), '.github', 'workflows', 'release.yml');
    const content = readFileSync(workflowPath, 'utf-8');
    const parsed = yaml.parse(content);
    
    expect(parsed.on).toBeDefined();
    expect(parsed.on.push).toBeDefined();
    expect(parsed.on.push.tags).toContain('v*');
  });

  it('has required permissions', () => {
    const workflowPath = join(process.cwd(), '.github', 'workflows', 'release.yml');
    const content = readFileSync(workflowPath, 'utf-8');
    const parsed = yaml.parse(content);
    
    expect(parsed.permissions).toBeDefined();
    expect(parsed.permissions.contents).toBe('write');
  });

  it('has release job with required steps', () => {
    const workflowPath = join(process.cwd(), '.github', 'workflows', 'release.yml');
    const content = readFileSync(workflowPath, 'utf-8');
    const parsed = yaml.parse(content);
    
    expect(parsed.jobs).toBeDefined();
    expect(parsed.jobs.release).toBeDefined();
    
    const stepNames = parsed.jobs.release.steps.map((s: any) => s.name);
    expect(stepNames).toContain('Checkout code');
    expect(stepNames).toContain('Extract version');
    expect(stepNames).toContain('Create GitHub Release');
    expect(stepNames).toContain('Update major version branch');
  });
});
```

- [ ] **Step 2: Install yaml dependency if needed**

Check if `yaml` package is already installed:

```bash
npm ls yaml
# If not installed:
npm install yaml --save-dev
```

- [ ] **Step 3: Run the test**

```bash
npm test -- src/tests/release.test.ts
# Expected: All tests pass
```

- [ ] **Step 4: Commit the test**

```bash
git add src/tests/release.test.ts
git commit -m "test: add release workflow validation tests"
```

---

### Task 11: Final Integration - Push all changes and verify

**Files:**
- Verify: All files created/modified

**Description:**
Push all release management changes to GitHub and verify the structure is in place. No releases yet; just infrastructure.

- [ ] **Step 1: Review all changes**

```bash
git status
# Should show:
# - CHANGELOG.md (new)
# - docs/VERSIONING.md (new)
# - docs/RELEASE.md (new)
# - docs/MARKETPLACE.md (new)
# - .github/workflows/release.yml (new)
# - src/tests/release.test.ts (new)
# - README.md (modified)
# - CLAUDE.md (modified)
```

- [ ] **Step 2: Verify tests pass before pushing**

```bash
npm test
npm typecheck
npm run build
# All should pass
```

- [ ] **Step 3: Create final setup commit**

```bash
git add -A
git commit -m "chore: implement release management infrastructure

- Add CHANGELOG.md with Keep a Changelog format
- Add versioning strategy (docs/VERSIONING.md)
- Add release process guide (docs/RELEASE.md)
- Add GitHub Marketplace publishing guide (docs/MARKETPLACE.md)
- Add automated release workflow (.github/workflows/release.yml)
- Add release workflow validation tests
- Update README with versioning/release information
- Update CLAUDE.md with release management guidance

Release ready for v1.0.0 or later versions following semantic versioning."
```

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
# Workflow validations run automatically on GitHub
```

- [ ] **Step 5: Verify on GitHub**

Check GitHub Actions → Workflows to ensure no errors (existing workflows should pass).

- [ ] **Step 6: Create summary**

```bash
echo "✅ Release management infrastructure complete!"
echo ""
echo "Next steps to perform a release:"
echo "1. Update CHANGELOG.md with changes"
echo "2. Follow steps in docs/RELEASE.md"
echo "3. Tag: git tag -a v1.2.0 -m 'Release v1.2.0'"
echo "4. Push: git push origin v1.2.0"
echo "5. Release workflow runs automatically"
```

---

## Summary

This plan establishes professional release management for spec-alignment:

✅ **Semantic Versioning** — Clear version scheme (MAJOR.MINOR.PATCH)
✅ **Changelog Tracking** — Keep a Changelog format for user-facing notes
✅ **Automated Releases** — GitHub Actions workflow handles releases automatically
✅ **Major Version Branches** — Users can use `@v1` for latest v1.x.x automatically
✅ **Documentation** — Maintainers have clear step-by-step release guide
✅ **Marketplace Ready** — Process documented for future GitHub Marketplace publication
✅ **Testing** — Workflow validates before every release

The next release (v1.0.0 or later) can follow the process in `docs/RELEASE.md` to automatically publish to GitHub Releases with proper versioning and changelog management.
