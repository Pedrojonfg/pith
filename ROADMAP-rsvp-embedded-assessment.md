# ROADMAP — rsvp-embedded-assessment

**Feature:** specs/20260621-rsvp-embedded-assessment | **Spec:** specs/20260621-rsvp-embedded-assessment/spec.md | **Plan:** specs/20260621-rsvp-embedded-assessment/plan.md
**Created:** 2026-06-21

## Dependency diagram

```
T01 (audit/research) → T02 (canonical module) → T03 (test wiring) → T04 (socratic wiring) → T05 (tests + SW)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03, T04 | parallel |
| 4 | T05 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Phase 0 audit in research.md | — | sequential | [x] |
| T02 | `block-answer-signals.js` + `promoteFromSocraticBlock` | T01 | sequential | [x] |
| T03 | Wire `handleTestAnswer` to canonical fn | T02 | parallel | [x] |
| T04 | Wire socratic submit to canonical fn | T02 | parallel | [x] |
| T05 | cursor-tests + SW bump | T03,T04 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-06-21 (none created)

## Prompt per task

### T01 — Phase 0 audit
**Spec ref:** FR-1, §4 | **Plan ref:** research.md | **Files:** specs/20260621-rsvp-embedded-assessment/research.md
**Success criterion:** Four call paths documented; Finding A/B recorded.
**On close:** `/validate` and mark `[x]`.

### T02 — Canonical module
**Spec ref:** FR-2, R1 | **Plan ref:** contracts/block-answer-signals.md | **Files:** src/js/block-answer-signals.js, src/js/concept-registry/ingest.js
**Success criterion:** `finalizeBlockQuestionAnswer` exports; socratic promotion helper added.
**On close:** `/validate` and mark `[x]`.

### T03 — Test wiring
**Spec ref:** FR-3, R2 | **Plan ref:** plan.md | **Files:** src/js/study.js
**Success criterion:** `handleTestAnswer` delegates; dead `ingestSm2FromTestAnswer` removed or thinned to wrapper.
**On close:** `/validate` and mark `[x]`.

### T04 — Socratic wiring
**Spec ref:** FR-4, R3 | **Plan ref:** plan.md | **Files:** src/js/study.js
**Success criterion:** Post-tutor socratic path calls `finalizeBlockQuestionAnswer`.
**On close:** `/validate` and mark `[x]`.

### T05 — QA closure
**Spec ref:** Testing checklist | **Plan ref:** quickstart.md | **Files:** cursor-tests/20260621_rsvp-embedded-assessment.mjs, src/js/sw-update.js, index.html, sw.js
**Success criterion:** Tests green; SW_VERSION bumped.
**On close:** `/validate` and mark `[x]`.
