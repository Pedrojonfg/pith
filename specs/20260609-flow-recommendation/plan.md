# Implementation Plan: Flow Recommendation

**Branch**: `20260609-flow-recommendation` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260609-flow-recommendation/spec.md`

## Summary

Capa de orientación pedagógica no bloqueante que, tras normalizar un documento, sugiere un flujo de modos (Slow → Cloze → Revisión, RSVP → Questions, etc.) según métricas determinísticas del texto y metadatos pedagógicos del LLM de `doc-hierarchy-index`. El recommender es 100% determinístico y testeable; la única IA reutiliza la llamada existente de `buildDocumentHierarchy`. El resultado persiste en `session.shared.modeRecommendation` y se muestra una vez en la pantalla de selección de modo.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: Módulos existentes — `normalization/hierarchy.js`, `session-store.js`, `study.js`, `index.html` / `main.css`; sin nuevas librerías

**Storage**: `session.shared.modeRecommendation` dentro de `DocumentSession` (localStorage vía `session-store`)

**Testing**: `cursor-tests/*.mjs` con `node --import ./cursor-tests/register.mjs`

**Target Platform**: SPA offline-first (Chrome/Firefox desktop)

**Project Type**: Web application — capa de dominio pura (`src/js/recommendation/`) + integración UI

**Performance Goals**: `analyzeText` + `computeModeRecommendation` < 50 ms en textos ≤ 100k chars; sin llamadas LLM adicionales

**Constraints**: No wizard bloqueante; usuario puede ignorar recomendación; fallback determinístico si LLM no disponible; panel no reaparece tras override o progreso iniciado

**Scale/Scope**: 3 módulos nuevos, extensión prompt hierarchy, campo shared, panel UI en pantalla create/mode-select, 7 tareas implementables

**External prerequisites**:
- `20260609-unified-session` T01+T04 (`session.shared`, `study.js` DocumentSession)
- `20260609-doc-hierarchy-index` (`buildDocumentHierarchy` operativo)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Library-first / pure functions | PASS | `analyzer`, `recommender`, `tracker` sin side effects |
| Testability | PASS | Tabla de decisión + heurísticas cubiertas por cursor-tests |
| Simplicity (YAGNI) | PASS | Sin ML, sin historial usuario, sin bloqueo de modos |
| Integration tests | PASS | T08 cubre flujo upload → panel → progreso |
| Offline-capable | PASS | Fallback determinístico sin LLM |

**Post-design re-check**: PASS — contratos acotan integración sin expandir scope.

## Project Structure

### Documentation (this feature)

```text
specs/20260609-flow-recommendation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── analyzer-api.md
│   ├── recommender-api.md
│   ├── tracker-api.md
│   ├── hierarchy-pedagogical-meta.md
│   ├── recommendation-ui.md
│   └── consumer-integration.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/recommendation/
├── analyzer.js       # analyzeText → TextMetrics
├── recommender.js    # computeModeRecommendation → ModeRecommendation
└── tracker.js        # updateFlowProgress, markStepCompleted, recordUserOverride

src/js/normalization/hierarchy.js   # pedagogical_meta en prompt + fallback
src/js/session-types.js             # modeRecommendation en SharedLayer
src/js/session-store.js             # updateRecommendation helper
src/js/study.js                     # orquestación + panel mount
index.html / src/css/main.css       # panel UI

cursor-tests/
├── 20260609_flow-recommendation-analyzer.mjs
├── 20260609_flow-recommendation-recommender.mjs
├── 20260609_flow-recommendation-tracker.mjs
└── 20260609_flow-recommendation-integration.mjs
```

**Structure Decision**: Módulos puros en `recommendation/`; integración en puntos existentes del pipeline upload (`study.js`) y persistencia (`session-store`). UI como sección en pantalla de creación/selección de modo, no modal global.

## Complexity Tracking

> No violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Task Graph (Método Pedro)

```text
T01 (analyzer) ──┐
                 ├──→ T03 (recommender) → T04 (tracker) ──┐
T02 (hierarchy) ─┘                                        │
                                                          ├──→ T06 (study.js) → T07 (UI) → T08 (tests)
T05 (session-store) ────────────────────────────────────┘
     ↑ requiere unified-session T01
```

**Paralelizables desde inicio**: T01 + T02 + T05 (si unified-session T01 listo)

**Secuenciales críticos**: T03→T04→T06→T07→T08

Ver `ROADMAP.md` para prompts listos por tarea.
