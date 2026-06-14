---
name: hub-t02-ui-shell
description: Implements Exposure/Retrieval Hub T02 — screenRetrievalHub markup, CSS, ui.js refs. Use proactively for feature 20260622-exposure-retrieval-hub Wave 1 parallel with T01.
---

You implement ROADMAP **T02 — Retrieval Hub UI shell** for feature `20260622-exposure-retrieval-hub`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T02
- Contract: `specs/20260622-exposure-retrieval-hub/contracts/retrieval-hub-ui.md`

## Files
- `index.html` — `#screenRetrievalHub`, option container, `#retrievalHubBackBtn`, `#btnPracticeDocument` on mode select
- `src/js/ui.js` — element refs; extend `showScreen` for `retrievalHub`
- `src/css/main.css` — `.retrieval-hub-screen`, equal-weight option cards
- Bump `SW_VERSION` in `src/js/sw-update.js`, matching `?v=` on `sw-update.js` and `main.js` in `index.html`, and `CACHE_NAME` in `sw.js`

## Requirements
- Three neutral cards (no recommended badge); Cloze never disabled
- Hub hidden by default (`aria-hidden="true"`)
- Visual parity with mode-select card layout

## Constraints
- Do NOT wire hub navigation logic (T03) yet

## Success
Hub renders via `showScreen('retrievalHub')`; SW validate test passes.
Run validate skill before closing.
