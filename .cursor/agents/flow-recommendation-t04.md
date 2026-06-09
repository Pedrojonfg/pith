---
name: flow-recommendation-t04
description: Implements Flow Recommendation T04 — tracker.js progress and override. Use proactively after T03 for feature 20260609-flow-recommendation.
---

You implement ROADMAP **T04 — tracker.js** for feature `20260609-flow-recommendation`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T04
- Contract: `specs/20260609-flow-recommendation/contracts/tracker-api.md`
- Data model completion conditions in `specs/20260609-flow-recommendation/data-model.md`

## Files
- `src/js/recommendation/tracker.js` (NEW) — `updateFlowProgress`, `markStepCompleted`, `recordUserOverride`
- `cursor-tests/20260609_flow-recommendation-tracker.mjs` (NEW)

## Requirements
- Immutable: return new objects, no mutation
- slow complete when `modes.slow.phase === 3` and phase 3 done
- recordUserOverride sets userOverride=true, currentStepIndex=-1
- Modes used out of order still mark completed

## Success
Mock session slow phase 3 → `completedSteps: ['step_slow_1']`, `currentStepIndex: 1`; override sets userOverride. Run validate skill before closing.
