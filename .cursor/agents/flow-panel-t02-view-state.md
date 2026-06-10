---
name: flow-panel-t02-view-state
description: Implements Flow Panel Chrome Polish T02 — resolveFlowPanelViewState pure function. Use proactively for feature 20260610-flow-panel-chrome-polish.
---

You implement ROADMAP **T02 — Flow panel view state** for feature `20260610-flow-panel-chrome-polish`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T02
- Data model: `specs/20260610-flow-panel-chrome-polish/data-model.md` (FlowPanelViewState)

## Files
- `src/js/study.js` — `export function resolveFlowPanelViewState(doc)`

## Logic
- `cta_upload`: no valid modeRecommendation (with or without doc)
- `intro` / `progress`: valid recommendation, !userOverride, by completedSteps
- `hidden`: userOverride

## Success
Pure function with 6+ documented cases. No markup/CSS. Run validate skill before closing.
