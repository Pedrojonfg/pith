---
name: rsvp-block-t06-qa
description: Implements RSVP Block Recommend T06 — integration tests + quickstart QA closure. Use proactively after T05 for feature 20260611-rsvp-block-recommend.
---

You implement ROADMAP **T06 — Tests + QA closure** for feature `20260611-rsvp-block-recommend`.

## Prerequisites
T01–T05 must be complete.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T06
- Quickstart: `specs/20260611-rsvp-block-recommend/quickstart.md`

## Files
- `cursor-tests/20260611_rsvp-block-recommend.mjs` — ampliar: cache invalidation, formula boundaries, session exports smoke
- `cursor-tests/loader.mjs` — register suite if needed
- `specs/20260611-rsvp-block-recommend/quickstart.md` — mark QA checklist
- `ROADMAP.md` — mark T01–T06 [x] when all pass

## Minimum cases
- 12+ recommender unit
- 4+ fingerprint/cache
- Smoke: `runConceptInventory` / `packInventoryToBlocks` exported from session.js
- DOM smoke: recommend IDs in index.html, els refs in ui.js

## Success
Full suite passes; quickstart QA-REC-1..7 documented. Run `.cursor/skills/validate/SKILL.md` before closing.
