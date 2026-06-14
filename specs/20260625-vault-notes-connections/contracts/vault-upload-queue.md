# Contract: Vault Upload Queue

## Storage key

`pith_vault_upload_queue`

## Public API (`vault-upload-queue.js`)

| Function | Behavior |
|----------|----------|
| `loadUploadQueue()` | Parse queue or null |
| `saveUploadQueue(queue)` | Persist |
| `clearUploadQueue()` | Remove key |
| `createUploadQueue(docId, items)` | Build queue from selections |
| `getPendingQueueCount()` | Count pending + error + stale processing |
| `resetStaleProcessingItems()` | processing → pending |
| `processUploadQueue(session, onProgress?)` | Sequential processor; returns when idle |
| `retryQueueItem(conceptId)` | Reset one error item to pending |
| `retryAllQueueErrors()` | Reset all error items |

## Processing step (per item)

1. Mark `processing`
2. Call extended normalize for single concept + batchContext
3. `commitVaultCurationItem(session, mapping, payload)`
4. `applyRelatedBacklinks(entryId, relatedAccepted)`
5. `saveVault`; mark `done` or `error`

## Boot integration (`main.js`)

On load: `resetStaleProcessingItems()` → if pending count > 0, show banner with Resume action calling `processUploadQueue`.
