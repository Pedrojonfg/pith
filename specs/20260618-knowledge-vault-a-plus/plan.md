# Implementation Plan: Global Knowledge Vault (Phase A+)

**Branch**: `20260618-knowledge-vault-a-plus` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260618-knowledge-vault-a-plus/spec.md`

## Summary

Build a persistent, cross-document **Global Knowledge Vault (GKV)** in localStorage that accumulates concept mastery from session-close observations, deduplicates concepts across documents via one LLM normalization call per close, elevates RSVP prerequisite graphs, and injects vault context into assessment pre-fill, block packing, and block generation. Ship a settings debug UI as the sole user-facing vault surface in A+. Layered delivery: store + mastery → session-close ingestion → debug UI → normalization → prompt injection → prerequisites → topic tags → assessment pre-fill.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: `session.js`, `study.js`, `api.js`, `session-types.js`, `assessment-signals.js` (mode-continuity), pre-packing assessment flow (`20260611-rsvp-assessment-reposition`)

**Storage**: `localStorage['pith_knowledge_vault']` → `GlobalKnowledgeVault`; split to `pith_knowledge_vault_data` when ~300KB exceeded (same pattern as large sessions)

**Testing**: `cursor-tests/20260618_knowledge-vault-a-plus.mjs` (new)

**Target Platform**: SPA offline-first PWA

**Project Type**: Web application — pure JS modules + minimal DOM debug UI

**Performance Goals**: Session-close pipeline non-blocking for navigation; normalization ≤1 LLM call per close; debug UI renders 1000 entries in <2s

**Constraints**: No backend; no frameworks; English for prompts and new UI; surgical changes; Flutter-portable pure modules under `src/js/vault/`

**Scale/Scope**: 7 new modules, ~5 existing files touched, 9 implementation tasks + QA

**External prerequisites**: `20260609-unified-session`, `20260611-rsvp-assessment-reposition`, `20260613-source-fidelity` (stable concept inventory / assessment signals)

## Constitution Check

*GATE: Project uses `.cursorrules` (constitution template not ratified).*

| Principle | Status | Notes |
|-----------|--------|-------|
| English prompts / UI | PASS | All new strings and LLM prompts in English |
| No backend | PASS | localStorage only |
| No frameworks | PASS | Vanilla JS modules |
| Simplicity / surgical | PASS | New code under `src/js/vault/`; api.js prompt extensions only |
| PWA versioning | PASS | Bump SW_VERSION when touching `src/js/**`, `index.html`, `src/css/**` |
| Testability | PASS | Pure mastery + store functions unit-testable without LLM |
| localStorage preservation | PASS | Vault is additive; never clear API keys on update |

**Post-design re-check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260618-knowledge-vault-a-plus/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── vault-store-api.md
│   ├── mastery-model.md
│   ├── session-close-pipeline.md
│   ├── normalization-llm.md
│   ├── prompt-injection.md
│   ├── prerequisites-elevation.md
│   └── debug-ui.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/vault/
├── vault-store.js          # CRUD, persistence, size migration
├── mastery-model.js        # updateMastery, getCurrentMastery, getMasteryLabel
├── normalization.js        # mergeNormalizationResult + api wiring
├── prerequisites.js        # elevatePrerequisiteRelations
├── session-close.js        # updateVaultFromSession orchestrator
├── prompt-injection.js     # buildVaultContextBlock, getVaultContextForDoc
└── debug-ui.js             # settings panel logic

src/js/api.js               # normalizeConceptsToVault, hierarchy topics, pack/block prompts
src/js/study.js             # onSessionClose → updateVaultFromSession
src/js/session-types.js     # shared.docTopics
index.html                  # Knowledge Vault debug section
src/css/main.css            # vault debug table styles

cursor-tests/
└── 20260618_knowledge-vault-a-plus.mjs
```

**Structure Decision**: All vault logic isolated under `src/js/vault/`; existing orchestration files receive thin wiring only.

## Complexity Tracking

> No violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Task Graph (Método Pedro)

```text
T01 ──→ T02 ──→ T03
T01 ──→ T04 ──┬──→ T05
              ├──→ T06
              └──→ T08
T07 (independiente, paralelo desde inicio)
T01–T08 ──→ T09
```

**Paralelizables desde inicio**: T01 + T07  
**Paralelizables ola 2**: T03 + T04 (tras T02)  
**Paralelizables ola 3**: T05 + T06 + T08 (tras T04; T08 también necesita T07)

Ver `ROADMAP.md` para prompts listos por tarea.

## Phase 0 / Phase 1 Artifacts

- [research.md](./research.md) — resolved design decisions from `spec-a-plus.md`
- [data-model.md](./data-model.md) — vault entities and session extensions
- [contracts/](./contracts/) — module interfaces
- [quickstart.md](./quickstart.md) — manual QA scenarios

**Phase 2 (tasks.md)**: Generated by `/speckit-tasks` — not in scope of this command.
