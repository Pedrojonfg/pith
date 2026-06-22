# Deep Dive: Fix Vision Analysis Routing

## 1. What we built

Document image vision analysis (DPP phase T1.7) was sending multimodal `image_url` payloads to DeepSeek via `llmChatCompletionsMultimodal`, which only supports text. That produced HTTP 400 errors on every embedded figure and silently dropped descriptions and `EXEMPLIFIES` graph edges.

We rewired `src/js/document-images/vision.js` to call Gemini's OpenAI-compatible endpoint directly with a hardcoded `gemini-2.0-flash` model, using the existing Gemini API key from Settings. Missing keys or per-image failures degrade gracefully without blocking document preparation.

## 2. Design decisions

### Direct `fetch` in `vision.js` instead of extending `llm.js`

**Chosen:** A private `geminiVisionChat()` inside the vision module with hardcoded endpoint and model.

**Alternatives:** Add a `llmChatCompletionsGeminiMultimodal` to `llm.js`, or branch inside `llmChatCompletionsMultimodal` on content type.

**Why discarded:** `llm.js` is explicitly documented as "chat always uses DeepSeek." A shared wrapper would invite future refactors to route vision through session `llmModel` again. Colocating the fetch with the only consumer makes the invariant obvious: vision ≠ session LLM.

**Trade-off:** Duplicated fetch/parse boilerplate vs `llm.js`. Acceptable for a single call site; if a third Gemini chat use appears, extract then.

### Keep JSON response + concept matching (not plain-text-only prompt)

**Chosen:** Retained the existing JSON contract (`description`, `matchedConceptIds`, `createConcept`) and downstream graph injection.

**Alternative:** Plain-text description per draft spec R5/R6, dropping structured concept links.

**Why discarded:** Testing checklist and `document-image-ingestion` spec require `EXEMPLIFIES` edges. Plain text alone would break graph enrichment without a second LLM pass.

**Trade-off:** Slightly more brittle parsing (fence-stripped JSON) than a dedicated schema API; same as before, just on Gemini.

### Missing key: `skipped` at orchestrator, `failed` on per-image null

**Chosen:** `runImageVisionAnalysis` early-exits when no Gemini key — marks all pending images `skipped`, one console warning per upload run. Individual Gemini/parse failures mark `failed`.

**Alternative:** Leave images `pending` when key is missing (would retry on next DPP run).

**Why discarded:** `pending` implies work remains; without a key it never will. `skipped` is honest and avoids repeated warnings.

**Trade-off:** Users without a Gemini key never get vision until they add one and re-run preparation (no automatic retry UI in this fix).

### Signed Supabase URL vs base64 `data:` URI

**Chosen:** Keep `getDocumentImageSignedUrl()` — no change to image extraction.

**Alternative:** Inline base64 from extraction pipeline (as in original spec sketch).

**Why discarded:** Signed HTTPS URLs are accepted by Gemini's OpenAI-compatible API; avoids loading full image bytes into the vision module and re-plumbing storage.

**Trade-off:** Depends on signed URL TTL and network reachability from the browser; if Gemini ever rejects expiring URLs, we'd need base64 fallback.

## 3. Concepts applied

| Concept | Where it appears |
|--------|------------------|
| **Provider separation / capability routing** | Text LLM (DeepSeek) vs vision LLM (Gemini) — different endpoints, keys, and models by capability, not user preference. |
| **Fail-soft sidecar pattern** | Vision runs in DPP T1.7 as enrichment; failures return `null`, increment `failed`, never throw out of the phase loop. |
| **Module-level session flag** | `_visionKeyWarningShown` reset at start of `runImageVisionAnalysis` — dedupe warnings within one upload without global singleton pollution across sessions. |
| **OpenAI-compatible API adapter** | `geminiVisionChat` speaks `messages` + `image_url` shape; Gemini host is swappable if Google keeps the compat layer. |
| **Defensive JSON parsing** | `parseVisionResponse` strips markdown fences before `JSON.parse` — tolerates models that wrap JSON in code blocks. |
| **Graph mutation as pipeline side effect** | `runImageVisionAnalysis` mutates `doc.shared.conceptInventory`, `conceptGraph.edges`, and per-image `conceptLinks` in one pass. |
| **Static contract tests** | `cursor-tests/20260622_fix-vision-routing.mjs` reads source file to assert absence of DeepSeek imports — cheap regression guard without mocking `fetch`. |

## 4. Technical debt and improvements

**Well done**
- Hardcoded Gemini routing cannot regress via session model changes.
- Explicit `max_tokens` constant with sizing comment (project rule compliant).
- Clear status taxonomy: `ready` / `failed` / `skipped`.

**Duct tape**
- `llm.js` still exports `llmChatCompletionsMultimodal` pointing at DeepSeek — a footgun for the next developer who imports it for images.
- Module flag `_visionKeyWarningShown` is process-global, not per-document; concurrent DPP runs in one tab could interleave warnings (unlikely in current UX).
- No retry on transient Gemini 429/5xx; one failure = `failed` for that image.

**Would not scale**
- Sequential per-image `await` in a loop — fine for ~5 figures, painful for image-heavy corpora; would need batching or concurrency limits.
- Concept inventory slice(0, 80) in prompt grows token cost linearly; large inventories need retrieval, not full dump.
- Static source-string tests don't catch runtime mis-wiring if someone reintroduces a dynamic URL builder.

## 5. Consolidation questions

1. Why must vision bypass `llm.js` entirely rather than adding a Gemini branch there — and what breaks if `document-preparation.js` still passes `llmModel: ctx.llmModel` into `runImageVisionAnalysis`?
2. When Gemini returns 200 but malformed JSON, why is the image marked `failed` while a missing API key marks images `skipped` — and how would you surface that distinction in the DPP UI?
3. If `getDocumentImageSignedUrl` returns a URL that expires before Gemini fetches it, where would the failure surface and what fallback (base64 re-read from storage) would you add without blocking T1.7?

## 6. Suggested update for .cursorrules

1. **Multimodal calls must not use `llmChatCompletions` or `llmChatCompletionsMultimodal` from `llm.js`** — those target DeepSeek text-only. Vision and any future image/audio input require a capability-specific module with hardcoded provider endpoint (currently Gemini in `document-images/vision.js`).

2. **Any new LLM call expecting JSON with `max_tokens` must declare a named constant** — vision already uses `VISION_ANALYSIS_MAX_TOKENS = 512`; follow the same pattern for new structured outputs.

3. **Fire-and-forget DPP phases must distinguish `skipped` (precondition missing) from `failed` (attempted and lost)** — do not leave assets `pending` when the precondition cannot be satisfied in the current session.
