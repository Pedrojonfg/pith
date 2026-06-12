---
name: pregen-assessment-t02-runner
description: Implements fix-pregen-assessment T02 — resilient runner, invalidate empty/stale itemsPromise, no auto handlePrePackingSkip in catch. Use proactively after T01 for feature 20260616-fix-pregen-assessment.
---

You implement ROADMAP **T02 — Runner resiliente** for feature `20260616-fix-pregen-assessment`. Depends on **T01**.

## Context
- Contracts: `prefetch-assessment.md`, `assessment-failure-ux.md`

## Files
- `src/js/study.js` — `enterPrePackingAssessmentRunner`, `enterPrePackingAssessmentScreen`: if `!itemsPromise` OR `prefetchConfigKey` mismatch OR result `[]`, recreate promise; in catch **do not** call `handlePrePackingSkip()` — surface error for T04

## Rules
- `questions.length === 0` → throw, no packing
- Keep `renderAssessmentChrome` + skip buttons when assessment screen active
- Shared helper to build items promise with same args as prefetch

## Success
Runner regenerates if prefetch failed; no silent skip in catch. Run validate before closing.
