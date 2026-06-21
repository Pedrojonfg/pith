# Implementation Plan: Adaptive Knowledge Probing Engine

**Branch**: `20260630-adaptive-knowledge-probing` | **Date**: 2026-06-21 | **Spec**: [spec.md](./spec.md)

## Summary

Add a pure-JS probe-selection and belief-propagation layer between the concept vault graph and existing pre-packing assessment generation. EIG picks the most informative concepts; Bayesian propagation updates beliefs along PREREQUISITE edges; project-level frontier surfaces in vault branch. No new LLM calls — same generation budget, smarter concept targeting.

## Technical Context

**Language/Version**: ES modules, browser PWA  
**Primary Dependencies**: Existing `assessment-coverage.js`, `study.js`, Supabase client, vault maturity from concept registry  
**Storage**: Session blob `shared.knowledgeBeliefState`; Supabase `probe_graph_warnings`, `vault_belief_state`  
**Testing**: `cursor-tests/*.mjs` (Node ESM, pure function imports)  
**Target Platform**: Browser PWA  
**Performance Goals**: Sub-ms per probe selection at ≤200 nodes  
**Constraints**: Must preserve `ASSESSMENT_PARALLEL_PACKING`; master flag rollback; English internal  
**Scale/Scope**: Tens–low hundreds of concepts per document

## Constitution Check

| Gate | Status |
|------|--------|
| Spec-driven | Pass |
| No new LLM on selection path | Pass |
| SW version bump on src change | Required at close |
| English internal | Pass |
| UI minimal (vault fringe read-only) | Pass |

## Project Structure

### Documentation

```text
specs/20260630-adaptive-knowledge-probing/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
└── contracts/adaptive-probing-api.md
```

### Source Code

```text
src/js/adaptive-probing/
├── probe-graph.js
├── belief-state.js
├── eig-selection.js
├── belief-propagation.js
├── knowledge-fringe.js
├── assessment-integration.js
└── belief-persist.js
src/js/config/flags.js              # ADAPTIVE_PROBING_FLAGS
src/js/study.js                     # wire pre-packing + vault branch
src/js/session-types.js             # knowledgeBeliefState typedef
index.html                          # vault fringe markup
supabase/migrations/20260630_adaptive_knowledge_probing.sql
cursor-tests/20260621_*.mjs
```

**Structure Decision**: New `adaptive-probing/` module namespace; integration points in `study.js` only.

## Implementation Sequence

1. **T01** — Flags + session types  
2. **T02** — Supabase migration  
3. **T03** — R0 probe graph + cycle break  
4. **T04** — R1 belief state init  
5. **T05** — R2 EIG selection (unit tests)  
6. **T06** — R3 propagation (unit tests)  
7. **T07** — R6 assessment integration  
8. **T08** — R5 fringe + vault UI + persist  
9. **T09** — Integration tests + SW bump + QA closure

## Complexity Tracking

| Violation | Why Needed | Alternative Rejected |
|-----------|------------|---------------------|
| Supabase tables for warnings/beliefs | Cross-session frontier + audit | Session-only — loses project frontier |
| Insert before holistic plan | Preserve map-reduce generation | Rewrite generation — high regression risk |
