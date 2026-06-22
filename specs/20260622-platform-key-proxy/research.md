# Research: Platform Key Proxy

## R1 — Existing `llm_usage_logs` schema

**Decision**: Additive migration adding `service`, `input_tokens`, `output_tokens`, `key_ownership`; retain `phase`, `doc_id`, `metadata` for existing client `logLlmUsage`.

**Rationale**: Table created in `20260621143227_document_images_and_llm_usage_logs_v2.sql` uses `phase` + `metadata`. Client `llm-usage-log.js` already sends token fields. Proxy logs via service role with new columns.

**Alternatives considered**: Drop and recreate table — rejected (data loss risk).

## R2 — Supabase client access from `llm.js`

**Decision**: Import singleton from `./supabase-client.js`; export `getSupabaseAuthToken()` and `syncPlatformLlmAccessFromSession()`; maintain sync cache for legacy `getApiKeyForLlmModel()` checks.

**Rationale**: `supabase-client.js` already exists; `main.js` has `onAuthStateChange`.

**Alternatives considered**: Move all checks to async — rejected (large study.js churn).

## R3 — Boot gate vs auth listener

**Decision**: Remove `getStoredKey()` gate in `openInitialScreen`; rely on existing `bootstrap()` auth check + `onAuthStateChange`. Authenticated users go straight to `enterAppHome()`.

**Rationale**: `bootstrap()` already shows `auth` screen when no session; duplicate key gate is obsolete.

## R4 — Gemini embed authentication

**Decision**: `llm-proxy` appends `?key=` for `gemini-embed` service; Bearer for `deepseek` and `gemini-chat`.

**Rationale**: Native `embedContent` endpoint uses query-param auth; OpenAI-compat chat uses Bearer.

## R5 — Direct provider call sites

**Decision**: All `api.deepseek.com` and `generativelanguage.googleapis.com` fetches in `llm.js`, `vault/embeddings.js`, `document-images/vision.js` route through proxy. Google Books in `book-lookup.js` only.

**Rationale**: Grep confirms no other client files hit those hosts.

## R6 — `SUPABASE_URL` source

**Decision**: Import from `./config/supabase.js` (already used by `supabase-client.js`).

**Alternatives considered**: Duplicate in `config.js` — rejected.
