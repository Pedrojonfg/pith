# Implementation Plan: RSVP Assessment Reposition

**Branch**: `20260611-rsvp-assessment-reposition` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260611-rsvp-assessment-reposition/spec.md`

## Summary

Mover el assessment RSVP **antes** del block packing: `Concept Inventory → Quiz sobre conceptos → knowledge_profile → Pack (hasta N bloques)`. El perfil filtra **solo** `blockIndex` y `learning_goal`; inventario, grafo y diccionario permanecen completos. Reemplaza el assessment legacy post-packing. Packing paralelo tras evaluación; pantalla de resultados informativa con opción "Ignorar" (perfil persistido, packing uniforme).

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: `api.js` (LLM), `session.js` (`runConceptInventory`, `packInventoryToBlocks`), `study.js`, `index.html`, `main.css`, `config/flags.js` (new)

**Storage**: `localStorage` active session + block_index; `state.blockSplitCache` ephemeral

**Testing**: `cursor-tests/20260611_rsvp-assessment-reposition.mjs`

**Target Platform**: SPA offline-first (Chrome/Firefox desktop)

**Project Type**: Web application — extend RSVP create flow; no backend

**Performance Goals**: Inventory → first UI < 60s medium doc; quiz items prefetch overlaps graph; evaluate → results UI < 3s perceived; parallel pack overlaps results

**Constraints**: MCQ-only UI v1; N = ceiling; layer separation invariant; flag rollback to legacy

**Scale/Scope**: ~6 source files, 1 test suite, 9 implementation tasks

**External prerequisites**:
- `20260611-rsvp-block-recommend` (`runConceptInventory` / `packInventoryToBlocks` split)
- `20260612-mode-continuity` (`addConceptsToShared` — full inventory promotion)

## Constitution Check

*GATE: Project uses `.cursorrules` (constitution template not ratified).*

| Principle | Status | Notes |
|-----------|--------|-------|
| No backend | PASS | LLM from browser like today |
| No frameworks | PASS | Vanilla DOM |
| Simplicity / surgical | PASS | Extend api/session/study; flag-gated legacy |
| Flutter portability | PASS | Schema on session objects |
| Testability | PASS | Normalizers + layer invariants in cursor-tests |
| RSVP critical path | PASS | Fewer blocks reduces study time; RSVP reader unchanged |

**Post-design re-check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260611-rsvp-assessment-reposition/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── pre-packing-assessment-api.md
│   ├── pack-with-profile.md
│   ├── assessment-ui.md
│   ├── feature-flags.md
│   └── consumer-integration.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/config/flags.js              # NEW
src/js/api.js                       # assessment LLM + pack prompt
src/js/session.js                   # meta helpers, packInventoryToBlocks
src/js/study.js                     # orchestration, screens, legacy gate
src/js/ui.js                        # DOM refs
index.html                          # pre-packing screens
src/css/main.css                    # .pre-packing-* styles

cursor-tests/
└── 20260611_rsvp-assessment-reposition.mjs
```

**Structure Decision**: Sin módulos nuevos salvo `flags.js`; funciones assessment en `api.js` siguiendo `generateAssessmentQuestions` existente.

## Complexity Tracking

> No violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Task Graph (Método Pedro)

```text
T01 ──────────────┐
T02 ──────────────┼──→ T04 ──→ T05 ──→ T06 ──→ T07 ──→ T09
T03 ──────────────┘              ↘ T08 ↗
```

**Paralelizables desde inicio**: T01 + T02 + T03 (hasta 3 agentes)

**Secuenciales críticos**: T04 → T05 → T06 → T07 → T09

**Paralelo tras T05**: T06 + T08

Ver `ROADMAP.md` para prompts listos por tarea.

## Phase 0 & 1 Outputs

- [research.md](./research.md) — R1–R10 resueltos
- [data-model.md](./data-model.md) — capas, entidades, transiciones
- [contracts/](./contracts/) — API, pack, UI, flags, integración
- [quickstart.md](./quickstart.md) — QA manual + tests
