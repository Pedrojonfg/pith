# Data Model: Adaptive Pre-Packing Assessment Activation

## ProbeEdge (normalized internal)

| Field | Type | Notes |
|-------|------|-------|
| from | string | Prerequisite concept id (normalized) |
| to | string | Dependent concept id |
| weight | number | Default 1 |

### Input acceptance (raw conceptGraph edge)

Accepted endpoint fields, in preference order:
1. `source_id` / `target_id` (DPP / cloze canonical)
2. `from` / `to` (legacy fixtures)
3. `sourceId` / `targetId` (camelCase fallback)

## BeliefState entry

Unchanged: `{ belief, lastUpdated, source, triggeredBy? }` with `source ∈ { prior, probe, propagated }`.

## Assessment status (additive)

On knowledge profile `byConceptId[id]` and mirrored on `items[]` when present:

| assessmentStatus | Meaning |
|------------------|---------|
| `tested` | User answered a question for this concept |
| `inferred` | Unasked; belief carried from early-stop / propagation |
| `presumed_known_vault` | Excluded from questions due to high vault/registry prior |

Mastery/confidence remain the packing inputs; status is metadata.

## Flag constants (adaptive)

| Constant | Role | Placeholder note |
|----------|------|------------------|
| `ADAPTIVE_PROBING_ENABLED` | Master | existing |
| `HIGH_CONFIDENCE_SKIP_THRESHOLD` | Vault hard-skip | retune to 0.80 unvalidated |
| `ADAPTIVE_PROBING_EARLY_STOP` | Enable early stop | wire reader |
| `ADAPTIVE_EARLY_STOP_ENTROPY_THRESHOLD` | Aggregate entropy cutoff | **new** unvalidated placeholder |

## Validation rules

- Dual-field parse must not invent edges when both endpoint pairs are empty.
- Profile must include vault-skipped and inferred concepts even when `assessed` is false for quiz purposes (downstream may treat `presumed_known_vault` / `inferred` as known for packing).
