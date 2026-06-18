# ROADMAP — ui-dead-weight-removal

**Feature:** specs/20260618-ui-dead-weight-removal | **Spec:** specs/20260618-ui-dead-weight-removal/spec.md | **Plan:** specs/20260618-ui-dead-weight-removal/plan.md
**Created:** 2026-06-18

## Dependency diagram

```text
T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04 | sequential |
| 5 | T05 | sequential |
| 6 | T06 | sequential |
| 7 | T07 | sequential |
| 8 | T08 | sequential |
| 9 | T09 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Delete screenBetweenBlocks + ghost handlers §2b | — | sequential | [x] |
| T02 | Delete broken HTML §2c; blocksListOutput → JS cache | T01 | sequential | [x] |
| T03 | screenSettings + delete screenApiSetup §4 | T02 | sequential | [x] |
| T04 | mode select + placeholder cleanup §3b–3c | T03 | sequential | [x] |
| T05 | syncFloatingChrome contextual rules §3d | T03 | sequential | [x] |
| T06 | Complete screen + export buttons §2d, §3e | T05 | sequential | [x] |
| T07 | Per-screen dedup §3f–3k | T04 | sequential | [x] |
| T08 | MCQ feedback CSS §6 + naming §5 | T06 | sequential | [x] |
| T09 | Integration tests + SW bump §8 | T07,T08 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-06-18

## Prompt per task

### T01 — Dead screen and ghost handlers
**Spec ref:** §2a, §2b | **Plan ref:** Task graph | **Files:** index.html, ui.js, study.js, dictionary.js, main.js
**Success criterion:** No `screenBetweenBlocks`, `showScreen("between")`, or §2b IDs in src/js/
**On close:** `/validate` and mark `[x]`.

### T02 — Broken HTML
**Spec ref:** §2c | **Files:** index.html, study.js, ui.js
**Success criterion:** `#loadOfflinePackBtn`, `#offlinePackInput`, `#blocksListOutput` absent from HTML
**On close:** `/validate` and mark `[x]`.

### T03 — Settings screen
**Spec ref:** §4, §3a | **Files:** index.html, ui.js, main.js, study.js, config.js, llm.js
**Success criterion:** `screenSettings` exists; `screenApiSetup` gone; boot uses `settings`
**On close:** `/validate` and mark `[x]`.

### T04 — Mode select / placeholder
**Spec ref:** §3b, §3c | **Files:** index.html, study.js, ui.js
**On close:** `/validate` and mark `[x]`.

### T05 — Chrome visibility
**Spec ref:** §3d, R7 | **Files:** ui.js, study.js, index.html
**On close:** `/validate` and mark `[x]`.

### T06 — Complete / export
**Spec ref:** §2d, §3e | **Files:** index.html, study.js, ui.js
**On close:** `/validate` and mark `[x]`.

### T07 — Per-screen dedup
**Spec ref:** §3f–3k | **Files:** index.html, study.js, recall-study.js, main.css
**On close:** `/validate` and mark `[x]`.

### T08 — MCQ + naming
**Spec ref:** §5, §6 | **Files:** main.css, index.html
**On close:** `/validate` and mark `[x]`.

### T09 — QA closure
**Spec ref:** §8 | **Files:** sw-update.js, index.html, sw.js, cursor-tests/
**On close:** `/validate` and mark `[x]`.
