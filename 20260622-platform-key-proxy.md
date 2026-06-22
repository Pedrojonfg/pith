# Spec: `20260622-platform-key-proxy`

## Summary

Replace client-side BYOK (Bring Your Own Key) API keys with Supabase Edge Function proxies. All LLM calls (DeepSeek, Gemini) and Google Books lookups route through authenticated server-side functions that use platform-owned secrets stored in Supabase. BYOK UI is removed entirely. Usage is logged per-user to `llm_usage_logs`.

**Supersedes:** none. Removes BYOK pattern introduced implicitly across `llm.js`, `session.js`, `book-lookup.js`.

---

## Goals

- G1. Store DeepSeek, Gemini, and Google Books API keys as Supabase secrets (never in client code or `localStorage`).
- G2. Gate all proxied calls on a valid Supabase JWT — unauthenticated requests get 401.
- G3. Log every proxied LLM call to `llm_usage_logs` (user\_id, service, model, tokens, `key_ownership: "platform"`).
- G4. Remove all API key input fields from Settings UI and all key-reading/saving code from the client.
- G5. Change the app boot gate from "has DeepSeek key in localStorage" to "has active Supabase auth session".

## Non-Goals

- Hard quota enforcement / request blocking (log only in this spec).
- Streaming response proxying (all current calls are non-streaming; flag for future).
- Multi-key rotation or per-environment key management.
- Google Books usage logging in `llm_usage_logs` (Books calls are not LLM; skip logging for Books).
- Migrating embedding computation to server-side (embeddings still computed client-side, just with platform key via proxy).

---

## Architecture

```
BEFORE:
Browser → DeepSeek API          (user's ds_api_key from localStorage)
Browser → Gemini API            (user's gemini_api_key from localStorage)
Browser → Google Books API      (user's google_books_api_key from localStorage)

AFTER:
Browser → supabase/functions/v1/llm-proxy   → DeepSeek API   (DEEPSEEK_API_KEY secret)
Browser → supabase/functions/v1/llm-proxy   → Gemini API     (GEMINI_API_KEY secret)
Browser → supabase/functions/v1/books-proxy → Google Books   (GOOGLE_BOOKS_API_KEY secret)
         ↑ JWT verified each request
```

Two Edge Functions are created. Both verify the Supabase JWT on every request using the built-in `SUPABASE_JWT_SECRET` (available automatically in Edge Functions — no manual secret needed for auth).

---

## DB Migration

> Run in Supabase SQL Editor **before** deploying Edge Functions.

```sql
-- Create llm_usage_logs if it doesn't already exist
create table if not exists llm_usage_logs (
  id           uuid        default gen_random_uuid() primary key,
  user_id      uuid        references auth.users(id) not null,
  service      text        not null,  -- 'deepseek' | 'gemini'
  model        text,
  input_tokens  integer,
  output_tokens integer,
  key_ownership text        default 'platform',
  created_at   timestamptz default now()
);

-- RLS: users can only read their own logs; inserts done by Edge Function (service role)
alter table llm_usage_logs enable row level security;

create policy "users read own logs"
  on llm_usage_logs for select
  using (auth.uid() = user_id);
```

> If `llm_usage_logs` already exists with a different schema, Cursor must verify column compatibility before running. Do not drop existing data.

---

## R1 — Create `supabase/functions/llm-proxy/index.ts`

Handles DeepSeek (OpenAI-compatible) and Gemini (both OpenAI-compat chat and native embeddings endpoint).

```typescript
// supabase/functions/llm-proxy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // --- Auth ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }
  const token = authHeader.replace("Bearer ", "");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  // --- Parse request ---
  // Body shape: { service: "deepseek" | "gemini-chat" | "gemini-embed", endpoint: string, body: object }
  // `endpoint` is the full target URL path (everything after the base URL of the provider)
  const { service, endpoint, body: llmBody } = await req.json();

  let targetUrl: string;
  let authKey: string;

  if (service === "deepseek") {
    authKey = Deno.env.get("DEEPSEEK_API_KEY")!;
    targetUrl = `https://api.deepseek.com${endpoint}`;
  } else if (service === "gemini-chat") {
    authKey = Deno.env.get("GEMINI_API_KEY")!;
    targetUrl = `https://generativelanguage.googleapis.com${endpoint}`;
  } else if (service === "gemini-embed") {
    authKey = Deno.env.get("GEMINI_API_KEY")!;
    targetUrl = `https://generativelanguage.googleapis.com${endpoint}`;
  } else {
    return new Response("Bad Request: unknown service", { status: 400, headers: CORS_HEADERS });
  }

  // --- Forward request ---
  const upstream = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authKey}`,
    },
    body: JSON.stringify(llmBody),
  });

  const upstreamBody = await upstream.json();

  // --- Usage logging (fire-and-forget, non-blocking) ---
  const model = llmBody?.model ?? null;
  const inputTokens = upstreamBody?.usage?.prompt_tokens ?? upstreamBody?.usage?.input_tokens ?? null;
  const outputTokens = upstreamBody?.usage?.completion_tokens ?? upstreamBody?.usage?.output_tokens ?? null;

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  supabaseAdmin.from("llm_usage_logs").insert({
    user_id: user.id,
    service: service === "deepseek" ? "deepseek" : "gemini",
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    key_ownership: "platform",
  }).then(() => {}).catch(() => {}); // non-blocking, errors silenced

  // --- Return upstream response ---
  return new Response(JSON.stringify(upstreamBody), {
    status: upstream.status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
```

