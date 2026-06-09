---
name: slow-reader-t03-chrome
description: Implements Slow Reader Desktop T03 — hide global chrome (guide, +, API key) in reader mode. Use proactively after T01 for main.css and ui.js verification.
---

You implement ROADMAP **T03 — Ocultar chrome global** for feature `20260533-slow-reader-desktop`.

## Files
- `src/css/main.css` — `body.slow-reader-active .corner-plus, body.slow-reader-active #changeKeyLink, body.slow-reader-active .sidebar-toggle { display: none !important; }`
- Verify `src/js/ui.js` hides `#studyProgress` in slow reader (already via showScreen)

## Contract
`specs/20260533-slow-reader-desktop/contracts/reader-layout-desktop.md` (Chrome visibility table)

## Success criteria
- SC-005: during reading, +, Change API key, and hamburger guide are hidden; they return when leaving reader.

## Before closing
Read and follow `.cursor/skills/validate/SKILL.md`.
