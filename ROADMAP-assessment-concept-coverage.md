# ROADMAP — assessment-concept-coverage

**Feature:** specs/20260629-assessment-concept-coverage | **Spec:** specs/20260629-assessment-concept-coverage/spec.md | **Plan:** specs/20260629-assessment-concept-coverage/plan.md  
**Created:** 2026-06-29

## Dependency diagram

```
T01 (R7 normalize) → T02 (R1+R2 batch) → T03 (R3+R4 holistic rewrite)
                                              ↓
                                    T04 (R5 profile) → T05 (R6 pack) → T06 (tests)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04 | sequential |
| 5 | T05 | sequential |
| 6 | T06 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Remove count-mismatch throw; empty → [] | — | sequential | [x] |
| T02 | Batch split + concept-coverage batch prompt | T01 | sequential | [x] |
| T03 | Rewrite holistic generation + retry coverage | T02 | sequential | [x] |
| T04 | buildConceptCoverageKnowledgeProfile | T03 | sequential | [x] |
| T05 | getMasteryWeight + pack profile bridge | T04 | sequential | [x] |
| T06 | cursor-tests + SW bump | T05 | sequential | [x] |

## Prompt per task

### T01 — Lenient normalization (R7)
**Spec ref:** R7 | **Plan ref:** Phase 1 | **Files:** api.js  
**Success criterion:** `normalizePrePackingAssessmentQuestions` never throws on under-count; returns `[]` for empty input.  
**On close:** `/validate` and mark `[x]`.

### T02 — Batch infrastructure (R1+R2)
**Spec ref:** R1, R2 | **Plan ref:** Phase 2 | **Files:** assessment-coverage.js, api.js  
**Success criterion:** `ASSESSMENT_BATCH_SIZE=20`, batch split, coverage batch LLM call with max_tokens 6000.  
**On close:** `/validate` and mark `[x]`.

### T03 — Holistic rewrite (R3+R4)
**Spec ref:** R3, R4 | **Plan ref:** Phase 3 | **Files:** api.js  
**Success criterion:** `generateHolisticPrePackingAssessmentItems` returns partial coverage, never throws on merge/count.  
**On close:** `/validate` and mark `[x]`.

### T04 — Knowledge profile (R5)
**Spec ref:** R5 | **Plan ref:** Phase 4 | **Files:** api.js, study.js  
**Success criterion:** Profile has `byConceptId`; counts sum to inventory length.  
**On close:** `/validate` and mark `[x]`.

### T05 — Pack integration (R6)
**Spec ref:** R6 | **Plan ref:** Phase 5 | **Files:** session.js, session-types.js  
**Success criterion:** `getMasteryWeight` neutral for unassessed; pack receives bridged profile.  
**On close:** `/validate` and mark `[x]`.

### T06 — Tests
**Spec ref:** §8 Testing checklist | **Plan ref:** Phase 6 | **Files:** cursor-tests, sw-update.js, index.html, sw.js  
**Success criterion:** New mjs tests pass.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-06-29 (none created)
