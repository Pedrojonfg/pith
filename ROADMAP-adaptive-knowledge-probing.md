# ROADMAP — adaptive-knowledge-probing

**Feature:** specs/20260630-adaptive-knowledge-probing | **Spec:** specs/20260630-adaptive-knowledge-probing/spec.md | **Plan:** specs/20260630-adaptive-knowledge-probing/plan.md  
**Created:** 2026-06-21 | **Completed:** 2026-06-21

## Dependency diagram

```
T01 (flags) ──┬──► T03 (probe-graph) ──┬──► T05 (eig) ──► T07 (integration) ──► T09 (tests)
T02 (migration)─┤                        │
              └──► T04 (belief-state) ───┴──► T06 (propagation) ──► T08 (fringe UI)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02 | parallel |
| 2 | T03, T04 | parallel |
| 3 | T05, T06 | parallel |
| 4 | T07 | sequential |
| 5 | T08 | sequential |
| 6 | T09 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | ADAPTIVE_PROBING_FLAGS in config/flags.js | — | parallel | [x] |
| T02 | Supabase migration probe_graph_warnings + vault_belief_state | — | parallel | [x] |
| T03 | R0 buildProbeGraph + cycle break | T01 | parallel | [x] |
| T04 | R1 initializeBeliefState + session types | T01 | parallel | [x] |
| T05 | R2 nextProbe / nextProbeBatch EIG | T03,T04 | parallel | [x] |
| T06 | R3 updateBeliefs propagation | T03,T04 | parallel | [x] |
| T07 | R6 assessment integration in study.js | T05,T06 | sequential | [x] |
| T08 | R5 fringe UI + belief-persist | T06 | sequential | [x] |
| T09 | cursor-tests + SW bump + QA | T07,T08 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-06-21 — none created (sequential implementation in parent chat).

## Artifacts

- Spec/plan: `specs/20260630-adaptive-knowledge-probing/`
- Code: `src/js/adaptive-probing/*`
- Migration: `supabase/migrations/20260630_adaptive_knowledge_probing.sql`
- Tests: `cursor-tests/20260621_*adaptive*.mjs` (7 probe tests)
- SW: `20260621_4` / `pith-v73`

## Pending (manual)

- Apply Supabase migration to linked project (`supabase db push`)
- Manual QA per `specs/20260630-adaptive-knowledge-probing/quickstart.md`
