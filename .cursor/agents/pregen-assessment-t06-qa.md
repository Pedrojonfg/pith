---
name: pregen-assessment-t06-qa
description: Implements fix-pregen-assessment T06 — full test suite + quickstart QA closure + ROADMAP [x]. Use proactively after T01–T05 for feature 20260616-fix-pregen-assessment.
---

You implement ROADMAP **T06 — Tests + QA closure** for feature `20260616-fix-pregen-assessment`. Depends on **T01–T05**.

## Context
- `specs/20260616-fix-pregen-assessment/quickstart.md`

## Files
- `cursor-tests/20260616_fix-pregen-assessment.mjs` — buildPrefetchConfigKey, API validation throws, prefetch param contract, legacy gate
- `cursor-tests/loader.mjs` — register suite if applicable
- `specs/20260616-fix-pregen-assessment/quickstart.md` — mark QA checklist
- `ROADMAP.md` — mark T01–T06 [x]

## Minimum cases
- API throws on missing n_test/n_socratic
- prefetchConfigKey changes when counts change
- Legacy gate documentation

## Success
Suite passes; QA-PA-1..PA-6 documented. Run validate before closing.
