---
name: slow-reader-t06-sidebar
description: Implements Slow Reader Desktop T06 — sidebar default closed on desktop, typography, textarea IA input. Use proactively after T02 for sidebar.js, index.html, slow-mode.css.
---

You implement ROADMAP **T06 — Sidebar desktop** for feature `20260533-slow-reader-desktop`.

## Files
- `src/js/slow/sidebar.js` — `resolveSidebarOpen()`: if undefined and `matchMedia('(min-width: 1024px)')` → false
- `index.html` — change `#slowSidebarIAInput` to `<textarea rows="3">`
- `src/css/slow-mode.css` — sidebar desktop typography; tab ☰ only when closed

## Contracts
`reader-layout-desktop.md`, `reader-responsive-overlays.md`

## Success criteria
- First desktop visit: sidebar closed; IA textarea usable; fonts ≥14px on items.

## Before closing
Read and follow `.cursor/skills/validate/SKILL.md`.
