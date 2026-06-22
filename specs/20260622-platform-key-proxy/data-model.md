# Data Model: Platform Key Proxy

## `llm_usage_logs` (extended)

Existing columns (retained):

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK auth.users | |
| doc_id | text nullable | client context |
| phase | text | client context / legacy |
| model | text nullable | |
| metadata | jsonb | legacy client meta |
| created_at | timestamptz | |

Added columns (migration):

| Column | Type | Notes |
|--------|------|-------|
| service | text nullable | `deepseek` \| `gemini` |
| input_tokens | integer nullable | from upstream usage |
| output_tokens | integer nullable | from upstream usage |
| key_ownership | text default `platform` | always `platform` for proxy logs |

### RLS

- Users SELECT own rows (`auth.uid() = user_id`) — existing
- Edge Function inserts via **service role** (bypasses RLS)
- Client `logLlmUsage` INSERT policy remains for authenticated users

## Proxy request bodies

### llm-proxy POST JSON

```json
{
  "service": "deepseek" | "gemini-chat" | "gemini-embed",
  "endpoint": "/v1/chat/completions",
  "body": { }
}
```

### books-proxy GET

Query params forwarded to Google Books; `key` injected server-side.

## Removed client state

- `localStorage` keys: `ds_api_key`, `gemini_api_key`, `google_books_api_key`
- Exports: `LS_KEY`, `LS_GEMINI_KEY`, `LS_GOOGLE_BOOKS_KEY`
