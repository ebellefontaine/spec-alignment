# Privacy & Data Handling

## What Data Does spec-alignment Process?

When you use spec-alignment, the following data is sent to your configured LLM provider for evaluation:

- **Pull request diff** — The code changes you're reviewing
- **Specification documents** — Your configured spec files (Spec Kit, OpenSpec, Kiro, BMAD-METHOD, domain-modeling, or custom files)
- **PR metadata** — Title, description, branch names (used for context)

## What Data We Do NOT Collect or Store

- GitHub authentication tokens
- User credentials or API keys
- Private GitHub repository data beyond the PR diff
- Approval/review history
- Any data on our own servers (this is a GitHub Action that runs in your environment)

## How Each Provider Handles Your Data

Your PR code is sent to your chosen LLM provider. **Data retention policies vary significantly:**

| Provider | Training Retention | Real-time Processing | Documentation |
|----------|------------------|----------------------|---|
| **Anthropic** | ❌ Not used for training | Your data processed then discarded | [Privacy Policy](https://www.anthropic.com/legal/privacy-policy) |
| **OpenAI** | ⚠️ 30 days (can opt-out) | May be retained for system monitoring | [Data Policy](https://openai.com/enterprise-privacy/) |
| **Google** | ❌ Not used for training | Your data processed then discarded | [Privacy Commitments](https://support.google.com/cloud/answer/13630047) |
| **OpenRouter** | Varies by upstream | Depends on selected model's provider | [Privacy Policy](https://openrouter.ai/privacy) |

**You choose the provider.** Different teams have different data sensitivity requirements. Review the provider's privacy policy before enabling the action.

## Your Control & Privacy Options

### 1. Choose Your Provider
Select a provider that matches your data sensitivity:
- **Maximum privacy** → Use Anthropic (no training retention)
- **Cost-focused** → Use Google or OpenAI with opt-out
- **Flexibility** → Use OpenRouter to switch models without re-authenticating

### 2. Exclude Sensitive Paths
Use the `exclude_paths` input to prevent certain files from being sent to the LLM:

```yaml
- uses: ebellefontaine/spec-alignment@main
  with:
    provider: anthropic
    api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    source_documents: domain-modeling
    exclude_paths: |
      src/secrets/**
      config/api-keys/**
      .env.production
```

### 3. Disable Public Comments
By default, spec-alignment posts a summary comment on your PR (visible to all users with access). If you're concerned about exposing verdicts publicly:

```yaml
- uses: ebellefontaine/spec-alignment@main
  with:
    comment_on_pr: false  # Only post the GitHub Check, no PR comment
    inline_review_comments: false  # Don't post line-level comments
```

### 4. Run on Self-Hosted Runners
For maximum control, run the action on a private self-hosted runner with restricted network access:

```yaml
runs-on: [self-hosted, private-network]
```

### 5. Review Before Enabling
Before adding spec-alignment to your workflow:
- ✅ Read the provider's privacy policy (links above)
- ✅ Review your organization's data sensitivity requirements
- ✅ Check if your legal/compliance team needs to approve
- ✅ Test on a non-critical repository first

## Data Residency

- **GitHub Actions** — Runs in the region of your choice (default: US)
- **LLM Provider** — Data is sent to the provider's infrastructure:
  - Anthropic: US-based
  - OpenAI: US-based
  - Google: Multi-region (check your configuration)
  - OpenRouter: US-based

## Changes & Data Minimization

spec-alignment is designed to send only what's necessary:
- The PR diff (not the full repository)
- Spec files you've configured (not all documentation)
- No history or version information

## Questions?

- **Privacy concern?** → Open an [issue on GitHub](https://github.com/ebellefontaine/spec-alignment/issues/new?labels=privacy)
- **How do I opt out of OpenAI retention?** → See [OpenAI's guide](https://openai.com/enterprise-privacy/)
- **Can I run this locally?** → Yes, with [act](https://github.com/nektos/act) on your machine
- **Does GitHub see my data?** → No, data flows directly from your action run to your LLM provider

## Right to Erasure & GDPR

If you use this action, your PR data is processed by your chosen LLM provider. To exercise GDPR rights:
- **Erasure requests** → Contact your LLM provider directly (not us)
- **Data access** → Contact your LLM provider directly (not us)

spec-alignment itself stores no data—it's a stateless GitHub Action that runs in your workflow.
