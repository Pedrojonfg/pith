# Implementation Plan: Slow Mode — Lectura Profunda

**Branch**: `20260528-slow-mode` | **Date**: 2026-06-06 | **Spec**: `specs/20260528-slow-mode/spec.md`

**Input**: Feature specification from `specs/20260528-slow-mode/spec.md` + diseño `slow_mode_spec.md`

## Summary

Añadir **Slow Mode** como pipeline alternativo a RSVP: selector sin preselección en pantalla de inicio, persistencia `sessionsByMode`, lectura paginada por viewport con anotaciones ancladas por offset de caracteres, Fases 0–3 con IA híbrida (scope usuario + umbral 60k), Modo Crítico, checkpoints dismissable, consolidación con grafo/flashcards y gamificación (depth score, hallazgos).

## Technical Context

**Language/Version**: JavaScript ES modules (browser, sin build step)

**Primary Dependencies**: APIs nativas (`localStorage`, `DOMParser`, `Range`, `fetch`), DeepSeek/Gemini vía `llm.js`, `input-normalization.js`, módulos existentes `session.js`, `dictionary.js`, `export.js`

**Storage**: `localStorage` — nuevo `sessions_by_mode`; migración desde `active_session`; sub-objeto `slow` por slot

**Testing**: `cursor-tests/20260528_t*.mjs` + validación manual (`quickstart.md`)

**Target Platform**: PWA estática — navegadores modernos desktop/mobile

**Project Type**: Web app frontend-only (vanilla JS)

**Performance Goals**:
- Reanudar sesión Slow &lt;2s (SC-004)
- Recompute paginación tipografía debounced ≤300ms percibidos
- Fase 0 map-reduce: feedback de progreso por subsección

**Constraints**:
- Sin backend; sin frameworks UI
- Reutilizar normalización RSVP (`html_min` / markdown)
- Spec completa v1 (Opción C clarify)
- Cambios quirúrgicos en RSVP — cero regresiones

**Scale/Scope**:
- Textos hasta cientos de miles de caracteres (map-reduce Fase 0)
- 12+ tipos de anotación; 4 fases + gamificación
- ~10 archivos nuevos en `src/js/slow/`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- `constitution.md` en plantilla — sin gates ejecutables adicionales.
- Gate pre-research: **PASS**
- Gate post-design: **PASS** — módulos `slow/` mantienen separación sin over-engineering de backend.

## Project Structure

### Documentation (this feature)

```text
specs/20260528-slow-mode/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── mode-selector-sessions.md
│   ├── slow-pagination-viewport.md
│   ├── annotation-char-offsets.md
│   ├── phase0-orientation-ia.md
│   ├── phase1-reader-ia.md
│   ├── phase2-checkpoints.md
│   └── phase3-consolidation.md
└── tasks.md                    # /speckit-tasks
```

### Source Code (repository root)

```text
index.html                      # mode selector, screens Slow
src/css/slow-mode.css           # reader, phase0, phase3
src/js/
├── config.js                   # LS_SESSIONS_BY_MODE_KEY
├── session.js                  # sessionsByMode load/store/migrate
├── study.js                    # routing studyMode
├── main.js                     # bootstrap mode-aware
├── export.js                   # slow export section
└── slow/
    ├── headings.js
    ├── pagination.js
    ├── phase0.js
    ├── reader.js
    ├── annotations.js
    ├── ai-context.js
    ├── checkpoints.js
    ├── phase3.js
    └── gamification.js

cursor-tests/
└── 20260528_t*.mjs
```

**Structure Decision**: Subcarpeta `src/js/slow/` para todo el pipeline Slow; RSVP permanece en archivos actuales; contratos definen fronteras entre módulos.

## Phase 0 — Research Output

`research.md` cierra:
- `sessionsByMode` + migración
- paginación viewport + cache
- Fase 0 híbrida scope/60k
- fallo Fase 0 → skip con orientación manual
- anti-spoiler `maxReadCharEnd`
- estructura de módulos

Sin `NEEDS CLARIFICATION` pendientes.

## Phase 1 — Design & Contracts Output

- `data-model.md` — entidades, transiciones, invariants
- `contracts/` — 7 contratos UI/IA/persistencia
- `quickstart.md` — verificación manual SC-001..SC-008
- `.cursor/rules/specify-rules.mdc` — apunta a este plan

## Ejecución (Método Pedro)

Ver **`ROADMAP.md`** en raíz para tabla de tareas, grafo, prompts autocontenidos y orden de ejecución paralela.

### Descomposición resumida

| ID | Tarea | Dep. | Complejidad |
|----|-------|------|-------------|
| T01 | `sessionsByMode` + migración + config | — | S |
| T02 | Selector de modo + resume/nueva sesión | T01 | M |
| T03 | Screens Slow + routing `studyMode` | T02 | M |
| T04 | Headings + scope picker | T03 | M |
| T05 | Motor paginación viewport + tests | T04 | L |
| T06 | Fase 0 IA (single + map-reduce) | T04 | L |
| T07 | Reader UI + tipografía + focus | T05, T06 | L |
| T08 | Sistema anotaciones (offsets) | T07 | M |
| T09 | IA Fase 1 anti-spoiler | T08 | M |
| T10 | Modo Crítico + menú tipos | T08 | S |
| T11 | Checkpoints Fase 2 | T08, T06 | M |
| T12 | Fase 3 consolidación | T08, T06 | L |
| T13 | Grafo + gamificación + flashcards | T12 | L |
| T14 | Export sesión Slow | T12 | M |
| T15 | QA quickstart + cursor-tests | T09–T14 | M |

### Grafo de dependencias

```text
T01 → T02 → T03 → T04 ─┬→ T05 → T07 → T08 ─┬→ T09 ─┐
                        │                     ├→ T10 ─┤
                        └→ T06 ───────────────┘   T11 ─┤
                                        T08 + T06 → T12 ─┬→ T13 ─┐
                                                         └→ T14 ─┴→ T15
```

**Paralelo tras T08**: T09, T10, T11 (tres chats).  
**Paralelo tras T12**: T13, T14 (dos chats).

### Orden recomendado

1. **Secuencial crítico**: T01 → T02 → T03 → T04 → T05 + T06 (paralelo) → T07 → T08.
2. **Paralelo**: T09 + T10 + T11.
3. **Secuencial**: T12 → T13 ‖ T14 → T15.

## Complexity Tracking

| Área | Justificación |
|------|---------------|
| Spec completa v1 | Decisión explícita usuario (clarify Opción C); implementación interna por capas en ROADMAP |
| Motor paginación custom | Requisito científico/UX (no scroll); sin librería equivalente en proyecto |
| Map-reduce Fase 0 | Textos filosóficos largos; umbral 60k del clarify |

No violaciones de constitution; complejidad acotada a módulos `slow/`.
