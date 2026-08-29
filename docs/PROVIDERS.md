# LLM Providers Guide

spec-alignment supports multiple LLM providers for spec validation. This guide covers how to configure each provider, obtain API keys, and understand their capabilities and defaults.

## Supported Providers

- **Anthropic** (Claude models)
- **OpenAI** (GPT models)
- **Google** (Gemini models)
- **OpenRouter** (Multi-model access)

## Provider Configuration

### Anthropic

**API Provider:** [Anthropic Console](https://console.anthropic.com/)

**How to get an API key:**
1. Visit https://console.anthropic.com/
2. Sign up or log in to your Anthropic account
3. Navigate to API Keys
4. Create a new API key
5. Store it as `ANTHROPIC_API_KEY` secret in GitHub

**Default Model:** `claude-opus-5`

**Supported Models:**
- `claude-opus-5` — Latest, most capable (default)
- `claude-sonnet-5` — Balanced performance/cost
- `claude-haiku-4.5` — Fast, lower cost

**GitHub Actions Configuration:**
```yaml
- uses: ebellefontaine/spec-alignment@main
  with:
    provider: anthropic
    api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    model: claude-opus-5  # optional
    source_documents: |
      domain-modeling
```

**Rate Limits:** Varies by tier. Check your [usage page](https://console.anthropic.com/usage).

---

### OpenAI

**API Provider:** [OpenAI Platform](https://platform.openai.com/)

**How to get an API key:**
1. Visit https://platform.openai.com/account/api-keys
2. Sign up or log in to your OpenAI account
3. Create a new API key
4. Store it as `OPENAI_API_KEY` secret in GitHub

**Default Model:** `gpt-5.6`

**Supported Models:**
- `gpt-5.6` — Latest, most capable (default)
- `gpt-4-turbo` — High quality with structured output
- `gpt-4o` — Faster alternative to GPT-4
- `gpt-4o-mini` — Cost-effective option

**GitHub Actions Configuration:**
```yaml
- uses: ebellefontaine/spec-alignment@main
  with:
    provider: openai
    api_key: ${{ secrets.OPENAI_API_KEY }}
    model: gpt-5.6  # optional
    source_documents: |
      domain-modeling
```

**Rate Limits:** Tier-dependent. Check your [usage page](https://platform.openai.com/account/usage/overview).

---

### Google

**API Provider:** [Google AI Studio](https://aistudio.google.com/)

**How to get an API key:**
1. Visit https://aistudio.google.com/app/apikey
2. Sign in with your Google account (free tier available)
3. Create a new API key
4. Store it as `GOOGLE_API_KEY` secret in GitHub

**Default Model:** `gemini-pro-latest`

**Supported Models:**
- `gemini-2.0-flash` — Latest, very fast
- `gemini-pro` — Previous version
- `gemini-pro-latest` — Recommended (default)
- `gemini-pro-vision` — Multimodal variant

**GitHub Actions Configuration:**
```yaml
- uses: ebellefontaine/spec-alignment@main
  with:
    provider: google
    api_key: ${{ secrets.GOOGLE_API_KEY }}
    model: gemini-pro-latest  # optional
    source_documents: |
      domain-modeling
```

**Rate Limits:** Free tier available with limits. See [pricing](https://ai.google.dev/pricing).

---

### OpenRouter

**API Provider:** [OpenRouter](https://openrouter.ai/)

**How to get an API key:**
1. Visit https://openrouter.ai/
2. Sign up or log in to your OpenRouter account
3. Navigate to Keys in your account settings
4. Create a new API key
5. Store it as `OPENROUTER_API_KEY` secret in GitHub

**Default Model:** `openai/gpt-4-turbo`

**Supported Models:** 300+ models available through OpenRouter, including:
- `openai/gpt-4-turbo` — High quality (default)
- `anthropic/claude-opus` — Claude through OpenRouter
- `google/palm-2` — PaLM through OpenRouter
- `mistralai/mistral-7b` — Open source models
- And many more...

**Model ID Format:** OpenRouter requires the format `provider/model-name`. See the [models page](https://openrouter.ai/models) for the complete list.

**GitHub Actions Configuration:**
```yaml
- uses: ebellefontaine/spec-alignment@main
  with:
    provider: openrouter
    api_key: ${{ secrets.OPENROUTER_API_KEY }}
    model: openai/gpt-4-turbo  # optional, defaults to gpt-4-turbo
    source_documents: |
      domain-modeling
```

**Advantages:**
- Access to multiple model families from one API
- Often competitive pricing compared to direct providers
- Useful for trying different models without separate accounts
- Load balancing across similar models available

**Rate Limits:** Provider-specific. Check your [account page](https://openrouter.ai/account) on OpenRouter.

---

## Comparing Providers

| Aspect | Anthropic | OpenAI | Google | OpenRouter |
|--------|-----------|--------|--------|------------|
| **Setup Complexity** | Simple | Simple | Simple | Simple |
| **Model Variety** | Limited to Claude | Limited to GPT | Limited to Gemini | 300+ models |
| **Free Tier** | No | Trial credits | Yes | Variable |
| **Pricing** | Competitive | Higher | Very low | Varies by model |
| **Best For** | Reliable Claude access | Latest GPT models | Cost-conscious | Model experimentation |
| **Unique Strengths** | Excellent reasoning | Largest model family | Free tier + speed | Access to all models |

## Choosing a Provider

**Choose Anthropic if:**
- You want Claude's reasoning capabilities
- You prefer a single, focused model family
- You want direct API access (no middleman)

**Choose OpenAI if:**
- You want the latest GPT models
- Your organization already uses OpenAI services
- You need the largest model family from a single vendor

**Choose Google if:**
- You want to minimize costs
- You prefer open-source-adjacent models
- You have a free tier available

**Choose OpenRouter if:**
- You want to experiment with multiple models
- You need flexibility to switch models without code changes
- You want access to niche or specialized models
- You're cost-optimizing across multiple model families

## Per-Provider Default Models

spec-alignment uses these defaults when no model is specified:

```typescript
const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-opus-5',
  openai: 'gpt-5.6',
  google: 'gemini-pro-latest',
  openrouter: 'openai/gpt-4-turbo',
};
```

Override these by providing the `model` input in your workflow.

## API Key Security

**Best Practices:**
1. **Always store API keys as GitHub secrets** — Never hardcode them in your workflow files
2. **Use repository secrets** — Set under Settings → Secrets and variables → Actions
3. **Rotate keys regularly** — Delete old keys and generate new ones
4. **Use minimal permissions** — If your provider supports scoped keys, create read-only keys if possible
5. **Monitor usage** — Regularly check your provider's usage dashboard for unusual activity

**Example Secret Setup:**
```bash
# In your GitHub repository:
# Settings → Secrets and variables → Actions → New repository secret
# Name: ANTHROPIC_API_KEY
# Value: sk-ant-xxx...
```

Then reference in your workflow:
```yaml
api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Rate Limits and Quotas

Each provider has rate limits. spec-alignment includes built-in retry logic for transient failures:

- **Max attempts:** 3 (initial + 2 retries)
- **Backoff strategy:** Exponential (1s → 2s → 4s)
- **Retried errors:** Rate limits (429), timeouts (408), server errors (5xx), connection errors

Non-retryable errors (invalid API key, authentication failure, malformed request) fail immediately.

Monitor your provider's dashboard:
- **Anthropic:** https://console.anthropic.com/usage
- **OpenAI:** https://platform.openai.com/account/usage/overview
- **Google:** https://aistudio.google.com/app/settings/billing
- **OpenRouter:** https://openrouter.ai/account

## Troubleshooting

**"Authentication failed" error:**
- Verify your API key is correct and not expired
- Check that the secret name matches your workflow configuration
- Ensure the secret is available to the workflow (check Actions permissions)

**"Rate limited" or timeout errors:**
- Wait a few minutes before retrying
- Check your provider's usage dashboard
- Consider upgrading your account tier
- Use a lower-strictness setting to reduce token usage

**Model not found:**
- Verify the exact model name (case-sensitive)
- Check that the model is available in your region
- Confirm your account has access to that model tier

**High costs:**
- Use `gpt-4o-mini` or `gemini-pro-latest` to reduce costs
- Try OpenRouter for comparison pricing
- Set `strictness: lenient` to reduce token usage
- Exclude large paths with `exclude_paths`

## Contributing

To add a new provider:

1. Add the provider name to the `Provider` type in `src/core/types.ts`
2. Add a default model to `DEFAULT_MODELS` in `src/adapters/llm.ts`
3. Import the provider's AI SDK and add a case in `resolveModel()`
4. Update this documentation with setup instructions

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full contribution guide.
