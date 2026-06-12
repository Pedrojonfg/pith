---
name: pregen-assessment-t01-prefetch
description: Implements fix-pregen-assessment T01 — prefetch aligned with n_test/n_socratic, buildPrefetchConfigKey, remove .catch(() => []). Use proactively for feature 20260616-fix-pregen-assessment.
---

You implement ROADMAP **T01 — Prefetch alineado** for feature `20260616-fix-pregen-assessment`.

## Context
- Spec: `specs/20260616-fix-pregen-assessment/spec.md`
- Contract: `specs/20260616-fix-pregen-assessment/contracts/prefetch-assessment.md`

## Files
- `src/js/study.js` — `prePackingFlow` block in generate handler (~6883): pass `materialText: cleanedText`, `n_test`/`n_socratic` from `resolvePrePackingQuestionConfig()`, add `prefetchConfigKey` via `buildPrefetchConfigKey({ qCfg, conceptInventory, cleanedText })`; **eliminate** `.catch(() => [])`

## Rules
- Same args as `enterPrePackingAssessmentRunner` uses for generation
- Export `buildPrefetchConfigKey` for tests
- `buildPrefetchConfigKey` minimum inputs: n_test, n_socratic, sorted inventory ids joined, cleanedText.length

## Success
Prefetch uses Questions params; errors propagate. Run validate skill before closing.
