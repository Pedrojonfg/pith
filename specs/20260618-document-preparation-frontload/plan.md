# Implementation Plan: Document Preparation Front-Load

**Branch**: `20260618-document-preparation-frontload` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

## Summary

Run all reusable LLM work once at upload into `DocumentSession.shared` via a **Document Preparation Pipeline (DPP)** with resumable tiered phases and parallel waves. Mode entry consumes cached artifacts — RSVP shows recommended block count immediately; Cloze/Recall open pre-generated; Slow uses shared hierarchy and orientation. Tier 3 (pack, assessment, per-block gen) stays inside modes.

## Technical Context

**Language/Version**: JavaScript ES modules (browser PWA + Node cursor-tests)

**Primary Dependencies**: `session-store.js`, `session.js`, `study.js`, `mode-bootstrap.js`, `document-preparation.js` (new), `cloze/pipeline.js`, `slow/phase0.js`, recall API, `recommendation/block-count-recommender.js`, vault import/registry

**Storage**: localStorage DocumentSession schemaVersion 3 — `shared.preparation`, `shared.conceptGraph`, `shared.blockRecommendation`, `shared.slowOrientation`

**Testing**: `cursor-tests/20260618_document-preparation-frontload.mjs`

**Target Platform**: Browser PWA offline-capable

**Performance Goals**: Mode entry ≤500ms local work after `ready` (NFR-001); parallel Tier 2 waves

**Constraints**: PWA SW_VERSION bump on src changes; no mega-prompt; no duplicate inventory on mode hops

**Scale/Scope**: 10 tasks (T01–T10), ~12 source files

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Testability | PASS | Pure orchestrator + integration tests |
| Simplicity | PASS | Reuses existing LLM call shapes |
| Backward compat | PASS | `legacy` status + migration |
| PWA versioning | PASS | T10 SW bump |

**Post-design re-check**: PASS

## Project Structure

### Documentation

```text
specs/20260618-document-preparation-frontload/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
└── contracts/
    ├── dpp-orchestrator.md
    └── mode-consumption.md
```

### Source Code

```text
src/js/
├── document-preparation.js    # NEW — DPP orchestrator
├── session-types.js           # schema v3, validation
├── session-store.js           # migration, normalize on read
├── mode-bootstrap.js          # prep-aware entry state
├── study.js                   # upload wiring, RSVP/Cloze/Recall/Slow consumption
├── cloze/pipeline.js          # shared graph projection
├── project-library.js         # preparation badges
index.html                     # prep progress UI
src/css/main.css               # badge styles
cursor-tests/20260618_document-preparation-frontload.mjs
```

**Structure Decision**: Single orchestrator module; study.js wiring only.

## Task Graph

```text
T01 ──► T02 ──► T03 ──► ┌ T04 ─┐
                          │ T05 ─┼──► T07 ──► T08 ──► T09 ──► T10
                          └ T06 ─┘
```

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04, T05, T06 | parallel |
| 5 | T07 | sequential |
| 6 | T08 | sequential |
| 7 | T09 | sequential |
| 8 | T10 | sequential |

## Complexity Tracking

No violations requiring justification.
