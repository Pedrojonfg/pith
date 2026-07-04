# Feature Specification: Embedding-Assisted Inventory Merge

**Feature ID**: `20260710-embedding-inventory-dedup`  
**Status**: Approved  
**Priority**: P1 — reduce T1.2 merge LLM cost and run variance  
**Created**: 2026-07-04  
**Source**: `spec-dedupembedding.md`

## Problem

During DPP T1.2, per-chunk concept inventories merge via LLM for every near-duplicate pair judgment. This is costly, slow, and non-deterministic across runs on identical documents.

## User Scenarios

### US1 — Cheaper merge for obvious duplicates (P1)

When a document spans multiple inventory chunks, concepts that are clearly the same idea (high embedding similarity) merge without an LLM call.

**Acceptance**: A two-chunk document with one reworded duplicate auto-merges with zero LLM merge calls for that pair (telemetry confirms `autoMerged` count ≥ 1).

### US2 — LLM only for ambiguous pairs (P1)

Pairs in the review band use entailment classification (existing contradiction-check pattern), capped per run. Pairs below the review floor stay distinct without LLM.

**Acceptance**: Engineered doc with 50+ near-duplicate candidates respects arbitration cap; no pair left in undefined state.

### US3 — Safe fallback (P1)

Offline or unauthenticated sessions keep the current all-LLM merge path unchanged.

**Acceptance**: Flag ON but embeddings unavailable → identical output path to flag OFF baseline.

### US4 — Shadow calibration (P2)

Before changing merge behavior, shadow mode logs embedding triage decisions alongside the existing LLM merge without altering results.

**Acceptance**: `inventoryMode` includes `embed_shadow` suffix; telemetry logged per run.

## Requirements

- **FR-001**: After per-chunk extraction and before LLM slim merge, embed candidate concepts (label + definition) via existing `embedText` / `geminiEmbedContent` infrastructure when enabled.
- **FR-002**: Pairwise cosine similarity MUST use `cosineSimilarity` from `embedding-math.js` for ephemeral in-memory candidates (not vault `findNearestConcepts`).
- **FR-003**: Two-threshold triage: `MERGE_AUTO_THRESHOLD`, `MERGE_REVIEW_THRESHOLD` — values from R8 calibration, not placeholders, before auto-merge goes live.
- **FR-004**: LLM arbitration for review-band pairs MUST reuse `classifyConceptRelation`; cap per run mirrors `getMaxContradictionChecksPerDppRun()`.
- **FR-005**: Gate behind `EMBEDDING_ASSISTED_INVENTORY_MERGE_ENABLED` (default `false`), independent of `SEMANTIC_ANCHORING_ENABLED`.
- **FR-006**: Gate on `isVaultEmbeddingsEnabled()`; silent fallback to current merge when unavailable.
- **FR-007**: Per-run telemetry: auto-merged, LLM-arbitrated, rejected-distinct counts, final concept count.
- **FR-008**: Shadow mode (`mergeMode: shadow`) logs decisions without changing merge output.
- **FR-009**: T1.2 cached embeddings on inventory entries (`_embedding`) MUST be reused by T1.8 novelty scoring when present.
- **FR-010**: Single-partial documents (`partials.length < 2`) MUST skip embedding merge (no added latency).
- **FR-011**: Auto-merged pairs MUST produce debug/audit records even without LLM calls.
- **FR-012**: `runConceptInventoryWithFallback` map-reduce path uses the same merge hook; `fallback_mono` unchanged.

## Assumptions

- Calibration uses labeled concept pairs (hand-curated + fixture-derived samples); live Gemini optional for threshold tuning.
- Merged concept carries the winning candidate's cached embedding (T1.8 compares against vault, not merged wording).
- Independent of `20260703-semantic-concept-anchoring`.
- `20260705-dpp-inventory-llm-optimization` deterministic tree remains first pass; embedding triage runs before LLM slim merge tree.

## Success Criteria

- Same document run 3× with flag ON (full mode): concept-count variance ≤ 1 vs flag OFF baseline variance.
- Obvious cross-chunk duplicate: auto-merged, zero LLM calls for that pair.
- Topically close distinct concepts: not auto-merged.
- Offline sessions: no regression vs current behavior.
