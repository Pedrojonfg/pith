# Research — DPP Persistence Overhaul

**Date**: 2026-06-29

## Q1: Where is `addConceptsToShared` defined?

**Decision**: `src/js/session-store.js`; callers in `src/js/study.js` (`promoteConceptInventoryToShared`) and `src/js/slow/phase0.js` (`syncPhase0ConceptsToShared`).

**Rationale**: Grep across `src/js/` confirms no DPP phase calls it directly; T1.2 writes inventory in-memory. External callers must persist after merge.

## Q2: Does `saveActiveSession` merge or upsert?

**Decision**: Full upsert via `upsertSessionInStore` → `upsertSessionRow`; replaces row with validated session payload.

**Rationale**: `saveActiveSession` validates, timestamps, and calls `upsertSessionInStore` without field-level merge.

## Q3: `deepCloneSession` utility?

**Decision**: Add `deepCloneSession` in `src/js/dpp-persistence.js` using `structuredClone` with JSON fallback.

**Alternatives**: Reuse private `deepCloneJson` in `session.js` — kept separate to avoid coupling.

## Q4: `resolveCreateSessionPrepStatus` entry points?

**Decision**: Primary upload flow in `study.js` `handleCreateSessionStartFilePicked`; also used post-pipeline `.then`. Poll loop added for R8.

## Q5: Library session iteration?

**Decision**: `project-library.js` uses `getAllSessions()` in `renderDocumentRows`; stale scan hooks `enterModeSelectScreen` and library render via shared `scanStalePreparationSessions`.

## Stale-run policy vs legacy auto-retry

**Decision**: Arch spec R9 overrides `handlePreparationStaleRun` auto-retry — mark `failed`/`STALE_RUN` without automatic re-run.

**Rationale**: User-facing Retry button is the recovery path per approved spec.
