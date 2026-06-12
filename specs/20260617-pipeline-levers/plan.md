# Implementation Plan: RSVP Pipeline Levers (Strict Mode)

**Branch**: `20260617-pipeline-levers` | **Date**: 2026-06-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260617-pipeline-levers/spec.md` (derived from `spec-pipeline-levers.md`)

## Summary

Implementar 25 palancas del pipeline RSVP en modo estricto para eliminar **overlapping estructural de preguntas** y **bloques thin**. Enfoque por sprints de impacto/esfuerzo:

- **Sprint 0** (P0): L15 Key terms sin preguntas, L11 dedup configurable, L22 manifest en regen
- **Sprint 1** (P1): L2 densidad inventario, L14 scope preguntas, L18 anti-reteaching, L17+L23 audit overlap
- **Sprint 2** (P1): L21 claim coverage, L16 manifest activo, L1 delimitadores, L9 snap obligatorio
- **Sprint 3** (P2): L3 inventario dos pasadas, L13 split explain/questions, L5-D glosario lateral
- **Sprint 4** (P3–P5): L4 tipología, L6–L10 pack/chunk tuning, L19–L20 calidad, L24–L25 grafo, L12 dedup semántico

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: `session.js` (inventory, pack, dedup, resolveBlockQuestionConfig), `api.js` (prompts, audit, regen), `study.js` (ensureBlockGenerated), `chunk-alignment.js`, `fidelity-validation.js`, `normalization/hierarchy.js`

**Storage**: `session._meta.coverageManifest`, `session._meta.pipelineLevers`, `block_index`, `splitRunMeta.concept_inventory`

**Testing**: `cursor-tests/20260617_pipeline-levers.mjs` (nuevo)

**Target Platform**: SPA offline-first

**Project Type**: Web application — pipeline orchestration + LLM prompts + deterministic validators

**Performance Goals**: Sprint 0–1 ≤40% latency increase; L3/L13 +2–3× token cost only when triggered

**Constraints**: Sin backend; cambios quirúrgicos; strict mode primary; no regress Questions/Slow modes

**Scale/Scope**: ~20 tareas, 8 contratos, 6+ archivos core, 25 palancas mapeadas a 14 tareas ejecutables + QA

**Prerequisites**: `20260613-source-fidelity`, `20260609-doc-hierarchy-index`, `20260614-rsvp-overlap-guard` (audit API exists)

## Constitution Check

*GATE: Project uses `.cursorrules` (constitution template not ratified).*

| Principle | Status | Notes |
|-----------|--------|-------|
| No backend | PASS | Embeddings L12 optional client-side only |
| No frameworks | PASS | Pure JS modules |
| Simplicity / surgical | PASS | Sprint 0 = ~3 small changes |
| Flutter portability | PASS | Pure functions in session/fidelity/chunk modules |
| Testability | PASS | Deterministic tests without live LLM |
| RSVP critical path | PASS | Improves quality, preserves create flow |

**Post-design re-check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260617-pipeline-levers/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── key-terms-no-questions.md      # L15
│   ├── inventory-density.md           # L2
│   ├── question-scope.md              # L14, L18
│   ├── coverage-manifest.md           # L16, L22
│   ├── overlap-audit.md               # L17, L23
│   ├── claim-coverage.md              # L20, L21
│   └── chunk-alignment-levers.md      # L1, L8, L9, L10, L11
├── checklists/requirements.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/session.js              # L2, L3, L11, L15, L16 state, resolveBlockQuestionConfig
src/js/api.js                  # L14, L18, L17 prompts, L13 split, L22 regen param
src/js/study.js                # L17 wire audit, L16 manifest update, L5-D sequence skip
src/js/chunk-alignment.js      # L8, L9, L10
src/js/fidelity-validation.js  # L20, L21
src/js/normalization/          # L1 delimiters (infer-headings or hierarchy)
index.html                     # L5-D glossary UI (Sprint 3)

cursor-tests/
└── 20260617_pipeline-levers.mjs
```

**Structure Decision**: Palancas P0–P2 en módulos existentes; sin nuevos paquetes salvo helpers pequeños exportables para tests.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| +1 LLM call/block (L17 audit) | Safety net for residual overlap | Solo prompts (L14) no capturan paráfrasis |
| +1 LLM call/block (L13 split) | Questions cover chunk beyond explanation | Single call optimizes questions on own explanation |
| Two-pass inventory (L3) | 79 gaps en docs densos | Single pass misses micro-concepts |

## Task Graph (Método Pedro)

```text
T01 ──┬──→ T14
T02 (indep)
T03 ──→ T09 ──→ T13
T04 (indep)
T05 ──→ T06
T05,T09 ──→ T07
T08 (indep, post-fidelity module)
T10 ──→ T11 ──→ T12
T01,T02,T03,T04,T05,T06,T07,T08,T09,T10,T11 ──→ T20
T12,T13,T14 ──→ T20
T15,T16,T17,T18,T19 (Sprint 4, optional) ──→ T20
```

**Paralelizables**:
- Ola 0: T01 + T02 + T03 (3 agentes)
- Ola 1: T04 + T05 + T08 (3 agentes)
- Ola 2: T06 + T07 + T10 (3 agentes, T07 tras T05)
- Ola 3: T09 + T11 (2 agentes, T09 tras T03)
- Ola 4: T12 + T13 + T14 (3 agentes, tras deps)
- Ola 5: T15–T19 opcional
- Ola 6: T20 QA

Ver `ROADMAP.md` para prompts listos por tarea.

## Phase Mapping

| Sprint | Tasks | Levers |
|--------|-------|--------|
| 0 | T01–T03 | L15, L11, L22 |
| 1 | T04–T07 | L2, L14, L18, L17, L23 |
| 2 | T08–T11 | L21, L16, L1, L9 |
| 3 | T12–T14 | L3, L13, L5-D |
| 4 | T15–T19 | L4, L6–L10, L19–L20, L24–L25, L12 |
| QA | T20 | closure |

## Lever → Task Index

| Lever | Task |
|-------|------|
| L15 | T01 |
| L11 | T02 |
| L22 | T03 |
| L2 | T04 |
| L14 | T05 |
| L18 | T06 |
| L17, L23 | T07 |
| L21, L20 | T08 |
| L16 | T09 |
| L1 | T10 |
| L9, L8, L10 | T11 |
| L3 | T12 |
| L13 | T13 |
| L5-D | T14 |
| L4, L6, L7 | T15 |
| L19 | T16 |
| L24, L25 | T17 |
| L12 | T18 |
