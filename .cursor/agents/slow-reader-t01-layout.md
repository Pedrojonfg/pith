---
name: slow-reader-t01-layout
description: Implements Slow Reader Desktop T01 — full-bleed layout shell, move reader outside .container, body.slow-reader-active. Use proactively as first blocking task for index.html, ui.js, main.css, slow-mode.css.
---

You implement ROADMAP **T01 — Full-bleed layout shell** for feature `20260533-slow-reader-desktop`.

## Files
- `index.html` — move `#screenSlowReader` outside `.container` (direct child of `main`)
- `src/js/ui.js` — `showScreen()`: `document.body.classList.toggle('slow-reader-active', showSlowReader)`
- `src/css/main.css` — `body.slow-reader-active main { padding: 0; place-items: stretch; }`
- `src/css/slow-mode.css` — `#screenSlowReader { width: 100%; max-width: none; }`

## Contract
`specs/20260533-slow-reader-desktop/contracts/reader-layout-desktop.md`

## Success criteria
- At 1920px viewport reader uses full window width (not 840px card). `body.slow-reader-active` only when slowReader visible.

## Before closing
Read and follow `.cursor/skills/validate/SKILL.md`.
