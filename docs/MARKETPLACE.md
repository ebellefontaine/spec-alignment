# GitHub Marketplace Listing
## spec-alignment

**LLM-powered validation of code against specifications**

### Short Description
A GitHub Action that validates whether code changes in pull requests align with your project's specifications using AI-powered LLM judgment. Supports multiple spec formats (Spec Kit, OpenSpec, Kiro, BMAD-METHOD, domain-modeling) and LLM providers (Anthropic, OpenAI, Google, OpenRouter).

### Full Description

#### The Problem
Teams write specifications (feature specs, PRDs, functional requirements docs) using various tools and conventions, but nothing automatically checks whether pull request code changes actually stay consistent with—or in scope of—those specs. Drift between spec and implementation is discovered late, if at all, often only by a human reviewer holding the entire spec in their head while reading a diff.

#### The Solution
**spec-alignment** reads your configured specification documents, analyzes the PR's code diff, and uses a generative AI language model to judge whether the changes are consistent with and in scope of those documents. Results are reported via GitHub's Checks API with optional PR review comments for quick feedback loops.

#### How It Works
1. **Specs are discovered automatically** — Supports Spec Kit, OpenSpec, Kiro, BMAD-METHOD, domain-modeling conventions, or custom file paths
2. **PR changes are analyzed** — Fetches the diff and identifies relevant changed files using deterministic filtering
3. **AI makes judgment** — A language model evaluates alignment at your chosen strictness level (strict, balanced, lenient)
4. **Results appear in GitHub** — Posts a GitHub Check with detailed verdict; optional PR comments highlight alignment concerns

#### Key Features
- ✅ **Multiple spec format support** — Spec Kit, OpenSpec, Kiro, BMAD-METHOD, domain-modeling, or arbitrary files/directories
- ✅ **Multiple LLM providers** — Choose from Anthropic, OpenAI, Google, or OpenRouter
- ✅ **Configurable strictness levels** — Tune evaluation rigor (strict/balanced/lenient)
- ✅ **Large-PR handling** — Deterministic filtering + LLM-based filtering keeps token costs predictable
- ✅ **Auto-approval** — Optional automatic approval when check passes
- ✅ **Immutable spec mode** — Enforce spec and code changes in separate PRs
- ✅ **Privacy-first design** — Choose a provider that matches your data sensitivity

### ⚠️ Generative AI Disclosure (Required by GitHub Marketplace)

**This action uses a generative artificial intelligence (AI) language model to evaluate your code.**

#### What Happens When You Use This Action

