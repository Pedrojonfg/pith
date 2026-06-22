# Data Model: DPP Recalculation Guard

No schema changes. Uses existing `session.shared`:

| Field | Role in guard |
|-------|----------------|
| `preparation.status` | `ready`/`partial` required for valid; `failed` blocks auto-retry |
| `preparation.failReason` | Cleared on `forceRerun` |
| `conceptInventory` | Length vs `minViableConcepts(charCount)` |
| `docMeta.charCount` | Threshold input |

Guard outcomes: `skip` | `run` | `failed` | `waiting` | `degraded`
