# ROADMAP — pedagogical-principles

**Feature:** specs/20260701-pedagogical-principles | **Spec:** specs/20260701-pedagogical-principles/spec.md | **Plan:** specs/20260701-pedagogical-principles/plan.md  
**Created:** 2026-06-21 | **Completed:** 2026-06-21

## Dependency diagram

```
T01 (flags) ──┬──► T02 (R4 SM-2 priority)
              ├──► T03 (R1 factual) ──► T04 (R2 gate)
              ├──► T05 (R5 why-this)
              ├──► T06 (R3 dim/highlight)
              └──► T07 (R6 packing) ──► T08 (tests + SW)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02, T03, T05, T06 | parallel |
| 3 | T04, T07 | parallel |
| 4 | T08 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | PEDAGOGICAL_FLAGS in config/flags.js | — | sequential | [x] |
| T02 | R4 reviewProvenance + queue penalty + gap-fill cap | T01 | parallel | [x] |
| T03 | R1 factual classifier + templates + DPP hook | T01 | parallel | [x] |
| T04 | R2 comprehension gate + UI indicator | T03 | parallel | [x] |
| T05 | R5 WhyThisCard explanation | T01 | parallel | [x] |
| T06 | R3 concept spans + dim/highlight rendering | T01 | parallel | [x] |
| T07 | R6 novelty-biased packing (default off) | T01 | parallel | [x] |
| T08 | cursor-tests + SW bump + QA closure | T02–T07 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-06-21 — none created (sequential implementation in parent chat).

## Artifacts

- Spec/plan: `specs/20260701-pedagogical-principles/`
- Code: `src/js/pedagogy/*`, `sm2.js`, `sm2-ingest.js`, `review.js`, `document-preparation.js`, `session.js`, `slow/reader.js`
- Tests: `cursor-tests/20260621_factual-*.mjs`, `comprehension-gate`, `gap-fill-cap`, `time-as-orderer-preserved`, `why-this-priority`, `novelty-packing-blend`
- SW: `20260621_5` / `pith-v74`

## Pending (manual)

- Manual QA per `specs/20260701-pedagogical-principles/quickstart.md`
- R1 batched LLM classification for ambiguous concepts (heuristic-only in v1; LLM batch wired when ambiguous set non-empty)
- Enable `NOVELTY_BIASED_PACKING_ENABLED` for personal testing
