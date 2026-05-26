# Implementation Plan: Zero-Latency Block Transitions

**Branch**: `20260527-zero-latency-blocks` | **Date**: 2026-05-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260527-zero-latency-blocks/spec.md`

## Summary

Eliminar la latencia percibida entre bloques aprovechando **prefetch de N+1** durante el estudio del bloque N y una **pantalla de transición bifurcada**: camino rápido (**Siguiente bloque**, CTA deshabilitado hasta `ready`) vs **Ajustar siguiente bloque** (controles de preguntas + regen). Regen parcial v1: conservar `explanation` del prefetch y regenerar solo `questions` vía prompt API dedicado. Dudas solo en sidebar; sin tarjeta inline al terminar RSVP.

## Technical Context

**Language/Version**: JavaScript (ES modules), browser vanilla  
**Primary Dependencies**: `deepSeekGenerateBlockJson`, `generateBlockForIndex`, `triggerPrefetch` / `getPrefetchedBlock` (`session.js`), overlay `transitionOverlay` (`study.js`), `guide-chat.js`  
**Storage**: `prefetchState` en memoria; `localStorage` sesión activa sin cambio de schema  
**Testing**: `cursor-tests/` (prefetch + regen parcial); manual [quickstart.md](./quickstart.md)  
**Target Platform**: Desktop + móvil (misma SPA)  
**Project Type**: Single-page study app (`index.html` + `src/js/*`)  
**Performance Goals**: SC-001 — ≥90% transiciones con prefetch `ready` antes de fin de bloque; &lt;1s hasta primer flash RSVP tras clic en camino rápido  
**Constraints**: Sin backend; sin frameworks; portable a Flutter; no tocar `rsvp.js` salvo quitar tarjeta guía en `finishRSVP`  
**Scale/Scope**: ~400–600 LOC netas en `study.js`, `api.js`, `session.js`; limpieza HTML muerto opcional

## Constitution Check

*GATE: Project uses `.cursorrules` (constitution template not ratified).*

| Principle (.cursorrules) | Status | Notes |
|--------------------------|--------|-------|
| Simplicity / surgical | PASS | Reutilizar prefetch existente; UX overlay refactor |
| No backend | PASS | |
| No frameworks | PASS | |
| Flutter portability | PASS | Lógica en `session.js` / prompts en `api.js` |
| RSVP critical path | PASS | Sin cambios de timing en `rsvp.js` |
| Single-file preference | PASS | Módulos ya partidos |

**Post-design re-check**: PASS

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
│   └── questions-only-regen.md
└── tasks.md             # /speckit-tasks (next)
```

### Source Code (repository root)

```text
src/js/api.js            # buildQuestionsOnly* + deepSeekRegenerateBlockQuestions
src/js/session.js        # generateQuestionsOnlyForIndex; prefetch helpers
src/js/study.js          # transitionOverlay UX, finishQuestions, finishRSVP
src/js/guide-chat.js     # sin pendingComment desde transición
src/js/ui.js             # prefetch dot (existente)
index.html               # opcional: retirar #screenBetweenBlocks muerto
cursor-tests/            # 20260527_t*.mjs
```

**Structure Decision**: La transición canónica es el overlay dinámico en `study.js`; `betweenBlocks` en HTML queda fuera de alcance salvo limpieza P3.

## Phase 0: Research

Complete — [research.md](./research.md).

## Phase 1: Design & Contracts

Complete:

- [data-model.md](./data-model.md)
- [contracts/transition-overlay-ux.md](./contracts/transition-overlay-ux.md)
- [contracts/questions-only-regen.md](./contracts/questions-only-regen.md)
- [quickstart.md](./quickstart.md)

**Agent context**: `.cursor/rules/specify-rules.mdc` → this plan.

## Phase 2: Implementation Outline (for /speckit-tasks & ROADMAP)

| ID | Work package | Acceptance |
|----|--------------|------------|
| WP1 | API regen solo preguntas | Contrato `questions-only-regen.md`; parse estable |
| WP2 | `session.js`: `generateQuestionsOnlyForIndex` + merge en bloque | Conserva `explanation`; actualiza `questions` + `concepts` si vienen |
| WP3 | Overlay transición: vista default vs Adjust | FR-002, FR-002b, FR-003a; sin textarea |
| WP4 | Camino rápido: CTA deshabilitado + consumo prefetch | SC-001, SC-003 |
| WP5 | Camino Adjust: regen parcial vs completa | FR-007, FR-008 |
| WP6 | Quitar tarjeta guía inline (`finishRSVP`) | FR-005a |
| WP7 | Tests automatizados + quickstart manual | SC-004 |

**Execution order**: WP1 → WP2 → (WP3 ∥ WP4) → WP5 → WP6 → WP7.

**Risks**: Regen parcial incoherente con explicación — mitigar con prompt que incluye `explanation` fija en user message; fallback a regen completa.

## Complexity Tracking

| Item | Why Needed | Simpler Alternative Rejected |
|------|------------|-------------------------------|
| Prompt API questions-only | FR-007 sin regen RSVP | Regen bloque completa desperdicia tokens y tiempo |
| Dos vistas en overlay | 99% camino rápido vs 1% adjust | Pantalla única actual mezcla todo y confunde |

## Next command

Ejecutar prompts en `ROADMAP.md` (T01→T07) o `/speckit-tasks`.
