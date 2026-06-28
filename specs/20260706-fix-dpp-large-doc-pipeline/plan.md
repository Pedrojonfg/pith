# Plan: Fix DPP Large Document Pipeline

## T01 — Semantic char boundary refinement

**File:** `src/js/api.js`, wire in `session.js` `runConceptInventoryMapReduce`

- `refineCharFallbackBoundaries(markdown, chunks, opts)` — one LLM call.
- Prompt: list mechanical cuts with ±300 char context; return `{ boundaries: [charOffset,...] }` snapped to `\n\n`.
- Validate slice sizes; fallback to mechanical on parse failure.

## T02 — Slim merge + pairwise tree + rehydrate

**File:** `src/js/api.js` — `deepSeekMergeConceptInventories`

- `slimPartialsForMerge`, `rehydrateMergedConcepts`, `mergeTwoPartialsSlimLlm`, `mergeConceptInventoriesSlimTree`.
- Flow: deterministic tree → slim monolithic (if input < 80k chars) → slim pairwise tree → rehydrate.
- Tighten partial recovery gate (FR-005).

## T03 — Finalize status + persistence reconcile

**Files:** `session-types.js`, `document-preparation.js`, `dpp-persistence.js`

- Export `hasTier1Artifacts(session)`; use in `isTier1PreparationComplete` and `resolveFinalStatus`.
- Broaden `isPreparedDocAheadOfStore` for terminal prepared vs in-progress store.
- `startDocumentPreparation`: if reconcile stale, force `saveActiveSession(prepared)`.

## T04 — Guard repair + tests + SW bump

**Files:** `session.js`, `cursor-tests/20260706_fix_dpp_large_doc_pipeline.mjs`

- `repairStuckRunningPreparationIfNeeded`: promote when artifacts complete and not in-flight.
- Guard: running + artifacts + !inFlight → repair then skip.
- Integration tests for artifacts helper, slim merge gate, ahead-of-store.
