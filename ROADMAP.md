# ROADMAP — Concept Inventory Truncation Fix + Map-Reduce

**Feature**: `20260627-inventory-truncation-map-reduce` | **Spec**: `specs/20260627-inventory-truncation-map-reduce/spec.md` | **Plan**: `specs/20260627-inventory-truncation-map-reduce/plan.md`

**Objective**: Fix Phase 1 concept inventory JSON truncation; map-reduce for docs >8k words; unified fallback; remove dead code.

**Source**: `spec-truncationfix-mapreduce.md`, `deep-dives/2026-06-16_concept-inventory-truncation.md`

## Task table

| ID | Description | Deps | Complexity | Status |
|----|-------------|------|------------|--------|
| T01 | api.js — token constants, truncation, terse retry, chunk/merge LLM | — | L | [x] |
| T02 | session.js — map-reduce orchestration + runConceptInventoryWithFallback | T01 | L | [x] |
| T03 | study.js — route callers, hierarchy await, banners | T02 | M | [x] |
| T04 | pipeline-levers + fidelity-validation + vault/import cleanup | T01 | S | [x] |
| T05 | Remove debug :7501 telemetry (study.js, ui.js) | — | S | [x] |
| T06 | cursor-tests + SW bump + quickstart QA | T01–T05 | M | [x] |

## Dependency graph

```text
T01 ──→ T02 ──→ T03
T01 ──→ T04
T05 (independent)
T01,T02,T03,T04,T05 ──→ T06
```

**Parallel Wave 1**: T01 + T05

**Parallel Wave 2**: T02 + T04 (after T01)

**Parallel Wave 3**: T03 (after T02)

**Parallel Wave 4**: T06

## Subagents (`.cursor/agents/`)

| Task | Subagent |
|------|----------|
| T01 | `truncation-t01-api-layer1.md` |
| T02 | `truncation-t02-session-fallback.md` |
| T03 | `truncation-t03-study-wiring.md` |
| T04 | `truncation-t04-cleanup-fidelity.md` |
| T06 | `truncation-t06-qa-closure.md` |

---

**PROMPT T01 — api.js Layer 1**

Implement T01 for `20260627-inventory-truncation-map-reduce`.

Add `CONCEPT_INVENTORY_*_MAX_TOKENS`, `buildInventoryChunks`, `callConceptInventoryLlm` with 4-attempt cascade + `throwConceptInventoryParseError`, chunk + merge functions in `src/js/api.js`. Remove `deepSeekConceptInventoryPhase2`.

Reference: `specs/20260627-inventory-truncation-map-reduce/contracts/inventory-api.md`, ROADMAP.md.

criterio de éxito: exports present; parse + truncation throw work. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T06 — QA closure**

Run `cursor-tests/20260616_inventory-truncation-map-reduce.mjs` and `cursor-tests/20260606_validate-sw-update-flow.mjs`. Mark ROADMAP [x].

criterio de éxito: tests green + SW versions aligned. Ejecuta /validate antes de cerrar este mensaje.
