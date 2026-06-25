# Deep Dive — Inventory merge truncation & API rate-limit cascade

**Date:** 2026-06-25  
**Module:** `api.js`, `llm.js`, `document-preparation.js`, `document-images/vision.js`

---

## 1. What we built

Hardened the document preparation pipeline (DPP) against two coupled failures on large uploads: LLM merge output truncation (32 recovered concepts vs 39 required) and Gemini 429 rate limits after a burst of inventory + vision calls. Added a deterministic client-side merge fallback, raised merge token ceiling, gated figure analysis on a viable inventory, and added proxy retry + vision throttling.

---

## 2. Design decisions

### Deterministic merge fallback (`mergeConceptInventoriesDeterministic`)

- **Chosen:** Concatenate chunk partials in section order, dedupe by normalized title, renumber `c1…cn`, clear cross-chunk `prerequisite_ids`.
- **Alternatives discarded:**
  - *More LLM retries* — same prompt/size often reproduces truncation.
  - *Lower `minViableConcepts`* — hides real quality gaps.
  - *Accept partial recovery below threshold* — violates `20260622-fix-inventory-merge-truncation` spec.
- **Trade-off:** Weaker cross-section dedup and no prerequisite rewiring vs reliable completion when chunk partials already contain enough concepts.

### Merge `max_tokens` 8192 → 12288

- **Chosen:** Align merge ceiling with single-pass inventory (`CONCEPT_INVENTORY_MAX_TOKENS`).
- **Alternatives:** Terse-only merge (already attempted first on large docs ≥100k chars).
- **Trade-off:** Higher per-call cost; still bounded by one merge attempt config ladder.

### Gate T1.7 on `isConceptInventoryValid`

- **Chosen:** Skip vision when inventory is empty/sub-threshold; mark pending images `skipped`.
- **Alternatives:** Run vision without concept links (wastes quota, produces orphan descriptions).
- **Trade-off:** Figures won't be analyzed until inventory succeeds on retry — correct dependency order.

### Proxy retry (429/502/503) + vision pacing

- **Chosen:** Exponential backoff in `callViaProxy` (3 retries, 1.5s base); 500ms inter-call delay + 8s cooldown after early vision failures.
- **Alternatives:** Global queue service — overkill for client PWA.
- **Trade-off:** Slower vision on large PDFs; fewer total failures.

---

## 3. Concepts applied

| Concept | Where |
|---------|--------|
| **Map-reduce with merge bottleneck** | Chunk inventories succeed; merge is the serial choke point (`deepSeekMergeConceptInventories`). |
| **Graceful degradation / fallback ladder** | LLM merge → partial JSON recovery → deterministic concat (`api.js`). |
| **Idempotent deduplication** | Title-normalized keys in `mergeConceptInventoriesDeterministic`. |
| **Rate limiting & backoff** | HTTP 429 handling in `callViaProxy`; pacing in `runImageVisionAnalysis`. |
| **DAG scheduling vs success semantics** | DPP waves only wait for phase *completion*, not *success* — why T1.7 needed an explicit inventory guard. |
| **Token budget for structured JSON** | `CONCEPT_INVENTORY_MERGE_MAX_TOKENS` sizing; truncation detected via `looksLikeTruncatedModelJson`. |

---

## 4. Technical debt and improvements

**Well done:** Deterministic merge is pure, testable, no network; fits existing partial-recovery spec spirit.

**Duct tape:** Vision cooldown triggers on "2 failures, 0 successes" heuristic — not tied to explicit 429 status from `geminiVisionChat` (status is swallowed into `{ content: null }`).

**Won't scale:** 30 sequential vision calls per doc remain O(n) on figures; needs batch API or server-side queue for heavy PDFs. `minViableConcepts(charCount/5000)` may be too aggressive for dense academic texts. DPP stale re-run guard can still re-trigger full pipeline after transient 429.

**Missing:** Deterministic merge doesn't remap `prerequisite_ids` across chunk id spaces. Platform-wide quota dashboard for users hitting 429.

---

## 5. Consolidation questions

1. Why does DPP run T1.7 after T1.2 *fails*, and what invariant does `isConceptInventoryValid` restore?
2. When partial recovery yields M concepts with M < `minRequired` but sum of chunk partials ≥ `minRequired`, why is deterministic merge preferable to a fourth LLM attempt?
3. How does `callViaProxy` retry interact with `AbortSignal` from the user cancelling preparation?

---

## 6. Suggested update for .cursorrules

1. DPP phases that call Gemini (T1.7 vision, embeddings) MUST check inventory viability or explicit phase success — wave deps alone are insufficient.
2. Map-reduce merge MUST implement a no-LLM deterministic fallback before `INVENTORY_MERGE_FAILED`.
3. Any client loop issuing N>5 platform LLM calls MUST include inter-call delay or shared 429 backoff via `callViaProxy`.
