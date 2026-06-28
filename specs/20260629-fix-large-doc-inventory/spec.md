# Feature Specification: Fix Large Document Inventory Sparse Failure

**Feature ID**: `20260629-fix-large-doc-inventory`  
**Status**: Approved  
**Priority**: P0 — blocks large PDF uploads  
**Created**: 2026-06-29

## Problem

Documents ~180k+ characters require `minViableConcepts` ≥ 37 but inventory returns 11–30 concepts (single-pass `terse` fallback). DPP T1.2 throws `INVENTORY_TOO_SPARSE` and aborts tier 1 despite having usable concepts. Map-reduce skips when hierarchy yields &lt;2 chunks.

## User Scenarios

### US1 — Large dense document reaches mode select (P1)

User uploads a ~180k-character philosophy PDF. DPP tier 1 completes (ready or partial) with a non-empty concept inventory; user can continue to mode select without a hard block.

### US2 — Degraded inventory banner (P2)

When inventory is below `minViableConcepts` but ≥ `MIN_CONCEPTS_ABSOLUTE`, user sees a dismissable banner explaining reduced coverage; study proceeds.

### US3 — Map-reduce when hierarchy is thin (P2)

When word count exceeds threshold but hierarchy produces one chunk, system uses char-based chunking fallback before single-pass.

## Requirements

- **FR-001**: T1.2 MUST NOT throw when `inventory.length >= MIN_CONCEPTS_ABSOLUTE` but below `minViableConcepts`; set `failReason: INVENTORY_TOO_SPARSE`, `status: partial`, persist inventory.
- **FR-002**: `runConceptInventory` MUST attempt char-based map-reduce when hierarchy chunks &lt; 2 and `charCount > 50000`.
- **FR-003**: Block generation MUST accept degraded inventory per existing `evaluateConceptInventoryGuard` `degraded` decision.
- **FR-004**: Dismissable banner when `failReason === INVENTORY_TOO_SPARSE` on generate/mode select.

## Assumptions

- Extends `20260622-fix-dpp-recalculation-guard` US4 degraded path; does not remove `minViableConcepts` for ideal path.
- Map-reduce chunk builder can live in `api.js` or `session.js` as fixed-size slices.

## Success Criteria

- Doc `2d97633c8592` class (187k chars) completes tier 1 with ≥5 concepts and partial/ready status.
- Live inventory re-run produces more concepts when map-reduce activates OR degraded path unblocks user.
