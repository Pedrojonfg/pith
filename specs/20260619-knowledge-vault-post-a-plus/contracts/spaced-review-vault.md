# Contract: spaced-review-vault

**Module**: `src/js/vault/spaced-review.js` + `session-store.js`  
**FR**: FR-701–FR-703

## Scheduler hook

```javascript
syncVaultToReviewPool(session) → void
```

Called on mode-select and after session-close.

## Selection rules

Include vault entry when:
- `getCurrentMastery(entry) < 0.5` (partial threshold)
- OR active misconception unresolved

## Priority

```javascript
priority = (0.5 - mastery) * (1 + importanceScore / 10)
```

Higher priority → sooner SM scheduling via existing `smItems` API.

## smItems shape extension

```javascript
{
  id: string,           // sm item id
  vaultEntryId: string, // link back
  conceptTitle: string,
  priority: number,
  source: 'vault_decay'
}
```

## Review completion

On review answer → create `VaultObservation` → `applyObservations` → re-run `syncVaultToReviewPool`

## Prerequisite

SM v1 integration must be stable (no lost items on session switch) before enabling in production.
