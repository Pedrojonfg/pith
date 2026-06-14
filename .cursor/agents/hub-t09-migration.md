---
name: hub-t09-migration
description: Implements Exposure/Retrieval Hub T09 — legacy modes.review migration noop/strip. Use proactively after T08 for feature 20260622-exposure-retrieval-hub Wave 4.
---

You implement ROADMAP **T09 — Legacy review migration** for feature `20260622-exposure-retrieval-hub`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T09
- Data model legacy section; `research.md` R2
- Depends on T08

## Files
- `src/js/session-migration.js` (or session-store normalizer) — strip/noop `modes.review` on load; preserve `shared.smItems`

## Requirements
- Legacy session JSON with `modes.review` loads without error
- smItems untouched
- No schemaVersion bump required

## Success
Migration fixture test passes.
Run validate skill before closing.
