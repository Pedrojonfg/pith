# Implementation Plan: Mode Continuity

**Branch**: `20260612-mode-continuity` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260612-mode-continuity/spec.md`

## Summary

Eliminar silos entre modos conectando **recomendación de flujo**, **DocumentSession.shared** y **entrada a cada modo**. Tras subir material para recomendación, elegir un modo debe **bootstrap** desde `shared.rawMarkdown` sin segundo upload. Transiciones RSVP→Cloze reutilizan **inventario** y **jerarquía**; fallos de evaluación se persisten en **`assessmentSignals`** y priorizan ítems Cloze. Orquestación central en `mode-bootstrap.js` + wiring en `study.js`.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: `session-store.js`, `study.js`, `recommendation/tracker.js`, `cloze/pipeline.js`, `session.js` (create*Session), `index.html`, `ui.js`

**Storage**: `localStorage` DocumentSession V2 — nuevos campos opcionales en `shared`

**Testing**: `cursor-tests/20260612_mode-continuity.mjs`

**Target Platform**: SPA offline-first (Chrome/Firefox desktop)

**Project Type**: Web application — 2 módulos puros nuevos + wiring orquestador

**Performance Goals**: Bootstrap resolve < 50ms; sin LLM extra en entry; transición RSVP→Cloze evita re-inventario (SC-002)

**Constraints**: Sin auto-generate LLM al entrar modo; sin merge de grafos; backward-compatible schema

**Scale/Scope**: 8 tareas (T01–T08), ~6 archivos fuente tocados

**External prerequisites** (ya implementados en repo):
- `20260609-unified-session` — DocumentSession, `addConceptsToShared`
- `20260609-flow-recommendation` — panel, `updateFlowProgress`
- `20260611-rsvp-block-recommend` — `blockSplitCache` (acelera bootstrap RSVP)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Library-first / pure functions | PASS | `mode-bootstrap` resolve + `assessment-signals` pure |
| Testability | PASS | T01/T03/T06 unit + T08 integration |
| Simplicity (YAGNI) | PASS | Order-only Cloze prioritization v1; no new LLM calls |
| Integration tests | PASS | T08 cross-mode handoff smoke |
| Backward compatibility | PASS | Optional shared fields |

**Post-design re-check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260612-mode-continuity/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── mode-bootstrap-api.md
│   ├── assessment-signals-api.md
│   ├── consumer-integration.md
│   └── bootstrap-create-ui.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/
├── mode-bootstrap.js           # NEW — resolveModeEntryState, buildModeSliceFromShared
├── assessment-signals.js       # NEW — extract, merge, prioritize
├── session-store.js            # uploadMeta, assessmentSignals helpers
├── session-types.js            # validate optional fields
├── study.js                    # enterModeWithContinuity, recommend wiring, sync hooks
├── cloze/pipeline.js           # gap-aware hints (optional) + study order
└── cloze/study.js              # apply studyOrder from prioritize

index.html                      # modeMaterialLoadedBanner
src/js/ui.js                    # els ref

cursor-tests/
└── 20260612_mode-continuity.mjs
```

**Structure Decision**: Módulos puros junto a `recommendation/`; orquestación en `study.js` siguiendo patrón flow-recommendation consumer.

## Complexity Tracking

> No violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Task Graph (Método Pedro)

```text
T01 ──────────────┐
T02 ──────────────┼──→ T04 ──→ T07 ──→ T08
T03 ──────────────┘      ↗
T05 ─────────────────────┘
T06 ─────────────────────┘ (tras T02; paralelo con T04/T05 tras T02)
```

**Paralelizables desde inicio**: T01 + T02 + T03

**Paralelizables tras T02**: T05 + T06 (mientras T04 avanza si T03 listo)

**Secuenciales críticos**: T04 → T07 → T08

Ver `ROADMAP.md` para prompts listos por tarea.

## Phase 0 & 1 Outputs

- [research.md](./research.md) — R1–R10 resueltos
- [data-model.md](./data-model.md) — SharedLayer extensions, transitions
- [contracts/](./contracts/) — bootstrap API, assessment signals, consumer, UI
- [quickstart.md](./quickstart.md) — QA manual + tests
