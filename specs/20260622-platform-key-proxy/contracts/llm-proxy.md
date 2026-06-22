# Contract: llm-proxy Edge Function

**Path**: `supabase/functions/v1/llm-proxy` (deployed as `llm-proxy`)

## Auth

- Header: `Authorization: Bearer <supabase_jwt>`
- Missing/invalid → `401` with CORS headers

## POST body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| service | string | yes | `deepseek`, `gemini-chat`, `gemini-embed` |
| endpoint | string | yes | Provider path e.g. `/v1/chat/completions` |
| body | object | yes | JSON forwarded to provider |

## Upstream routing

| service | Base URL | Auth |
|---------|----------|------|
| deepseek | `https://api.deepseek.com` | Bearer `DEEPSEEK_API_KEY` |
| gemini-chat | `https://generativelanguage.googleapis.com` | Bearer `GEMINI_API_KEY` |
| gemini-embed | `https://generativelanguage.googleapis.com` | `?key=GEMINI_API_KEY` on URL |

## Response

- Status and JSON body mirror upstream
- Side effect: insert `llm_usage_logs` (non-blocking, service role)

## OPTIONS

- CORS preflight → 200 `ok`
