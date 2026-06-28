# ROADMAP — vault-study-trail

**Feature:** specs/20260628-vault-study-trail | **Spec:** specs/20260628-vault-study-trail/spec.md | **Plan:** specs/20260628-vault-study-trail/plan.md
**Created:** 2026-06-28

## Dependency diagram

```
T01 (study-trail.js) → T02 (CSS) → T03 (debug-ui wire) → T04 (tests + SW)
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
| T01 | Pure study-trail mapper + relative time | — | sequential | [x] |
| T02 | Trail CSS in main.css | T01 | sequential | [x] |
| T03 | Collapsible lazy trail in renderDetail | T01,T02 | sequential | [x] |
| T04 | cursor-tests + SW bump | T03 | sequential | [x] |

## Prompt per task

### T01 — study-trail.js
**Spec ref:** FR-001, FR-002, FR-004 | **Plan ref:** study-trail.js | **Files:** src/js/vault/study-trail.js
**Success criterion:** mapObservationToTrailRow, buildStudyTrailRows, formatStudyTrailRelativeTime exported; 50 cap + overflow count.
**On close:** `/validate` and mark `[x]`.

### T02 — CSS
**Spec ref:** FR-006 | **Plan ref:** main.css | **Files:** src/css/main.css
**Success criterion:** Trail section, row, badge, empty styles using design tokens.
**On close:** `/validate` and mark `[x]`.

### T03 — debug-ui integration
**Spec ref:** FR-003, FR-005, R5 lazy | **Plan ref:** debug-ui.js | **Files:** src/js/vault/debug-ui.js
**Success criterion:** Study trail at bottom of renderDetail; lazy expand; empty state.
**On close:** `/validate` and mark `[x]`.

### T04 — Tests + SW
**Spec ref:** FR-008, Success Criteria | **Plan ref:** SW bump | **Files:** cursor-tests/20260628_vault-study-trail.mjs, sw-update.js, sw.js
**Success criterion:** Tests pass; SW flow test pass.
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-06-28 (none created)
