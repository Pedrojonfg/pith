# Implementation Plan: Concept-Coverage Assessment

**Spec**: [spec.md](./spec.md) | **Date**: 2026-06-29

## Summary

Replace holistic assessment merge-by-count with concept-coverage batching (20 concepts/call, one MCQ each), lenient normalization, retry for uncovered concepts, and a `byConceptId` knowledge profile for packing.

## Technical context

- **Language**: ES modules in browser PWA (`src/js/`)
- **Key files**: `api.js`, `assessment-coverage.js`, `study.js`, `session.js`, `session-types.js`
- **Testing**: `cursor-tests/20260629_assessment-concept-coverage.mjs`

## Constitution check

- Explicit `max_tokens` on batch LLM calls (6000)
- Parse failures distinguish truncated vs schema (reuse `recoverPartialQuestionArray`)
- No localStorage clearing; SW version bump on `src/js/**` change

## Implementation phases

| Phase | Rules | Files |
|-------|-------|-------|
| 1 | R7 | `api.js` — remove count-mismatch throw; empty → `[]` |
| 2 | R1, R2 | `assessment-coverage.js`, `api.js` — batch split + coverage batch generator |
| 3 | R3, R4 | `api.js` — rewrite `generateHolisticPrePackingAssessmentItems` |
| 4 | R5 | `api.js`, `study.js` — `buildConceptCoverageKnowledgeProfile` |
| 5 | R6 | `session.js`, `session-types.js` — `getMasteryWeight`, pack bridge |
| 6 | Tests | `cursor-tests/20260629_assessment-concept-coverage.mjs` |

## Dependencies

- Extends pre-packing assessment flow from `20260611-rsvp-assessment-reposition`
- Supersedes merge retry throw in `20260618-holistic-assessment-coverage` for truncation paths
