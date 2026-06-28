# Feature Specification: Fix DPP Persist Race

**Feature ID**: `20260629-fix-dpp-persist-race`  
**Status**: Approved  
**Priority**: P0 — blocks all downstream prep state  
**Created**: 2026-06-29

## Problem

Document Preparation Pipeline finishes in memory (`status: ready`, full `phaseResults`, concept inventory) but Supabase/`getSession` retains an older snapshot (`status: running`, partial phases, missing inventory). Parallel `persistDoc` calls within each DPP wave race: last write wins with stale JSON clones.

## User Scenarios

### US1 — Prep state survives upload (P1)

After upload + DPP tier 1 on a small document, reloading the session shows `preparation.status` of `ready` or `partial`, full phase results, and persisted concept inventory matching console logs.

**Acceptance**: `getSession(docId)` after DPP matches in-pipeline `Finished` log (status, concept count, T1.2 in phaseResults).

### US2 — No inventory loss on parallel waves (P1)

When wave 2 runs T0.2, T1.1, T1.3 in parallel, a single coherent persist occurs after all phases in the wave complete.

## Requirements

- **FR-001**: DPP MUST persist at most once per wave after all parallel phases settle (success or failure).
- **FR-002**: `finalizePreparationStatus` MUST persist after status resolution.
- **FR-003**: Persisted `conceptInventory` MUST not regress to empty when pipeline populated it in memory.
- **FR-004**: No change to Supabase schema or auth.

## Assumptions

- Root cause is concurrent `upsertSessionInStore` from parallel phase handlers, not auth/RLS.
- `doc` object is shared in memory; race is at persist boundary only.

## Success Criteria

- Reproduction on localhost with real auth: philosophy sample upload shows `ready` + 30 concepts in DB after DPP.
- cursor-tests cover wave-level persist contract.
