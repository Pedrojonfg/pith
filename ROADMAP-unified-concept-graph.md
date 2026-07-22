# ROADMAP — unified-concept-graph

**Feature:** `specs/20260722-unified-concept-graph` | **Spec:** `specs/20260722-unified-concept-graph/spec.md` | **Plan:** `specs/20260722-unified-concept-graph/plan.md`  
**Created:** 2026-07-22

## Dependency diagram

```text
T01 normalize adapter ──┐
                        ├──► T03 T1.3 relations ──► T04 Cloze consume ──┐
T02 packing-weights ────┤                                              ├──► T06 QA/SW
                        └──► T05 edge-weighted pack ───────────────────┘
                              (needs T02 + T03)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02 | parallel |
| 2 | T03 | sequential |
| 3 | T04 | sequential |
| 4 | T05 | sequential |
| 5 | T06 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Normalize accepts inventory-shaped nodes; export RELATION_TYPES | — | parallel | [x] |
| T02 | Add `config/packing-weights.js` constants | — | parallel | [x] |
| T03 | `generateConceptRelations` + rewrite `runPhaseT13` + PHASE_DEPS | T01 | sequential | [x] |
| T04 | Adapters + Cloze skip `generateEpistemicGraph` | T03 | sequential | [x] |
| T05 | Edge-weighted packing in pack pipeline | T02, T03 | sequential | [x] |
| T06 | Integration tests, SW bump, quickstart QA closure | T04, T05 | sequential | [x] |

## Prompt per task

### T01 — Normalize inventory-shaped nodes
**Spec ref:** FR-001, FR-006 | **Plan ref:** research Q4, data-model ConceptNode | **Files:** `src/js/cloze/normalize.js`, `cursor-tests/20260722_unified-cg-normalize.mjs`  
**Success criterion:** `normalizeEpistemicNode` accepts `text || label || title`; `normalizeEpistemicGraph` keeps inventory nodes; `RELATION_TYPES` exported for weights.  
**On close:** `/validate` and mark `[x]`.

### T02 — Packing weight constants
**Spec ref:** FR-008, SC-006 | **Plan ref:** research Q2 weights | **Files:** `src/js/config/packing-weights.js`, `cursor-tests/20260722_unified-cg-weights.mjs`  
**Success criterion:** All 9 RELATION_TYPES have ordering+affinity; unmapped default 0/0.1; STRUCTURAL_BONUS_SCALE exported.  
**On close:** `/validate` and mark `[x]`.

### T03 — Relations LLM + T1.3
**Spec ref:** FR-002–FR-004, FR-001 | **Plan ref:** contracts/concept-graph.md, research Q6 | **Files:** `src/js/concept-graph/relations.js`, `src/js/document-preparation.js`, `cursor-tests/20260722_unified-concept-graph-t13.mjs`  
**Success criterion:** PHASE_DEPS T1.3→T1.2; mocked LLM → `conceptGraph.nodes` same ref as inventory; invalid edge ids dropped; LLM fail → empty edges. Named `max_tokens`.  
**On close:** `/validate` and mark `[x]`.

### T04 — Cloze consume + graph adapter
**Spec ref:** FR-005, FR-006, FR-011 | **Plan ref:** research Q4/Q6 | **Files:** `src/js/graph/build.js`, `src/js/cloze/pipeline.js`, `cursor-tests/20260722_unified-concept-graph-adapter.mjs`  
**Success criterion:** `buildClozeEpistemicGraph` works with inventory nodes; Cloze Phase 0 does not call `generateEpistemicGraph` when shared graph has nodes.  
**On close:** `/validate` and mark `[x]`.

### T05 — Edge-weighted packing
**Spec ref:** FR-008, FR-009, SC-004, SC-005 | **Plan ref:** research Q5 | **Files:** `src/js/session.js` (or small helper under `src/js/concept-graph/`), packing helpers, `cursor-tests/20260722_edge-weighted-packing.mjs`  
**Success criterion:** Property tests: prerequisite repair; affinity co-location when size allows; structural bonus uses affinity only.  
**On close:** `/validate` and mark `[x]`.  
**Note:** Inject in pack pipeline, not `runPhaseT14` (research Q5).

### T06 — QA closure
**Spec ref:** SC-001–SC-006 | **Plan ref:** quickstart.md | **Files:** SW version files per `.cursorrules`, ROADMAP marks  
**Success criterion:** All feature cursor-tests green; SW_VERSION bumped if `src/js/**` changed; quickstart checklist done.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-07-22 — none created (waves run in orchestrator chat).

## Closeout

- All tasks `[x]`
- SW_VERSION `20260722_01` / CACHE_NAME `pith-v161`
- Suite: `cursor-tests/20260722_unified-cg-suite-sw.mjs` green
- SW flow: `cursor-tests/20260606_validate-sw-update-flow.mjs` 36 passed
