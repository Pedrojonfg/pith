# Implementation Plan: DPP Persistence Overhaul

**Feature**: `specs/20260629-dpp-persistence-overhaul`  
**Date**: 2026-06-29

## Summary

Single-owner DPP persistence: clone-at-start, checkpoint/final writes only, `runId` guard, inventory validity fix, store-backed UI polling, stale-run scanner.

## New module

- `src/js/dpp-persistence.js` — `deepCloneSession`, `generateRunId`, run registry, `persistCheckpoint`, `persistFinal`

## Files

| File | Change |
|------|--------|
| `dpp-persistence.js` | R1, R5, R6 helpers |
| `document-preparation.js` | Orchestrator clone, checkpoints, remove mid-pipeline saves |
| `session-store.js` | R2 `addConceptsToShared(doc)`, `mergeConceptsIntoInventory`, `setLocalSessionCache` |
| `session.js` | R7 verify, R9 stale scanner, remove running→ready self-heal |
| `study.js` | R8 poll UI; caller persist for concept promotion |
| `slow/phase0.js` | R2 caller persist |
| `project-library.js` | R9 scan on library render |

## Implementation order

1. T01 R2 — `addConceptsToShared` refactor + callers  
2. T02 R1+R3+R4+R5 — orchestrator + `dpp-persistence.js`  
3. T03 R6 — `runId` guard in `persistFinal`  
4. T04 R7+R9 — guard + stale scanner (remove auto-ready repair)  
5. T05 R8 — UI store polling  
6. T06 — integration tests + regression

## Constitution

- Bump `SW_VERSION` / `index.html` `?v=` / `CACHE_NAME` on `src/js/**` changes.
- English-only internal strings.
- Validate before marking roadmap tasks `[x]`.
