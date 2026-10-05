# Edge Functions

| Function | Role |
|----------|------|
| `llm-proxy` | DeepSeek / Gemini chat with allowlist + rate limits |
| `books-proxy` | Google Books lookup |
| `geocode-proxy` | Geocoding proxy |
| `shared-cache-upsert` | Authenticated writes to shared DPP / book caches |

Shared CORS and user allowlist: `_shared/proxy-guards.ts`.

Deploy and secrets: [DEPLOY.md](../../DEPLOY.md).

```bash
supabase functions deploy llm-proxy books-proxy geocode-proxy shared-cache-upsert
```
