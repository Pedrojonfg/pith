# Contract: books-proxy Edge Function

**Path**: `supabase/functions/v1/books-proxy`

## Auth

- Header: `Authorization: Bearer <supabase_jwt>`
- Missing/invalid → `401`

## GET

- Forwards all query params to `https://www.googleapis.com/books/v1/volumes`
- Injects `key=GOOGLE_BOOKS_API_KEY` server-side
- No `llm_usage_logs` logging

## Response

- Status and JSON mirror Google Books API

## OPTIONS

- CORS preflight → 200 `ok`
