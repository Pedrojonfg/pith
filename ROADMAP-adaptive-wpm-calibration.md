# ROADMAP — adaptive-wpm-calibration

**Feature:** specs/20260628-adaptive-wpm-calibration | **Spec:** specs/20260628-adaptive-wpm-calibration/spec.md | **Plan:** specs/20260628-adaptive-wpm-calibration/plan.md  
**Created:** 2026-06-28

## Dependency diagram

```
T01 (module) → T02 (study wiring) → T03 (slider UI) → T04 (tests)
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
| T01 | wpm-calibration.js + config key | — | sequential | [x] |
| T02 | study.js WPM record + session complete hook | T01 | sequential | [x] |
| T03 | RSVP recommended marker UI | T01 | sequential | [x] |
| T04 | cursor-tests + SW bump | T02,T03 | sequential | [x] |

## Prompt per task

### T01 — calibration module
**Spec ref:** FR-001–FR-008 | **Plan ref:** wpm-calibration.js | **Files:** `src/js/rsvp/wpm-calibration.js`, `src/js/config.js`  
**Success criterion:** Pure functions pass unit tests for score, adjustment, clamp, localStorage.  
**On close:** `/validate` and mark `[x]`.

### T02 — study wiring
**Spec ref:** FR-008, FR-010 | **Plan ref:** study.js | **Files:** `src/js/study.js`  
**Success criterion:** Per-block WPM stored; calibration fires at showSessionComplete for rsvp/questions only.  
**On close:** `/validate` and mark `[x]`.

### T03 — slider marker
**Spec ref:** FR-009 | **Plan ref:** rsvp.js | **Files:** `index.html`, `src/js/rsvp.js`, `src/css/main.css`  
**Success criterion:** "Recommended" marker at WPM base on slider load.  
**On close:** `/validate` and mark `[x]`.

### T04 — tests + deploy bump
**Spec ref:** Success Criteria | **Plan ref:** cursor-tests | **Files:** `cursor-tests/20260628_adaptive-wpm-calibration.mjs`, `sw-update.js`, `index.html`, `sw.js`  
**Success criterion:** All tests green; SW_VERSION bumped.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-06-28 (none created)
