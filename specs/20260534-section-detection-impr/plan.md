# Implementation Plan: Section Detection & Normalization Improvements

**Branch**: `20260534-section-detection-impr` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260534-section-detection-impr/spec.md`

## Summary

Corregir el scope picker de Slow Mode para PDFs reales con outline (caso *Primates y Filósofos*): normalización tolerante en `matchOutlineToBlocks`, exclusión de front matter, short-circuit heurístico cuando outline cubre ≥80 %, filtrado de secciones mínimas, artefactos tipográficos, layout bicolumna, dehiphenation, y UX jerárquica con overrides manuales. Extiende el pipeline `src/js/normalization/` de `20260531-structure-inference` sin nueva dependencia npm.

## Technical Context

**Language/Version**: JavaScript ES modules, browser (sin build step)

**Primary Dependencies**: pdf.js 4.4.168 (existente), pipeline `src/js/normalization/*`, `src/js/slow/headings.js`, `src/js/study.js`

**Storage**: `session.slow.normalizedTextFull`, `session.slow.headingOverrides` (localStorage vía session store)

**Testing**: `cursor-tests/*.mjs` con `node --import ./cursor-tests/register.mjs`

**Target Platform**: SPA estática (index.html + módulos ES)

**Project Type**: Web application (client-side only)

**Performance Goals**: Normalización PDF <5s para libros ~400k chars en hardware típico; sin regresión perceptible vs pipeline actual

**Constraints**: Determinístico (sin LLM en normalización); compatibilidad contratos `input-normalization-v3` y `parseHeadings`; no romper offsets de anotaciones

**Scale/Scope**: 10 fixes en ~8 archivos; 4 fixtures de regresión; 1 PDF golden (*Primates y Filósofos*)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Constitution file | ⚠️ Placeholder | `.specify/memory/constitution.md` sin principios ratificados; proyecto usa convenciones implícitas |
| Test coverage | ✅ PASS | cursor-tests obligatorios por fixture; quickstart manual |
| Minimize scope | ✅ PASS | Solo archivos listados en spec; extiende pipeline existente |
| No new npm deps | ✅ PASS | Reutiliza pdf.js y módulos normalization |
| Backward compat | ✅ PASS | `headingOverrides` opcional; migración html_min intacta |

**Post-design re-check**: Contratos documentan extensiones sin breaking changes en `normalizeStudyMaterial` return shape.

## Project Structure

### Documentation (this feature)

```text
specs/20260534-section-detection-impr/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── outline-matching.md
│   ├── front-matter-detection.md
│   ├── scope-picker-ux.md
│   └── regression-fixtures.md
└── tasks.md             # Phase 2 — /speckit-tasks
```

### Source Code

```text
src/js/normalization/
├── pdf-outline.js          # FIX-01
├── front-matter-detector.js # FIX-02 (nuevo)
├── infer-headings.js       # FIX-02, FIX-03, FIX-05 integración
├── strip-artifacts.js      # FIX-05
├── extract-pdf-blocks.js   # FIX-06
├── emit-markdown.js        # FIX-07
└── index.js                # wire dehyphenate

src/js/slow/
└── headings.js             # FIX-04, FIX-08, FIX-09

src/js/
├── input-normalization.js  # FIX-07 facade
└── study.js                # FIX-08, FIX-09, FIX-10 UI

cursor-tests/
└── 20260609_section-detection-*.mjs
```

**Structure Decision**: Monorepo SPA; toda la lógica en `src/js/`; tests en `cursor-tests/`; specs en `specs/20260534-section-detection-impr/`.

## Complexity Tracking

> Sin violaciones que requieran justificación adicional.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Phase 0 — Research

Completado en [research.md](./research.md). Resuelve:

- R1: Causa raíz dominante = match sin normalización (A)
- R2: Orden de aplicación front matter → artifacts → outline → short-circuit
- R3: Encoding fixups tabla `6→ó` documentada, no ML
- R4: Multi-columna solo cuando gap central >8 % page width
- R5: Overrides en sesión vs editar markdown

## Phase 1 — Design

- [data-model.md](./data-model.md) — entidades extendidas
- [contracts/](./contracts/) — interfaces por capa
- [quickstart.md](./quickstart.md) — QA manual + automated
- ROADMAP.md — descomposición Método Pedro (T01–T12)

## Implementation Waves (Método Pedro)

```text
Ola 1 (paralelo): T01, T02, T06, T07
Ola 2 (paralelo): T03 ← T01 | T04 ← T02
Ola 3: T05
Ola 4: T08 ← T05
Ola 5: T09 → T10
Ola 6: T11, T12
```

Ver [ROADMAP.md](../../ROADMAP.md) para prompts listos.
