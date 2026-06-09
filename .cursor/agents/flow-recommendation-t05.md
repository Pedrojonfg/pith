---
name: flow-recommendation-t05
description: Implements Flow Recommendation T05 — session-store modeRecommendation + updateRecommendation. Use proactively in parallel with T01-T02 for feature 20260609-flow-recommendation.
---

You implement ROADMAP **T05 — session-store modeRecommendation** for feature `20260609-flow-recommendation`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T05
- Contract: `specs/20260609-flow-recommendation/contracts/consumer-integration.md` §session-store

## Files
- `src/js/session-types.js` — `modeRecommendation` in SharedLayer + lax validation
- `src/js/session-store.js` — default `null`, `updateRecommendation(docId, rec)`
- Test in cursor-tests (extend CRUD or tracker test file)

## Requirements
- createSession includes `modeRecommendation: null`
- updateRecommendation persists and rehydrates
- validateDocumentSession: modeRecommendation optional; if present must have primaryFlow array

## Success
createSession + updateRecommendation work. Run validate skill before closing.
