---
name: study-projects-t06
description: Implements Study Projects T06 — renderBreadcrumb and renderProjectPicker in ui.js. Use proactively for feature 20260623-study-projects Wave 1.
---

You implement ROADMAP **T06 — Breadcrumb & project selector UI** for feature `20260623-study-projects`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T06
- Contract: `specs/20260623-study-projects/contracts/project-library-ui.md`
- Depends on T01 types only (may import MISC_PROJECT_ID for default label)

## Files
- `src/js/ui.js` — `renderBreadcrumb(segments)`, `renderProjectPicker(store, { selectedId, onSelect })` with indentation
- `src/css/main.css` — breadcrumb + picker styles

## Rules
- Breadcrumb renders arbitrary depth; clickable segments call onClick
- Project picker shows tree flat-indented
- English labels only
- Do NOT touch study.js navigation, session-store
- Run validate skill before closing

## Success
`renderBreadcrumb([{label:'Library'}])` returns clickable DOM node in DevTools.
