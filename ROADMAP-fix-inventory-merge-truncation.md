# ROADMAP — fix-inventory-merge-truncation

**Feature:** specs/20260622-fix-inventory-merge-truncation | **Spec:** specs/20260622-fix-inventory-merge-truncation/spec.md | **Plan:** specs/20260622-fix-inventory-merge-truncation/plan.md
**Created:** 2026-06-22

## Dependency diagram

```
T01 flags ──┬──> T03 merge loop ──> T04 DPP ──> T06 tests
T02 recover ┘         │
T05 session-types ────┘ (parallel with T04 after T03)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02 | parallel |
| 2 | T03 | sequential |
| 3 | T04, T05 | parallel |
| 4 | T06 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Add min viable concept constants + helper | — | parallel | [x] |
| T02 | Implement recoverPartialConceptArray | — | parallel | [x] |
| T03 | Restructure merge retry loop + prompt | T01,T02 | sequential | [x] |
| T04 | DPP T1.2 validation + failReason handling | T01,T03 | parallel | [x] |
| T05 | Preparation failReason field + session merge propagation | T03 | parallel | [x] |
| T06 | cursor-tests + SW_VERSION bump | T04,T05 | sequential | [x] |

## Prompt per task

### T01 — flags constants
**Spec ref:** FR-005 | **Plan ref:** Phase 1 | **Files:** `src/js/config/flags.js`
**Success criterion:** `minViableConcepts(54000) === 10`, `minViableConcepts(2000) === 5`
**On close:** `/validate` and mark `[x]`.

### T02 — partial recovery
**Spec ref:** FR-003 | **Plan ref:** Phase 1 | **Files:** `src/js/api.js`
**Success criterion:** Truncated JSON after 2 complete objects returns exactly 2 parsed objects
**On close:** `/validate` and mark `[x]`.

### T03 — merge loop
**Spec ref:** FR-001–FR-004, FR-006, FR-008 | **Plan ref:** Phase 2 | **Files:** `src/js/api.js`
**Success criterion:** ≤3 attempts, partial recovery before retry, no throw on total failure
**On close:** `/validate` and mark `[x]`.

### T04 — DPP integration
**Spec ref:** FR-007 | **Plan ref:** Phase 3 | **Files:** `src/js/document-preparation.js`
**Success criterion:** sparse/empty inventory sets failed status + failReason
**On close:** `/validate` and mark `[x]`.

### T05 — prep state + session
**Spec ref:** fail reasons | **Plan ref:** Phase 3 | **Files:** `src/js/session-types.js`, `src/js/session.js`
**Success criterion:** failReason normalized; map-reduce handles empty merge
**On close:** `/validate` and mark `[x]`.

### T06 — QA closure
**Spec ref:** all | **Plan ref:** Phase 4 | **Files:** `cursor-tests/20260622_inventory-merge-truncation.mjs`, `sw-update.js`, `index.html`, `sw.js`
**Success criterion:** all tests green
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

(empty)
