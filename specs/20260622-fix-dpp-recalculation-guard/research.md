# Research: Fix DPP Recalculation Guard

## Decision: Centralize guard in session.js

**Rationale**: Three call sites share identical rules (valid / failed / running / degraded). Single `evaluateConceptInventoryGuard` avoids drift.

**Alternatives**: Per-file duplicate checks — rejected (R8 audit burden).

## Decision: Keep startDocumentPreparation in study.js

**Finding**: `startDocumentPreparation` is exported from `study.js` (line ~432), not `document-preparation.js`. `forceRerun` wires through study → `runDocumentPreparationPipeline`.

## Decision: resolveRsvpInventoryForPack unchanged

**Rationale**: Guard in study.js checks `isConceptInventoryValid` before falling through to `runConceptInventoryWithFallback` / `twoPhaseConceptSplit`. Avoids widening `isTier1PreparationComplete` semantics.

## Decision: Retry UI on mode select + generate blocks only

Per spec non-goals; reuse `generateBlocksError` pattern for generate screen; new banner on `screenModeSelect`.
