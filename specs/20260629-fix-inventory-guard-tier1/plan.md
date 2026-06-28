# Implementation Plan: Fix Inventory Guard Tier1

**Feature**: `specs/20260629-fix-inventory-guard-tier1`  
**Date**: 2026-06-29

## Summary

Tighten `isConceptInventoryValid` and `repairStuckRunningPreparationIfNeeded` in `session.js`.

## Files

- `src/js/session.js`
- `cursor-tests/20260629_inventory-guard-tier1.mjs`

## Implementation

1. `isConceptInventoryValid`: only `ready` | `partial` | `legacy` after threshold met.
2. `repairStuckRunningPreparationIfNeeded`: check `phaseResults.T1.2` success/skipped before promoting.
3. Unit tests for running+inventory → invalid; ready+inventory → valid.
