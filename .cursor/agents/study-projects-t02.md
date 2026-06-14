---
name: study-projects-t02
description: Implements Study Projects T02 — project-store.js pure CRUD and tree helpers. Use proactively for feature 20260623-study-projects Wave 2 after T01.
---

You implement ROADMAP **T02 — Project store pure module** for feature `20260623-study-projects`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T02
- Contract: `specs/20260623-study-projects/contracts/project-store-api.md`
- Data model: `specs/20260623-study-projects/data-model.md`
- Depends on T01: import `MISC_PROJECT_ID` from `./session-types.js`

## Files
- `src/js/project-store.js` (NEW) — `getProject`, `getAncestorChain`, `getDescendantIds`, `getChildren`, `getProjectTree`, `getSessionsByProject`, `createProject`, `renameProject`, `moveProject`, `deleteProject`, `assignSessionToProject`, cycle check, delete guards for misc
- Export error constants: `PROJECT_ERROR_CYCLE`, `PROJECT_ERROR_DELETE_BLOCKED`, etc. matching contract UI strings

## Rules
- Pure functions only — no localStorage/DOM
- `moveProject` rejects cycles and misc reparent
- `deleteProject` rejects misc, non-empty children, assigned sessions
- Do NOT touch session-store persistence, UI, migration
- Run validate skill before closing

## Success
Unit smoke in Node import — create tree, reject cycle delete.
