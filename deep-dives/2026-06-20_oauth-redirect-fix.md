# OAuth redirect fix — production Google login

## 1. What we built

Fixed a production bug where Google OAuth completed successfully but redirected users to `http://localhost:3000/#access_token=...` instead of the deployed app origin. The client now resolves the OAuth `redirectTo` URL at runtime via `getOAuthRedirectUrl()` in `config/supabase.js`, so the same build works on localhost and production. Deploy cache-bust markers were bumped so stale service-worker bundles cannot keep serving an auth path without an explicit redirect.

## 2. Design decisions

### Centralize redirect URL in `config/supabase.js`

- **Chosen:** `getOAuthRedirectUrl()` next to `SUPABASE_URL` / `SUPABASE_ANON_KEY`.
- **Alternatives:** Inline `window.location.origin + pathname` in `auth.js` (already existed); add to `config.js` or `flags.js`.
- **Discarded:** `config.js` holds localStorage keys, not Supabase auth; `flags.js` is feature toggles, not runtime URL resolution.
- **Trade-off:** One more import in `auth.js`, but a single place to document the Supabase Dashboard allow-list requirement.

### Runtime origin, not hardcoded domains

- **Chosen:** `${window.location.origin}${pathname || "/"}`.
- **Alternatives:** Env-specific config (`PROD_URL`, `DEV_URL`); build-time injection per deploy target.
- **Discarded:** Hardcoded domains break preview/staging URLs and require a new deploy per host; build-time injection adds pipeline complexity for a static PWA.
- **Trade-off:** Every origin must be allow-listed in Supabase Redirect URLs; code cannot bypass that server-side gate.

### Guard when `window` is unavailable

- **Chosen:** Return `""` and pass `options: {}` if no origin (SSR/test edge).
- **Alternatives:** Throw before OAuth call; always pass redirect even if empty.
- **Discarded:** Throwing is harsh for hypothetical non-browser imports; empty string as `redirectTo` may confuse Supabase.
- **Trade-off:** Omitting `redirectTo` falls back to dashboard Site URL — acceptable only in non-browser contexts; browser sign-in always has `window`.

### SW version bump with auth change

- **Chosen:** `SW_VERSION` → `20260620_5`, `CACHE_NAME` → `pith-v67`, matching `index.html` `?v=`.
- **Alternatives:** Code-only fix without bump (relies on network-first for JS).
- **Discarded:** Stale SW cache could still serve older `auth.js` that omitted `redirectTo` or used an older pattern.
- **Trade-off:** Users may need one refresh after deploy; aligns with existing `.cursorrules` deploy contract.

## 3. Concepts applied

| Concept | Where it appears |
|---------|------------------|
| **OAuth authorization-code / implicit redirect flow** | `signInWithGoogle()` → `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })` in `auth.js` |
| **Runtime environment detection** | `getOAuthRedirectUrl()` reads `window.location.origin` and `pathname` in `config/supabase.js` |
| **Configuration module pattern** | Supabase URL, anon key, and redirect helper colocated in `config/supabase.js` |
| **Defensive guard for non-browser execution** | `typeof window === "undefined"` check before accessing `location` |
| **PWA cache busting / deploy identity** | `SW_VERSION`, `index.html` `?v=`, `CACHE_NAME` in `sw-update.js`, `index.html`, `sw.js` |
| **Allow-list security model (OAuth redirect URIs)** | Documented in JSDoc on `getOAuthRedirectUrl()` — Supabase rejects unknown `redirectTo` and falls back to Site URL |

## 4. Technical debt and improvements

**Well done:** Single call site for OAuth; redirect logic is testable in isolation; no secrets or domain literals; deploy versioning kept in sync.

**Functional duct tape:** If Supabase Dashboard Site URL remains `localhost:3000`, production still breaks when `redirectTo` is rejected or omitted — code cannot fix dashboard config. No automated test asserts `signInWithOAuth` receives a production-shaped URL. `GOOGLE_OAUTH_SETUP.md` still mentions `localhost:5500` generically, not the user's actual prod host.

**Would not scale:** Manual Redirect URL allow-listing per preview deploy (e.g. every Vercel preview URL) unless wildcards are configured. No CI check that auth changes include SW bump. Spec `spec-supabase-migration.md` still shows `signInWithOAuth` without `redirectTo` — misleading for future readers.

## 5. Consolidation questions

1. When Supabase receives a `redirectTo` that is not in the Redirect URLs allow-list, what URL does the user land on after Google consent, and why does that look like a "hardcoded localhost" bug even when client code is correct?

2. Why must `SW_VERSION`, `index.html` script `?v=`, and `CACHE_NAME` change together when only `auth.js` logic changes, and what failure mode appears if they drift?

3. What is the difference between Google Cloud "Authorized redirect URIs" (Supabase callback) and Supabase "Redirect URLs" (return to your app), and which one controls the `#access_token` hash on your PWA origin?

## 6. Suggested update for .cursorrules

1. **OAuth redirect:** Every `signInWithOAuth` call MUST pass `redirectTo` from `getOAuthRedirectUrl()` in `config/supabase.js` — never omit `redirectTo` and never hardcode origins.

2. **Supabase auth deploy checklist:** When changing auth redirect behavior, verify Supabase Dashboard Site URL and Redirect URLs include production and local dev origins; document required values in commit/PR notes.

3. **Auth + SW bump:** Any change to `auth.js` or `config/supabase.js` that affects sign-in flow MUST bump `SW_VERSION`, `index.html` `?v=`, and `CACHE_NAME` in the same commit.
