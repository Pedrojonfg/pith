---
name: study-projects-t03
description: Implements Study Projects T03 — migrateProjects boot + ProjectStore persistence in session-store. Use proactively for feature 20260623-study-projects Wave 2 after T01.
---

You implement ROADMAP **T03 — Migration & ProjectStore persistence** for feature `20260623-study-projects`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T03
- Contract: `specs/20260623-study-projects/contracts/project-migration.md`
- Data model: `specs/20260623-study-projects/data-model.md`
- Depends on T01: `MISC_PROJECT_ID`, `PROJECT_STORE_KEY` from session-types or config

## Files
- `src/js/session-migration.js` — add `migrateProjects()` idempotent step per contract
- `src/js/session-store.js` — `loadProjectStore`, `saveProjectStore`, `ensureMiscProject`; wire migration call at boot
- Hook migration from app entry (`main.js` or existing boot path)

## Rules
- Do NOT touch UI, vault, review
- First boot creates `mylearning_projects` with misc
- All sessions without projectId → misc
- Second boot is no-op (idempotent)
- Run validate skill before closing

## Success
Legacy localStorage sessions gain projectId after refresh.
