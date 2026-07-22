# Research: Adaptive Holistic Assessment Wiring

**Feature**: `20260722-adaptive-holistic-wiring`  
**Date**: 2026-07-22  
**Source brief**: `spec-eig.md` Open Questions 1–6 (answered against live code before any implementation)

---

## OQ1 — `buildAdaptiveCoveragePlan` return shape

**Decision**: Use `selectedConceptIds` from the adaptive return object (and/or `plan.adaptiveProbing.selectedConceptIds`).

**Findings** (`src/js/adaptive-probing/assessment-integration.js` L94–188):

When adaptive probing is enabled and selection is non-empty, returns:

```js
{
  plan,           // coverage plan; plan.adaptiveProbing = { selectedConceptIds, vaultSkippedIds, probeGraphMeta }
  graph,
  beliefState,
  selectedConceptIds: orderedIds,  // EIG-ordered concept id strings
  vaultSkippedIds,                 // ids with belief >= HIGH_CONFIDENCE_SKIP_THRESHOLD
}
```

When adaptive is off, or filtered inventory is empty, returns the bare result of `buildAssessmentCoveragePlan(...)` (a plan object, not wrapped).

`resolveHolisticAssessmentContext` already stores `flow.adaptiveProbing.{selectedConceptIds,vaultSkippedIds}` when the wrapped shape is returned.

**Rationale**: Field already exists; resolver maps ids → inventory objects.

**Alternatives considered**: Re-run EIG at call site (rejected — duplicate work; plan already computed).

---

## OQ2 — Where is vault-prior exclusion?

**Decision**: Holistic path does **not** get hard vault-skip “for free” from wiring alone. Resolver must hard-exclude `vaultSkippedIds` (mirror non-holistic).

**Findings**:

| Location | Behavior |
|----------|----------|
| `isProbeCandidate` (`belief-state.js`) | Soft exclude: belief ≥ `HIGH_CONFIDENCE_SKIP_THRESHOLD` → not an EIG candidate |
| `filterInventoryForAdaptiveProbing` | **Hard** exclude: `askedIds = selectedConceptIds.filter(id => !skipSet.has(id))` |
| `buildAdaptiveCoveragePlan` | Collects `vaultSkippedIds` and attaches them to plan/return, but **does not** filter them out of `orderedIds` / `filteredInventory` |
| `selectAdaptiveProbeConcepts` fallback | Can return raw inventory slice (may include vault-high concepts) |

Phase C of `20260711` is implemented primarily on the non-holistic hard-exclude path + profile labeling via `enrichKnowledgeProfileWithAdaptiveStatuses`. Soft EIG skip is shared; hard skip is not on the holistic builder.

**Rationale**: Spec FR-002 requires actual skip before generation. Hard-exclude in `resolveAdaptiveCandidateConcepts` closes the gap without changing EIG math.

**Alternatives considered**: Patch `buildAdaptiveCoveragePlan` to hard-exclude (also valid; slightly broader than minimal wire). Prefer resolver so call-site contract is explicit and matches §3.1.

---

## OQ3 — Duplication: filter vs buildAdaptiveCoveragePlan

**Decision**: Report only; do **not** unify in this feature (out of scope per non-goals).

**Findings**: Two independent implementations of “prepare context → selectAdaptiveProbeConcepts → map ids to inventory”. Shared helpers: `prepareAdaptiveProbingContext`, `collectVaultSkippedConceptIds`, `selectAdaptiveProbeConcepts`. Hard vault filter exists only in `filterInventoryForAdaptiveProbing`.

**Cleanup candidate for `a_implementar`**: Unify selected-set construction so holistic and non-holistic share one hard-exclude path.

---

## OQ4 — `generateHolisticPrePackingAssessmentItems` & denominators

**Decision**: Rename param `conceptInventory` → `conceptsToAssess`. No generation-progress denominator fix required.

**Findings** (`api.js` ~L5535–5614):

- Chunks via `splitInventoryIntoConceptBatches(concepts, ASSESSMENT_BATCH_SIZE)` (≤20).
- `onProgress` reports batch indices (`batchStart–batchEnd/batches.length`), not “concepts assessed / full inventory”.
- Retry uncovered filters against the **passed-in** list (`inventory` local), not a global full inventory.
- Extra kwargs from study.js (`edges`, `docHierarchy`, `conceptGraph`, `plan`) are currently ignored by the function signature.
- **Post-eval** `buildConceptCoverageKnowledgeProfile` / `computeAssessmentCoverage` use whatever inventory `evaluatePrePackingAssessmentResponses` receives (`study.js` still passes full `prePackingFlow.conceptInventory`). That yields document-level `coverage` / `notAssessedCount` — not a generation “X of Y” progress UI (no UI bindings to those fields in `index.html` / study chrome). Leaving as document-level profile stats.

**Rationale**: Passing filtered `conceptsToAssess` automatically scopes generation coverage/retry/logs. No UI “X of Y concepts assessed” progress bar found.

**Alternatives considered**: Re-scope evaluate inventory to `flow.assessedConceptIds` — rejected for this feature; would make document-level coverage always ~100% after a successful subset run.

---

## OQ5 — `enrichKnowledgeProfileWithAdaptiveStatuses` overwrite

**Decision**: Overwrite is reachable today; after pre-generation hard-exclude it should be structurally unreachable for vault ids; add loud guard anyway (FR-007).

**Findings** (L322–385): Vault loop unconditionally sets:

```js
byConceptId[sid] = {
  ...(byConceptId[sid] || { assessed: false }),
  assessed: false,
  assessmentStatus: "presumed_known_vault",
  correct: true,
};
```

If `byConceptId[sid]` already had `assessmentStatus: "tested"` / `assessed: true`, it is overwritten. After §3.1 hard-exclude, vault ids should never enter generation → never get `tested` from answers. Guard: if existing status is `tested`/`assessed` and id ∈ `vaultSkippedIds`, `console.warn` (or throw in tests) and **do not** overwrite — vault-skip must not clobber tested; if both present, prefer preserving tested and warn (invariant violation). Spec §3.3 alternate: “vault-skip status wins” when still reachable — choose **warn + do not overwrite tested** so user-visible answers are never erased; document in Assumptions.

**Revised precedence (this feature)**: If invariant violated, keep `tested`, warn loudly. Correct fix is upstream exclusion, not post-hoc vault stamp winning.

---

## OQ6 — Call sites of `generateHolisticPrePackingAssessmentItems`

**Decision**: Only `study.js` `createPrePackingItemsPromise` (holistic branch). One call site to wire.

**Findings**: Grep hits only `api.js` (definition) and `study.js` (import + call).

---

## Implementation decisions (summary)

| Topic | Choice |
|-------|--------|
| Helper location | `resolveAdaptiveCandidateConcepts` in `assessment-integration.js` (next to builders; easy unit test) |
| Vault hard-exclude | Inside resolver: selected ids minus `vaultSkippedIds` |
| Empty selection | Fall back to full inventory + `console.warn` |
| Flag off | Return full inventory unchanged |
| Enrich guard | Warn + refuse to overwrite `tested`/`assessed` with `presumed_known_vault` |
| SW bump | Required (touches `src/js/**`) |
| Dead non-holistic path | Leave; note duplication for future cleanup |