When you enable spec-alignment:
1. Your **pull request diff** (the code changes you're reviewing) is sent to your chosen LLM provider for evaluation
2. Your **specification documents** are also sent to the LLM provider for context
3. The LLM provider returns an alignment verdict, which is posted as a GitHub Check

#### Privacy & Data Handling

Your code and specifications are sent to your chosen LLM provider. **Each provider handles data differently.** Before enabling this action, review:

- **[Privacy & Data Handling Guide](https://github.com/ebellefontaine/spec-alignment/blob/main/docs/PRIVACY.md)** — Comprehensive guide on how your data is processed
- **[Provider Policies](https://github.com/ebellefontaine/spec-alignment/blob/main/docs/PROVIDERS.md#data-privacy-summary)** — Links to each provider's privacy policy:
  - [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy-policy)
  - [OpenAI Data Policy](https://openai.com/enterprise-privacy/)
  - [Google Privacy Policy](https://support.google.com/cloud/answer/13630047)
  - [OpenRouter Privacy Policy](https://openrouter.ai/privacy)

**spec-alignment does not store or retain your data.** It's a stateless GitHub Action—data flows directly from your workflow to your chosen provider.

#### What We Do NOT Send

- GitHub authentication tokens
- User credentials or API keys
- Private GitHub repository data beyond the PR diff being evaluated
- Approval or review history

#### Privacy Control

You choose which LLM provider to use. Review your chosen provider's privacy policy to ensure it aligns with your organization's data requirements. See the [Privacy & Data Handling Guide](https://github.com/ebellefontaine/spec-alignment/blob/main/docs/PRIVACY.md) for more information.

#### Important Limitations

Generative AI language models have known limitations:
- ✓ They can hallucinate or miss subtle issues
- ✓ They're not suitable for security-critical decisions alone
- ✓ Very large diffs (>10K lines) become expensive
- ✓ Verdicts should be reviewed in context, not blindly trusted

**Always review the AI's verdict. Use it as a guide for code review, not a replacement.**

### Best Use Cases

✅ **Ideal for:**
- Detailed specifications with clear requirements
- Architectural validation and design pattern checking
- Feature scope validation (does this PR do only what the spec says?)
- Catching unintended scope creep
- Preventing spec-implementation drift

❌ **Not ideal for:**
- Vague or incomplete specifications
- Security-critical architectural decisions (use human review + this tool)
- Very large pull requests (>10K lines)
- Binary files or generated code
- Real-time decision-making (each check takes 10-30 seconds)

### Getting Started

#### Installation

Add to your workflow file (`.github/workflows/spec-check.yml`):

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
      - uses: ebellefontaine/spec-alignment@v1
        with:
          provider: anthropic
          api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          source_documents: |
            domain-modeling
            Other - docs/implementation-notes.md
```

#### Required Inputs

- `provider`: LLM provider to use (`anthropic`, `openai`, `google`, or `openrouter`)
- `api_key`: Your LLM provider's API key (store as a GitHub secret)
- `source_documents`: Specification document locations (built-in conventions or custom paths)

#### Optional Inputs

- `model`: LLM model to use (defaults per provider)
- `strictness`: Evaluation rigor (`strict`, `balanced` [default], `lenient`)
- `comment_on_pr`: Post summary comment (default: `true`)
- `inline_review_comments`: Post line-level comments (default: `false`)
- `exclude_paths`: File patterns to exclude from checks
- `immutable_spec`: Block PRs modifying both spec and code (default: `false`)
- `auto_approve`: Automatically approve passing PRs (default: `false`)

See the [full configuration guide](https://github.com/ebellefontaine/spec-alignment#configuration) for details.

### Pricing

**Cost depends on your LLM provider:**
- Anthropic (Claude): ~$0.01-0.05 per PR evaluation
- OpenAI (GPT): ~$0.02-0.10 per PR evaluation
- Google (Gemini): Free tier + paid options
- OpenRouter: Varies by model selection

Most evaluations complete in 10-30 seconds depending on PR size and provider.

### Support & Feedback

We respond to all support requests within 48 hours.

- **Report Issues** — [GitHub Issues](https://github.com/ebellefontaine/spec-alignment/issues/new?labels=bug)
- **Request Features** — [GitHub Issues](https://github.com/ebellefontaine/spec-alignment/issues/new?labels=enhancement)
- **Ask Questions** — [GitHub Discussions](https://github.com/ebellefontaine/spec-alignment/discussions)
- **Privacy Questions** — [GitHub Issues](https://github.com/ebellefontaine/spec-alignment/issues/new?labels=privacy)

### Documentation

- **[Privacy & Data Handling](https://github.com/ebellefontaine/spec-alignment/blob/main/docs/PRIVACY.md)** — Detailed data flow and privacy options
- **[Providers Guide](https://github.com/ebellefontaine/spec-alignment/blob/main/docs/PROVIDERS.md)** — Setup instructions and provider comparison
- **[Design Document](https://github.com/ebellefontaine/spec-alignment/blob/main/docs/superpowers/specs/2026-08-16-spec-alignment-action-design.md)** — Full specification and architecture
- **[README](https://github.com/ebellefontaine/spec-alignment#readme)** — Quick start and feature overview

### Version & Compatibility

- **Minimum GitHub**: GitHub Enterprise Server 2.22+ or GitHub.com
- **Permissions Required**: `checks: write`, `contents: read`
- **Node**: Runs on Node 20 (provided by GitHub)

### License

MIT License — See [LICENSE](https://github.com/ebellefontaine/spec-alignment/blob/main/LICENSE) for details.

### About

Developed by Eric Bellefontaine. Contributions welcome! See the [contributing guide](https://github.com/ebellefontaine/spec-alignment/blob/main/CONTRIBUTING.md).

---

## GitHub Marketplace Compliance Checklist

✅ **AI Disclosure** — Clearly states that an AI language model makes verdicts
✅ **Data Handling** — Links to each provider's privacy policy
✅ **Privacy Statement** — Links to comprehensive privacy guide  
✅ **Limitations** — Explains AI model limitations and use cases
✅ **Support** — Provides multiple channels for issues and feedback
✅ **Configuration** — Links to full documentation and setup guides
✅ **Pricing** — Transparent about per-provider costs
✅ **Versioning** — Uses semantic versioning; stable major version branches available