---

## R2 — Create `supabase/functions/books-proxy/index.ts`

Handles Google Books REST GET calls. No LLM logging needed.

```typescript
// supabase/functions/books-proxy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // --- Auth ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }
  const token = authHeader.replace("Bearer ", "");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  // --- Forward query params to Google Books ---
  const incomingUrl = new URL(req.url);
  const params = new URLSearchParams(incomingUrl.searchParams);
  params.set("key", Deno.env.get("GOOGLE_BOOKS_API_KEY")!);

  const booksUrl = `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
  const upstream = await fetch(booksUrl);
  const upstreamBody = await upstream.json();

  return new Response(JSON.stringify(upstreamBody), {
    status: upstream.status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
```

---

## R3 — Modify `llm.js`

**What changes:**
- Remove `getApiKeyForLlmModel()`, `getStoredKey()`, `getStoredGeminiKey()`, `saveGeminiKey()` — all key-reading functions.
- Add `getSupabaseAuthToken()` helper:
  ```js
  async function getSupabaseAuthToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }
  ```
- Replace all direct calls to `https://api.deepseek.com/...` and `https://generativelanguage.googleapis.com/...` with calls to the Edge Function proxy.

**Proxy call pattern** (replace all `fetch` calls to LLM APIs with this):
```js
const PROXY_URL = `${SUPABASE_URL}/functions/v1/llm-proxy`;

async function callViaProxy({ service, endpoint, body }) {
  const token = await getSupabaseAuthToken();
  if (!token) throw new Error("Not authenticated — cannot call LLM proxy.");

  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ service, endpoint, body }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM proxy error ${res.status}: ${err}`);
  }
  return res.json();
}
```

**Service mapping:**
- DeepSeek calls → `service: "deepseek"`, `endpoint: "/v1/chat/completions"`
- Gemini chat/completions → `service: "gemini-chat"`, `endpoint: "/v1beta/openai/chat/completions"`  
  *(or whatever the OpenAI-compat path is — Cursor to verify against existing `llm.js`)*
- Gemini embeddings → `service: "gemini-embed"`, `endpoint: "/v1beta/models/gemini-embedding-001:embedContent"`  
  *(Cursor to verify exact endpoint path in existing embedding calls)*

**SUPABASE_URL**: Cursor must locate where `supabaseUrl` is already defined in the client (likely in `config.js` or the Supabase init file) and import/reference it in `llm.js`.

---

## R4 — Modify `book-lookup.js`

- Remove `getGoogleBooksApiKey()`, `saveGoogleBooksApiKey()` functions.
- Replace direct calls to `https://www.googleapis.com/books/v1/volumes?...` with:

```js
const BOOKS_PROXY_URL = `${SUPABASE_URL}/functions/v1/books-proxy`;

async function fetchBooksViaProxy(queryParams) {
  const token = await getSupabaseAuthToken(); // same helper as in llm.js, or import it
  if (!token) return null; // Books is an enrichment; fail gracefully

  const params = new URLSearchParams(queryParams);
  const res = await fetch(`${BOOKS_PROXY_URL}?${params.toString()}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });

  if (!res.ok) return null;
  return res.json();
}
```

---

## R5 — Modify `config.js`

- **Remove** exports: `LS_KEY`, `LS_GEMINI_KEY`, `LS_GOOGLE_BOOKS_KEY`.
- **Add** (if `SUPABASE_URL` is not already exported from here):
  ```js
  export const SUPABASE_URL = "https://mnoczpssewnymuxeniyo.supabase.co";
  ```
- Cursor must verify there are zero remaining imports of `LS_KEY`, `LS_GEMINI_KEY`, `LS_GOOGLE_BOOKS_KEY` after removing them. If any remain, they must be cleaned up in the same commit.

---

## R6 — Modify `session.js`

- Remove `getStoredKey()` and `saveKey()` functions entirely.
- Cursor must verify no other file imports them. If any other file calls `getStoredKey()`, it must be updated to use `callViaProxy()` from `llm.js` instead.

---

## R7 — Modify `main.js`

**Current boot gate** (approximately):
```js
if (!getStoredKey()) {
  showScreen("settings");
  return;
}
showScreen("appHome");
```

**New boot gate:**
```js
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  // User not authenticated → show auth (Google OAuth flow)
  showScreen("settings"); // or whatever screen handles OAuth — Cursor to verify
  return;
}
showScreen("appHome");
```

> Cursor must verify: (a) the existing auth check location in `main.js`, (b) which screen hosts the Google OAuth button, and (c) whether there's already an `onAuthStateChange` listener that handles this — if so, the key-based gate should simply be removed without adding a duplicate auth check.

---

## R8 — Modify Settings UI (`index.html` + `ui.js`)

**`index.html`:**
- Remove `<input id="apiKeyInput" name="apiKey" ...>` (DeepSeek key field) from `#screenSettings`.
- Remove `<input id="geminiApiKeyInput" name="geminiApiKey" ...>` from `#screenSettings`.
- Remove `<input id="googleBooksApiKeyInput" name="googleBooksApiKey" ...>` from `#screenSettings`.
- Remove any `<label>` elements, help text, or links associated with these inputs.
- Keep `#languageSelect` and `#llmModelSelect` — these are still user-configurable preferences.

