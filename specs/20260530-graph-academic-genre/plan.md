# Implementation Plan: Grafo Académico — Género Textual y Tipado Filosófico

**Branch**: `20260530-graph-academic-genre` | **Date**: 2026-06-07 | **Spec**: `specs/20260530-graph-academic-genre/spec.md`

**Input**: Extensión del grafo Slow Mode para textos filosófico-históricos: tipado de nodos, aristas ampliadas, detección de género Phase 0, deduplicación de clusters, prune de huérfanos.

## Summary

El pipeline Phase 0 + `buildSlowPhase0Graph` asume argumentos lineales y nodos homogéneos. Esta feature introduce **clasificación de género textual** (`textGenre`) que adapta el `argumentMap`, **subtipos de nodo** en capa `text` (CONCEPTO/PERSONA/OBRA/MOVIMIENTO/EVENTO), **6 aristas filosóficas** nuevas con estilos SVG, **deduplicación** vía campo `includes`, y **pruneOrphanNodes** antes de persistir. Cambios quirúrgicos en `phase0.js`, `graph/build.js`, `graph/canvas.js`, `export-format.js`; sin tocar RSVP/Cloze.

## Technical Context

**Language/Version**: JavaScript ES modules (browser, sin build step)

**Primary Dependencies**: `src/js/slow/phase0.js`, `src/js/graph/build.js`, `src/js/graph/canvas.js`, `src/js/graph/view.js`, `src/js/export-format.js`, `llm.js`

**Storage**: `Phase0Orientation` extendido en `session.slow.phase0` (localStorage); campos nuevos opcionales — backward compatible

**Testing**: `cursor-tests/20260607_t14-graph-refactor.mjs` (regresión) + nuevo `cursor-tests/20260607_t15-graph-academic-genre.mjs`

**Target Platform**: PWA estática — navegadores modernos

**Project Type**: Web app frontend-only (vanilla JS)

**Performance Goals**: Sin llamadas IA adicionales; clasificación de género en el mismo JSON Phase 0

**Constraints**:
- Sin backend; prompts IA en un solo paso Phase 0
- Reutilizar `buildSlowPhase0GraphFromInputs` / `buildSlowEnrichedGraphFromInputs` (pure builders)
- Map-reduce Phase 0 (≥60k): género sintetizado en paso final
- Cero regresión en textos técnicos-lineales

**Scale/Scope**: 5 cambios sistémicos; ~6 archivos fuente; 8 tareas implementables

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- `constitution.md` en plantilla — sin gates ejecutables adicionales.
- Gate pre-research: **PASS** — extensión de modelo existente, no nueva arquitectura.
- Gate post-design: **PASS** — builders puros + prompts; sin over-engineering.

## Project Structure

### Documentation (this feature)

```text
specs/20260530-graph-academic-genre/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Extended entities
├── quickstart.md        # Manual QA scenarios
├── contracts/
│   ├── phase0-text-genre.md
│   ├── text-node-subtypes.md
│   ├── graph-edge-vocabulary.md
│   └── orphan-prune.md
└── tasks.md             # /speckit-tasks (not created by /speckit-plan)
```

### Source Code (repository root)

```text
src/js/slow/phase0.js           # prompts + validatePhase0Orientation
src/js/graph/build.js           # EdgeType, pruneOrphanNodes, genre-aware edges
src/js/graph/canvas.js          # edge stroke styles
src/js/graph/view.js            # prune before persistEnrichedGraph
src/js/export-format.js         # EDGE_TYPE_FAMILIES extension
cursor-tests/20260607_t15-graph-academic-genre.mjs
ROADMAP.md                        # Método Pedro execution prompts
```

**Structure Decision**: Single frontend project; extensión del sub-sistema `graph/` y `slow/phase0.js` ya existente.

## Phase 0: Research Summary

Ver `research.md`. Decisiones clave:
- `textGenre` como primer campo generado por IA en Phase 0
- Fallback `ARGUMENTO_LINEAL` para sesiones legacy
- Aristas nuevas mapeadas a familias export existentes
- Prune en builders + view.js (defensa en profundidad)

## Phase 1: Design Summary

Ver `data-model.md` y `contracts/`. Entidades extendidas:
- `Phase0Orientation.textGenre`
- `ConceptToFind.nodeType`, `ConceptToFind.includes`
- `ArgumentMapNode.period`, `ArgumentMapNode.author`
- `GraphEdge.type` ampliado (12+ tipos)

## Complexity Tracking

> Sin violaciones de constitution que requieran justificación.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Post-Design Constitution Re-check

**PASS** — Cambios localizados; tests de regresión T14; quickstart con fixture Horlacher.

**Agent context**: `.cursor/rules/specify-rules.mdc` → this plan.
