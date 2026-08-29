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
