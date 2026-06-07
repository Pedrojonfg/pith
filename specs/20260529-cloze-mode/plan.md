# Implementation Plan: Cloze Detection — Recuperación Activa sobre Grafo

**Branch**: `20260529-cloze-mode` | **Date**: 2026-06-07 | **Spec**: `specs/20260529-cloze-mode/spec.md`

**Input**: Feature specification + `cloze_mode_spec.md` + clarificaciones Session 2026-06-07

## Summary

Añadir **Cloze Detection** como tercer modo de estudio: selector sin preselección, slot `sessionsByMode.cloze`, upload reutilizado, pipeline IA en 5 fases (botón explícito "Generar ítems"), grafo epistémico aislado por sesión, distractores L1+L3, sesión MC mínima sin SR, visualización de grafo vía `buildSessionGraph({ mode: 'cloze' })`.

## Technical Context

**Language/Version**: JavaScript ES modules (browser, sin build step)

**Primary Dependencies**: `input-normalization.js`, `llm.js`, `session.js`, `study.js`, `review.js`, `shuffle-options.js`, `graph/build.js`, `graph/view.js`, `markdown.js`

**Storage**: `localStorage` — extender `sessions_by_mode` con slot `cloze`; sub-objeto `cloze` por sesión

**Testing**: `cursor-tests/20260529_t*.mjs` + validación manual (`quickstart.md`)

**Target Platform**: PWA estática — navegadores modernos

**Project Type**: Web app frontend-only (vanilla JS)

**Performance Goals**:
- Reanudar sesión MC &lt;2s (SC-005)
- Pipeline ~12k chars: 30–90s total IA (5 fases)
- Progreso UI por fase sin bloquear main thread

**Constraints**:
- Sin backend; sin frameworks UI
- Reutilizar upload, normalización, visor de grafo, patrones MC
- Grafo epistémico **no** compartido con RSVP/Slow
- SR y vault L2 fuera de alcance v1
- Cambios quirúrgicos — cero regresiones RSVP/Slow

**Scale/Scope**:
- 60–120 ítems `valid` por documento típico
- 7 tipos de ítem (4 NODE + 3 EDGE)
- ~6 archivos nuevos en `src/js/cloze/`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- `constitution.md` en plantilla — sin gates ejecutables adicionales.
- Gate pre-research: **PASS**
- Gate post-design: **PASS** — módulos `cloze/` separados; reutilización modo-agnóstica sin over-engineering.

## Project Structure

### Documentation (this feature)

```text
specs/20260529-cloze-mode/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── mode-selector-cloze.md
│   ├── cloze-pipeline.md
│   ├── cloze-study-session.md
│   └── cloze-graph-view.md
└── tasks.md                    # /speckit-tasks
```

### Source Code (repository root)

```text
index.html                      # 3er modo, screenClozeStudy, generate button
src/css/cloze-mode.css          # estilos mínimos
src/js/
├── config.js                   # constantes cloze si aplica
├── session.js                  # cloze slot, normalizeStudyMode
├── study.js                    # routing studyMode === 'cloze'
├── graph/build.js              # buildClozeEpistemicGraph, mode 'cloze'
└── cloze/
    ├── pipeline.js             # fases 0–4 LLM
    ├── study.js                # sesión MC
    └── normalize.js            # validación ClozeItem

cursor-tests/
└── 20260529_t*.mjs
```

**Structure Decision**: Subcarpeta `src/js/cloze/` para pipeline y estudio; extensión puntual de `session.js`, `study.js`, `graph/build.js`.

## Phase 0 — Research Output

`research.md` cierra: slot cloze, grafo aislado, botón generar, 5 fases IA, L1+L3, MC sin SR, fallos por fase.

Sin `NEEDS CLARIFICATION` pendientes.

## Phase 1 — Design & Contracts Output

- `data-model.md` — ClozeSessionData, EpistemicGraph, ClozeItem, transiciones
- `contracts/` — 4 contratos (selector, pipeline, estudio MC, grafo)
- `quickstart.md` — verificación SC-001..SC-007
- `.cursor/rules/specify-rules.mdc` — apunta a este plan

## Ejecución (Método Pedro)

Ver **`ROADMAP.md`** en raíz para tabla de tareas, grafo, prompts autocontenidos y orden de ejecución paralela.

### Descomposición resumida

| ID | Tarea | Dep. | Complejidad |
|----|-------|------|-------------|
| T01 | `sessionsByMode.cloze` + `normalizeStudyMode` | — | S |
| T02 | Selector 3 modos + hints UI | T01 | S |
| T03 | Routing `study.js` + resume/nueva cloze | T02 | M |
| T04 | `createClozeSession` + upload sin IA auto | T03 | M |
| T05 | `buildClozeEpistemicGraph` + mode `cloze` | T01 | M |
| T06 | `pipeline.js` Fase 0 (grafo epistémico) | T04 | L |
| T07 | Pipeline Fases 1–2 (análisis + ítems base) | T06 | L |
| T08 | Pipeline Fases 3–4 (distractores + QA) | T07 | L |
| T09 | UI "Generar ítems" + progreso por fase | T08 | M |
| T10 | Sesión MC (`cloze/study.js`) | T09 | L |
| T11 | Botón Ver grafo + `cloze-mode.css` | T05, T09 | S |
| T12 | cursor-tests + quickstart QA | T10, T11 | M |

### Grafo de dependencias

```text
T01 ─┬→ T02 → T03 → T04 → T06 → T07 → T08 → T09 ─┬→ T10 → T12
     │                                              └→ T11 ↗
     └→ T05 ────────────────────────────────────────────────┘
```

**Paralelo desde T01**: T02 y T05.  
**Paralelo desde T09**: T10 y T11.

## Deferred v2

- Motor SR (`next_review`, scheduling)
- Pool distractores L2 (vault global)
- Caché cross-modo de grafo epistémico
- Explicaciones post-respuesta generadas por IA
