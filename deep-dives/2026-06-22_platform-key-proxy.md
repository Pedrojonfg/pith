# Deep Dive: Platform Key Proxy

**Date:** 2026-06-22  
**Module:** `platform-key-proxy` — Supabase Edge Function proxies replacing client BYOK

---

## 1. What we built

Pith no longer asks users for DeepSeek, Gemini, or Google Books API keys. All LLM and Books HTTP calls go through two Supabase Edge Functions (`llm-proxy`, `books-proxy`) that verify the user's JWT, attach platform-owned secrets server-side, and forward requests to the upstream providers. The Settings screen lost the entire API-keys section; boot now depends on Supabase auth instead of `localStorage` keys. Every proxied LLM call is logged to `llm_usage_logs` with `key_ownership: platform`.

---

## 2. Design decisions

### Two Edge Functions instead of one generic proxy

**Chosen:** `llm-proxy` (POST, multi-service) and `books-proxy` (GET, Google Books only).

**Alternatives:** Single catch-all proxy with a `target` field in the body.

**Why discarded:** Books is GET with query-param forwarding; LLM is POST with JSON bodies and three auth modes. Splitting keeps each function small and avoids a generic URL-forwarding surface that would be harder to audit for SSRF risk.

**Trade-off:** Two deploy targets and two CORS configs to maintain.

---

### Sync auth token cache (`cachedAccessToken`) for legacy call sites

**Chosen:** `syncPlatformLlmAccessFromSession()` + `hasPlatformLlmAccess()` / `getApiKeyForLlmModel()` returning `"platform"` when cached.

**Alternatives:** Refactor all `getApiKeyForLlmModel()` and `assertLlmKeyPresent()` call sites in `study.js` / `session.js` to async auth checks.

**Why discarded:** Hundreds of sync guard sites; full async refactor was out of scope and high regression risk.

**Trade-off:** Stale cache if token expires mid-session without an `onAuthStateChange` event. Acceptable because Supabase refreshes tokens and emits events; worst case is a failed proxy call prompting re-auth.

---

### Gemini embed uses query-param auth in proxy, chat uses Bearer

**Chosen:** In `llm-proxy/index.ts`, `gemini-embed` appends `?key=` to the URL; `deepseek` and `gemini-chat` use `Authorization: Bearer`.

**Alternatives:** Uniform Bearer for all services.

**Why discarded:** Google's native `embedContent` endpoint expects API key as query param, not Bearer. Forcing Bearer would fail embeddings.

**Trade-off:** Service-specific auth logic inside one function; must be documented when adding new Gemini endpoints.

---

### Additive `llm_usage_logs` migration

**Chosen:** `ADD COLUMN IF NOT EXISTS` for `service`, `input_tokens`, `output_tokens`, `key_ownership`; keep existing `phase`, `doc_id`, `metadata`.

**Alternatives:** Replace table schema per the original spec draft; drop and recreate.

**Why discarded:** Table already existed from document-images work with client-side `logLlmUsage` rows. Dropping would lose history.

**Trade-off:** Two logging shapes coexist (client `phase`/`metadata` vs proxy `service`/`key_ownership`). Analytics queries must handle both.

---

### Boot gate: remove key check, keep existing auth flow

**Chosen:** `openInitialScreen()` always calls `enterAppHome()` when `continueAppBoot()` runs; `bootstrap()` already shows `auth` when no session.

**Alternatives:** Duplicate session check in `openInitialScreen`.

**Why discarded:** `onAuthStateChange` + `getSupabaseAuthSession()` already gate unauthenticated users.

**Trade-off:** `openInitialScreen()` on error still falls back to `settings` screen — slightly odd for unauthenticated users but rare.

---

### Books proxy fails gracefully

**Chosen:** `fetchBooksViaProxy` returns `null` on missing token or non-OK response; cascade continues with Open Library / Wikipedia.

**Alternatives:** Throw and block book-enriched nodoc flow.

**Why discarded:** Google Books was always optional enrichment; auth or proxy failure should not block session creation.

**Trade-off:** Silent degradation — user may not know Books tier was skipped.

---

## 3. Concepts applied

