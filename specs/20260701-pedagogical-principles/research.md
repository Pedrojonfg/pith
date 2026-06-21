# Research: Pedagogical Principles Layer

**Date**: 2026-06-21

## 14.1 — smItems schema and provenance field

**Decision**: Add `reviewProvenance` field on normalized smItems; keep existing `sourceType` (mode: `rsvp_block`, `cloze_item`, etc.).

**Rationale**: `sourceType` already encodes creation mode with legacy mapping in `sm2.js`. Spec's document/gap_fill taxonomy is orthogonal — a provenance dimension for queue priority.

**Mapping at creation**:
| Call site | Default reviewProvenance |
|-----------|-------------------------|
| block-answer-signals, cloze, slow flashcards | `document` |
| mnemonic ingest | `mnemonic` |
| vault curation / vault_review | `vault_curation` |
| Explicit param | caller-supplied (`gap_fill` for auto filler) |

**Alternatives**: Overwrite `sourceType` — rejected (breaks normalizeSmItem and review routing).

## 14.2 — Text-offset-to-conceptId mapping

**Decision**: Build new `concept-span-index.js` using source-text search on concept `label`/`title` (same approach as `graph/proximity.js` keyword fallback). No full entity-span pipeline.

**Rationale**: `proximity.js` maps annotations→argument-map nodes, not conceptInventory. Label search is sufficient for dim/highlight v1.

**Scope impact**: R3 is M complexity (~200 LOC), not a separate infrastructure project.

## 14.3 — Mnemonic / vault_curation priority

**Decision**: Neutral — no penalty or boost in R4 scoring.

## 14.4 — NOVELTY_BLEND_WEIGHT

**Decision**: Default `0.15` per spec; configurable in flags.

## 14.5 — questionClass backfill

**Decision**: Going-forward only at DPP T1.2; no migration of existing sessions.

## R4 gap-fill items

**Decision**: No existing `gap_fill` creator in codebase. Infrastructure supports explicit `reviewProvenance: 'gap_fill'` at ingest; tests use synthetic items.

## R1 integration point

**Decision**: Hook classification in `document-preparation.js` after concept inventory is written (Tier-1 wave alongside novelty scoring).

## R2 comprehension signals

**Decision**: Set `comprehensionConfirmed` in `sm2-ingest.js` from Recall (`partial`/`strong`/`adequate`) and Socratic (quality ≥ 4). Gate in `registerOrUpdateSmItem` when flag enabled.

## R6 packing hook

**Decision**: Post-process concept assignment in `packInventoryDeterministic` via `applyNoveltyPackingBias()` when flag on; skip when off (identity transform).
