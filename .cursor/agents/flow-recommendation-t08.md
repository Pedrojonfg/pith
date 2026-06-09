---
name: flow-recommendation-t08
description: Implements Flow Recommendation T08 — integration tests + quickstart QA closure. Use proactively after T07 for feature 20260609-flow-recommendation.
---

You implement ROADMAP **T08 — Tests integración y QA** for feature `20260609-flow-recommendation`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T08
- Quickstart: `specs/20260609-flow-recommendation/quickstart.md`

## Files
- `cursor-tests/20260609_flow-recommendation-integration.mjs` (NEW)
- Mark T01–T08 [x] in ROADMAP.md

## Test cases
- Upload → recommendation populated
- Override flow
- Existing session no recompute
- ~83 min for 10k words slow flow
- Fallback without LLM

## Success
All cursor-tests pass; ROADMAP tasks marked complete. Run validate skill before closing.
