# Deep Dive: Assessment Error Visibility & Auth Fix

## 1. What we built

Fixed pre-packing assessment showing "Could not load knowledge check questions." with nothing in the browser console. The work added `[assessment] Error:` logging at every catch path that previously swallowed failures, made LLM auth resolution async so assessment can recover a Supabase session token, and improved holistic batch error propagation so the first real batch failure surfaces instead of a generic merge retry message. Deploy markers were bumped to `SW_VERSION` `20260622_10`.

## 2. Design decisions

### `console.error('[assessment] Error:', err)` at UI catch sites
- **Chosen:** Log in `showPrePackingAssessmentGenerationFailure`, `enterPrePackingAssessmentRunner`, and `enterPrePackingAssessmentScreen` before updating UI.
- **Alternatives:** Only log in `api.js` — rejected because study.js catch blocks were the last hop before the user saw silence. Central error reporter module — rejected as over-scope for a hotfix.
- **Trade-off:** Duplicate log lines if both batch and runner catch fire; acceptable for diagnosability.

### Async `resolveLlmContext` via `getSupabaseAuthToken()`
- **Chosen:** `resolveLlmContext` awaits `getSupabaseAuthToken()` before throwing "Sign in to use AI features."
- **Alternatives:** Auth gate only at assessment entry in `study.js` — duplicates DPP fix pattern and misses other call sites. Remove sync check entirely and rely on `callViaProxy` — still need a clear error before building the request body.
- **Trade-off:** Every `llmChatCompletions` call pays one async session read when cache is cold; matches the platform-proxy auth model.

### Rethrow first batch error when all holistic batches return empty
- **Chosen:** Collect `batchErrors` in `runHolisticBatches`; if flat results are empty and errors exist, `throw batchErrors[0]`.
- **Alternatives:** Always fail fast on first batch error — loses partial-success map-reduce. Only improve logging — leaves user stuck on merge retries without root cause.
- **Trade-off:** Partial batch failure still returns `[]` for that batch; merge retries may mask intermittent LLM issues until all batches fail.

### Unify remaining bare `llm.js` imports to `?v=${SW_VERSION}`
- **Chosen:** Versioned imports in `vault/`, `interview/`, `document-images/`, `pedagogy/` files touched by the same singleton bug class.
- **Alternatives:** Barrel re-export — wider refactor. Leave bare imports — reintroduces split `cachedAccessToken` instances.
- **Trade-off:** More files touched per deploy when bumping `SW_VERSION`.

## 3. Concepts applied

| Concept | What it is | Where in our code |
|--------|------------|-------------------|
| **ES module identity** | Distinct import URLs load separate module instances with separate top-level state | `llm.js` vs `llm.js?v=20260622_10` each hold their own `cachedAccessToken` |
| **Error swallowing / lossy catch** | Catch blocks that update UI without logging or rethrowing obscure root causes | Former `study.js` catch → generic "Could not load" string |
| **Async auth fallback** | Sync cache first, then `supabase.auth.getSession()` when cache is empty | `getSupabaseAuthToken()` in `llm.js`; now used by `resolveLlmContext` |
| **Map-reduce with tolerant workers** | Parallel batch LLM calls merged downstream; workers may return empty on failure | `generateHolisticPrePackingAssessmentItems` → `runHolisticBatches` → `tryMergeHolisticAssessmentQuestions` |
| **Promise misuse** | Accessing `.budget` on an async function return (a Promise) without `await` | Fixed in `enterPrePackingAssessmentRunner` |
| **Prefetch / fire-and-forget** | `itemsPromise` started at block generation before assessment screen awaits it | `prePackingFlow.itemsPromise = createPrePackingItemsPromise(...)` in generate-blocks handler |

## 4. Technical debt and improvements

**Well done**
- Logging convention `[assessment] Error:` is grep-friendly and consistent with partial-recovery `[assessment]` logs in `api.js`.
- Async auth aligns assessment with the DPP fix documented in `deep-dives/2026-06-22_llm-module-singleton-auth.md`.
- Assessment runner now surfaces `err.message` in `setTestError` when available.

**Duct tape**
- Manual `?v=` propagation across dozens of files; one missed bare import revives the singleton bug.
- Holistic batches still return `[]` on individual failure; merge retry loop can delay surfacing the real error.
- Generic throw `new Error("Could not generate assessment items.")` when `items.length === 0` still discards context if the promise resolves empty without rejecting.

**Would not scale**
- No automated test that assessment catch paths call `console.error` or that all `llm.js` imports share one version string.
- No structured error type (e.g. `ASSESSMENT_AUTH`, `ASSESSMENT_MERGE`, `ASSESSMENT_SCHEMA`) for distinct UI recovery paths.
- Reliance on console for operator diagnostics in production PWA installs.

## 5. Consolidation questions

1. Why can concept inventory succeed (cached or from a prior LLM call) while pre-packing assessment fails with "Sign in to use AI features." on the same page load?
2. Trace `createPrePackingItemsPromise` → `generateHolisticPrePackingAssessmentItems` → batch catch → merge retry: at which step does the original `LLM proxy error 401` become `Holistic assessment merge: expected at least N test questions, got 0`?
3. If `main.js` imports `llm.js?v=20260622_10` and `pedagogy/distractor-validation.js` imported bare `../llm.js`, how many `cachedAccessToken` values exist at runtime and which call sites read which instance?

## 6. Suggested update for .cursorrules

1. **Assessment error visibility:** Any catch block that sets pre-packing assessment failure UI (`showPrePackingAssessmentGenerationFailure`, `prePackingAssessmentError`, `setTestError` for assessment) MUST call `console.error('[assessment] Error:', err)` first.
2. **LLM auth gates:** `llmChatCompletions` and pipeline entry points MUST use `await getSupabaseAuthToken()` (or async `resolveLlmContext`); sync-only `cachedAccessToken` checks are forbidden on new code paths.
3. **Holistic batch failures:** Returning `[]` from a failed assessment batch is allowed for partial merge, but if all batches fail the first batch error MUST be thrown, not only logged.
