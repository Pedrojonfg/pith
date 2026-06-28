# Implementation Plan: Fix Large Document Inventory

**Feature**: `specs/20260629-fix-large-doc-inventory`  
**Date**: 2026-06-29

## Summary

Align T1.2 with guard US4 (degraded not fatal). Add char-based inventory chunks when hierarchy map-reduce cannot split. Surface sparse-inventory banner in study.js.

## Files

| File | Change |
|------|--------|
| `document-preparation.js` | T1.2 degraded path |
| `session.js` | char-chunk fallback before single-pass |
| `api.js` | optional `buildCharInventoryChunks` |
| `study.js` | banner on `INVENTORY_TOO_SPARSE` |
| `cursor-tests/20260629_large-doc-inventory.mjs` | unit tests |

## Implementation

1. **T1.2**: If `inventory.length >= MIN_CONCEPTS_ABSOLUTE && inventory.length < minRequired` → set failReason, partial, return hash (no throw).
2. **Map-reduce fallback**: When `buildInventoryChunks` returns &lt;2 and charCount &gt; 50k, split material into ~8k-word char windows.
3. **Banner**: reuse inventory banner pattern for sparse prep.
4. Tests + SW bump.
