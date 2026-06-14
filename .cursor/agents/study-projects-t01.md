---
name: study-projects-t01
description: Implements Study Projects T01 — session-types.js Project typedefs, MISC_PROJECT_ID, projectId validation. Use proactively for feature 20260623-study-projects Wave 1.
---

You implement ROADMAP **T01 — Session types & projectId** for feature `20260623-study-projects`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T01
- Spec: `specs/20260623-study-projects/spec.md` (FR-003, Key Entities)
- Data model: `specs/20260623-study-projects/data-model.md`
- Contract: `specs/20260623-study-projects/contracts/project-store-api.md`

## Files
- `src/js/session-types.js` — add JSDoc typedefs `Project`, `ProjectStore`; export `MISC_PROJECT_ID = 'misc'`; document `projectId` on DocumentSession root; extend `validateDocumentSession` to accept optional `projectId` string (warn if missing pre-migration only — do not break legacy reads)

## Rules
- Do NOT touch project-store.js, study.js, migration yet
- No schemaVersion bump
- All comments and exports in English
- Run validate skill before closing

## Success
- `MISC_PROJECT_ID` exported and used consistently
- Validation allows sessions without projectId (migration handles backfill)
- Import `{ MISC_PROJECT_ID }` from session-types works in DevTools
