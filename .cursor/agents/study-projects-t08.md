---
name: study-projects-t08
description: Implements Study Projects T08 — study.js library navigation and project CRUD wiring. Use proactively for feature 20260623-study-projects Wave 4 after T06+T07.
---

You implement ROADMAP **T08 — Library navigation & project CRUD wiring** for feature `20260623-study-projects`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T08
- Contracts: `specs/20260623-study-projects/contracts/project-library-ui.md`, `project-store-api.md`
- Depends on T06, T07

## Files
- `src/js/study.js` — `enterProjectLibrary`, drill-down/back, create/rename/move/delete project handlers, `Move to project…` → `assignSessionToProject`, error toasts for cycle/delete block
- Wire library document tap → mode select with breadcrumb context

## Rules
- Full CRUD except misc delete/move blocked
- Document reassignment persists and reflects in library
- Breadcrumb updates on navigation
- Do NOT touch upload flow (T09), vault (T04)
- Run validate skill before closing

## Success
create Algebra → Unit 3 → move doc → visible in library.
