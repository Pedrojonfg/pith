# Contract: Adaptive Pre-Packing Assessment Activation

## Edge input contract

Raw `conceptGraph.edges[]` endpoints (any one pair sufficient):

```json
{ "source_id": "c1", "target_id": "c2", "type": "prerequisite" }
```

Fallbacks: `{ "from", "to" }`, `{ "sourceId", "targetId" }`.

Normalized probe/coverage edges always emit `{ "from", "to", ... }`.

## Flag contract

| Function | Gates on |
|----------|----------|
| `isPrePackingAssessmentEnabled()` | hardcoded `false` (unchanged) |
| `isSharedPreModeAssessmentEnabled()` | user preference (live) |
| `isAdaptiveProbingEnabled()` | `ADAPTIVE_PROBING_ENABLED && isSharedPreModeAssessmentEnabled()` |
| `isHolisticAssessmentEnabled()` | `HOLISTIC_ASSESSMENT_ENABLED && isSharedPreModeAssessmentEnabled() && isAssessmentQuestionsUiEnabled()` |

## Adaptive generation contract

- Selection/order: `nextProbeBatch` / `selectAdaptiveProbeConcepts` → inventory passed to `generatePrePackingAssessmentItems` / holistic generator.
- LLM calls: no additional mid-quiz generation calls.
- Early stop: when `ADAPTIVE_PROBING_EARLY_STOP` and `computeGraphEntropy(state, remainingIds) < ADAPTIVE_EARLY_STOP_ENTROPY_THRESHOLD`, end runner; profile status `"inferred"` for remaining.

## Knowledge profile assessmentStatus

```ts
type AssessmentStatus = "tested" | "inferred" | "presumed_known_vault";
```

Packing may treat `presumed_known_vault` and high-confidence `inferred` similarly to known for omission, but MUST be able to distinguish them when reading the profile.
