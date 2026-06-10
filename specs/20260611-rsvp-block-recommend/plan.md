# Implementation Plan: RSVP Block Count Recommendation

**Branch**: `20260611-rsvp-block-recommend` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260611-rsvp-block-recommend/spec.md`

## Summary

Recomendación **bajo demanda** del número de bloques RSVP: el usuario pulsa **Recommend block count**, la app indexa conceptos **una vez** (LLM), calcula N con fórmula **determinística** reutilizando señales gratis (`analyzer`, `pedagogical_meta`, secciones) y pre-rellena el input editable. Al **Generate blocks**, se reutiliza el inventario cacheado y solo corre empaquetado + dedup. Invalidación al cambiar archivo o notas de estudio. Solo RSVP v1.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: `recommendation/analyzer.js`, `normalization/hierarchy.js`, `session.js` (`twoPhaseConceptSplit` refactor), `study.js`, `index.html`, `main.css`

**Storage**: Cache efímero `state.blockSplitCache` en flujo create (no localStorage v1)

**Testing**: `cursor-tests/20260611_rsvp-block-recommend.mjs`

**Target Platform**: SPA offline-first (Chrome/Firefox desktop)

**Project Type**: Web application — módulo puro `block-count-recommender.js` + refactor pipeline split + UI create RSVP

**Performance Goals**: Recommend → UI update < 60s medium doc (SC-003); recomputar N sin re-index < 100ms; generate con cache evita mensaje "Indexing concepts…"

**Constraints**: Sin LLM para elegir N; sin auto-recommend en upload; RSVP-only; límites 5–60 bloques

**Scale/Scope**: 1 módulo nuevo, refactor 2 exports en session.js, cache helpers, 4 DOM IDs, 6 tareas

**External prerequisites**:
- `20260609-flow-recommendation` (analyzer + pedagogical meta patterns)
- Pipeline RSVP existente (`twoPhaseConceptSplit`, `deepSeekConceptInventory`, `deepSeekPackConceptsToBlocks`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Library-first / pure functions | PASS | `computeBlockCountRecommendation` sin side effects |
| Testability | PASS | Fórmula + fingerprint + invalidación en cursor-tests |
| Simplicity (YAGNI) | PASS | Sin persistencia cross-session; sin Questions v1 |
| Integration tests | PASS | T06 cubre recommend → generate single inventory |
| Token efficiency | PASS | Inventario una vez; pack reutiliza cache |

**Post-design re-check**: PASS — contratos acotan integración sin expandir scope.

## Project Structure

### Documentation (this feature)

```text
specs/20260611-rsvp-block-recommend/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── block-count-recommender-api.md
│   ├── block-split-cache.md
│   ├── recommend-blocks-ui.md
│   └── consumer-integration.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/recommendation/
└── block-count-recommender.js    # computeBlockCountRecommendation (NEW)

src/js/session.js                 # runConceptInventory, packInventoryToBlocks (REFACTOR)
src/js/study.js                   # cache, handlers, invalidation, generate branch
src/js/ui.js                      # els refs for new DOM IDs
index.html                        # recommend button + status + why
src/css/main.css                  # .recommend-blocks-* styles

cursor-tests/
└── 20260611_rsvp-block-recommend.mjs
```

**Structure Decision**: Módulo puro junto a `recommender.js`; refactor mínimo en `session.js` para separar fases; cache y wiring en `study.js` siguiendo patrón `materialGraphContext`.

## Complexity Tracking

> No violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Task Graph (Método Pedro)

```text
T01 ──────────────┐
T02 ──────────────┼──→ T05 ──→ T06
T03 ──────────────┤
T04 ──────────────┘
```

**Paralelizables desde inicio**: T01 + T02 + T03 + T04 (hasta 4 agentes)

**Secuenciales críticos**: T05 → T06

Ver `ROADMAP.md` para prompts listos por tarea.

## Phase 0 & 1 Outputs

- [research.md](./research.md) — R1–R10 resueltos
- [data-model.md](./data-model.md) — entidades y transiciones
- [contracts/](./contracts/) — API recommender, cache, UI, integración
- [quickstart.md](./quickstart.md) — QA manual + tests
