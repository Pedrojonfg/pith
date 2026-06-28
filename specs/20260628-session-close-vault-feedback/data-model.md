# Data Model: Session Close Vault Feedback

## SessionVaultSummary (computed, not persisted)

| Field | Type | Description |
|-------|------|-------------|
| addedCount | number | Concepts newly linked to vault this visit |
| reinforcedCount | number | Existing vault concepts with positive signals |
| addedNames | string[] | Display titles for added concepts |

## Inputs

- Vault entries: `sources[].{docId, conceptId, addedAt}`, `observations[]`
- Session: `shared.conceptInventory`, `shared.assessmentSignals`, `shared._vaultPendingObservations`
- Mode slices: `_responses.blocks[].questions[].answered_at`

## Positive signal types

`mcq_correct`, `socratic_passed`, `assessment_mastered`, `cloze_correct`, `recall_strong`, `recall_adequate`, `review_correct`, `vault_added`, `vault_promoted`
