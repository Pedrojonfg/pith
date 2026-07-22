# Data Model: Adaptive Holistic Assessment Wiring

No new persisted entities. In-memory / session fields already present; this feature consumes them correctly.

## Entities (existing)

### Adaptive probing slice (`flow.adaptiveProbing`)

| Field | Type | Notes |
|-------|------|-------|
| `graph` | probe graph | unchanged |
| `beliefState` | `Record<id, BeliefEntry>` | unchanged |
| `selectedConceptIds` | `string[]` | EIG-ordered; may still include vault ids until resolver hard-excludes |
| `vaultSkippedIds` | `string[]` | belief ≥ HIGH_CONFIDENCE_SKIP_THRESHOLD |

### Coverage plan (`flow.coveragePlan` / `ctx.plan`)

| Field | Type | Notes |
|-------|------|-------|
| `adaptiveProbing.selectedConceptIds` | `string[]` | same as above when adaptive built the plan |
| `adaptiveProbing.vaultSkippedIds` | `string[]` | labeling + hard-exclude input |

### New ephemeral field

| Field | Type | Notes |
|-------|------|-------|
| `flow.assessedConceptIds` | `string[]` | ids actually passed to the generator (post-resolve) |

### Knowledge profile statuses

| Status | Meaning |
|--------|---------|
| `tested` | Asked and answered |
| `inferred` | Early-stop / unasked selected with belief carry-forward |
| `presumed_known_vault` | Vault-high prior; must not have been asked |

## Validation rules

1. `resolveAdaptiveCandidateConcepts` never returns `[]` when inventory is non-empty.
2. No id in `vaultSkippedIds` may appear in `conceptsToAssess` when adaptive probing is on and selection was non-empty.
3. Enrichment must not change an entry with `assessmentStatus === "tested"` (or `assessed === true` with tested semantics) to `presumed_known_vault` without a warning (guard refuses overwrite).
