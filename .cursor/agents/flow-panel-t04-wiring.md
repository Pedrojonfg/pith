---
name: flow-panel-t04-wiring
description: Implements Flow Panel Chrome Polish T04 — renderFlowPanel + handlers in study.js. Use proactively after T02+T03 for feature 20260610-flow-panel-chrome-polish.
---

You implement ROADMAP **T04 — Panel wiring** for feature `20260610-flow-panel-chrome-polish`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T04
- Contract: `specs/20260610-flow-panel-chrome-polish/contracts/flow-panel-ui.md`
- Backend: `src/js/recommendation/*`, `computeAndPersistModeRecommendation`, `getRecommendedStep`

## Files
- `src/js/study.js` — `renderFlowPanel`, `wireFlowRecommendUpload`, call on mode select
- `src/js/ui.js` — DOM refs in `els` if missing

## Success
CTA/panel exclusivity; Why details works; override navigates. Run validate skill before closing.
