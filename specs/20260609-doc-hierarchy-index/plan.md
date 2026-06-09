# Implementation Plan: Document Hierarchy Pre-Index

**Branch**: `20260609-doc-hierarchy-index` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260609-doc-hierarchy-index/spec.md`

## Summary

Tras normalizar el estudio a markdown canónico, generar y persistir `session.docHierarchy`: árbol jerárquico con offsets en caracteres del markdown. Modo determinístico (headings), trivial (<3k chars) o LLM ligero (≥3k sin headings). Cache localStorage por hash. Consumidores: `buildScopeOptions`, `computePageBreakpoints`, `buildMapReduceChunks` / Fase 0.

## Technical Context

**Language/Version**: JavaScript ES modules, browser (sin build step)

**Primary Dependencies**: `src/js/normalization/*`, `src/js/llm.js`, `src/js/api.js` (chat completions), `src/js/slow/headings.js`, `src/js/slow/pagination.js`, `src/js/slow/phase0.js`, `src/js/session.js`, `src/js/study.js`

**Storage**: `session.docHierarchy`, `localStorage['mylearning_hierarchy_{hash}']`

**Testing**: `cursor-tests/*.mjs` con `node --import ./cursor-tests/register.mjs`

**Target Platform**: SPA estática (index.html + módulos ES)

**Project Type**: Web application (client-side only)

**Performance Goals**: Modo determinístico/trivial síncrono; modo LLM 1–3s con loading state no bloqueante

**Constraints**: `hierarchy.js` puro (sin side effects); LLM temp 0; fallback determinístico en validación fallida; backward compat sesiones sin `docHierarchy`

**Scale/Scope**: 2 módulos nuevos, ~6 archivos modificados, 8 tareas (T01–T08), ~2.5 días estimados

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Constitution file | ⚠️ Placeholder | Sin principios ratificados; convenciones implícitas del repo |
| Test coverage | ✅ PASS | cursor-tests por modo + integración |
| Minimize scope | ✅ PASS | No toca RSVP/Cloze ni pipeline PDF |
| No new npm deps | ✅ PASS | Reutiliza LLM existente |
| Backward compat | ✅ PASS | `docHierarchy` nullable; fallbacks actuales |

**Post-design re-check**: Contratos documentan schema y hooks sin breaking changes en `normalizeStudyMaterial` return shape.

## Project Structure

### Documentation (this feature)

```text
specs/20260609-doc-hierarchy-index/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── hierarchy-schema.md
│   ├── llm-hierarchy-prompt.md
│   └── consumer-integration.md
└── tasks.md             # Phase 2 — /speckit-tasks
```

### Source Code

```text
src/js/normalization/
├── hierarchy.js          # NUEVO — funciones puras + buildDocumentHierarchy
└── hierarchy-cache.js    # NUEVO — hash, get/set cache LRU

src/js/
├── input-normalization.js  # wire post-normalize (opcional facade)
├── session.js              # docHierarchy en schema
└── study.js                # llamada async + loading UI

src/js/slow/
├── headings.js             # buildScopeOptions desde árbol
├── pagination.js           # snap a section boundaries
├── phase0.js               # getChunksFromHierarchy + contexto árbol
└── reader.js                 # pasar boundaries a pagination

cursor-tests/
└── 20260609_doc-hierarchy-*.mjs
```

**Structure Decision**: Monorepo SPA; lógica de árbol en `normalization/`; consumo en `slow/`; tests en `cursor-tests/`.

## Complexity Tracking

> Sin violaciones que requieran justificación adicional.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Phase 0 — Research

Completado en [research.md](./research.md). Resuelve:

- R1: Tres modos (determinístico / trivial / LLM)
- R2: `llmFn` inyectado en módulo puro
- R3: Cache localStorage LRU
- R4: Integración vía `buildScopeOptions`
- R5: Snap paginación ±200 chars
- R6: Chunks Fase 0 desde árbol
- R7: Ejecución post-normalize en `study.js`
- R8: Validación estricta + fallback

## Phase 1 — Design

- [data-model.md](./data-model.md) — HierarchyNode, DocHierarchy, cache
- [contracts/](./contracts/) — schema, prompt LLM, hooks consumidores
- [quickstart.md](./quickstart.md) — QA manual + automated
- ROADMAP.md — descomposición Método Pedro (T01–T08)

## Implementation Waves (Método Pedro)

```text
Ola 1 (paralelo): T01, T03
Ola 2: T02 ← T01
Ola 3: T04 ← T02, T03
Ola 4 (paralelo): T05, T06 ← T04
Ola 5: T07 ← T04
Ola 6: T08 ← T05, T06, T07
```

**Paralelizables**: T01 ∥ T03 desde inicio; T05 ∥ T06 tras T04

**Secuenciales críticos**: T01 → T02 → T04; T04 antes T05/T06/T07