| Concept | What it is | Where in our code |
|--------|------------|-------------------|
| **API Gateway / BFF** | Server mediates client→third-party calls, hiding secrets | `llm-proxy`, `books-proxy` Edge Functions |
| **JWT bearer authentication** | Client sends short-lived token; server validates identity | `getUser()` in proxies; `Authorization: Bearer` in `callViaProxy` |
| **Secret injection** | Credentials live in server env, never in client | `Deno.env.get("DEEPSEEK_API_KEY")` etc. in `llm-proxy/index.ts` |
| **Reverse proxy** | Forward request shape/status/body from upstream | `fetch(targetUrl, …)` → return upstream JSON in proxies |
| **Fire-and-forget logging** | Non-blocking side effect; errors swallowed | `void supabaseAdmin.from("llm_usage_logs").insert(…).catch()` in `llm-proxy` |
| **Service role bypass** | Admin client skips RLS for server writes | `SUPABASE_SERVICE_ROLE_KEY` in usage log insert |
| **Adapter / facade** | Stable client API hiding transport change | `callViaProxy`, `geminiEmbedContent`, `geminiChatCompletions` in `llm.js` |
| **Strangler fig migration** | Keep old function names, swap implementation | `getApiKeyForLlmModel()` → returns `"platform"`; `assertLlmKeyPresent()` → checks auth cache |
| **Additive schema migration** | Extend DB without destructive DDL | `20260622_platform_key_proxy_usage_logs.sql` |
| **Graceful degradation** | Optional path fails without breaking main flow | `fetchBooksViaProxy` returns `null` in `book-lookup.js` |
| **CORS preflight** | OPTIONS handler for browser cross-origin POST | `if (req.method === "OPTIONS")` in both proxies |

---

## 4. Technical debt and improvements

**Well done**
- Clear separation: secrets server-side, identity from JWT, client has no provider URLs.
- Minimal churn at call sites via auth cache and deprecated-compatible exports.
- Contract tests in `cursor-tests/20260622_platform-key-proxy.mjs` catch BYOK regressions statically.
- SW version bump paired with `CACHE_NAME` per project rules.

**Functional duct tape**
- `getApiKeyForLlmModel()` returning `"platform"` string is a lie for backward compat — confusing for new code.
- Dual logging paths (client `logLlmUsage` + server proxy insert) may double-count or diverge on schema.
- `llm-usage-log.js` still uses `input_tokens`/`output_tokens` columns that may not exist until migration runs — pre-existing mismatch with original migration using only `metadata`.
- Edge functions not deployed or secrets not set → opaque proxy errors in production until ops checklist is done.

**Would not scale**
- No quota enforcement — log-only means unbounded platform cost per authenticated user.
- Single platform key per provider — no rotation, no per-tenant keys, no rate limiting at proxy.
- `gemini-embed` serial per `embedBatch` — unchanged, but proxy adds latency hop per call.
- CORS `Access-Control-Allow-Origin: *` is fine for anon JWT apps but should be tightened if cookies or custom domains matter.

---

## 5. Consolidation questions

1. **If `cachedAccessToken` is set but the JWT is expired, what exact user-visible failure mode occurs on the first LLM call, and does Supabase refresh happen before or after that failure?**

2. **How would you query `llm_usage_logs` to get accurate per-user token totals when some rows come from client `logLlmUsage` (phase/doc_id) and others from `llm-proxy` (service/key_ownership)?**

3. **What attack surface does `llm-proxy` expose if a malicious authenticated user sends arbitrary `endpoint` paths — can they reach non-intended Google or DeepSeek APIs, and what guard would you add?**

---

## 6. Suggested update for .cursorrules

1. **All new LLM or third-party API calls MUST route through `callViaProxy` / platform Edge Functions — never add `fetch` to `api.deepseek.com`, `generativelanguage.googleapis.com`, or provider URLs with user-supplied keys.**

2. **Edge Function proxies that forward `endpoint` from the client MUST validate against an allowlist of path prefixes per `service` — do not treat arbitrary paths as safe.**

3. **When removing BYOK, preserve sync guard compatibility via `hasPlatformLlmAccess()` / auth cache until all `getApiKeyForLlmModel()` call sites are migrated to explicit async auth checks.**
