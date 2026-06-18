# Research — Document Preparation Front-Load

**Date**: 2026-06-18

## R1: Orchestrator placement

**Decision**: New module `src/js/document-preparation.js` with pure phase registry + async `runDocumentPreparationPipeline(doc, options)`.

**Rationale**: Keeps `study.js` as wiring only; mirrors `runConceptInventoryWithFallback` and cloze pipeline patterns; testable without DOM.

**Alternatives considered**:
- Inline in `study.js` — rejected (orchestrator >500 lines).
- Service worker batch — rejected (LLM needs main thread API key).

## R2: Canonical epistemic graph storage

**Decision**: `shared.conceptGraph` is canonical; dual-write to `modes.cloze.epistemicGraph` on prep for backward compat; migration copies legacy cloze graph → shared.

**Rationale**: Spec FR-012; Cloze pipeline already reads `epistemicGraph` on slice — adapter layer maps shared → slice on bootstrap.

**Alternatives considered**:
- Keep cloze-only storage — rejected (Recall/Slow/vault need shared access).

## R3: Preparation status model

**Decision**: `shared.preparation.status`: `pending` | `running` | `ready` | `partial` | `failed` | `legacy`. Tier 1 complete ⇒ at least `partial`; all Tier 2 done ⇒ `ready`.

**Rationale**: Spec FR-050/FR-051; progressive readiness (Open Q3 default: yes).

**Alternatives considered**:
- Binary ready/not — rejected (partial failure UX).

## R4: Fingerprint / idempotency

**Decision**: Fingerprint = hash of `rawMarkdown` + `studyNotes` + `pipelineLevers` snapshot (same inputs as block-split cache). Phase skip when `phaseResults[phaseId].outputHash` matches expected for current fingerprint.

**Rationale**: Spec FR-003; aligns with `blockSplitCache` invalidation on study focus notes change.

## R5: Parallel wave execution

**Decision**: `Promise.allSettled` per wave; failed phase recorded in `preparation.errors`; dependents skip unless retry. Wave 1: T1.1∥T0.2; T1.3 after T0.1 (parallel T1.2); Wave 2: T2.1∥T2.2∥T2.3 after Tier 1 gate.

**Rationale**: Spec Pipeline Contract; minimizes wall-clock without mega-prompt.

## R6: Ingest-only subset

**Decision**: `runIngestOnlyPipeline` calls DPP with `{ stopAfterTier: 1 }` instead of separate inventory path.

**Rationale**: Spec cross-doc §10; single shape.

## R7: RSVP Recommend button

**Decision**: Hide/disable Recommend when `shared.blockRecommendation` exists and prep ≥ partial; keep manual edit of N.

**Rationale**: Spec FR-041; extends rsvp-block-recommend.

## R8: Schema version

**Decision**: Bump `DocumentSession.schemaVersion` to 3 with migration: backfill `preparation.status = 'legacy'`, copy `cloze.epistemicGraph` → `shared.conceptGraph`.

**Rationale**: Spec Key Entities; non-destructive migration.
