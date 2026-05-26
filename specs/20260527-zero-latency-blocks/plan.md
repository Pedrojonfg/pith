# Implementation Plan: Zero-Latency Block Transitions

**Branch**: `20260527-zero-latency-blocks` | **Date**: 2026-05-27 (rev. 2026-05-26) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260527-zero-latency-blocks/spec.md`

## Summary

Eliminar la latencia entre bloques con **prefetch de N+1**, transición bifurcada (**Siguiente bloque** / **Ajustar siguiente bloque**), regen parcial de preguntas, y dudas solo en sidebar.

**Ampliación (clarificación 2026-05-26)**: El prefetch debe alimentar en paralelo el **diccionario de conceptos** y el **export `.md`**: write-through a `session.blocks` en `ready`, fusión de `concepts` al diccionario, export con unión de fuentes (SC-005, SC-006).

## Technical Context

**Language/Version**: JavaScript (ES modules), browser vanilla  
**Primary Dependencies**: `triggerPrefetch` / `getPrefetchedBlock` (`session.js`), `dictionary.js`, `export.js` (`buildMarkdown`), overlay `transitionOverlay` (`study.js`), `deepSeekRegenerateBlockQuestions` (`api.js`)  
**Storage**: `prefetchState` (memoria); `localStorage` — `active_session`, `session_concepts`, **`session_concepts_by_block`** (nuevo)  
**Testing**: `cursor-tests/20260527_t*.mjs` + nuevos tests T08–T12; manual [quickstart.md](./quickstart.md) §7–8  
**Target Platform**: Desktop + móvil (misma SPA)  
**Project Type**: Single-page study app (`index.html` + `src/js/*`)  
**Performance Goals**: SC-001, SC-005/006; write-through síncrono &lt;50ms (localStorage)  
**Constraints**: Sin backend; sin frameworks; portable a Flutter; no tocar timing de `rsvp.js`  
**Scale/Scope**: ~150–250 LOC netas fase diccionario/export (T08–T12) sobre base T01–T07 ya implementada

## Constitution Check

*GATE: Project uses `.cursorrules` (constitution template not ratified).*

| Principle (.cursorrules) | Status | Notes |
|--------------------------|--------|-------|
| Simplicity / surgical | PASS | Hook único `applyPrefetchReadySideEffects`; sin refactor global |
| No backend | PASS | |
| No frameworks | PASS | |
| Flutter portability | PASS | Lógica en `session.js`, `dictionary.js`, `export.js` |
| RSVP critical path | PASS | Sin cambios en `rsvp.js` |
| Single-file preference | PASS | Módulos existentes |

**Post-design re-check (2026-05-26)**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260527-zero-latency-blocks/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── transition-overlay-ux.md
│   ├── questions-only-regen.md
│   ├── prefetch-ready-persistence.md    # NEW
│   └── export-concept-dictionary.md     # NEW
└── tasks.md             # /speckit-tasks (optional)
```

### Source Code (repository root)

```text
src/js/session.js        # applyPrefetchReadySideEffects; triggerPrefetch hook
src/js/dictionary.js     # concepts_by_block; replaceBlockConcepts; aggregate
src/js/export.js         # collectExportConcepts; buildMarkdown union
src/js/study.js          # onPrefetchReady → refresh dictionary UI
src/js/config.js         # LS_SESSION_CONCEPTS_BY_BLOCK_KEY (si aplica)
cursor-tests/            # 20260527_t03-*.mjs (prefetch write-through + export)
```

## Phase 0: Research

Complete — [research.md](./research.md) (R1–R11).

## Phase 1: Design & Contracts

Complete:

- [data-model.md](./data-model.md)
- [contracts/transition-overlay-ux.md](./contracts/transition-overlay-ux.md)
- [contracts/questions-only-regen.md](./contracts/questions-only-regen.md)
- [contracts/prefetch-ready-persistence.md](./contracts/prefetch-ready-persistence.md)
- [contracts/export-concept-dictionary.md](./contracts/export-concept-dictionary.md)
- [quickstart.md](./quickstart.md)

**Agent context**: `.cursor/rules/specify-rules.mdc` → this plan.

## Phase 2: Implementation Outline (metodo-pedro → ROADMAP.md)

### Fase A — Completada (T01–T07)

| ID | Work package | Status |
|----|--------------|--------|
| WP1–WP7 | Prefetch UX, regen parcial, sidebar, tests base | Done |

### Fase B — Diccionario + export en paralelo (T08–T12)

| ID | Work package | Acceptance |
|----|--------------|------------|
| WP8 | `applyPrefetchReadySideEffects` en `session.js` | FR-010; write-through + `concepts_by_block[idx]`; slot prefetch sigue `ready` |
| WP9 | `dictionary.js`: agregado + `replaceBlockConcepts` | FR-009, FR-012; UI lee merge; idempotente con `commitSessionConceptsForBlock` |
| WP10 | `export.js`: `collectExportConcepts` + `buildMarkdown` | FR-011, FR-011a; SC-006 en export mid-session |
| WP11 | `study.js`: `onPrefetchReady` refresh UI | FR-009; botón diccionario + overlay transición |
| WP12 | Tests + quickstart §7–8 | SC-005, SC-006 automatizado o documentado |

**Execution order (Fase B)**:

```text
T08 → T09 ∥ T10 → T11 → T12
```

**Risks**: Cuota `localStorage` en sesiones largas — capturar try/catch sin romper prefetch `ready`.

## Complexity Tracking

| Item | Why Needed | Simpler Alternative Rejected |
|------|------------|-------------------------------|
| `session_concepts_by_block` | FR-012 replace por índice | Vaciar diccionario global en regen |
| Write-through en `ready` | Export + ensureBlockGenerated sin doble API | Solo memoria hasta transición |
| Union en export | FR-011 rutas legacy + nuevas | Solo `session_concepts` (pierde bloques no commiteados) |

## Next command

Ejecutar **T08** desde `ROADMAP.md` (Fase B). Opcional: `/speckit-tasks` para `tasks.md` formal.
