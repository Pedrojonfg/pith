# Implementation Plan: RSVP Reading UX

**Branch**: `20260526-rsvp-reading-ux` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260526-rsvp-reading-ux/spec.md`

## Summary

Corregir dos defectos del lector RSVP reportados en uso real:

1. **Punto focal (ORP)**: hoy se calcula sobre el chunk completo multi-palabra → la letra roja queda desplazada respecto al centro del cuadro. **Solución**: ORP solo en la palabra ancla (central) + `translateX` para alinear el glifo al 50% del contenedor.

2. **Tipografía variable**: `calcRSVPFontSize` corre en cada flash → el tamaño cambia dentro del mismo bloque. **Solución**: `RsvpTypographyProfile` con `fontSizePx` fijo por sesión/WPF/resize, calculado con cadena probe de peor caso.

## Technical Context

**Language/Version**: JavaScript (ES modules), browser vanilla  
**Primary Dependencies**: DOM APIs (`ResizeObserver`, `getBoundingClientRect`); MathJax sin cambios de API  
**Storage**: `localStorage` existente (`rsvp_container_size`, WPM/WPF defaults) — sin nuevas claves v1  
**Testing**: Manual [quickstart.md](./quickstart.md); regresión `tests/rsvp-latex.html` si aplica  
**Target Platform**: Desktop + móvil (cuadro 90vw)  
**Project Type**: Single-page study app  
**Performance Goals**: RSVP ≥500 WPM sin jank; layout ORP < 5ms/flash  
**Constraints**: Solo `rsvp.js` + `main.css`; RSVP es critical path — cambios quirúrgicos  
**Scale/Scope**: ~120–180 LOC netas en `rsvp.js`

## Constitution Check

*GATE: Project uses `.cursorrules` (constitution template not ratified).*

| Principle (.cursorrules) | Status | Notes |
|--------------------------|--------|-------|
| RSVP critical path | PASS | Mejora directa del componente crítico |
| No frameworks | PASS | DOM + CSS transform |
| Simplicity / surgical | PASS | Sin nuevos módulos ni settings UI |
| No backend | PASS | |
| Flutter portability | PASS | Sin cambios al session JSON exportado |
| Mobile-aware | PASS | Resize móvil recalcula perfil una vez |

**Post-design re-check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260526-rsvp-reading-ux/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── rsvp-typography.md
│   └── rsvp-orp-centering.md
└── tasks.md             # /speckit-tasks (next)
```

### Source Code (repository root)

```text
src/js/rsvp.js           # Profile, render multi-word, centerOrp, remove per-chunk sizing
src/css/main.css         # .rsvp-word, transform baseline
tests/rsvp-latex.html    # Optional: note in quickstart only
```

**Structure Decision**: Un solo módulo de dominio (`rsvp.js`); `study.js` sin cambios de API pública.

## Phase 0: Research

Complete — [research.md](./research.md). Root causes documented with code references:

- `renderRSVPWord` + `getORP(raw)` on full chunk string (`src/js/rsvp.js` ~232–269)
- `applyRsvpFontSizingForChunk` → `calcRSVPFontSize` per flash (~65–131, ~436–443)

## Phase 1: Design & Contracts

Complete:

- [data-model.md](./data-model.md)
- [contracts/rsvp-typography.md](./contracts/rsvp-typography.md)
- [contracts/rsvp-orp-centering.md](./contracts/rsvp-orp-centering.md)
- [quickstart.md](./quickstart.md)

**Agent context**: `.cursor/rules/specify-rules.mdc` updated to reference this plan.

## Phase 2: Implementation Outline (for /speckit-tasks)

| ID | Work package | Acceptance |
|----|--------------|------------|
| WP1 | `computeRsvpTypographyProfile` + module `typographyProfile` | Probe-based single calc; remove wordCount from binary search |
| WP2 | Wire profile: `startRsvpForText`, `setWordsPerFlash`, `ResizeObserver` | No `applyRsvpFontSizingForChunk` on `showChunkByIndex` |
| WP3 | `renderRsvpTextChunk` multi-word + anchor ORP | Replaces `renderRSVPWord` for multi-token content |
| WP4 | `centerOrpInContainer` after append | SC-002 ≤4px error |
| WP5 | Math path: fixed `fontSizePx * 0.85` | No ORP; no MathJax callback resizing per chunk |
| WP6 | CSS + quickstart validation | quickstart.md all pass |

**Execution order**: WP1 → WP2 → WP3 → WP4 → WP5 → WP6.

**Risk**: `requestAnimationFrame` doble frame antes de medir ORP si hay fuentes web loading — mitigar con medición post-append sync (ya en overlay).

## Complexity Tracking

No violations requiring justification.

## Next command

`/speckit-tasks` — generar `tasks.md`, o implementar WP1–WP6 directamente.
