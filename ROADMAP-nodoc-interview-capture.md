# ROADMAP — nodoc-interview-capture

**Feature:** specs/20260620-nodoc-interview-capture | **Spec:** specs/20260620-nodoc-interview-capture/spec.md | **Plan:** specs/20260620-nodoc-interview-capture/plan.md
**Created:** 2026-06-20

## Dependency diagram

```text
T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08
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
| 7 | T07 | sequential |
| 8 | T08 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Schema, flags, opening bank, transcript helpers | — | sequential | [x] |
| T02 | Entry screen + interview capture UI shell | T01 | sequential | [x] |
| T03 | Transcript accumulation + session create/resume | T01,T02 | sequential | [x] |
| T04 | Dynamic follow-up LLM + generating UX | T03 | sequential | [x] |
| T05 | Fidelity synthesis + DPP interview path | T04 | sequential | [x] |
| T06 | Mode availability gate for interview origin | T05 | sequential | [x] |
| T07 | Unprompted articulation assessment signals | T05 | sequential | [x] |
| T08 | Integration tests + SW bump | T06,T07 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-06-20 (none created)

## Prompt per task

### T01 — Foundation modules
**Spec ref:** FR-001, FR-002, FR-004, FR-006, FR-011 | **Plan ref:** data-model, contracts | **Files:** session-types.js, config/flags.js, interview/opening-questions.js, interview/transcript.js, fidelity-validation.js
**Success criterion:** Types validate interviewTranscript; flags exported; opening bank per lang; transcript helpers pure; validateInterviewSynthesisFidelity wrapper
**On close:** `/validate` and mark `[x]`.

### T02 — UI shell
**Spec ref:** FR-003, FR-012, SC-001 | **Plan ref:** project structure | **Files:** index.html, main.css, ui.js
**Success criterion:** Secondary link on create-session start; screenInterviewCapture with question/answer/submit; instant opener display
**On close:** `/validate` and mark `[x]`.

### T03 — Transcript persistence
**Spec ref:** FR-002, FR-011 | **Files:** study.js, session-store.js, interview/transcript.js
**Success criterion:** Create interview session; append turns; resume partial; min-turn gate on finish
**On close:** `/validate` and mark `[x]`.

### T04 — Follow-up generation
**Spec ref:** FR-005, FR-006, FR-007, SC-006 | **Files:** interview/interview-api.js, study.js
**Success criterion:** One LLM call per follow-up; cap enforced; generating screen; categorized errors + retry
**On close:** `/validate` and mark `[x]`.

### T05 — Synthesis + DPP
**Spec ref:** FR-008, FR-009, FR-015 | **Files:** interview/synthesis.js, interview/interview-api.js, document-preparation.js, study.js
**Success criterion:** rawMarkdown + gray inventory from transcript only; fidelity pass; interview DPP subset; synthesisComplete flag
**On close:** `/validate` and mark `[x]`.

### T06 — Mode gate
**Spec ref:** FR-010, FR-013 | **Files:** study.js, mode-taxonomy.js or interview/origin.js
**Success criterion:** RSVP/Slow/Questions hidden for interview origin; Cloze/Recall visible
**On close:** `/validate` and mark `[x]`.

### T07 — Assessment signals
**Spec ref:** FR-016, User Story 4 | **Files:** session-types.js, interview/synthesis.js, assessment-signals.js
**Success criterion:** signalOrigin unprompted_articulation recorded for articulated concepts at synthesis
**On close:** `/validate` and mark `[x]`.

### T08 — QA closure
**Spec ref:** §7 testing checklist, quickstart | **Files:** cursor-tests/20260620_nodoc-interview-capture.mjs, sw-update.js, index.html, sw.js
**On close:** `/validate` and mark `[x]`.
