# Feature Specification: Fix Inventory Guard Running Shortcut

**Feature ID**: `20260629-fix-inventory-guard-tier1`  
**Status**: Approved  
**Priority**: P1 — premature skip while DPP incomplete  
**Created**: 2026-06-29

## Problem

`isConceptInventoryValid` returns `true` when `preparation.status === 'running'` and inventory meets threshold, causing `evaluateConceptInventoryGuard` to return `skip` while tier-1 phases (e.g. T1.2) are incomplete. Users can reach block generation with inconsistent prep state.

## User Scenarios

### US1 — Guard waits while DPP running (P1)

Session with 27 concepts but `status: running` and missing T1.2 phase result → guard `waiting`, not `skip`.

### US2 — Self-heal still works (P2)

`repairStuckRunningPreparationIfNeeded` promotes to `ready` when inventory sufficient AND tier-1 artifact phases complete.

## Requirements

- **FR-001**: Remove unconditional `running` → valid in `isConceptInventoryValid`.
- **FR-002**: Valid prep requires `ready`/`partial`/`legacy` OR repaired ready state.
- **FR-003**: `repairStuckRunningPreparationIfNeeded` MUST require tier-1 phase T1.2 success (or skip) before promoting to ready.
- **FR-004**: `[DPP-GUARD]` log when `running` + inventory forces `waiting`.

## Assumptions

- `isTier1PreparationComplete` artifact checks remain for RSVP skip; guard uses prep status + threshold.

## Success Criteria

- Session `9f459b5e6270` pattern → `waiting` until DPP completes or stale retry fires.
