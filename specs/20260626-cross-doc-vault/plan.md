# Implementation Plan: Cross-Document Concept Vault

**Branch**: `20260626-cross-doc-vault` | **Date**: 2026-06-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260626-cross-doc-vault/spec.md`

## Summary

Introduce a global concept registry (`concept-registry-store.js`) above per-document `shared` data with gray/yellow/green maturity, lazy identity resolution at gray→yellow, global `ConceptFacetSchedule` replacing per-document `smItems`, automatic promotion from all study modes, vault graph view reusing `graph/view.js` + `canvas.js`, ingest-only upload path, and removal of the manual vault curation commit gate. Phase 1 ships registry + yellow; Phase 2 green via Recall/Slow; Phase 3 vault navigation.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: `session-store.js`, `session-migration.js`, `sm2.js`, `vault/mastery-model.js`, `vault/session-close.js`, `graph/view.js`, `graph/canvas.js`, `graph/adapters.js`, `review.js`, `study.js`, `api.js` (embedding/dedup), Recall/Slow/Cloze mode modules

**Storage**: `localStorage['mylearning_concept_registry']` (new); existing `pith_doc_sessions`, `pith_knowledge_vault` (legacy vault entries coexist until migration path defined)

**Testing**: `cursor-tests/20260626_cross-doc-vault*.mjs` integration; unit tests per module

**Target Platform**: SPA offline-first PWA

**Project Type**: Web application — vanilla JS modules + DOM

**Performance Goals**: Identity resolution &lt; 3s per concept; vault cold graph &lt; 2s for 500 concepts; `buildReviewQueue` global merge &lt; 10ms for 500 facet schedules

**Constraints**: English UI; `concept-registry-store.js` as Supabase seam; no speculative green pages; maturity monotonic; bump `SW_VERSION` on asset changes; bias split on ambiguous resolution

**Scale/Scope**: ~13 implementation tasks across 3 rollout phases; new store + promotion + resolution modules; graph adapter; UI for vault tab and concept pages; deprecate curation gate

**External prerequisites**: `20260609-unified-session`, `20260620-sm2-priority-queue`, `20260621-recall-mode`, `20260623-study-projects`, `20260624-knowledge-vault-curation` (partial supersession)

## Constitution Check

*GATE: Project uses `.cursorrules` (constitution template not ratified).*

| Principle | Status | Notes |
|-----------|--------|-------|
| English prompts / UI | PASS | All new strings in English |
| No frameworks | PASS | Pure JS modules + DOM |
| Simplicity / surgical | PASS | Single registry store seam; reuse graph/SM-2 |
| PWA versioning | PASS | SW bump when touching shipped assets |
| Testability | PASS | Pure promotion/resolution functions unit-tested |
| Heuristics in English | PASS | Resolution prompts in English |

**Post-design re-check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260626-cross-doc-vault/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── concept-registry-store.md
│   ├── identity-resolution.md
│   ├── promotion-rules.md
│   ├── vault-graph.md
│   └── review-global-queue.md
├── checklists/
│   └── requirements.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/
├── concept-registry/
│   ├── registry-store.js       # NEW: CRUD, localStorage, Supabase-ready API
│   ├── identity-resolution.js  # NEW: embedding + fuzzy match, split bias
│   ├── promotion.js            # NEW: gray→yellow, yellow→green rules
│   ├── mastery.js              # NEW: global mastery cache + decay
│   └── vault-graph-adapter.js  # NEW: nodes/edges for graph/view.js
├── session-types.js            # extend: Concept, ConceptFacetSchedule, ConceptContent
├── session-migration.js        # extend: globalConceptId, smItems migration flag
├── session-store.js            # extend: globalConceptId on signals/inventory
├── sm2-ingest.js               # extend: write global facet schedules
├── review.js                   # extend: global ConceptFacetSchedule queue
├── study.js                    # vault tab, concept pages, ingest path, deprecate curation
├── graph/canvas.js             # extend: yellow/green maturity styles
└── vault/vault-curation.js     # deprecate commit gate; bridge to promotion

cursor-tests/
└── 20260626_cross-doc-vault.mjs
```

**Structure Decision**: New `concept-registry/` package mirrors `vault/` pattern; single store seam for Supabase migration per spec §14.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Parallel registry alongside legacy vault | Gradual migration; existing vault entries have different shape | Big-bang replace would break Post A+ vault features mid-rollout |
| Per-facet global schedules | Spec requires facet-specific SM-2 while single mastery scalar | Document-level smItems cannot express cross-doc facet schedules |

## Phasing

1. **Phase 1 (T01–T06)**: Registry store, schema migration, identity resolution, gray→yellow from RSVP/Questions/Cloze, smItems→global schedule migration, vault graph yellow nodes
2. **Phase 2 (T07)**: Yellow→green via Recall + Slow Phase 3, ConceptContent storage
3. **Phase 3 (T08–T12)**: Vault navigation UI, focusConceptId, ingest-only, curation gate removal
4. **Phase 4 (T13)**: Integration tests, SW bump, quickstart QA
