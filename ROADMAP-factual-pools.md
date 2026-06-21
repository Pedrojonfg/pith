# ROADMAP — factual-pools

**Feature:** specs/20260702-factual-pools | **Spec:** specs/20260702-factual-pools/spec.md | **Plan:** specs/20260702-factual-pools/plan.md  
**Created:** 2026-06-21 | **Completed:** 2026-06-21

## Dependency diagram

```
T01 (stem pools + rotation) ──► T02 (distractor sourcing) ──► T03 (validation batch)
                                                                      │
                                                                      ▼
                                                              T04 (orchestrator + wiring)
                                                                      │
                                                                      ▼
                                                              T05 (tests + SW)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04 | sequential |
| 5 | T05 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Stem pools + pool-rotation.js + factual-templates refactor | — | sequential | [x] |
| T02 | distractor-sourcing.js with unit matching + min-pool | T01 | sequential | [x] |
| T03 | distractor-validation.js Gemini batch | T02 | sequential | [x] |
| T04 | factual-block-questions.js + session.js wiring + generation_method | T03 | sequential | [x] |
| T05 | Seven cursor-tests + SW bump + contract update | T04 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-06-21 — none created (sequential implementation).

## Artifacts

- Spec/plan: `specs/20260702-factual-pools/`
- Code: `src/js/pedagogy/{pool-rotation,factual-templates,distractor-sourcing,distractor-validation,factual-block-questions}.js`, `session.js`, `factual-classifier.js`
- Tests: `cursor-tests/20260621_stem-pool-rotation.mjs` … `20260621_definitions-enumerations-unaffected.mjs`
- SW: `20260621_6` / `pith-v75`

## Pending (manual)

- Manual QA per `specs/20260702-factual-pools/quickstart.md`
