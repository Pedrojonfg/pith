---
name: recall-t05-ui
description: Implements Recall Mode T05 — screenRecall markup, CSS, mode selector entry. Use proactively for feature 20260621-recall-mode Wave 2 parallel with T02/T03/T04.
---

You implement ROADMAP **T05 — screenRecall UI** for feature `20260621-recall-mode`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T05
- Spec: User Story 1, `research.md` R9
- Contract: `specs/20260621-recall-mode/contracts/recall-entry-bootstrap.md` UI section

## Files
- `index.html` — `#screenRecall`: question area, textarea, submit, feedback panel, next, progress, optional concept peek
- `src/js/ui.js` — element refs per project pattern
- `src/css/main.css` or `src/css/recall-mode.css` + import — focused distraction-free layout
- Mode selector: Recall radio/button on create/mode select screens
- Bump `SW_VERSION`, `index.html` `?v=`, `sw.js` `CACHE_NAME` per `.cursorrules`

## Requirements
- No timer; generous textarea; progress "N / M"
- Screen hidden by default; matches app visual language
- Recall visible on mode select alongside other modes
- Stub render hook in study.js optional (minimal) so screen can be shown for QA

## Constraints
- Full orchestration is T06; wiring can be stub-only here

## Success
Screen renders with stub JS; PWA version bump validated (`cursor-tests/20260606_validate-sw-update-flow.mjs`). Run validate skill before closing.
