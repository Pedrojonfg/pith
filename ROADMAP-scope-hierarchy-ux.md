# ROADMAP — scope-hierarchy-ux

**Feature:** specs/20260807-scope-hierarchy-ux | **Spec:** specs/20260807-scope-hierarchy-ux/spec.md | **Plan:** specs/20260807-scope-hierarchy-ux/plan.md  
**Created:** 2026-08-07

## Dependency diagram

```
T01 → T02 → T03 → T04
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Selectable hierarchy tree helper + keep flat list API | — | sequential | [x] |
| T02 | normalizeScopeSectionIds + dedupe in buildScopedMarkdown | T01 | sequential | [x] |
| T03 | Nested picker UI: expand/collapse, cascade, indeterminate | T02 | sequential | [x] |
| T04 | Integration tests + SW/version bump + quickstart QA | T03 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-08-07 (none created — sequential in-chat)

## Quickstart QA

- [x] Unit tree / normalize / UI / integration suites green
- [x] SW validate green (`SW_VERSION=20260807_07`, CACHE_NAME pith-v159)
- [x] Expand re-render uses `resetState: false` (review fix)

## Prompt per task

### T01 — Selectable tree
**Spec ref:** FR-001, FR-011 | **Plan ref:** research R1, contracts/selectable-tree.md | **Files:** src/js/scope-selection.js, cursor-tests/20260807_scope-hierarchy-tree.mjs  
**Complexity:** S  
**Success criterion:** `listSelectableHierarchyTree` preserves L1→L2 children; `listSelectableHierarchyNodes` still returns ordered flat ids; unit test green.  
**On close:** `/validate` and mark `[x]`.

### T02 — Normalize + dedupe
**Spec ref:** FR-006–FR-009 | **Plan ref:** research R2–R3, contracts/selection-normalize.md | **Files:** src/js/scope-selection.js, cursor-tests/20260807_scope-hierarchy-normalize.mjs  
**Complexity:** M  
**Success criterion:** Parent+children → parent-only; overlapping slices not double-counted; `buildScopeSelection` stores normalized ids; tests green.  
**On close:** `/validate` and mark `[x]`.

### T03 — Picker UI
**Spec ref:** FR-001–FR-005, FR-010, FR-012 | **Plan ref:** research R4–R7, contracts/scope-picker-ui.md, data-model.md | **Files:** src/js/study.js, src/css/main.css, src/css/slow-mode.css (align only), index.html (aria only if needed), cursor-tests/20260807_scope-hierarchy-ui.mjs  
**Complexity:** L  
**Success criterion:** Nested indent, collapsed children by default, parent cascade, indeterminate mixed, full-doc unchanged; UI test green.  
**On close:** `/validate` and mark `[x]`.

### T04 — QA closure
**Spec ref:** SC-001–SC-005 | **Plan ref:** quickstart.md | **Files:** cursor-tests (integration), src/js/sw-update.js, index.html `?v=`, optionally sw.js CACHE_NAME if CSS strategy needs it  
**Complexity:** S  
**Success criterion:** All feature tests + SW validate pass; ROADMAP tasks `[x]`; quickstart checklist noted done in roadmap.  
**On close:** `/validate` and mark `[x]`.
