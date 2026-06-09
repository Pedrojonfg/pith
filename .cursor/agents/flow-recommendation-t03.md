---
name: flow-recommendation-t03
description: Implements Flow Recommendation T03 — recommender.js decision table + times. Use proactively after T01+T02 for feature 20260609-flow-recommendation.
---

You implement ROADMAP **T03 — recommender.js** for feature `20260609-flow-recommendation`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T03
- Contract: `specs/20260609-flow-recommendation/contracts/recommender-api.md`
- Data model: `specs/20260609-flow-recommendation/data-model.md`

## Files
- `src/js/recommendation/recommender.js` (NEW) — `computeModeRecommendation`, `computeStepTimes`, `TIME_FACTORS`, genreLabel ES map
- `cursor-tests/20260609_flow-recommendation-recommender.mjs` (NEW)

## Requirements
- Decision table priority per contract (philosophical → slow flow, lecture notes → rsvp, tiny → questions, etc.)
- ModeStep templates with Spanish labels/descriptions
- Output invariants: computedAt, analysis.*, reasoning ES, currentStepIndex=0, completedSteps=[], userOverride=false

## Success
Philosophical paper → `primaryFlow[0].mode === 'slow'`; notes → questions/rsvp; tiny → one step; full schema no nulls. Run validate skill before closing.
