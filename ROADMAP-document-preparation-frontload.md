# ROADMAP — document-preparation-frontload

**Feature:** specs/20260618-document-preparation-frontload | **Spec:** specs/20260618-document-preparation-frontload/spec.md | **Plan:** specs/20260618-document-preparation-frontload/plan.md
**Created:** 2026-06-18

## Dependency diagram

```text
T01 → T02 → T03 → T04 ─┐
              ├→ T05 ─┼→ T07 → T08 → T09 → T10
              └→ T06 ─┘
```

## Waves

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

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Schema v3 + shared prep fields + migration | — | sequential | [x] |
| T02 | DPP orchestrator core (phases, waves, fingerprint) | T01 | sequential | [x] |
| T03 | Tier 0–1 phase runners + vault ingest | T02 | sequential | [x] |
| T04 | Tier 2 Cloze prep integration | T03 | parallel | [x] |
| T05 | Tier 2 Recall prep integration | T03 | parallel | [x] |
| T06 | Tier 2 Slow orientation prep | T03 | parallel | [x] |
| T07 | Upload wiring + progress UI + library badges | T04,T05,T06 | sequential | [x] |
| T08 | Mode entry + RSVP create consumption | T07 | sequential | [x] |
| T09 | Cloze/Recall/Slow consumption paths | T08 | sequential | [x] |
| T10 | Integration tests + SW bump + QA closure | T09 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-06-18 (none created — sequential execution)

## Prompt per task

### T01 — Schema v3 + migration
**Spec ref:** Key Entities, FR-002 | **Plan ref:** data-model.md | **Files:** session-types.js, session-store.js
**Success criterion:** schemaVersion 3; shared.preparation, conceptGraph, blockRecommendation, slowOrientation validated; legacy migration on load
**On close:** `/validate` and mark `[x]`.

### T02 — DPP orchestrator core
**Spec ref:** FR-001–005, Pipeline Contract | **Plan ref:** contracts/dpp-orchestrator.md | **Files:** src/js/document-preparation.js
**Success criterion:** computePreparationFingerprint, wave scheduler, idempotent phase skip, runDocumentPreparationPipeline shell
**On close:** `/validate` and mark `[x]`.

### T03 — Tier 0–1 runners
**Spec ref:** FR-010–015, Tier 1 table | **Plan ref:** research R4–R6 | **Files:** document-preparation.js, session.js
**Success criterion:** T0.1–T1.6 phases wired; blockRecommendation + vault gray ingest; runIngestOnlyPipeline uses stopAfterTier:1
**On close:** `/validate` and mark `[x]`.

### T04 — Tier 2 Cloze
**Spec ref:** FR-021, FR-032 | **Files:** document-preparation.js, cloze/pipeline.js, study.js
**Success criterion:** Cloze phases 1–4 at prep; modes.cloze pipelineStatus ready; shared.conceptGraph canonical
**On close:** `/validate` and mark `[x]`.

### T05 — Tier 2 Recall
**Spec ref:** FR-022, FR-033 | **Files:** document-preparation.js, study.js, recall API
**Success criterion:** modes.recall slice prep-ready from inventory + pedagogical meta
**On close:** `/validate` and mark `[x]`.

### T06 — Tier 2 Slow orientation
**Spec ref:** FR-023, FR-034 | **Files:** document-preparation.js, slow/phase0.js
**Success criterion:** shared.slowOrientation stored for full doc; syncPhase0ConceptsToShared
**On close:** `/validate` and mark `[x]`.

### T07 — Upload + UI
**Spec ref:** FR-040, FR-042, US1 | **Files:** study.js, index.html, main.css, project-library.js
**Success criterion:** Auto DPP after upload; progress UI; library badges Preparing/Ready/Partial
**On close:** `/validate` and mark `[x]`.

### T08 — Mode entry + RSVP
**Spec ref:** FR-026–031, FR-041, US2 | **Files:** mode-bootstrap.js, study.js, index.html
**Success criterion:** resolveModeEntryState prep-aware; RSVP pre-fill N; generate skips inventory; hide Recommend when prep ready
**On close:** `/validate` and mark `[x]`.

### T09 — Cloze/Recall/Slow consumption
**Spec ref:** FR-032–034, US3–4 | **Files:** study.js, cloze/pipeline.js, slow/phase0.js
**Success criterion:** No duplicate LLM on mode open when prep artifacts exist
**On close:** `/validate` and mark `[x]`.

### T10 — QA closure
**Spec ref:** SC-001–005, quickstart.md> **Files:** cursor-tests/, sw-update.js, index.html, sw.js, ROADMAP marks
**Success criterion:** Integration test green; SW_VERSION bumped
**On close:** `/validate` and mark `[x]`.
