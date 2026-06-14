# Research: Exposure / Retrieval Architecture & Retrieval Hub

**Feature**: `20260622-exposure-retrieval-hub`  
**Date**: 2026-06-14

## R1 — Mode taxonomy representation

**Decision**: Add static `MODE_TAXONOMY` map in new `mode-taxonomy.js` with `{ role, scope, label, description }` per mode key. Export `getDocumentRetrievalModes()` filtering `role === 'retrieval' && scope === 'document'`.

**Rationale**: Hub must not hardcode three buttons; future retrieval modes auto-appear. Taxonomy is code metadata only—not persisted on `DocumentSession`.

**Alternatives considered**:
- Hardcode hub options in HTML — rejected (FR-002 extensibility).
- Persist taxonomy on session — rejected (unnecessary storage, no user override).

## R2 — Legacy `review` slot handling

**Decision**: Variant **(b)** — keep optional empty legacy compatibility; `review` already absent from `MODE_KEYS` in current codebase. Hide all per-document Review UI entry points; do not delete `screenReview*` screens.

**Rationale**: Avoids `schemaVersion` bump and migration risk; vault Review reuses same screens with different data loader.

**Alternatives considered**:
- Variant (a) delete `modes.review` everywhere — rejected for v1 (migration churn for minimal gain).

## R3 — Vault Review data path

**Decision**: Add `runVaultSm2ReviewSession()` that calls `getSmItemsDueToday()` with no `docId`, builds queue via existing `buildReviewQueue`, tracks `sm2ReviewDocId` per **item** (from `item.docId`) on quality rating write via `upsertSmItem(item.docId, ...)`.

**Rationale**: `getSmItemsDueToday` already aggregates cross-session when `docId` omitted (`session-store.js:501–517`). `runSm2ReviewSession(docId)` currently single-doc — vault path is thin wrapper.

**Alternatives considered**:
- Switch active document per item — rejected (disrupts library context; spec assumption: write to origin doc without activation).

## R4 — Post-exposure navigation targets

**Decision**:
- RSVP: after `showSessionComplete()` flow, add path from complete screen CTA → hub (or replace "exit to mode select" primary with "Practice retrieval").
- Slow: replace `enterModeSelectScreen()` in `slowPhase3FinishBtn` with `enterRetrievalHub()`.
- Cloze complete already calls `enterModeSelectScreen` — unchanged (retrieval → mode select OK).

**Rationale**: Spec targets exposure completion only; changing every retrieval exit would over-scope.

**Alternatives considered**:
- Always hub after any mode — rejected (out of scope).

## R5 — Questions assessmentSignals prioritization

**Decision**: When building block study order for Questions mode (hub or direct entry), sort `blockIndex` entries using `prioritizeByAssessmentSignals` on block-level proxy items `{ conceptIds, blockIndex }` — same helper as Cloze.

**Rationale**: Reuses pure function from mode continuity; no new signal schema.

**Alternatives considered**:
- LLM re-rank blocks — rejected (cost, latency, YAGNI).

## R6 — Hub neutrality vs flow recommender

**Decision**: Do not pass hub through `renderFlowPanel` or recommender badges. Flow panel remains on `screenModeSelect` for exposure mode choice only. Optional future spec may suggest hub option post-selection.

**Rationale**: Explicit spec requirement FR-002 / User Story 5.

## R7 — Reserved `exposureSignals` shape (not implemented)

**Decision**: Document in `data-model.md` only:

```javascript
// Future — not v1
{ conceptId, questionText, source: 'guide-chat' | 'slow-sidebar', timestamp }
```

**Rationale**: FR-013; avoids collision when `exposure-signals-capture` spec lands.

## R8 — Library entry copy

**Decision**: Add "Practice this document" button on `screenModeSelect` (when doc active) and/or doc library item secondary action → `enterRetrievalHub({ docId })`. Remove `btnReview` from mode select; add vault "Review due items" on `screenDocLibrary` header with badge from `getSmItemsDueToday()` aggregate.

**Rationale**: FR-004, FR-008, FR-011 in one navigation pass.
