# Research: Fix DPP Guard Status Race

**Feature**: `specs/20260709-fix-dpp-guard-race`  
**Date**: 2026-07-09

## Root cause trace (confirmed)

### Hypothesis (a) — write-before-log

**Finding**: `runDocumentPreparationPipeline` already awaits `finalizeAndPersist` (which calls `persistFinal`) before logging `Finished`. **R2 satisfied in pipeline.**

**Gap**: `startDocumentPreparation` re-reads store via `commitPreparedDocToStore` + `getSession`; reconcile logic exists but `enterModeSelectAfterTier1Gate` can still observe `running` when store lags or split fields persist.

### Hypothesis (b) — cached / stale read

**Finding**: `pollUntilConceptInventoryReady` reloads via `getActiveSession()` each tick — fresh store reads. **However**, `evaluateConceptInventoryGuard` bypass for in-flight status uses `hasTier1Artifacts` (requires `modeRecommendation`).

**Critical mismatch**: Tier-1 upload uses `stopAfterTier: 1` → phases `T0.1, T0.2, T1.1, T1.2, T1.4` only. `modeRecommendation` (T1.5) is post-gate and **not required** for `isTier1PreparationComplete`, which uses `hasTier1GateArtifacts` (inventory + blockRec only).

**Result**: Production scenario — 37 concepts, block rec present, status `running`, no mode rec → bypass never fires → `waiting — preparation already running` for 11 minutes.

**Decision**: Align guard bypass and `repairStuckRunningPreparationIfNeeded` with `hasTier1GateArtifacts`.

### Hypothesis (c) — runId tiebreak

**Finding**: `runId` is on preparation state; `persistFinal` and `isPreparedDocAheadOfStore` handle write-side staleness. Guard `running` branch checks `isDppInFlight` and `isPreparationStale` but not "completed run on device with gate artifacts while store shows old running runId".

**Decision**: When not in flight and gate artifacts present, treat stale `running` as complete (skip) regardless of runId string; optionally compare against `getActiveDppRunId` for logging.

## Decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Gate artifact bar | `hasTier1GateArtifacts` | Matches `isTier1PreparationComplete` and tier-1 upload scope |
| Poll ceiling | 90s (`DPP_GUARD_POLL_MAX_MS`) | 11min was symptom masking |
| Timeout UX | Reuse `renderPreparationFailedUi` with retry hint | Existing pattern in `enterModeSelectAfterTier1Gate` |
| Fresh read helper | `reloadSessionForGuard(docId)` wrapping `getSession` + repair | Single entry for gate + poll |

## Alternatives considered

- Require mode rec before mode select for tier-1 uploads — rejected; T1.5 is explicitly post-gate.
- Force T1.5 in stopAfterTier 1 — rejected; scope creep, changes DPP scheduling.
- Remove poll loop entirely — rejected; still needed for genuine in-flight pipeline.
