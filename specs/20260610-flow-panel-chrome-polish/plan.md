# Implementation Plan: Flow Panel & Study Chrome Polish

**Branch**: `20260610-flow-panel-chrome-polish` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260610-flow-panel-chrome-polish/spec.md`

## Summary

Corregir la visibilidad de los FABs flotantes (libro rojo = releer bloque en RSVP+preguntas; menú azul = guía solo en Cloze/Questions durante preguntas y diccionario) y restaurar el panel de recomendación de flujo con diseño pulido: exclusividad CTA/panel, desplegable legible en tema oscuro, «Why this flow?» funcional, y progreso como stepper único. Sin cambios al backend `recommendation/*`; integración en `ui.js`, `study.js`, `index.html`, `main.css`.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: `ui.js` (`syncFloatingChrome`), `study.js` (orquestación), `dictionary.js`, módulos `recommendation/*` y `session-store` existentes

**Storage**: Sin cambios de esquema; lee `session.shared.modeRecommendation`

**Testing**: `cursor-tests/*.mjs` — regresión chrome + panel + exclusividad

**Target Platform**: SPA offline-first, tema oscuro desktop

**Project Type**: Web application — capa UI + reglas de visibilidad

**Performance Goals**: `syncFloatingChrome` sin reflow extra; render panel O(n) en pasos del flujo (n ≤ 5)

**Constraints**: No nuevas llamadas LLM; copy UI en inglés; accesibilidad teclado en popover «Why»; contraste ≥ 4.5:1

**Scale/Scope**: ~6 tareas, 4 archivos fuente principales, 2 contratos UI, 1 test suite

**External prerequisites**: `20260609-flow-recommendation` T01–T08 completos (backend + integración study.js)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Simplicity (YAGNI) | PASS | Solo reglas de visibilidad + remount panel; sin nuevo estado global |
| Testability | PASS | Matriz pantalla×modo cubierta por cursor-tests |
| Pure functions where possible | PASS | `resolveFlowPanelViewState`, `resolveChromeVisibility` testeables |
| Integration tests | PASS | T06 cierra quickstart + regresión FAB |
| Offline-capable | PASS | Respeta `isOfflineMode()` existente |

**Post-design re-check**: PASS — contratos acotan DOM IDs y reglas sin expandir scope.

## Project Structure

### Documentation (this feature)

```text
specs/20260610-flow-panel-chrome-polish/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── chrome-visibility.md
│   └── flow-panel-ui.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/ui.js              # syncFloatingChrome, SCREENS_WITH_GUIDE_TOGGLE
src/js/study.js           # renderFlowPanel, wireFlowRecommendUpload, view state
src/js/dictionary.js      # alinear visibilidad diccionario con chrome (si aplica)
index.html                # CTA + #recommendationPanel markup
src/css/main.css          # .flow-panel, .flow-progress-stepper, select dark theme

cursor-tests/
└── 20260610_flow-panel-chrome-polish.mjs
```

**Structure Decision**: Reglas de chrome centralizadas en `ui.js`; panel en `study.js` siguiendo patrón previo de `20260609-flow-recommendation/contracts/recommendation-ui.md` pero rediseñado.

## Complexity Tracking

> No violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Task Graph (Método Pedro)

```text
T01 (chrome rules) ────────┐
T02 (CTA/panel exclusivity) ┼──→ T04 (panel wiring) ──→ T06 (tests + QA)
T03 (panel markup + CSS) ──┘
T05 (chrome tests) ← T01
```

**Paralelizables desde inicio**: T01 + T02 + T03

**Secuenciales críticos**: T04 → T06; T05 tras T01

Ver `ROADMAP.md` para prompts listos por tarea.
