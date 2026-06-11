# Implementation Plan: RSVP Pre-Packing Assessment — Questions Mode Parity

**Branch**: `20260612-rsvp-assessment-questions-parity` | **Date**: 2026-06-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260612-rsvp-assessment-questions-parity/spec.md`

## Summary

Reemplazar el quiz pre-packing minimalista (MCQ custom, ~4 ítems mal formateados) por el **mismo stack que modo Questions**: schema `test`/`socratic`, conteo `n_test`+`n_socratic`, prompts con reglas pedagógicas existentes, normalizers/shuffle compartidos, y pantallas `test`/`socratic` reutilizadas en un runner de assessment. La salida sigue siendo `knowledge_profile` para block packing.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: `api.js` (prompts, generation, evaluation), `session.js` (`normalizeBlockJson`, `resolveBlockQuestionConfig`), `study.js` (question runner), `shuffle-options.js`, `config/flags.js`

**Storage**: Ephemeral `prePackingFlow` + `session._meta.knowledge_profile` (sin cambios)

**Testing**: `cursor-tests/20260612_rsvp-assessment-questions-parity.mjs` (nuevo); extender suite reposition donde aplique

**Target Platform**: SPA offline-first

**Project Type**: Web application — refactor assessment UX/generation dentro del flujo RSVP create

**Performance Goals**: Misma latencia que hoy (prefetch tras inventory); generación puede ser ligeramente más lenta por prompt más rico — aceptable

**Constraints**: No romper `20260611-rsvp-assessment-reposition`; reutilizar código Questions (no duplicar render); flag rollback

**Scale/Scope**: ~4 archivos fuente, 1 suite tests, 6 tareas

**External prerequisites**: `20260611-rsvp-assessment-reposition` completo (T01–T09)

## Constitution Check

*GATE: Project uses `.cursorrules` (constitution template not ratified).*

| Principle | Status | Notes |
|-----------|--------|-------|
| No backend | PASS | LLM desde browser |
| No frameworks | PASS | Reutiliza DOM Questions existente |
| Simplicity / surgical | PASS | Adaptadores + runner mode; elimina UI duplicada |
| Flutter portability | PASS | Questions schema ya portable |
| Testability | PASS | Normalizers + score mapping unitarios |
| RSVP critical path | PASS | Mejora calidad assessment sin cambiar pack |

**Post-design re-check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260612-rsvp-assessment-questions-parity/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── assessment-generation.md
│   ├── assessment-runner-ui.md
│   ├── assessment-evaluation.md
│   └── feature-flags.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/api.js                       # prompt + normalizer + evaluator
src/js/study.js                     # assessment runner (test/socratic screens)
src/js/config/flags.js              # deprecate ASSESSMENT_ITEMS_MAX as count driver
index.html                          # hide/remove prePackingAssessment from happy path
src/css/main.css                    # assessment chrome overrides if needed

cursor-tests/
└── 20260612_rsvp-assessment-questions-parity.mjs
```

**Structure Decision**: Sin módulos nuevos; extraer prompt builder en `api.js` junto a `buildQuestionsOnlySystemPrompt`.

## Complexity Tracking

> No violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Task Graph (Método Pedro)

```text
T01 ──→ T03 ──→ T05 ──→ T06
T02 ──→ T04 ──↗
```

**Paralelizables desde inicio**: T01 + T02 (2 agentes)

**Secuenciales críticos**: T03 → T05 → T06

Ver `ROADMAP.md` para prompts listos por tarea.

## Phase 0 & 1 Outputs

- [research.md](./research.md) — R1–R8 resueltos
- [data-model.md](./data-model.md) — AssessmentBlock, runner state, profile mapping
- [contracts/](./contracts/) — generation, runner UI, evaluation, flags
- [quickstart.md](./quickstart.md) — QA manual parity checklist
