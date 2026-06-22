# ROADMAP — fix-dpp-recalculation-guard

**Feature:** specs/20260622-fix-dpp-recalculation-guard | **Spec:** specs/20260622-fix-dpp-recalculation-guard/spec.md | **Plan:** specs/20260622-fix-dpp-recalculation-guard/plan.md
**Created:** 2026-06-22

## Dependency diagram

```
T01 (guard pure) → T02 (DPP) → T03 (mode entry) → T04 (generate blocks) → T05 (UI+tests)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04, T05 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Add isConceptInventoryValid + evaluateConceptInventoryGuard + poll helper | — | sequential | [x] |
| T02 | Guard DPP T1.2 + forceRerun in pipeline | T01 | sequential | [x] |
| T03 | Mode entry guards (mode-bootstrap + study gate) | T02 | sequential | [x] |
| T04 | Block generation + recommend guards | T03 | sequential | [x] |
| T05 | Retry UI, tests, SW bump, R8 audit | T04 | sequential | [x] |

## Prompt per task

### T01 — Guard pure functions
**Spec ref:** FR-001, FR-006 | **Plan ref:** Phase 1 | **Files:** src/js/session.js
**Success criterion:** Exported functions with correct threshold logic and [DPP-GUARD] logs.
**On close:** `/validate` and mark `[x]`.

### T02 — DPP call site A
**Spec ref:** FR-002 A, FR-007 | **Plan ref:** Phase 2 | **Files:** document-preparation.js, study.js
**Success criterion:** T1.2 skips when valid; forceRerun resets failed state.
**On close:** `/validate` and mark `[x]`.

### T03 — Mode entry call site B
**Spec ref:** FR-002 B, FR-003, FR-004 | **Plan ref:** Phase 3 | **Files:** mode-bootstrap.js, study.js
**Success criterion:** Failed/waiting handled at mode select gate; no duplicate DPP on valid inventory.
**On close:** `/validate` and mark `[x]`.

### T04 — Block generation call site C
**Spec ref:** FR-002 C, FR-005 | **Plan ref:** Phase 4 | **Files:** study.js
**Success criterion:** Generate/recommend use shared inventory when valid; degraded path proceeds.
**On close:** `/validate` and mark `[x]`.

### T05 — UI, tests, audit
**Spec ref:** FR-003, FR-008 | **Plan ref:** Phase 5 | **Files:** index.html, ui.js, study.js, sw-update.js, sw.js, cursor-tests
**Success criterion:** Retry button on mode select + generate; integration tests pass; call-site comment in session.js.
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-06-22 (none created)

## R8 audit notes

| Call site | Coverage |
|-----------|----------|
| `document-preparation.js` runPhaseT12 | Guard skip |
| `study.js` enterModeSelectAfterTier1Gate | failed/waiting/poll |
| `study.js` recommendBlockCount | resolveInventoryForBlockFlow |
| `study.js` generate-blocks submit | isConceptInventoryValid + degraded |
| `study.js` recall runConceptInventoryForDoc | evaluateConceptInventoryGuard |
| `vault/import.js` | User-initiated vault import (out of DPP scope) |
| `session.js` twoPhaseConceptSplit | Internal; callers guarded in study.js |
