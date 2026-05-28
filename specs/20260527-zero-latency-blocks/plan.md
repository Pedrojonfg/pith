# Implementation Plan: Zero-Latency Block Transitions (Background Prefetch)

**Branch**: `20260527-zero-latency-blocks` | **Date**: 2026-05-27 | **Spec**: `specs/20260527-zero-latency-blocks/spec.md`

**Input**: Feature specification from `specs/20260527-zero-latency-blocks/spec.md`

## Summary

Eliminar la espera percibida entre bloques con prefetch N+1, transición bifurcada (rápida vs ajustar), diccionario/export en paralelo al `ready`, y añadir normalización de material de estudio orientada a tokens: `html -> html ultrarreducido`, `pdf/txt/md -> markdown`, rechazando formatos fuera de la lista v1.

## Technical Context

**Language/Version**: JavaScript ES modules (browser, sin build step)

**Primary Dependencies**: APIs nativas del navegador (`fetch`, `localStorage`, `FileReader`, `DOMParser`), DeepSeek chat API, utilidades internas en `src/js/*.js`

**Storage**: `localStorage` (`activeSession`, `session_concepts`, `session_concepts_by_block`)

**Testing**: pruebas de integración ligeras con `cursor-tests/*.mjs` + validación manual en navegador

**Target Platform**: Navegadores modernos desktop/mobile (app estática)

**Project Type**: Web app frontend-only (single-page, vanilla JS)

**Performance Goals**:
- Transición rápida a bloque siguiente <1s percibido cuando `prefetch.ready`
- 0 llamadas duplicadas de generación completa en fast path (`SC-003`)
- Conversión de entrada sin inflar tokens (HTML sanitizado mínimo, resto en markdown)

**Constraints**:
- Sin backend y sin dependencias pesadas innecesarias
- Sin introducir CSS/JS en el contenido normalizado
- Formatos v1 estrictos: `pdf`, `html`, `txt`, `md`
- Cambios quirúrgicos sobre flujo existente

**Scale/Scope**:
- Sesiones locales de estudio con decenas de bloques (sin multiusuario)
- Prefetch de un bloque por adelantado (N+1) en v1

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- `constitution.md` está en plantilla (sin reglas ejecutables concretas), por lo que no define gates verificables.
- No se detectan violaciones explícitas contra principios obligatorios del repositorio.
- Gate status pre-research: **PASS (sin restricciones adicionales declaradas)**.
- Gate status post-design: **PASS**.

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
│   ├── prefetch-ready-persistence.md
│   ├── questions-only-regen.md
│   ├── export-concept-dictionary.md
│   ├── block-sneak-peek.md
│   └── input-normalization.md
└── tasks.md
```

### Source Code (repository root)

```text
index.html
src/
└── js/
    ├── study.js
    ├── api.js
    ├── export.js
    ├── dictionary.js
    ├── session.js
    ├── ui.js
    └── markdown.js

cursor-tests/
└── 20260527_t*.mjs
```

**Structure Decision**: Mantener arquitectura actual frontend-only y documentar contratos por flujo para que `/speckit-tasks` derive implementación sin refactor estructural.

## Phase 0 — Research Output

`research.md` consolida decisiones cerradas para:
- transición default/adjust y CTA deshabilitado hasta `ready`
- regen parcial de preguntas sin tocar `explanation`
- write-through a `session.blocks` + diccionario por bloque
- sneak peek sin tokens extra
- normalización de input por formato y lista soportada v1

Todas las entradas `NEEDS CLARIFICATION` quedan resueltas.

## Phase 1 — Design & Contracts Output

- `data-model.md` define estados de prefetch, persistencia de sesión, merge de conceptos y reglas de normalización de fuente.
- `contracts/` define contratos de comportamiento para transición, persistencia, export, sneak peek, regen parcial y normalización de entrada.
- `quickstart.md` incluye verificación manual de los nuevos criterios (`SC-001..SC-007` + formato de entrada).
- Contexto de agente en `.cursor/rules/specify-rules.mdc` ya apunta al plan activo; no requiere cambio adicional.

## Ejecución (Método Pedro)

### Descomposición

| ID | Tarea | Dependencias | Complejidad |
|----|-------|--------------|-------------|
| T01 | Unificar normalización de input (HTML reducido vs Markdown) + validación de formatos v1 | - | M |
| T02 | Ajustar transición rápida/adjust con gating por `prefetch.ready` | T01 | M |
| T03 | Implementar regen parcial (`questions_only`) y fallback full regen | T02 | M |
| T04 | Persistencia write-through + diccionario por bloque + refresh UI | T02 | L |
| T05 | Export robusto de bloques prefetched + concept dictionary unión | T04 | M |
| T06 | QA: quickstart + tests cursor + regresión manual | T03, T05 | M |

### Grafo de dependencias

`T01 -> T02 -> T03 -> T06`  
`T02 -> T04 -> T05 -> T06`

Paralelizable tras `T02`: `T03` y `T04`.

### Orden recomendado

1. Ejecutar `T01` y `T02` secuencialmente.
2. Ejecutar `T03` y `T04` en paralelo.
3. Ejecutar `T05` cuando termine `T04`.
4. Cerrar con `T06`.

## Complexity Tracking

No se justifican excepciones de complejidad ni violaciones de gates.
