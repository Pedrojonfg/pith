# ROADMAP — threshold-generative-pedagogy

**Feature:** specs/20260703-threshold-generative-pedagogy | **Spec:** specs/20260703-threshold-generative-pedagogy/spec.md | **Plan:** specs/20260703-threshold-generative-pedagogy/plan.md  
**Created:** 2026-06-28 | **Completed:** 2026-06-28

## Dependency diagram

```
T01 (threshold module) ──┬──► T02 (DPP + LLM)
                           ├──► T03 (RSVP scheduling + prompts)
                           ├──► T05 (comprehension gate)
                           └──► T06 (RSVP WPM)
T04 (generative prompts) ──► T05 wire
T02,T03,T04,T05,T06 ──► T08 (tests + SW)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T04 | parallel |
| 2 | T02, T03, T05, T06, T07 | parallel |
| 3 | T08 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | threshold-concepts.js + flags | — | parallel | [x] |
| T02 | DPP + LLM threshold classify | T01 | parallel | [x] |
| T03 | RSVP packing, block config, threshold_expanded prompt | T01 | parallel | [x] |
| T04 | generative-pedagogy.js constants | — | parallel | [x] |
| T05 | Wire generative prompts + tutors | T04 | parallel | [x] |
| T06 | comprehension gate threshold bar | T01 | parallel | [x] |
| T07 | RSVP WPM cap threshold blocks | T01 | parallel | [x] |
| T08 | cursor-tests + SW bump | T02–T07 | sequential | [x] |

## Artifacts

- Spec/plan: `specs/20260703-threshold-generative-pedagogy/`
- Code: `src/js/pedagogy/threshold-concepts.js`, `generative-pedagogy.js`, `api.js`, `session.js`, `document-preparation.js`, `comprehension-gate.js`, `rsvp.js`, `study.js`, `recall-api.js`, `slow/phase0.js`, `slow/phase3.js`
- Tests: `cursor-tests/20260703_threshold-generative-pedagogy.mjs`
- SW: `20260703_01` / `pith-v107`

## Temporary subagents

Cleanup: 2026-06-28 — none created.

## Pending (manual)

- Manual QA per `specs/20260703-threshold-generative-pedagogy/quickstart.md`
