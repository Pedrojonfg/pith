# Deep Dive — Concept Inventory Merge Truncation Fix

**Date:** 2026-06-22  
**Module:** `deepSeekMergeConceptInventories` / DPP T1.2  
**Spec:** `specs/20260622-fix-inventory-merge-truncation/spec.md`

---

## 1. What we built

Long documents use map-reduce concept inventory: per-chunk extraction, then an LLM **merge** step that consolidates partial inventories into one ordered list. When the merge response hit the output token ceiling, JSON was truncated mid-object, every retry repeated the same failure, and downstream DPP could still mark the document `ready` with a useless inventory.

We fixed the merge path with bracket-count **partial recovery**, a hard cap of **3 merge attempts**, JSON-only prompt instructions, a **minimum viable concept count** scaled by document size, and explicit **failure semantics** (`failReason`, empty inventory, no silent `ready`).

---

## 2. Design decisions

### Partial recovery before retry (not after all retries fail)

**Chosen:** Run `recoverPartialConceptArray` on every failed parse *before* deciding to retry.

**Alternatives:** (a) only recover after all LLM attempts exhaust; (b) always accept any recovered objects.

**Why:** Truncation often leaves dozens of complete objects before the cut. Recovering early saves API budget and can avoid a retry entirely. Accepting any count was rejected — sparse inventory is as dangerous as a stub.

**Trade-off:** Recovery uses a hand-rolled bracket scanner instead of `JSON.parse`; it must respect string escapes and nested braces.

### `minViableConcepts(charCount)` in `flags.js`

**Chosen:** `max(5, floor(charCount / 5000))`.

**Alternatives:** fixed floor only; word-count-based scaling; LLM-estimated target.

**Why:** Matches spec placeholders; ties viability to document length without coupling merge to word-splitting heuristics. Absolute floor prevents false failures on short docs.

**Trade-off:** `5000` is uncalibrated — may be too strict or loose for dense/sparse genres.

### Return `{ concepts: [], failReason }` instead of throw from merge

**Chosen:** Merge returns a structured failure; `session.js` throws `CONCEPT_INVENTORY_TRUNCATED` for fallback paths.

**Alternatives:** throw inside merge; return partial concepts below minimum on last attempt.

**Why:** Caller can distinguish merge failure from transport errors. Below-minimum partials are **not** accepted on the last attempt — DPP must fail loud.

**Trade-off:** Two failure shapes (return vs throw) across the stack.

### Reuse `parseConceptInventoryFromModelResponse` for recovered objects

**Chosen:** Wrap recovered raw objects as `{"concepts":[...]}` and pipe through existing parser.

**Alternatives:** duplicate field validation in recovery; trust raw LLM objects.

**Why:** Single schema gate — same id/title/scope rules as full parse.

**Trade-off:** Invalid objects inside a complete brace pair still get dropped silently.

### `preparation.failReason` on session state

**Chosen:** `INVENTORY_MERGE_FAILED` vs `INVENTORY_TOO_SPARSE` on T1.2 failure.

**Alternatives:** only `status: failed` with message in `errors[]`.

**Why:** Downstream DPP guard spec needs machine-readable reasons without parsing error strings.

**Trade-off:** Another field to normalize in `session-types.js` and migrate mentally for older sessions.

---

## 3. Concepts applied

| Concept | What it is | Where in our code |
|--------|------------|-------------------|
| **Streaming / incremental parsing** | Process input without requiring full validity | `recoverPartialConceptArray` — char-by-char scan with `depth`, `inString`, `escape` in `api.js` |
| **Bracket matching / finite state** | Track nesting depth outside string literals | Same loop: `{` increments depth, `}` decrements, emit object at depth 0 |
| **Retry with backoff of strategies** | Escalate prompt compactness across attempts | `attemptConfigs` in `deepSeekMergeConceptInventories`: full → compact → terse |
| **Fail-fast / fail-closed** | Invalid state must not proceed as success | T1.2 throws when `inventory.length < minRequired`; merge returns empty on total failure |
| **Threshold functions** | Piecewise rules from config constants | `minViableConcepts` in `flags.js` |
| **Schema validation layer** | Business rules after syntactic parse | `parseConceptInventoryFromModelResponse` reused via `normalizeRecoveredConcepts` |
| **Structured error codes** | Machine-readable failure for callers | `failReason: 'MERGE_TRUNCATED'`, `err.code = 'CONCEPT_INVENTORY_TRUNCATED'` |
| **Dynamic import** | Avoid circular deps | `minViableConcepts` imported inside merge via `await import("./config/flags.js")` |

---

## 4. Technical debt and improvements

**Well done**

- Pure `recoverPartialConceptArray` is testable without LLM mocks.
- Merge attempt cap stops runaway API spend.
- `failReason` gives the next spec (DPP guard) a clean contract.

**Duct tape**

- Bracket scanner only handles the `"concepts": [` shape — won't recover from truncated root or array-only responses.
- `charCount` sourcing is inconsistent (`docMeta`, `textMetrics`, `text.length` fallback).
- `isConceptInventoryValid` duplicates `minViableConcepts` math inline in one branch (DPP guard follow-on).

**Would not scale**

- 8192 output tokens is a hard ceiling; 100+ concept dense docs may still truncate — recovery helps but doesn't add map-split on merge.
- Three identical-ish retries with same partials input may still repeat truncation if the model always front-loads preamble (mitigated by JSON-only prompt, not guaranteed).
- No telemetry/metrics on recovery success rate — hard to calibrate `MIN_CHARS_PER_CONCEPT` post-launch.

---

## 5. Consolidation questions

1. **When merge parse succeeds with `N` concepts where `0 < N < minRequired`, why do we run partial recovery instead of retrying immediately?** Could full parse return a strict subset that recovery cannot improve?

2. **What happens to RSVP `runConceptInventoryWithFallback` when merge fails but mono-phase fallback succeeds?** DPP rejects `fallback_mono`; do other entry points still silently study on block-split garbage?

3. **If `recoverPartialConceptArray` returns objects that fail `parseConceptInventoryFromModelResponse` (missing `scope_one_line`), do we under-count recovered concepts and retry unnecessarily?** Where should validation live — scanner or parser?

---

## 6. Suggested update for .cursorrules

1. **Merge/map-reduce LLM steps:** Any consolidate step that emits JSON arrays MUST implement partial-array recovery before retry, cap total attempts at 3, and NEVER mark preparation `ready` when result count `< minViableConcepts(charCount)`.

2. **Inventory failure contract:** Use `preparation.failReason` enum strings (`INVENTORY_MERGE_FAILED`, `INVENTORY_TOO_SPARSE`) — do not rely on thrown `Error.message` for guard logic.

3. **LLM merge prompts:** Include verbatim JSON-only output instruction (first char `{`, last `}`) on all merge/consolidate prompts; treat missing instruction as a bug equal to missing `max_tokens`.
