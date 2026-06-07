---
name: cloze-t08-pipeline-phases34
description: Implements Cloze Mode T08 — pipeline Fases 3-4 distractors L1+L3 and QA calibration. Use proactively after T07.
---

You implement ROADMAP **T08 — Pipeline Fases 3–4** for branch `20260529-cloze-mode`. Depends on T07.

## Context
- Clarify: L1+L3 only, no L2 vault

## Files
- `src/js/cloze/pipeline.js` — `generateDistractors`, `qaAndCalibrate`
- `src/js/cloze/normalize.js` — `ClozeOption`, `qa_status` filter

## Requirements
1. Phase 3: 3 distractors + correct = 4 options; L1 pool from graph; L3 fallback.
2. Plausibility gradient high/medium/low.
3. Phase 4: assign `difficulty`, `qa_status` (valid/weak/rejected).
4. Export `getValidItems(items)` → only `valid`.
5. Target balance EASY 30% / MEDIUM 50% / HARD 20% documented in comment.

## Success
`cursor-tests/20260529_t03-cloze-valid-items.mjs` passes with fixtures. Run validate skill.
