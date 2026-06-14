---
name: study-projects-t07
description: Implements Study Projects T07 — project library browser shell in index.html + CSS. Use proactively for feature 20260623-study-projects Wave 3 after T02+T03+T06.
---

You implement ROADMAP **T07 — Library browser shell** for feature `20260623-study-projects`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T07
- Contract: `specs/20260623-study-projects/contracts/project-library-ui.md` §Library browser
- Depends on T02, T03, T06

## Files
- `index.html` — extend `screenDocLibrary` with subproject list, document list, action buttons (`New Project`, `New Subproject`, `Move to project…` placeholders)
- `src/js/ui.js` — refs for new elements
- `src/css/main.css` — project browser layout, optional color swatch

## Rules
- DOM structure supports root vs drill-down views
- Breadcrumb mount point present
- Matches English strings table
- Do NOT touch study.js handlers (T08), full CRUD logic
- Run validate skill before closing

## Success
showScreen library displays project list container.
