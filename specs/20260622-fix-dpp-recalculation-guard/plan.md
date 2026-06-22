# Implementation Plan: Fix DPP Recalculation Guard

**Date**: 2026-06-22 | **Spec**: [spec.md](./spec.md)

## Summary

Add `isConceptInventoryValid` and `evaluateConceptInventoryGuard` in `session.js`. Wire guards at DPP T1.2, mode-entry gate, and RSVP block-generation paths. Add failed/waiting UI with manual retry and 3s polling.

## Technical Context

- **Stack**: Vanilla JS PWA, `session.js`, `document-preparation.js`, `mode-bootstrap.js`, `study.js`
- **Testing**: `cursor-tests/*.mjs` node tests
- **Dependency**: `20260622-fix-inventory-merge-truncation` (constants in `flags.js`)

## Implementation phases

### Phase 1 — Pure guard (session.js)

Export `isConceptInventoryValid`, `evaluateConceptInventoryGuard`, `pollUntilConceptInventoryReady`.

### Phase 2 — DPP call site A

Skip T1.2 when valid; support `forceRerun` in pipeline + `startDocumentPreparation`.

### Phase 3 — Mode entry call site B

Update `resolveModeEntryState`; gate `enterModeSelectAfterTier1Gate` for failed/waiting.

### Phase 4 — Block generation call site C

Guard `recommendBlockCount` and generate-blocks submit; use shared inventory when valid.

### Phase 5 — UI + tests

Mode-select and generate-blocks retry affordance; integration tests; SW bump.

## Constitution check

- English-only user strings and logs
- No new LLM calls in guard paths
- Bump `SW_VERSION` on `src/js/**` change
