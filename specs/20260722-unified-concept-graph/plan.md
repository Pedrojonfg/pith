# Implementation Plan: Unified Concept Graph

**Branch**: `20260722-unified-concept-graph` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260722-unified-concept-graph/spec.md`  
**Design reference**: repo-root `spec-unifcg.md` (resolved via [research.md](./research.md))

## Summary

Merge redundant concept inventory + epistemic graph generation into one preparation artifact: inventory remains the node set; a new relations-only LLM step adds edges between existing ids. Cloze and graph views consume that shared graph (no second concept extraction). Edge-weighted packing injects prerequisite ordering repair and affinity grouping into the **pack pipeline** (not into T1.4 block-count recommendation).

## Technical Context

**Language/Version**: JavaScript (ES modules), browser PWA  
**Primary Dependencies**: Existing DeepSeek LLM helpers in `api.js`, Cloze normalize/pipeline, session pack path  
**Storage**: Document `shared` on session (local + Supabase JSON); no schema migration for legacy graphs  
**Testing**: `cursor-tests/*.mjs` (fixture + property invariants, mocked LLM)  
**Target Platform**: Existing MyLearning PWA  
**Project Type**: Client-side study app (single repo)  
**Performance Goals**: One fewer full concept-extraction LLM call per document preparation  
**Constraints**: Preserve all inventory fields; empty edges = degraded OK; no practice-ontology; surgical file scope  
**Scale/Scope**: DPP phases T1.2→T1.3→pack/Cloze; ~8–12 source files + tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file is a placeholder template — project rules from `.cursorrules` / Speckit skills apply:

- [x] Test-first for new behaviour (cursor-tests before implementation)
- [x] Simplicity / ponytail: thin adapters over mass renames; packing inject at pack path not T1.4 rewrite
- [x] No speculative practice-ontology or Vault type work
- [x] Explicit `max_tokens` on any new structured LLM JSON call (`generateConceptRelations`)
- [x] PWA SW bump only if `src/js/**` / `index.html` / `src/css/**` ship (required at feature close)

**Post-design re-check**: Pass — design uses existing normalize/pack modules; config constants isolated; no new user-facing screens required.

## Project Structure

### Documentation (this feature)

```text
specs/20260722-unified-concept-graph/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── concept-graph.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/js/
├── document-preparation.js          # PHASE_DEPS T1.3→T1.2; rewrite runPhaseT13
├── concept-graph/relations.js       # NEW: generateConceptRelations + edge drop validation
├── cloze/normalize.js               # accept text||label||title on nodes; export RELATION_TYPES if needed
├── cloze/pipeline.js                # skip generateEpistemicGraph when shared graph ready
├── graph/build.js                   # buildClozeEpistemicGraph adapter
├── config/packing-weights.js        # NEW: EDGE_*_WEIGHTS, STRUCTURAL_BONUS_SCALE
├── session.js                       # packInventoryToBlocks / deterministic pack hooks
└── (optional touch) pack-concept-editor.js, api.js (LLM helper if relations live there)

cursor-tests/
├── 20260722_unified-concept-graph-t13.mjs
├── 20260722_unified-concept-graph-adapter.mjs
└── 20260722_edge-weighted-packing.mjs
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Dual field aliases (`title`/`label`, `text`/`label`) | Live inventory ≠ design sketch | Mass rename of T1.2 + all consumers is out of scope and high risk |
| Packing outside T1.4 | T1.4 is count-only today | Rewriting T1.4 to own packing would conflate unrelated responsibilities |

## Implementation Phases (engineering)

1. Schema/adapters JSDoc + normalize accepts inventory-shaped nodes  
2. `generateConceptRelations` + `runPhaseT13` + `PHASE_DEPS`  
3. Cloze skip regen + `buildClozeEpistemicGraph`  
4. Packing weights + affinity bonus + prerequisite repair post-pass  
5. Integration tests + SW bump + quickstart QA  

See ROADMAP for task decomposition.
