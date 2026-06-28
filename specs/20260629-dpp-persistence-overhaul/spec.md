# Feature Specification: DPP Persistence Architecture Overhaul

**Feature ID**: `20260629-dpp-persistence-overhaul`  
**Status**: Approved — ready for implementation  
**Created**: 2026-06-29  
**Supersedes**: partial fixes in commit `07ee581` (persist-race patch, F3 UI patch)

## Problem

The Document Preparation Pipeline (DPP) runs correctly in memory but fails to persist its final state reliably. `prep.status` stays `"running"` in Supabase and localStorage after successful completion, leaving the UI stuck on *"Preparing document…"* and blocking study mode entry.

### Root causes

- **RC-1**: Concurrent writes during DPP (`addConceptsToShared` read-modify-write races).
- **RC-2**: Fire-and-forget mid-pipeline persists overwriting final status.
- **RC-3**: No single authoritative final write.
- **RC-4**: Guards treating `running` as inventory-valid masked failures.

## Goals

- **G1**: `prep.status` in store always matches DPP in-memory conclusion.
- **G2**: No mid-pipeline write overwrites a later write from the same run.
- **G3**: UI reflects true prep status within 2 seconds of DPP completion.
- **G4**: Stuck `"running"` sessions from prior failed runs are detectable and recoverable.
- **G5**: DPP phases mutate one in-memory document; store writes only at checkpoints.

## Non-goals

- No DPP phase logic, prompts, or LLM call changes.
- No `shared` field semantics or `session-types.js` type definition changes.
- No automatic migration of broken legacy sessions.
- No background DPP (separate backlog spec).

## Requirements

### R1 — Single document clone at pipeline start

Clone session at `runDocumentPreparationPipeline` start; set `status: running`, `startedAt`, `runId`; initial checkpoint.

### R2 — Phase functions must not touch session store

Refactor `addConceptsToShared(doc, concepts)` to mutate `doc.shared` only. No `getSession`/`saveActiveSession` inside phase runners.

### R3 — Checkpoint writes explicit and awaited

Checkpoints after T1.1, T1.2, all Tier 1 complete, and final. All `await`ed.

### R4 — Final write atomic and last

`persistFinal` after `finalizePreparationStatus`; no further writes for the run.

### R5 — Only `persistCheckpoint` / `persistFinal` call session store during DPP

### R6 — Stale run detection via `runId`

Only matching `runId` may write final state.

### R7 — `isConceptInventoryValid` rejects non-ready/partial/legacy status

### R8 — UI polls store every 2s while `prep.status === "running"`

### R9 — Stuck run recovery

`running` + `startedAt` > 10 min + device did not initiate run → mark `failed` / `STALE_RUN`; show Retry.

## Assumptions

- `saveActiveSession` performs full upsert (verified in research).
- `structuredClone` acceptable for session clone.
- Open questions from source spec resolved in `research.md`.

## Success Criteria

- All three fixture sizes end with `prep.status` `ready` or `partial`, never `running`.
- UI leaves *"Preparing document…"* within 2s of pipeline end.
- `isConceptInventoryValid` returns false for `status: running` regardless of inventory count.
- Stale `running` sessions show Retry on library/mode-select entry.
