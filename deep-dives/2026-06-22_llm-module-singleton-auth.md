# Deep Dive: LLM Module Singleton & DPP Auth Fix

## 1. What we built

Fixed document preparation (DPP) failing with a generic "concept analysis could not complete" error after migrating to platform-key-proxy. The root cause was not the Edge Functions themselves but the browser loading **multiple instances** of `llm.js` because import URLs differed (`?v=_7`, `?v=_8`, and bare `./llm.js`). Auth token sync ran on one instance while DPP checked another. We unified all cache-bust versions to `20260622_9`, switched DPP's auth gate to `await getSupabaseAuthToken()`, and bumped PWA deploy markers.

## 2. Design decisions

### Unified `?v=` on every versioned import
- **Chosen:** Bulk-align all `?v=20260622_*` imports to a single `SW_VERSION` (`20260622_9`).
- **Alternatives:** (a) Remove `?v=` entirely and rely on SW cache invalidation only — rejected because existing PWA contract requires explicit busting on deploy. (b) Central re-export barrel — rejected as over-engineering for a hotfix.
- **Trade-off:** Touching many files per deploy is noisy; a missed file reintroduces the bug silently.

### `getSupabaseAuthToken()` instead of `assertLlmKeyPresent()` in DPP
- **Chosen:** Async token fetch with Supabase session fallback before starting the pipeline.
- **Alternatives:** Make `assertLlmKeyPresent` async everywhere — wide refactor across `study.js`, `session.js`, etc. Sync-only cache check — fragile after proxy migration.
- **Trade-off:** One async call at pipeline start; all other call sites still use sync `assertLlmKeyPresent` until refactored.

### Keep STALE_RUN guard unchanged
- **Chosen:** Fix the upstream auth/LLM path; leave the 10-minute stale timeout as-is.
- **Alternatives:** Shorter timeout or surface proxy errors earlier — better UX but masks the real fix and adds scope.
- **Trade-off:** Users still see a generic message if LLM hangs; Network tab remains the diagnostic path.

## 3. Concepts applied

| Concept | What it is | Where in our code |
|--------|------------|-------------------|
| **ES module identity** | Browser treats each distinct URL as a separate module instance with its own top-level state | `llm.js?v=20260622_8` vs `llm.js` vs `llm.js?v=20260622_7` each had separate `cachedAccessToken` |
| **Cache busting** | Query-string versioning forces fresh module fetch after deploy | `SW_VERSION` in `sw-update.js`, `?v=` on `index.html` and transitive imports |
| **Module singleton state** | Top-level `let` in a module is shared only within that module URL | `cachedAccessToken` in `llm.js`; `syncPlatformLlmAccessFromSession` in `main.js` |
| **Proxy gateway pattern** | Client sends JWT; Edge Function holds provider API keys | `callViaProxy` → `supabase/functions/llm-proxy` (deployed in prior commit) |
| **Stale-run timeout / guard** | Poll-based workflow marks long-stuck jobs failed to avoid infinite UI wait | `pollUntilConceptInventoryReady`, `markPreparationStaleRun`, `DPP_STALE_TIMEOUT_MS` |
| **Fire-and-forget async** | Upload kicks DPP without awaiting; UI polls shared session state | `void startDocumentPreparation(...)` in `study.js` |

## 4. Technical debt and improvements

**Well done**
- Platform proxy architecture (prior commit) correctly centralizes secrets server-side.
- DPP guard and `STALE_RUN` prevent infinite "Preparing…" states.
- `getSupabaseAuthToken()` already had async Supabase fallback — underused because sync assert ran first.

**Duct tape**
- Manual `?v=` on hundreds of import lines; one bare `./llm.js` broke production behavior.
- `assertLlmKeyPresent()` still sync/cache-only at many call sites.
- Error surfaced as `STALE_RUN` after 10 minutes, not "Sign in required" or "LLM proxy 401".

**Would not scale**
- Version string propagation by search-replace across the tree.
- `document-preparation.js` still imports `./session.js` without `?v=` — duplicate session module graph possible (separate from this fix but same class of bug).
- No automated test that all `llm.js` import URLs resolve to one canonical string.

## 5. Consolidation questions

1. Why does `syncPlatformLlmAccessFromSession` in `main.js` not propagate auth to `document-preparation.js` if both import `llm.js` — and under what exact URL conditions would it work?
2. Walk through the DPP state machine from upload to `STALE_RUN`: which `preparation.status` values appear, and what timestamps does `getPreparationActivityTs` use to decide staleness?
3. If `llm-proxy` returns 401, at which layer is the error caught (proxy client, phase runner, guard), and why does the user see the generic preparation message instead of the proxy body?

## 6. Suggested update for .cursorrules

1. **Module URL singleton:** Any module holding cross-cutting runtime state (`llm.js`, `supabase-client.js`) MUST be imported with the same `?v=${SW_VERSION}` everywhere. Bare `./llm.js` imports are forbidden.
2. **Auth gates:** After platform-key-proxy, never use sync-only `assertLlmKeyPresent()` at pipeline entry points; use `await getSupabaseAuthToken()` or an async assert helper.
3. **Deploy checklist:** When bumping `SW_VERSION`, run a repo-wide grep for `llm.js` and `?v=` mismatches before merge; optionally run `cursor-tests/20260606_validate-sw-update-flow.mjs`.
