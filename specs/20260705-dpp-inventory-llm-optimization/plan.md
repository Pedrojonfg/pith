# Implementation Plan: DPP Inventory LLM Cost Reduction

**Feature**: `specs/20260705-dpp-inventory-llm-optimization`  
**Date**: 2026-07-05  
**Spec**: [spec.md](./spec.md)

## Summary

Wire hierarchy LLM in DPP T1.1 and session inventory bootstrap; raise char-fallback slice to 24k with bisect-on-truncation; replace monolithic-first merge with pairwise deterministic tree and optional slim LLM polish.

## Technical Context

**Files**: `document-preparation.js`, `session.js`, `api.js`, `hierarchy-llm.js` (new small helper), `sw-update.js`, `index.html`, `sw.js`  
**Testing**: `cursor-tests/20260705_dpp-inventory-llm-optimization.mjs`  
**Constants**: `INVENTORY_CHAR_FALLBACK_SLICE_CHARS = 24000`, merge tree in `api.js`

## Project Structure

```text
src/js/hierarchy-llm.js              # shared makeHierarchyLlmFn(ctx)
src/js/document-preparation.js       # T1.1 llmFn
src/js/session.js                    # inventory hierarchy bootstrap
src/js/api.js                        # slice, bisect, merge tree
cursor-tests/20260705_dpp-inventory-llm-optimization.mjs
```

## Phase A — Hierarchy wiring (US1)

Extract `makeHierarchyLlmFn({ llmModel, signal })` from study.js pattern. Use in `runPhaseT11` and `runConceptInventory` hierarchy fallback.

## Phase B — Char fallback + bisect (US2)

Export `INVENTORY_CHAR_FALLBACK_SLICE_CHARS = 24000`. In `runConceptInventoryMapReduce`, wrap chunk call with `extractChunkWithBisect` (split on truncation, max depth 2).

## Phase C — Merge tree (US3)

Add `mergeConceptInventoriesDeterministicTree(partials)` — pairwise reduce using existing deterministic merge. Refactor `deepSeekMergeConceptInventories` to try tree first; LLM only if below `minRequired` or `mergePolish: true`.

## Phase D — QA

cursor-tests + SW_VERSION bump.
