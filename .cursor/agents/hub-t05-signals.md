---
name: hub-t05-signals
description: Implements Exposure/Retrieval Hub T05 — Questions block order via prioritizeByAssessmentSignals. Use proactively for feature 20260622-exposure-retrieval-hub Wave 2 parallel with T03/T06.
---

You implement ROADMAP **T05 — Questions assessmentSignals prioritization** for feature `20260622-exposure-retrieval-hub`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T05
- Contract: `specs/20260622-exposure-retrieval-hub/contracts/assessment-signals-consumers.md`
- Depends on T01

## Files
- `src/js/study.js` (Questions study path) — block proxies, `prioritizeByAssessmentSignals`, study in returned order
- `cursor-tests/20260622_exposure-retrieval-hub.mjs` — start with signal ordering test

## Requirements
- Blocks with weak signal concepts appear earlier in Questions session
- Empty signals → default order unchanged
- Hub and direct mode-select entry both use same ordering

## Success
Seeded signals test puts weak-concept block in first half.
Run validate skill before closing.
