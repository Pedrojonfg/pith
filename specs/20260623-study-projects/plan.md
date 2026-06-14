# Implementation Plan: Study Projects

**Branch**: `20260623-study-projects` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260623-study-projects/spec.md`

## Summary

Introduce user-defined **Project** hierarchy grouping `DocumentSession`s (1:1 assignment, default `misc`). Deliver project browser in Library, scoped Review, project-prioritized Knowledge Vault context for RSVP generation, breadcrumbs, and mode-select hub entry points. Migration backfills existing sessions idempotently.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: `session-types.js`, `session-store.js`, `session-migration.js`, `project-store.js` (new), `vault/prompt-injection.js`, `review.js`, `study.js`, `ui.js`, `index.html`, `main.css`, `api.js`

**Storage**: `localStorage` — new `mylearning_projects` (ProjectStore v1); `projectId` root field on DocumentSession V2 (no schemaVersion bump)

**Testing**: `cursor-tests/20260623_study-projects.mjs`

**Target Platform**: SPA offline-first PWA (Chrome/Firefox desktop)

**Project Type**: Web application — 1 new pure store module + library UI + vault/review integration

**Performance Goals**: Project tree render < 50ms for ≤50 projects; scoped review filter < 100ms for ≤50 documents

**Constraints**: English UI; bump `SW_VERSION` on JS/CSS/HTML changes; idempotent migration; `misc` non-deletable; no localStorage wipe

**Scale/Scope**: 10 tasks (T01–T10), ~12 source files touched

**External prerequisites** (already in repo):
- `20260609-unified-session` — DocumentSession V2
- `20260618-knowledge-vault-a-plus` — vault prompt injection
- `20260612-mode-continuity` — mode select / enterModeWithContinuity
- `20260620-sm2-priority-queue` — shared.smItems review pool

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Library-first / pure functions | PASS | `project-store.js` tree helpers pure |
| Testability | PASS | T01–T05 unit-testable; T10 integration |
| Simplicity (YAGNI) | PASS | Block delete vs cascade; no drag-drop; no auto-suggest |
| Integration tests | PASS | T10 migration + scope + vault ordering |
| Backward compatibility | PASS | Backfill misc; docTopics untouched |

**Post-design re-check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260623-study-projects/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── project-store-api.md
│   ├── project-migration.md
│   ├── vault-context-priority.md
│   ├── review-project-scope.md
│   └── project-library-ui.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/
├── session-types.js          # Project types, MISC_PROJECT_ID, projectId on session
├── project-store.js          # NEW — CRUD + tree helpers
├── session-store.js          # load/save ProjectStore; getSessionsByProject export
├── session-migration.js      # migrateProjects() boot step
├── vault/prompt-injection.js # session-aware getVaultContextForDoc + scope bands
├── review.js                 # getReviewableItemsForProject + scope UI wiring
├── study.js                  # library nav, upload assign, hub, breadcrumbs
├── ui.js                     # renderBreadcrumb, project tree/selectors
└── api.js                    # pass session to vault context in pack/block gen

index.html                    # library browser, review scope, upload selector, breadcrumbs
src/css/main.css              # project browser + breadcrumb styles
cursor-tests/
└── 20260623_study-projects.mjs
```

**Structure Decision**: Pure `project-store.js` colocated with `session-store.js`; UI wiring in `study.js` following existing screen navigation patterns.

## Complexity Tracking

> No violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Task Graph (Método Pedro)

```text
T01 ──→ T02 ──→ T04
  │       │
  └──→ T03 ──→ T05
  │
T06 ──→ T07 ──→ T08 ──→ T09
T02,T03,T04,T05,T08,T09 ──→ T10
```

**Parallel Wave 1**: T01 + T06  
**Parallel Wave 2**: T02 + T03  
**Parallel Wave 3**: T04 + T05 + T07  
**Parallel Wave 4**: T08 + T09  
**Sequential**: T10 after all

See `ROADMAP.md` for executable prompts.
