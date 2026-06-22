# Feature Specification: Fix Concept Inventory Merge Truncation

**Feature ID**: `20260622-fix-inventory-merge-truncation`  
**Status**: Approved  
**Priority**: A — blocks all study modes  
**Created**: 2026-06-22

## Problem

`deepSeekMergeConceptInventories` hits output token limits on long documents. Truncated JSON is discarded; retries repeat identical failures; downstream DPP may mark preparation `ready` with unusably sparse inventory.

## User Scenarios & Testing

### User Story 1 — Upload long document (P1)

A student uploads a 20+ page PDF. DPP merge must complete with a viable concept inventory or fail visibly — never silent garbage.

**Acceptance**:

1. Merge LLM calls ≤ 3 per upload.
2. For ~54k chars, `conceptInventory.length` ≥ 10 when status is `ready`.
3. Total merge failure → `preparation.status === 'failed'`, `conceptInventory === []`, `failReason` set.

### User Story 2 — Partial truncation recovery (P1)

When merge JSON truncates mid-array but complete objects exist, system accepts recovered concepts if count meets minimum.

**Acceptance**:

1. Partial recovery runs before each retry.
2. Recovery accepted when `M >= minViableConcepts(charCount)`.

## Requirements

### Functional Requirements

- **FR-001**: Merge call MUST use `max_tokens: 8192`.
- **FR-002**: Merge prompt MUST force JSON-only output (no preamble/fences).
- **FR-003**: System MUST implement `recoverPartialConceptArray` for bracket-count extraction.
- **FR-004**: Partial recovery MUST run before each retry; max 3 merge LLM attempts.
- **FR-005**: `minViableConcepts(charCount)` = `max(5, floor(charCount / 5000))`.
- **FR-006**: Remove any stub/synthetic concept fallback on merge failure.
- **FR-007**: Never set `preparation.status = 'ready'` when inventory `< minViableConcepts`.
- **FR-008**: Log partial recovery attempts at INFO level.

### Fail reasons

- `INVENTORY_MERGE_FAILED` — empty inventory after merge
- `INVENTORY_TOO_SPARSE` — some concepts but below minimum

## Non-Goals

- Chunk-splitting upstream logic
- Per-chunk `max_tokens` changes
- DPP retry UI (separate spec)

## Assumptions

- `charCount` from `docMeta.charCount` or `textMetrics.charCount`
- `MIN_CHARS_PER_CONCEPT = 5000` is an unvalidated placeholder
