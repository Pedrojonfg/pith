# Implementation Plan: Fix DPP Persist Race

**Feature**: `specs/20260629-fix-dpp-persist-race`  
**Date**: 2026-06-29

## Summary

Remove per-phase `persistDoc` inside `Promise.allSettled` parallel mappers; persist once after each wave completes. Keep persist on pipeline start, finalize, and phase-failure paths that exit early if needed.

## Technical Context

| Item | Detail |
|------|--------|
| Root file | `src/js/document-preparation.js` wave loop ~L643–695 |
| Persist | `persistDoc` → `saveActiveSession` → `upsertSessionInStore` |
| Tests | `cursor-tests/20260629_dpp-persist-race.mjs` |

## Implementation

1. Refactor wave loop: parallel phases mutate shared `doc`/`prep` only; `await persistDoc(doc)` after `Promise.allSettled`.
2. On phase failure, still record `markPhase` + errors in memory before wave-end persist.
3. Integration test: mock persist counter asserts ≤1 persist per wave.
4. SW bump with JS change.

## Constitution Check

Minimal diff; no new UI; English logs only.
