# Quickstart: Platform Key Proxy

## Prerequisites

- Supabase project linked
- Secrets set: `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_BOOKS_API_KEY`
- User signed in via Google OAuth

## Deploy

1. Run migration `supabase/migrations/20260622_platform_key_proxy_usage_logs.sql`
2. Deploy functions: `supabase functions deploy llm-proxy` and `books-proxy`

## Smoke tests

```bash
# 401 without auth
curl -X POST "$SUPABASE_URL/functions/v1/llm-proxy" -H "Content-Type: application/json" -d '{}'

# DeepSeek via proxy (replace JWT)
curl -X POST "$SUPABASE_URL/functions/v1/llm-proxy" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"service":"deepseek","endpoint":"/v1/chat/completions","body":{"model":"deepseek-chat","messages":[{"role":"user","content":"hi"}]}}'
```

## App verification

1. Clear `ds_api_key` from localStorage
2. Sign in → land on app home (no key form)
3. Run RSVP session end-to-end
4. Check `llm_usage_logs` for new rows with `key_ownership = platform`
5. Settings: no API key fields

## Automated tests

```bash
node cursor-tests/20260622_platform-key-proxy.mjs
```
