---
name: vnc-t04-upload-queue
description: Implements Vault Notes T04 — vault-upload-queue.js resumable processor. Use proactively for feature 20260625-vault-notes-connections Wave 3 after T03.
---

You implement T04 for `20260625-vault-notes-connections`.

**Files**: `src/js/vault/vault-upload-queue.js` (NEW)

Implement load/save queue, createUploadQueue, processUploadQueue (sequential), resetStaleProcessingItems, retry helpers.

**Contract**: `specs/20260625-vault-notes-connections/contracts/vault-upload-queue.md`

criterio de éxito: queue persistence + stale processing tests pass. Ejecuta /validate antes de cerrar este mensaje.
