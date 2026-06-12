# Implementation Plan: Study Source Fidelity (RSVP & Guide)

**Branch**: `20260613-source-fidelity` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260613-source-fidelity/spec.md`

## Summary

Garantizar que el LLM **traduzca** el material subido en lugar de inventar pedagogía genérica. Tres fases en un solo release:

- **A**: Reglas `SOURCE_FIDELITY` unificadas en todos los prompts RSVP + tutor con chunk de fuente.
- **B**: `assignAlignedChunks` sustituye corte lineal 1/N; inventario con `source_phrase`; validación determinista + retry + banner UI.
- **C**: Modo estricto extract→rewrite (opt-in); tutor con búsqueda en documento completo y política de spoilers.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: `api.js` (prompts, generation), `session.js` (pack/chunks), `guide-chat.js`, `config/flags.js`, `study.js`, `normalization/hierarchy.js` (optional snap)

**Storage**: `block_index` localStorage, `session.blocks[]`, `splitRunMeta.concept_inventory`, `session._meta.source_fidelity_mode`

**Testing**: `cursor-tests/20260613_source-fidelity.mjs` (nuevo)

**Target Platform**: SPA offline-first

**Project Type**: Web application — prompt + deterministic alignment + UI warnings

**Performance Goals**: Fase A ≤10% latency increase; Fase B pack ≤30s p95; Fase C +1 LLM call/block solo en strict

**Constraints**: Sin backend; sin frameworks; cambios quirúrgicos; portable a Flutter (lógica pura en módulos nuevos)

**Scale/Scope**: 3 módulos nuevos, ~6 archivos tocados, 13 tareas, 1 suite tests

**External prerequisites**: `20260526-block-split-dedup` (two-phase pack); `20260609-doc-hierarchy-index` opcional para FR-B02

## Constitution Check

*GATE: Project uses `.cursorrules` (constitution template not ratified).*

| Principle | Status | Notes |
|-----------|--------|-------|
| No backend | PASS | Búsqueda léxica en cliente |
| No frameworks | PASS | Módulos JS puros + DOM mínimo |
| Simplicity / surgical | PASS | Nuevos módulos pequeños; no reescribir Slow/Cloze |
| Flutter portability | PASS | `chunk-alignment`, `fidelity-validation`, `source-fidelity` exportables |
| Testability | PASS | Determinista sin LLM live |
| RSVP critical path | PASS | Mejora fidelidad sin cambiar flujo create |

**Post-design re-check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260613-source-fidelity/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── source-fidelity-rules.md
│   ├── chunk-alignment.md
│   ├── fidelity-validation.md
│   ├── guide-chat-grounding.md
│   ├── strict-extract-rewrite.md
│   └── fidelity-ui.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/source-fidelity.js          # NEW — SOURCE_FIDELITY_RULES + RSVP structure builders
src/js/chunk-alignment.js          # NEW — assignAlignedChunks
src/js/fidelity-validation.js    # NEW — validateBlockFidelity
src/js/api.js                      # prompts, extract pass, validation hook
src/js/session.js                  # packInventoryToBlocks wiring
src/js/guide-chat.js               # chunk + document excerpt
src/js/study.js                    # banner, strict toggle create UI
src/js/config/flags.js             # SOURCE_FIDELITY_STRICT
index.html                         # banner mount + checkbox
src/css/main.css                   # .block-fidelity-banner

cursor-tests/
└── 20260613_source-fidelity.mjs
```

**Structure Decision**: Lógica determinista en módulos nuevos; prompts permanecen en `api.js` importando `source-fidelity.js`.

## Complexity Tracking

> No violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Task Graph (Método Pedro)

```text
T01 ──→ T02 ──┐
T01 ──→ T03 ──┼──→ T08 ──→ T09 ──→ T13
T01 ──→ T04 ──┘
T05 ──→ T06 ──→ T07 (optional enhance)
T06 ──→ T08
T02 ──→ T10 ──→ T11
T06 ──→ T12 ──→ T13
T10,T11,T09 ──→ T13
```

**Paralelizables**:
- Ola 2: T02 + T03 + T05 (3 agentes, tras T01)
- Ola 3: T04 + T06 + T07 (3 agentes)
- Ola 5: T09 + T10 (2 agentes)
- Ola 6: T11 + T12 (2 agentes)

Ver `ROADMAP.md` para prompts listos por tarea.

## Phase Mapping

| Phase | Tasks |
|-------|-------|
| A | T01–T04 |
| B | T05–T09 |
| C | T10–T12 |
| QA | T13 |
