---
name: slow-reader-t07-overlays
description: Implements Slow Reader Desktop T07 — responsive IA overlays (modal desktop / bottom sheet mobile). Use proactively in parallel with T02-T05 for slow-mode.css and reader.js.
---

You implement ROADMAP **T07 — Overlays IA responsivos** for feature `20260533-slow-reader-desktop`.

## Files
- `src/css/slow-mode.css` — `@media (min-width: 1024px)` for `.slow-ia-overlay` centered modal, panel `max-width: 560px`; mobile unchanged
- `src/js/slow/reader.js` — verify focus trap and Escape without regression

## Contract
`specs/20260533-slow-reader-desktop/contracts/reader-responsive-overlays.md`

## Success criteria
- Desktop: IA appears as centered modal; at 375px remains bottom sheet with swipe.

## Before closing
Read and follow `.cursor/skills/validate/SKILL.md`.
