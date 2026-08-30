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

Your PR code is sent to your chosen LLM provider. **Data retention policies vary — review each provider's documentation:**

| Provider | Privacy Documentation |
|----------|---|
| **Anthropic** | [Privacy Policy](https://www.anthropic.com/legal/privacy-policy) |
| **OpenAI** | [Data Policy](https://openai.com/enterprise-privacy/) |
| **Google** | [Privacy Commitments](https://support.google.com/cloud/answer/13630047) |
| **OpenRouter** | [Privacy Policy](https://openrouter.ai/privacy) |

**You choose the provider.** Different teams have different data sensitivity requirements. Review the provider's privacy policy before enabling the action.

## Your Control & Privacy Options

**You choose which LLM provider to use.** Different providers have different data handling policies. Before enabling spec-alignment, review your chosen provider's privacy documentation (see table above) to ensure it aligns with your organization's data sensitivity requirements.

## Data Residency

Data residency depends on your chosen LLM provider. Refer to your provider's privacy documentation for details on where your data is processed and stored.

## Changes & Data Minimization

spec-alignment is designed to send only what's necessary:
- The PR diff (not the full repository)
- Spec files you've configured (not all documentation)
- No history or version information

## Questions?

- **Privacy concern?** → Open an [issue on GitHub](https://github.com/ebellefontaine/spec-alignment/issues/new?labels=privacy)
- **Can I run this locally?** → Yes, with [act](https://github.com/nektos/act) on your machine

## Right to Erasure & GDPR

If you use this action, your PR data is processed by your chosen LLM provider. To exercise GDPR rights:
- **Erasure requests** → Contact your LLM provider directly (not us)
- **Data access** → Contact your LLM provider directly (not us)

spec-alignment itself stores no data—it's a stateless GitHub Action that runs in your workflow.
