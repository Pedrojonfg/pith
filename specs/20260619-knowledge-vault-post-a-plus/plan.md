# Implementation Plan: Global Knowledge Vault (Post A+)

**Branch**: `20260619-knowledge-vault-post-a-plus` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260619-knowledge-vault-post-a-plus/spec.md`

## Summary

Extend Phase A+ GKV with nine incremental capability blocks: manual vault curation, external knowledge import (text/document/file), misconception detection and scaffolding, declarative/procedural mastery (optional BKT when data-rich), prerequisite graph hardening (cycles, LLM inference, centrality), interactive vault graph UI, vault-driven spaced review, and (deferred) backend sync plus collaborative priors. Delivery is gated on A+ validation signals; blocks ship in priority waves without rewriting A+ session-close or normalization core.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: A+ vault modules (`src/js/vault/*`), `vault-store.js`, `mastery-model.js`, `session-close.js`, `prompt-injection.js`, `debug-ui.js`, `api.js`, `study.js`, `graph/view.js`, `graph/canvas.js`, `session-store.js` (`shared.smItems`)

**Storage**: `localStorage['pith_knowledge_vault']` (extended schema v2); Blocks 8–9 require future backend — out of scope for initial waves

**Testing**: `cursor-tests/20260619_knowledge-vault-post-a-plus.mjs` (new)

**Target Platform**: SPA offline-first PWA

**Project Type**: Web application — vanilla JS modules + DOM UI extensions

**Performance Goals**: Manual edit/merge <500ms for typical vault sizes; graph view usable at 100 nodes; import text processing non-blocking with progress UI; misconception LLM call only when ≥3 negative obs on same concept

**Constraints**: No backend until Block 8; extend A+ surgically; English UI; bump SW_VERSION on `src/js/**` / `index.html` / `src/css/**` changes; BKT disabled until ≥15 obs/concept average

**Scale/Scope**: ~12 implementation tasks in scope for waves 1–4 + QA; 2 deferred backend tasks documented only

**External prerequisites**: `20260618-knowledge-vault-a-plus` validated in production-like use

## Constitution Check

*GATE: Project uses `.cursorrules` (constitution template not ratified).*

| Principle | Status | Notes |
|-----------|--------|-------|
| English prompts / UI | PASS | All new strings in English |
| No backend (waves 1–4) | PASS | localStorage only until Block 8 |
| No frameworks | PASS | Extend existing vault + graph modules |
| Simplicity / surgical | PASS | New code under `src/js/vault/` + thin wiring |
| PWA versioning | PASS | SW bump when touching shipped assets |
| Testability | PASS | Pure graph/mastery functions unit-testable |
| A+ readiness gate | PASS | FR-000 documented; no Post A+ code before validation |

**Post-design re-check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260619-knowledge-vault-post-a-plus/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── manual-vault-ui.md
│   ├── external-import.md
│   ├── misconception-detection.md
│   ├── mastery-refinement.md
│   ├── prerequisite-graph.md
│   ├── vault-graph-ui.md
│   └── spaced-review-vault.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/vault/
├── vault-store.js          # extend: merge, delete, manual add, cycle detect
├── mastery-model.js        # extend: declarative/procedural, optional BKT
├── misconceptions.js       # NEW: detect, resolve, prompt block
├── import.js               # NEW: text/doc/csv/json import orchestration
├── prerequisite-graph.js   # NEW: cycle resolution, centrality, LLM inference hook
├── vault-graph.js          # NEW: buildVaultGraph adapter
├── spaced-review.js        # NEW: decay → smItems bridge
├── debug-ui.js             # extend: edit/merge/delete/manual prereqs
└── (existing A+ modules unchanged in spirit)

src/js/graph/
├── view.js                 # reuse for vault graph screen
└── canvas.js               # node styling by mastery

src/js/api.js               # import LLM, misconception detect, prereq inference prompts
src/js/study.js             # import entry points, graph nav, review hooks
index.html                  # vault management + import + graph screens
src/css/main.css            # vault management styles

cursor-tests/
└── 20260619_knowledge-vault-post-a-plus.mjs
```

**Structure Decision**: All Post A+ logic under `src/js/vault/` with one graph adapter module; reuse existing graph renderer; no new top-level packages.

## Complexity Tracking

> No unjustified violations. Blocks 8–9 deferred intentionally.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Optional BKT path (T08) | Better calibration with dense per-concept data | Weighted average insufficient when >15 obs/concept |
| LLM prerequisite inference (T10) | Cross-document links never co-occur in one doc | Manual prereq editing does not scale past ~50 concepts |

## Implementation Waves

| Wave | Tasks | Trigger |
|------|-------|---------|
| 0 — Gate | Validate A+ readiness (manual) | FR-000 signals green |
| 1 — Curation | T01 | User needs vault corrections |
| 2 — Knowledge in | T02–T04 | External sources |
| 3 — Pedagogy | T05–T06, T07 | ≥2 weeks session data |
| 4 — Graph + review | T09–T13 | >3 docs/topic, SM robust |
| 5 — Precision | T08, T12 | >15 obs/concept, >50 concepts |
| 6 — Platform | T15–T16 (deferred) | Backend + user base |

## Phase 0 / 1 Outputs

- [research.md](./research.md) — decisions on merge semantics, misconception threshold, BKT gate, SM integration
- [data-model.md](./data-model.md) — schema v2 extensions
- [contracts/](./contracts/) — per-block module contracts
- [quickstart.md](./quickstart.md) — QA scenarios per wave
