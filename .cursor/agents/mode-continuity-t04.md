---
name: mode-continuity-t04
description: Implements Mode Continuity T04 — study.js enterModeWithContinuity, recommend upload meta, bootstrap create UI. Use proactively for feature 20260612-mode-continuity after T02+T03.
---

You implement ROADMAP **T04 — Study.js continuity wiring** for feature `20260612-mode-continuity`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T04
- Contracts: `specs/20260612-mode-continuity/contracts/consumer-integration.md`, `bootstrap-create-ui.md`
- Requires T02 (session-store) + T03 (mode-bootstrap)

## Files
- `src/js/study.js` — `enterModeWithContinuity`, `applyModeEntry`, `recommendFlowFromUploadedFile` + `setUploadMeta`
- `index.html` — `#modeMaterialLoadedBanner`, `#studyFileInputRow`
- `src/js/ui.js` — banner refs
- `main.css` — banner styles
- `cursor-tests/20260612_mode-continuity.mjs` — T04 section

## Requirements
- Wire `startModeFromRecommendation`, mode radio, flow panel Continue via `enterModeWithContinuity`
- Bootstrap: hide file input, show banner, Generate uses `shared.rawMarkdown` / `state.lastCleanedMaterialText`
- Recommend upload sets `uploadMeta` + material state
- Resume path without regression

## Success
QA-MC-1/2 verifiable; tests pass. Run validate before closing.
