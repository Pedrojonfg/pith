# Deep Dive: Cross-Document Concept Registry

**Date**: 2026-06-26  
**Feature**: `20260626-cross-doc-vault`  
**Branch**: `20260626-cross-doc-vault`

---

## 1. What we built

A **global concept registry** sits above per-document `shared` data. Concepts mature gray → yellow → green as the user studies: gray stays local in `conceptInventory` until first engagement; yellow means a global row with SM-2 facet schedules; green means user-authored content blocks from Recall (or future Slow Phase 3). Identity resolution runs lazily at gray→yellow (slug/alias fuzzy match, split bias). Review aggregates due `ConceptFacetSchedule` entries across the corpus instead of duplicating per-document `smItems`. A vault graph view reuses existing `graph/canvas.js` with maturity-aware styling. The manual "Upload to vault" curation gate is removed in favor of automatic promotion hooks from RSVP, Cloze, and Recall.

---

## 2. Design decisions

### 2.1 Gray concepts stay local (no registry row until engagement)

**Chosen**: `globalConceptId: null` on inventory until first `onConceptEngagement`; registry only stores yellow/green.

**Alternatives**: Eager dedup on every document upload (30–80 LLM/embedding calls per doc).

**Trade-off**: Same concept name in two unstudied documents appears as two gray nodes until engaged — acceptable because there is nothing to merge (no schedules, no content). False split is recoverable later; false merge corrupts content.

### 2.2 `concept-registry-store.js` as Supabase seam

**Chosen**: New `localStorage` key `mylearning_concept_registry`, mirroring `vault-store.js` patterns; CRUD API designed for future relational backend.

**Alternatives**: Extend `vault-store.js` entries; store global state inside each `DocumentSession`.

**Trade-off**: Two persistence layers coexist (legacy Knowledge Vault + new registry) until a future migration spec unifies them. Clean seam for pgvector later.

### 2.3 Identity resolution without embeddings in v1

**Chosen**: `identity-resolution.js` — exact slug, alias match, token-overlap score; high confidence (≥0.85) merges, medium creates new row with `relatedConceptIds` hint.

**Alternatives**: Embedding + nearest-neighbor on every promotion; always create new rows.

**Trade-off**: Cheaper and offline-friendly; homographs and near-synonyms may split incorrectly until manual merge UI exists.

### 2.4 Global SM-2 via `ConceptFacetSchedule`, legacy `smItems` read-through

**Chosen**: `promotion.js` writes facet schedules to registry; `global-review.js` builds queue from registry first, falls back to unmigrated `shared.smItems`.

**Alternatives**: Big-bang delete `smItems`; dual-write forever without migration path.

**Trade-off**: Transition period can show duplicate queue entries if smItems exist for concepts already linked globally — legacy branch skips items when inventory has `globalConceptId`.

### 2.5 Maturity monotonic; decay on mastery scalar only

**Chosen**: `mastery.js` recomputes cached `Concept.mastery` from facet qualities + exponential decay (`LAMBDA` from vault); green stays green when mastery drops.

**Alternatives**: Regress maturity on decay; per-facet mastery scores (rejected in spec — BKT sparsity).

**Trade-off**: UI must distinguish "green, low mastery" vs "yellow, no content" — handled via badge in graph adapter.

### 2.6 Reuse graph renderer, new adapter

**Chosen**: `vault-graph-adapter.js` → `graph-mount.js` → `renderGraphCanvas` with `maturity` metadata on nodes.

**Alternatives**: Fourth graph schema; separate D3/canvas implementation.

**Trade-off**: Node shape is still circle-based vault layout; gray local nodes use synthetic ids `local:{docId}:{canonicalId}`.

### 2.7 Deprecate curation gate, not vault-store

**Chosen**: Hide `btnUploadToVault`; promotion runs on mode events via `ingest.js`.

**Alternatives**: Remove `vault-curation.js` entirely.

**Trade-off**: Legacy vault entries and review items still work; two parallel "vault" concepts until product consolidates.

---

## 3. Concepts applied

