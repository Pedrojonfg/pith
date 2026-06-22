# Contract: DPP inventory guard

## `isConceptInventoryValid(session): boolean`

True when:
- `preparation.status` is `ready` or `partial`
- `conceptInventory` is non-empty array
- `inventory.length >= max(MIN_CONCEPTS_ABSOLUTE, floor(charCount / MIN_CHARS_PER_CONCEPT))`

## `evaluateConceptInventoryGuard(session, { forceRerun? })`

Returns `{ decision: 'skip'|'run'|'failed'|'waiting'|'degraded' }` with mandatory `[DPP-GUARD]` log.

## `startDocumentPreparation(doc, { forceRerun?: true, ... })`

When `forceRerun`: set `preparation.status = 'pending'`, `failReason = null`, save, then run pipeline bypassing valid-inventory skip.
