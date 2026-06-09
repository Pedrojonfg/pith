---
name: flow-recommendation-t06
description: Implements Flow Recommendation T06 — study.js orchestration post-normalization and mode lifecycle. Use proactively after T04+T05 for feature 20260609-flow-recommendation.
---

You implement ROADMAP **T06 — study.js integración** for feature `20260609-flow-recommendation`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T06
- Contract: `specs/20260609-flow-recommendation/contracts/consumer-integration.md`

## Files
- `src/js/study.js` — after upload: analyzeText + computeModeRecommendation; on load: updateFlowProgress; on enter/exit mode: override + progress

## Requirements
- New doc: compute and persist modeRecommendation before mode select
- Existing doc: skip recompute, only updateFlowProgress on load
- Never throw to user; console.warn on failures

## Success
Upload new doc → session.shared.modeRecommendation populated; existing session does not recompute flow. Run validate skill before closing.
