# Contract: Adaptive → Holistic wiring

## `resolveAdaptiveCandidateConcepts(inventory, plan, options?)`

**Module**: `src/js/adaptive-probing/assessment-integration.js`

### Inputs

- `inventory`: `object[]` — full document concept inventory
- `plan`: coverage plan object (may include `plan.adaptiveProbing`)
- `options` (optional):
  - `selectedConceptIds?: string[]` — override (e.g. from `flow.adaptiveProbing`)
  - `vaultSkippedIds?: string[]` — override
  - `adaptiveEnabled?: boolean` — default `isAdaptiveProbingEnabled()`

### Output

`object[]` — concept objects from inventory, EIG order when selected; never empty if inventory non-empty.

### Rules

1. If adaptive disabled → return `inventory` as-is (same array reference acceptable).
2. Resolve id list from `options.selectedConceptIds` ?? `plan?.adaptiveProbing?.selectedConceptIds` ?? `[]`.
3. Resolve skips from `options.vaultSkippedIds` ?? `plan?.adaptiveProbing?.vaultSkippedIds` ?? `[]`.
4. Filter selected ids: drop any in skip set; map remaining ids to inventory entries (preserve order; skip missing ids).
5. If resulting list empty and inventory non-empty → `console.warn` and return full inventory.

## `generateHolisticPrePackingAssessmentItems`

### Parameter rename

- **Was**: `conceptInventory`
- **Now**: `conceptsToAssess`
- **JSDoc**: Must be the pre-filtered candidate set (adaptive / vault-skip applied upstream), NOT the full document inventory.

### Call site (`study.js`)

```js
const candidateConcepts = resolveAdaptiveCandidateConcepts(flow.conceptInventory, ctx.plan, {
  selectedConceptIds: flow.adaptiveProbing?.selectedConceptIds,
  vaultSkippedIds: flow.adaptiveProbing?.vaultSkippedIds,
});
flow.assessedConceptIds = candidateConcepts.map((c) => getConceptId(c)).filter(Boolean);
return generateHolisticPrePackingAssessmentItems({
  conceptsToAssess: candidateConcepts,
  materialText: flow.cleanedText,
  // ...
});
```

## `enrichKnowledgeProfileWithAdaptiveStatuses` guard

Before writing `presumed_known_vault` for id `sid`:

- If existing `byConceptId[sid].assessmentStatus === "tested"` OR (`assessed === true` and status is tested-equivalent): `console.warn` invariant violation; **do not overwrite**.
- Else: set `presumed_known_vault` as today.
