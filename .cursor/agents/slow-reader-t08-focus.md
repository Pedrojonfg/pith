---
name: slow-reader-t08-focus
description: Implements Slow Reader Desktop T08 — auto focus mode on Phase 1 reader init. Use proactively after T03 and T04 for reader.js.
---

You implement ROADMAP **T08 — Focus mode automático** for feature `20260533-slow-reader-desktop`.

## Files
- `src/js/slow/reader.js` — in `initSlowReader`, activate `focus-mode` and `aria-pressed="true"` unless `session.slow.focusModeOptOut`
- Optional: on focus disable, set `focusModeOptOut = true` + `storeActiveSession`

## Contract
`reader-toolbar-keyboard.md` (Focus mode auto)

## Success criteria
- Entering Phase 1 reading: focus active without manual click; user can disable.

## Before closing
Read and follow `.cursor/skills/validate/SKILL.md`.