**`ui.js`:**
- Remove references to `els.apiKeyInput`, `els.geminiApiKeyInput`, `els.googleBooksApiKeyInput` from the `els` object and all handlers.
- Remove the `#apiKeyForm` submit handler (or the key-saving portion of Settings save, wherever it lives).
- Cursor must search for all string literals `"apiKeyInput"`, `"geminiApiKeyInput"`, `"googleBooksApiKeyInput"` and remove related wiring.

**`main.js`:**
- Remove `localStorage.setItem("ds_api_key", ...)` and equivalent Gemini/Books key-saving calls in the Settings save handler.

---

## Risk-Ordered Implementation Sequence

1. **DB migration** — run SQL for `llm_usage_logs` in Supabase dashboard. Additive, zero risk.
2. **R1: `llm-proxy` Edge Function** — create file, deploy, test with `curl` using a valid JWT before touching client code.
3. **R2: `books-proxy` Edge Function** — same, deploy and test independently.
4. **R3: `llm.js`** — highest blast radius (all LLM calls). Implement `callViaProxy()`, then replace each provider call site one at a time. Test RSVP generation end-to-end first.
5. **R4: `book-lookup.js`** — isolated; low risk.
6. **R7: `main.js` boot gate** — change key check to auth check.
7. **R5 + R6: `config.js`, `session.js` cleanup** — remove dead exports.
8. **R8: UI removal** — Settings inputs and handlers.

---

## Testing Checklist

- [ ] `curl` to `llm-proxy` without Authorization header → 401
- [ ] `curl` to `llm-proxy` with valid Supabase JWT → DeepSeek response arrives
- [ ] `curl` to `llm-proxy` with valid JWT and `service: "gemini-embed"` → embedding response arrives
- [ ] `curl` to `books-proxy` with valid JWT and `q=isbn:...` param → Google Books response arrives
- [ ] `llm_usage_logs` table gains a new row after each LLM call (verify in Supabase Table Editor)
- [ ] `llm_usage_logs` rows have `key_ownership: "platform"` and correct `user_id`
- [ ] App boots without prompting for API keys (localStorage has no `ds_api_key`)
- [ ] Unauthenticated user is redirected to auth, not to a broken state
- [ ] Authenticated user can complete a full RSVP study session
- [ ] Authenticated user can run Gemini embeddings (vault novelty scoring)
- [ ] Settings screen shows no API key input fields
- [ ] `localStorage.getItem("ds_api_key")` returns `null` after the change (no ghost keys written)
- [ ] No TypeScript/ESM import errors for removed `LS_KEY`, `LS_GEMINI_KEY`, `LS_GOOGLE_BOOKS_KEY`
- [ ] Bump `sw.js` `CACHE_NAME` and `SW_VERSION` in `sw-update.js`

---

## Open Questions for Cursor

1. Is the Supabase client (`supabase`) already initialized as a module-level singleton accessible in `llm.js`? If not, where is the canonical Supabase client import, and how should `llm.js` access it?
2. Does `main.js` already have an `onAuthStateChange` listener? If so, is the key-based boot gate inside or outside that listener?
3. Are there any Gemini calls that use a query param `?key=` instead of `Authorization: Bearer`? If so, the proxy endpoint path for those calls may differ.
4. Does `book-lookup.js` make GET or POST calls to Google Books? (Assumed GET — verify.)
5. Are there any places outside `llm.js` / `session.js` that call `fetch` directly to DeepSeek or Gemini? (Search for `api.deepseek.com` and `generativelanguage.googleapis.com` across `src/js/`.)