| Concept | What it is | Where in our code |
|--------|------------|-------------------|
| **Lazy initialization** | Defer expensive work until first need | Gray concepts have no registry row until `onConceptEngagement` |
| **Repository / store pattern** | Single module owns persistence + normalization | `registry-store.js`: `loadRegistry`, `saveRegistry`, `normalizeConcept` |
| **Idempotent migration** | Safe to run on every load | `migrateSessionV3` in `session-store.js` adds `globalConceptId`, bumps `schemaVersion` |
| **State machine** | Monotonic transitions | `promotion.js`: gray→yellow (any engagement), yellow→green (`qualifiesForGreen`) |
| **Append-only with supersession** | History preserved, active view filtered | `appendContentBlock` + `supersededBy` in `registry-store.js` |
| **Priority queue** | Sort by due date, not block on early review | Reuses `buildReviewQueue` from `sm2.js` in `global-review.js` |
| **Adapter pattern** | Translate domain model to existing UI contract | `vault-graph-adapter.js` → graph node/edge shapes for `canvas.js` |
| **Facade / bridge** | Thin mode-specific entry points | `ingest.js`: `promoteFromMcqBlock`, `promoteFromRecall`, `promoteFromCloze` |
| **Bias toward false negatives** | Prefer split over merge when uncertain | `identity-resolution.js` medium-confidence → new concept + `relatedConceptIds` |
| **Feature flag / seam for backend** | Same API, swappable storage | `REGISTRY_STORAGE_KEY` + documented contracts in `specs/.../contracts/` |
| **Weighted average + exponential decay** | Cached derived metric | `computeConceptMastery` in `mastery.js` |

---

## 4. Technical debt and improvements

**Done well**
- Pure promotion and resolution logic are testable without DOM (`cursor-tests/20260626_cross-doc-vault.mjs`, 15 assertions).
- Supabase-ready store interface documented in contracts.
- SM-2 regression suite still passes after adding `global_concept` source type.

**Functional shortcuts**
- **Slow Phase 3 → green** not wired: steel-man/devil's-advocate annotations do not call `onConceptEngagement` with content text.
- **Identity resolution** is string heuristics only — no embeddings, no LLM disambiguation.
- **`buildGlobalReviewQueue` legacy branch** uses fragile `contentPreview.includes(canonicalId)` to detect already-migrated smItems.
- **`promotion.js` supersession**: compares `prior.lastQuality` on content blocks that have no such field — dead branch.
- **Co-occurrence edges** in `vault-graph-adapter.js` iterate sessions loosely; `void globalIds` suggests incomplete prerequisite edge wiring from doc hierarchy.
- **Two vault systems**: `pith_knowledge_vault` (legacy) vs `mylearning_concept_registry` — user-facing "Vault" branch has both Knowledge Vault graph and Concept graph without unified navigation story.

**Would not scale**
- Linear scan in `findConceptCandidates` and `getDueFacetSchedules` — fine for hundreds of concepts, painful at thousands without indexes.
- `localStorage` single JSON blob for registry — same size threshold problem `vault-store` already solves with ref split (not yet applied to registry).
- `recordObservationAndRecompute` on every MCQ answer — observation array capped at 2000 but still grows hot path work per interaction.

---

## 5. Consolidation questions

1. **Why does a concept remain gray in document A's graph but appear yellow globally after studying it only in document B?** Trace `globalConceptId` backfill and `buildVaultGraph` cold vs `focusedDocId` modes.

2. **What happens if the same inventory `canonicalId` is engaged in two documents with different labels before resolution?** Walk through `resolveGlobalConcept` scoring and the split-vs-merge thresholds.

3. **How does a Review answer update state — session `smItems`, global facet schedule, or both?** Follow `handleSm2QualityClick` branches for `global_concept` vs `session_legacy` vs vault review items.

---

## 6. Suggested `.cursorrules` additions

1. **Global concept registry seam**: Any cross-document concept identity, maturity, or facet SM-2 state MUST go through `src/js/concept-registry/` (`registry-store.js`, `promotion.js`). Do not add parallel `globalConceptId` persistence outside `session-store` backfill fields.

2. **Gray-before-yellow invariant**: Never create a registry row at inventory/upload time. Promotion hooks (`ingest.js` / `onConceptEngagement`) are the only entry points for new global concepts.

3. **Review queue precedence**: When extending Review, merge `buildGlobalReviewQueue` first; treat `shared.smItems` as legacy read-through only until a migration task explicitly removes the fallback.

---

## File map (quick reference)

```text
src/js/concept-registry/
├── registry-store.js      # persistence + normalization
├── identity-resolution.js # slug/alias resolve at gray→yellow
├── promotion.js           # maturity transitions + facet schedules
├── mastery.js             # decay cache
├── ingest.js              # RSVP / Cloze / Recall bridges
├── global-review.js       # cross-doc review queue
├── vault-graph-adapter.js # nodes/edges builder
└── graph-mount.js         # DOM + detail panel

specs/20260626-cross-doc-vault/   # spec, plan, contracts, quickstart
cursor-tests/20260626_cross-doc-vault.mjs
```
