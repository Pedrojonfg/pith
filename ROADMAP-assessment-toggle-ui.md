# ROADMAP — assessment-toggle-ui

**Feature:** specs/20260628-assessment-toggle-ui | **Spec:** specs/20260628-assessment-toggle-ui/spec.md | **Plan:** specs/20260628-assessment-toggle-ui/plan.md
**Created:** 2026-06-28

## Dependency diagram

```
T01 (flags + config key) → T02 (index copy) → T03 (ui els) → T04 (study wiring) → T05 (tests + SW)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02, T03 | parallel |
| 3 | T04 | sequential |
| 4 | T05 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Preference helpers + update isPrePackingAssessmentEnabled | — | sequential | [x] |
| T02 | Update toggle copy in index.html | T01 | parallel | [x] |
| T03 | Register rsvpAssessmentOption in ui.js | T01 | parallel | [x] |
| T04 | Wire init, change handler, visibility in study.js | T02,T03 | sequential | [x] |
| T05 | cursor-tests + SW bump | T04 | sequential | [x] |

## Prompt per task

### T01 — Preference helpers
**Spec ref:** FR-003, FR-004 | **Plan ref:** config.js + flags.js | **Files:** src/js/config.js, src/js/config/flags.js
**Success criterion:** get/save preference; isPrePackingAssessmentEnabled reads localStorage default true; ASSESSMENT_BEFORE_PACKING @deprecated.
**On close:** `/validate` and mark `[x]`.

### T02 — Toggle copy
**Spec ref:** FR-001, FR-002 | **Plan ref:** index.html | **Files:** index.html
**Success criterion:** Label and hint match spec.
**On close:** `/validate` and mark `[x]`.

### T03 — ui.js els
**Spec ref:** FR-001 | **Plan ref:** ui.js | **Files:** src/js/ui.js
**Success criterion:** rsvpAssessmentOption in els.
**On close:** `/validate` and mark `[x]`.

### T04 — study.js wiring
**Spec ref:** FR-005, FR-006 | **Plan ref:** study.js | **Files:** src/js/study.js
**Success criterion:** Init from storage, save on change, visibility RSVP+online only.
**On close:** `/validate` and mark `[x]`.

### T05 — Tests + SW
**Spec ref:** FR-008, Success Criteria | **Plan ref:** SW bump | **Files:** cursor-tests, sw-update.js, sw.js, index.html
**Success criterion:** Tests pass; SW flow test pass.
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-06-28 (none created)
