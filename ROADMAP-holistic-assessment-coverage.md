# ROADMAP — holistic-assessment-coverage

**Feature:** specs/20260618-holistic-assessment-coverage | **Spec:** specs/20260618-holistic-assessment-coverage/spec.md | **Plan:** specs/20260618-holistic-assessment-coverage/plan.md
**Created:** 2026-06-18

## Dependency diagram

```text
T01 (coverage pure) ─┬─► T02 (API map-reduce)
                     └─► T03 (flags) ──► T04 (study wiring) ──► T05 (evaluator) ──► T06 (QA)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02, T03 | parallel |
| 3 | T04 | sequential |
| 4 | T05 | sequential |
| 5 | T06 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | assessment-coverage.js budget + plan + merge | — | sequential | [x] |
| T02 | generateHolisticPrePackingAssessmentItems + prompt | T01 | parallel | [x] |
| T03 | flags + config HOLISTIC_ASSESSMENT_* | T01 | parallel | [x] |
| T04 | study.js wiring + prefetch key + progress | T02,T03 | sequential | [x] |
| T05 | edge evaluation in knowledge_profile | T04 | sequential | [x] |
| T06 | cursor-tests + quickstart QA | T05 | sequential | [x] |

## Prompt per task

### T01 — Coverage plan pure module
**Spec ref:** FR-001, FR-002, FR-003 | **Plan ref:** Phase 1 | **Files:** src/js/assessment-coverage.js
**Success criterion:** computeHolisticAssessmentBudget, buildAssessmentCoveragePlan, mergeHolisticAssessmentQuestions, hashCoveragePlan exported and unit-testable.
**On close:** `/validate` and mark `[x]`.

### T02 — Holistic API generation
**Spec ref:** FR-004, FR-005, FR-006 | **Plan ref:** contracts/holistic-generation.md | **Files:** src/js/api.js
**Success criterion:** generateHolisticPrePackingAssessmentItems map-reduce; prompt edge quota; section material.
**On close:** `/validate` and mark `[x]`.

### T03 — Feature flags
**Spec ref:** FR-010 | **Plan ref:** data-model | **Files:** src/js/config/flags.js, src/js/config.js
**Success criterion:** isHolisticAssessmentEnabled(); HOLISTIC_ASSESSMENT_MAX=50.
**On close:** `/validate` and mark `[x]`.

### T04 — study.js integration
**Spec ref:** FR-008, FR-009 | **Plan ref:** Wave 3 | **Files:** src/js/study.js
**Success criterion:** holistic path in createPrePackingItemsPromise; progress UI; prefetch key.
**On close:** `/validate` and mark `[x]`.

### T05 — Evaluator edge mapping
**Spec ref:** FR-007 | **Plan ref:** contracts/holistic-generation.md | **Files:** src/js/api.js
**Success criterion:** edge questions update both endpoint concepts.
**On close:** `/validate` and mark `[x]`.

### T06 — Integration tests
**Spec ref:** SC-001–SC-004 | **Plan ref:** quickstart.md | **Files:** cursor-tests/20260618_holistic-assessment-coverage.mjs, sw bump
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-06-18 — none created (sequential implementation in parent chat).
