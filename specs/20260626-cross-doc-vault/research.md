# Research: Cross-Document Concept Vault

**Feature**: `20260626-cross-doc-vault` | **Date**: 2026-06-15

## R1: Registry storage seam

**Decision**: New `concept-registry-store.js` with `localStorage` key `mylearning_concept_registry`, mirroring `vault-store.js` patterns (inline vs ref split at size threshold).

**Rationale**: Spec §14 requires same CRUD interface for Supabase Phase 2; `session-store.js` remains document-scoped.

**Alternatives considered**: Extend `vault-store.js` entries — rejected because vault entries mix organizational types (CLASS, PROJECT) with different lifecycle than concept maturity registry.

## R2: Identity resolution without pgvector

**Decision**: Phase 1 uses normalized slug equality, alias fuzzy match (Levenshtein/ratio threshold), and optional LLM disambiguation call only when slug+alias inconclusive. No embedding API required for v1 ship.

**Rationale**: Registry stays small (hundreds); linear scan + slug match covers majority; embedding can layer in Phase 2 Supabase.

**Alternatives considered**: Full embedding on every resolution — rejected for cost/latency on first engagement.

## R3: Gray concepts stay local

**Decision**: No global row until gray→yellow; `globalConceptId: null` on inventory entries.

**Rationale**: Spec §6.1 — avoid 30–80 LLM dedup calls per document upload.

**Alternatives considered**: Eager registry on inventory — rejected per spec.

## R4: smItems transition

**Decision**: `upsertSmItem` writes through to global `ConceptFacetSchedule` when `globalConceptId` resolved; legacy `shared.smItems` read during migration pass on session load; one-time `migrateSmItemsToRegistry(docId)` helper.

**Rationale**: Minimizes breaking Review UI; aligns with SM-2 priority queue canonical shape.

**Alternatives considered**: Immediate delete of smItems — rejected; would break sessions mid-study.

## R5: Mastery aggregation v1

**Decision**: Simple average of facet schedule `lastQuality` weighted by recency (most recent `lastReviewedAt` facet gets 2× weight), then multiply by `exp(-lambda * days_since_last_observation)`.

**Rationale**: Spec §16 open question — pick shape before Phase 1; logging via existing `decay-calibration.js`.

**Alternatives considered**: Max-of-facets — rejected; hides weak facets.

## R6: Vault graph adapter

**Decision**: New `vault-graph-adapter.js` produces node/edge arrays consumed by existing `buildGraph` / `renderGraph` pipeline; maturity maps to `nodeType` metadata + CSS classes in `canvas.js`.

**Rationale**: Spec §9 — not a fourth graph schema.

**Alternatives considered**: Separate graph renderer — rejected.

## R7: Curation gate supersession

**Decision**: Hide "Upload to vault" from Session Hub; `commitVaultCuration` becomes no-op with console warn; studied concepts auto-promote via `promotion.js` hooks on mode events.

**Rationale**: Spec §13 supersedes commit gate; retain vault-store for legacy entries until separate migration spec.

**Alternatives considered**: Remove vault-store entirely — out of scope; breaks existing vault browse.

## R8: focusConceptId for Recall

**Decision**: Extend `resolveModeEntryState` / `enterModeWithContinuity` with optional `focusConceptId` query param; Recall question generation filters to concepts matching global ID via inventory `globalConceptId` linkage.

**Rationale**: Spec §9.4; small addendum to recall-mode entry contract.

**Alternatives considered**: New Recall-only route — unnecessary duplication.
