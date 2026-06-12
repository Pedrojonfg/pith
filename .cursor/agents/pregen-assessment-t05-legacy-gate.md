---
name: pregen-assessment-t05-legacy-gate
description: Implements fix-pregen-assessment T05 — legacy post-generation assessment gate tests. Use proactively after T01 for feature 20260616-fix-pregen-assessment.
---

You implement ROADMAP **T05 — Gate legacy post-generación** for feature `20260616-fix-pregen-assessment`. Depends on **T01** (verification).

## Context
- Contract: `legacy-assessment-gate.md`

## Files
- `src/js/study.js` — verify `goAfterBlocksConfirmed`, `setAssessmentUiDefaults`; no new routes to `goToInitialAssessment` when flag on
- `cursor-tests/20260616_fix-pregen-assessment.mjs` — gate regression tests

## Rules
- Do not remove legacy screen from DOM
- Document flag on → no post-generation path in tests

## Success
Tests document flag on → no post-generation path. Run validate before closing.
