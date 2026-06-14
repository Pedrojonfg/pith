---
name: study-projects-t10
description: Closes Study Projects T10 — integration tests, ROADMAP [x], quickstart QA. Use proactively for feature 20260623-study-projects Wave 5 after T01–T09.
---

You implement ROADMAP **T10 — Integration tests & QA closure** for feature `20260623-study-projects`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T10
- Quickstart: `specs/20260623-study-projects/quickstart.md`
- All contracts in `specs/20260623-study-projects/contracts/`
- Depends on T01–T09 complete

## Files
- `cursor-tests/20260623_study-projects.mjs` (NEW) — migration idempotency, tree helpers, scopeDepth sort, review scope filter, misc guards
- `ROADMAP.md` — mark T01–T10 `[x]`
- Run `cursor-tests/20260606_validate-sw-update-flow.mjs` if SW changed in T09

## Rules
- All new tests pass via `node cursor-tests/20260623_study-projects.mjs`
- Use `cursor-tests/register.mjs` if needed for imports
- Run validate skill before closing

## Success
Full test file green + ROADMAP [x].
