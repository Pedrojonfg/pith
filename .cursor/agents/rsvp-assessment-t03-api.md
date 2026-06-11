---
name: rsvp-assessment-t03-api
description: Implements RSVP Assessment Reposition T03 — pre-packing assessment LLM API + normalizers. Use proactively for feature 20260611-rsvp-assessment-reposition.
---

You implement ROADMAP **T03 — Pre-packing assessment API** for feature `20260611-rsvp-assessment-reposition`.

## Context
- Contract: `specs/20260611-rsvp-assessment-reposition/contracts/pre-packing-assessment-api.md`

## Files
- `src/js/api.js` — `generatePrePackingAssessmentItems`, `evaluatePrePackingAssessmentResponses`, `normalizeAssessmentItems`, `normalizeKnowledgeProfile`
- `cursor-tests/20260611_rsvp-assessment-reposition.mjs` — normalizer tests (≥10 cases, no live LLM)

## Requirements
- MCQ v1; "I don't know" handled in evaluator
- Evaluator failure returns `null`
- `coverage` computed in normalizer
- Reuse `parseModelJsonValue` patterns

## Success
Normalizer tests pass. Run validate skill before closing.
