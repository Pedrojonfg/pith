# Implementation Plan: Fix Concept Inventory Merge Truncation

**Date**: 2026-06-22 | **Spec**: [spec.md](./spec.md)

## Summary

Raise merge reliability via 8192 token budget, JSON-only prompt, partial array recovery, 3-attempt cap, and DPP failure semantics when inventory is empty or too sparse.

## Technical Context

**Files**: `src/js/api.js`, `src/js/document-preparation.js`, `src/js/config/flags.js`, `src/js/session-types.js`, `src/js/session.js`

**Testing**: `cursor-tests/20260622_inventory-merge-truncation.mjs`

## Phases

### Phase 1 — Constants & recovery primitive

- Add `MIN_CONCEPTS_ABSOLUTE`, `MIN_CHARS_PER_CONCEPT`, `minViableConcepts` in `flags.js`
- Add `recoverPartialConceptArray` in `api.js`

### Phase 2 — Merge loop

- Cap at 3 attempts; partial recovery between attempts
- JSON-only instruction in merge prompt
- Return `{ concepts: [], failReason: 'MERGE_TRUNCATED' }` on total failure

### Phase 3 — DPP integration

- `failReason` on preparation state
- T1.2 validates count before persisting inventory
- `session.js` propagates merge failure

### Phase 4 — Tests & SW bump

- Unit tests for recovery + min viable
- Contract test for merge attempt cap
