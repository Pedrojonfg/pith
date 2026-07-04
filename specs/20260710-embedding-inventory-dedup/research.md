# Research — Embedding-Assisted Inventory Merge

## OQ1 — Merge insertion point

**Decision**: Hook in `deepSeekMergeConceptInventories` (`api.js`) after `mergeConceptInventoriesDeterministicTree`, before `mergeConceptInventoriesSlimTree` LLM calls. Called from `runConceptInventoryMapReduce` (`session.js`).

**Rationale**: Deterministic title-key dedupe stays first; embedding triage reduces LLM input size without changing chunk extraction order.

## OQ2 — Ephemeral candidate comparison

**Decision**: Use `embedText` + in-memory `cosineSimilarity` for all candidate pairs above `INVENTORY_MERGE_PAIR_FLOOR`. Do **not** use `findNearestConcepts` (vault pgvector scope only).

**Rationale**: Pre-persistence concepts have no registry IDs; pairwise loop on ≤~200 candidates is acceptable at DPP scale.

## OQ3 — Embedding cache T1.2 → T1.8

**Decision**: Store `entry._embedding` on merged inventory rows during DPP. On merge cluster, keep the **richest** (longest `source_phrase`) candidate's embedding. `scoreConceptNovelty` checks `_embedding` before `embedText`.

**Rationale**: T1.8 compares against vault registry vectors; merged label drift is minor vs re-embed cost. Non-persisted field avoids schema migration.

## OQ4 — Truncation fallback path

**Decision**: `runConceptInventoryWithFallback` → `runConceptInventory` → map-reduce → same `deepSeekMergeConceptInventories`. `fallback_mono` bypasses merge entirely — embedding hook is no-op.

## OQ5 — Auto-merge audit records

**Decision**: Push `{ type: 'auto', idA, idB, similarity }` into run telemetry array; log via `console.info` with `[inventory-merge-embed]` prefix.

## OQ6 — Single-chunk no-op

**Decision**: Return early when `payload.length < 2` or flattened concept count < 2 — no embed calls.

## R8 Calibration methodology

**Decision**: Hand-labeled pairs in `calibration-pairs.json` (duplicate vs distinct-related). Mock deterministic vectors for CI; optional live Gemini via `scripts/calibrate-inventory-merge-thresholds.mjs`.

**Thresholds chosen**: `MERGE_AUTO_THRESHOLD = 0.91`, `MERGE_REVIEW_THRESHOLD = 0.78`, `INVENTORY_MERGE_PAIR_FLOOR = 0.72` — separates mock duplicate cluster (≥0.91) from distinct cluster (<0.78) with review band for overlap.

**Alternatives considered**: Placeholder 0.92/0.78 from draft spec — rejected until calibration completes.
