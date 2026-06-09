---
name: slow-reader-t02-grid
description: Implements Slow Reader Desktop T02 — desktop 3-column grid (text | margin | sidebar) + responsive CSS. Use proactively after T01 for slow-mode.css and reader.js margin layout.
---

You implement ROADMAP **T02 — Grid desktop y columna de margen** for feature `20260533-slow-reader-desktop`.

## Context
- T01 complete: `#screenSlowReader` is direct child of `main`, `body.slow-reader-active` toggled in `ui.js`.
- Contract: `specs/20260533-slow-reader-desktop/contracts/reader-layout-desktop.md`

## Files
- `src/css/slow-mode.css` — `@media (min-width: 1024px)`:
  - Grid closed: `minmax(0, 1fr) 32px`
  - Sidebar open: `minmax(0, 1fr) 32px minmax(300px, 360px)`
  - Remove `grid-template-columns: minmax(0, 1fr) minmax(200px, 20vw)`
  - `.slow-reader-main`: desktop `max-width: min(75ch, 100%)`, centered in text column
  - `.slow-reader-margin`: remove `right: -36px`; integrate as grid column 2
- `src/js/slow/reader.js` — adjust `measureMarkY` / `renderMarginMarks` if DOM structure changes

## Success criteria
- SC-001: reading column ≥60ch with sidebar closed at 1920px; margin marks visible without clip.

## Before closing
Read and follow `.cursor/skills/validate/SKILL.md`: generate cursor-tests, run them, report results.
