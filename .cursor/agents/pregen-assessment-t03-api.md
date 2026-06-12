---
name: pregen-assessment-t03-api
description: Implements fix-pregen-assessment T03 — generatePrePackingAssessmentItems rejects non-finite n_test/n_socratic. Use proactively in parallel with T01 for feature 20260616-fix-pregen-assessment.
---

You implement ROADMAP **T03 — Validación API** for feature `20260616-fix-pregen-assessment`. Independent of T01.

## Context
- Contract: `specs/20260616-fix-pregen-assessment/contracts/api-input-validation.md`
- `Number(undefined)` → NaN bypasses current checks

## Files
- `src/js/api.js` — Questions path in `generatePrePackingAssessmentItems`: validate finite `n_test`/`n_socratic` before LLM; stable error messages

## Rules
- No silent defaults to 2+1 — caller must pass counts
- Legacy MCQ path unchanged
- Validate non-empty `materialText` on Questions path

## Success
Call without `n_test` throws clear error without LLM. Run validate before closing.
