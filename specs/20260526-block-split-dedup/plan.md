# Implementation Plan: Block Split Deduplication

**Branch**: `20260526-block-split-dedup` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260526-block-split-dedup/spec.md`

## Summary

Reducir el solapamiento conceptual entre bloques de estudio sustituyendo el split monofásico “exactamente N” por un pipeline de **dos llamadas LLM** (inventario de conceptos → empaquetado con overview global en bloque 1) y un **dedup determinista** que reemplaza el audit LLM conservador. Si el pipeline nuevo falla, fallback al split actual sin bloquear la sesión.

## Technical Context

**Language/Version**: JavaScript (ES modules), browser vanilla  
**Primary Dependencies**: `llmChatCompletions` (`api.js`), parsers existentes (`parseBlockIndexFromModelResponse`, `parseModelJsonValue`)  
**Storage**: Sin nuevas claves localStorage; `state.lastBlockIndex`, `state.lastNBlocks`  
**Testing**: `cursor-tests/20260526_t01-deterministic-dedup.mjs`; manual [quickstart.md](./quickstart.md)  
**Target Platform**: Desktop + móvil (misma UI de generate blocks)  
**Project Type**: Single-page study app  
**Performance Goals**: Split total ≤ 2× latencia monofásica p95 (NFR-002)  
**Constraints**: Sin backend; sin frameworks; lógica empaquetado/dedup portable; `mergeChunks` LLM solo al fusionar  
**Scale/Scope**: ~350–500 LOC netas en `api.js` + `session.js` + `study.js`

## Constitution Check

*GATE: Project uses `.cursorrules` (constitution template not ratified).*

| Principle (.cursorrules) | Status | Notes |
|--------------------------|--------|-------|
| Simplicity / surgical | PASS | Un call site en `study.js`; audit LLM deja de invocarse |
| No backend | PASS | |
| No frameworks | PASS | |
| Flutter portability | PASS | Funciones puras en `session.js` |
| RSVP critical path | PASS | No toca `rsvp.js` |
| Single-file preference | PASS | Módulos existentes ya partidos |

**Post-design re-check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260526-block-split-dedup/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── two-phase-split-api.md
│   └── deterministic-dedup.md
└── tasks.md             # /speckit-tasks (next)
```

### Source Code (repository root)

```text
src/js/api.js            # Phase 1/2 prompts + deepSeekConceptInventory + deepSeekPackConceptsToBlocks
src/js/session.js        # twoPhaseConceptSplit, parseConceptInventory, applyDeterministicDedup
src/js/study.js          # Wire generate handler, progress strings, M vs N summary
cursor-tests/            # deterministic dedup unit test
```

**Structure Decision**: Orquestación en `session.js` (como `twoPhaseSplitMerge` hoy); API prompts en `api.js`.

## Phase 0: Research

Complete — [research.md](./research.md).

## Phase 1: Design & Contracts

Complete:

- [data-model.md](./data-model.md)
- [contracts/two-phase-split-api.md](./contracts/two-phase-split-api.md)
- [contracts/deterministic-dedup.md](./contracts/deterministic-dedup.md)
- [quickstart.md](./quickstart.md)

**Agent context**: `.cursor/rules/specify-rules.mdc` → this plan.

## Phase 2: Implementation Outline (for /speckit-tasks & ROADMAP)

| ID | Work package | Acceptance |
|----|--------------|------------|
| WP1 | Phase 1 API + parser (`deepSeekConceptInventory`) | Parse stable JSON; 3 retries |
| WP2 | Phase 2 API + parser (`deepSeekPackConceptsToBlocks`) | Block 1 overview; unique concept_ids |
| WP3 | `twoPhaseConceptSplit` orchestrator + fallback | Returns `splitRunMeta`; fallback mono |
| WP4 | `findDeterministicDuplicateMerges` + `applyDeterministicDedup` | Contract dedup; no audit LLM call |
| WP5 | `study.js` wire + progress + `renderSplitMergeSummary` M/N | quickstart §1–3 |
| WP6 | `cursor-tests` dedup + import skip guard | SC-004 automated |
| WP7 | Manual quickstart + overlap subjective check | SC-001–003 |

**Execution order**: WP1 → WP2 → WP3 → WP4 → WP5 → (WP6 ∥ WP7).

**Risk**: Doble latencia API — mitigar con status claro; fallback si timeout.

## Complexity Tracking

| Item | Why Needed | Simpler Alternative Rejected |
|------|------------|-------------------------------|
| 2 LLM calls | Clarified strategy D | Monophasic split caused overlap |
| LLM `mergeChunks` on dedup | Concatenar chunks sin perder fórmulas | Solo borrar bloque duplicado pierde texto |

## Next command

`/speckit-tasks` — o ejecutar prompts del `ROADMAP.md` (T01→T07).
