# Server AI provider selection

Both Opportunity AI and Proposal AI use an explicit server-only `AI_PROVIDER`.
Missing or invalid selection fails closed. There is no default and no automatic
fallback, including when keys are missing, a model is unavailable, the provider
returns 429, output is invalid, or a request times out.

## Configuration

For Groq, configure these variables in the intended Vercel environment:

```text
AI_PROVIDER=groq
GROQ_API_KEY=<your Groq secret>
GROQ_MODEL=openai/gpt-oss-20b
```

For OpenAI, explicitly set `AI_PROVIDER=openai` and retain `OPENAI_API_KEY` and
`OPENAI_MODEL`. OpenAI variables are not required or used with Groq selected.
Never prefix provider keys with `NEXT_PUBLIC_`. Existing Supabase configuration
remains required and unchanged. Existing deployments must explicitly configure
`AI_PROVIDER` when deploying this change; unset selection disables generation.

## Transport and validation

Groq uses only `https://api.groq.com/openai/v1/chat/completions`, with
`response_format.json_schema.strict=true` and the existing unmodified schemas.
The preferred model supports strict structured outputs. Groq Responses is beta
and does not support the current OpenAI transport's `store` field; using the
documented Chat Completions contract avoids assuming drop-in compatibility.
There is no downgrade to JSON mode, relaxed schemas, tools, or another provider.
Unsupported models or schema keywords fail safely rather than weakening checks.

OpenAI continues using its existing Responses transport. Both workflows still
apply their original server-derived input budgets, strict Zod output schemas,
and factual/service/financial safety validation before existing persistence.
Provider/model/prompt/schema metadata comes from the selected server adapter.

The Groq request envelope is capped at 24,000 UTF-8 bytes (including prompts and
schema), below the shared 64,000-byte provider limit. Existing field limits and
the 32,000-byte structured input limit still apply. Oversized requests are
rejected, not truncated. Responses, including errors, are capped at 64,000 bytes.
Opportunity output remains capped at 1,200 completion tokens, proposal output at
1,600. GPT-OSS reasoning effort is low; reasoning can still use the output budget,
and truncated completions are rejected. A 30-second deadline covers headers and
body consumption, in addition to the existing workflow abort/deadline.

Byte limits are not token estimates or Free Tier guarantees. Groq limits are
organization-wide; the published baseline for this model is 8,000 TPM, 30 RPM,
1,000 RPD, and 200,000 TPD. Verify actual account limits in Groq Console. A valid
large prompt or concurrent tenants may exceed them. Existing agency usage limits
still apply, but do not represent a shared Groq token scheduler.

HTTP 429 stops automatic retries and reports a parsed numeric/HTTP-date
`Retry-After` as a minimum wait when available. No in-process sleep, paid
fallback, or hidden provider retry occurs. Other non-retryable configuration,
permission, model and request errors also stop. Existing workflow retries remain
bounded to two attempts for transient failures or invalid/unsafe output.
Provider error bodies and request payloads are not logged or returned.

## Persistence

No migration is required: `opportunity_ai_insights.model_provider` accepts any
nonempty text; proposal AI metadata is stored in `content.aiDraft` JSON. Existing
records are not rewritten by configuration changes. Regeneration follows the
existing lifecycle; this does not add version history or change failure recovery.

## Safe smoke test and release control

1. Review this diff and verification results before authorizing release.
2. Configure Groq in a local or Vercel Preview environment after approval. Keep
   production secrets unchanged until the release is explicitly approved.
3. Confirm the Groq account remains on the intended Free Tier; this application
   cannot enforce the provider account's billing plan.
4. Generate one insight for an owned completed audit's opportunity, then one
   proposal AI draft with an existing selected service. Check stored provider
   `groq`, configured model, unchanged evidence, service mapping and manual prices.
5. Check Groq usage; confirm application requests never reach `api.openai.com`.
   Do not repeatedly click on 429; wait at least the reported interval.
6. Verify malformed output/failure retains existing successful content and that
   cross-tenant access remains denied. Automated tests use mocked HTTP responses
   and do not require or consume either provider's API credits.

References checked for this integration:

- https://console.groq.com/docs/openai
- https://console.groq.com/docs/responses-api
- https://console.groq.com/docs/structured-outputs
- https://console.groq.com/docs/rate-limits
- https://console.groq.com/docs/api-reference
