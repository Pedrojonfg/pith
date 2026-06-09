---
name: slow-reader-t04-toolbar
description: Implements Slow Reader Desktop T04 — toolbar page indicator N/total, line height buttons, ArrowLeft/ArrowRight keyboard nav. Use proactively after T01 for index.html, reader.js, slow-mode.css.
---

You implement ROADMAP **T04 — Toolbar, página N/M y teclado** for feature `20260533-slow-reader-desktop`.

## Files
- `index.html` — add `#slowReaderPageIndicator`, `#slowLineSmallerBtn` / `#slowLineLargerBtn` in toolbar
- `src/js/slow/reader.js` — `renderProgress()` updates indicator; line height handlers; `onSlowReaderKeydown` ArrowLeft/ArrowRight → `goToReaderPage` when no overlay/input active
- `src/css/slow-mode.css` — toolbar desktop styles (no ugly wrap at ≥1024px)

## Contract
`specs/20260533-slow-reader-desktop/contracts/reader-toolbar-keyboard.md`

## Success criteria
- SC-004: navigate 10 pages with keyboard only; indicator shows `N / total`; lineHeight persists in session.

## Before closing
Read and follow `.cursor/skills/validate/SKILL.md`.
