# Implementation Plan: Exposure / Retrieval Architecture & Retrieval Hub

**Branch**: `20260622-exposure-retrieval-hub` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260622-exposure-retrieval-hub/spec.md`

## Summary

Formalize **exposure vs retrieval** mode taxonomy; add **`screenRetrievalHub`** as the neutral post-exposure and per-document practice entry; generalize **`assessmentSignals`** prioritization to Questions (and confirm Recall); reposition **Review** as vault-level SM-2 queue via `getSmItemsDueToday()` cross-session aggregation. RSVP embedded block test/socratic flow unchanged.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: `session-types.js`, `mode-bootstrap.js`, `study.js`, `ui.js`, `review.js`, `session-store.js`, `assessment-signals.js`, `cloze/study.js`, `recall-study.js`, `index.html`, `main.css`

**Storage**: `localStorage` DocumentSession V2 — `shared.smItems`, `shared.assessmentSignals`; no mandatory `schemaVersion` bump if legacy `modes.review` kept empty

**Testing**: `cursor-tests/20260622_exposure-retrieval-hub.mjs`

**Target Platform**: SPA offline-first PWA (Chrome/Firefox desktop)

**Project Type**: Web application — 1 new pure taxonomy module + hub screen + navigation rewiring

**Performance Goals**: Hub render < 50ms; vault Review queue build < 100ms for ≤50 documents

**Constraints**: Hub neutral (no recommender badges); Cloze no pre-generate UI on hub; backward-compatible sessions; bump `SW_VERSION` on JS/CSS/HTML changes

**Scale/Scope**: 10 tasks (T01–T10), ~12 source files touched

**External prerequisites** (already in repo):
- `20260612-mode-continuity` — `assessmentSignals`, `enterModeWithContinuity`
- `20260620-sm2-priority-queue` — `shared.smItems`, `getSmItemsDueToday`
- `20260621-recall-mode` — Recall slice + study orchestration
- `getSmItemsDueToday(docId?)` already aggregates all sessions when `docId` omitted — vault Review builds on this

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Library-first / pure functions | PASS | `mode-taxonomy.js` pure; hub option list derived from taxonomy |
| Testability | PASS | T01/T05/T06 unit + T10 integration |
| Simplicity (YAGNI) | PASS | Reuse existing mode entry; no new LLM calls; hub is navigation only |
| Integration tests | PASS | T10 cross-mode handoff + vault Review smoke |
| Backward compatibility | PASS | Legacy empty `modes.review`; shared shapes unchanged |

**Post-design re-check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260622-exposure-retrieval-hub/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── mode-taxonomy.md
│   ├── retrieval-hub-ui.md
│   ├── hub-navigation.md
│   ├── vault-review.md
│   └── assessment-signals-consumers.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/
├── mode-taxonomy.js            # NEW — MODE_TAXONOMY, getDocumentRetrievalModes()
├── session-types.js            # import taxonomy; review out of MODE_KEYS (already)
├── study.js                    # hub enter/exit; exposure end → hub; library entry
├── ui.js                       # els.screenRetrievalHub; showScreen branch
├── review.js                   # runVaultSm2ReviewSession(); cross-doc write path
├── session-store.js            # upsertSmItem by docId; vault badge helper
├── assessment-signals.js       # (existing) prioritizeByAssessmentSignals
├── questions study paths       # block order prioritization via signals
├── cloze/study.js              # (existing consumer — verify hub path)
└── recall-study.js             # (existing consumer — verify hub path)

index.html                      # screenRetrievalHub section; vault Review on doc library
src/css/main.css                # hub card layout
cursor-tests/
└── 20260622_exposure-retrieval-hub.mjs
```

**Structure Decision**: Pure taxonomy module colocated with `mode-bootstrap.js`; hub orchestration in `study.js` following `enterModeWithContinuity` pattern.

## Complexity Tracking

> No violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Task Graph (Método Pedro)

```text
T01 ──→ T03 ──→ T04 ──→ T07
  │       ↑
T02 ──────┘
T01 ──→ T05
T01 ──→ T06 ──→ T08 ──→ T09
T01–T09 ──→ T10
```

**Parallel Wave 1**: T01 + T02  
**Parallel Wave 2**: T03 + T05 + T06  
**Parallel Wave 3**: T04 + T07 + T08  
**Sequential**: T09 after T08; T10 after all

See `ROADMAP.md` for executable prompts.
