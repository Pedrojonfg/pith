---
name: vnc-t03-commit-backlinks
description: Implements Vault Notes T03 — commitVaultCurationItem, notes append merge, resolveRelatedAcceptedIds, buildBatchContext. Use proactively for feature 20260625-vault-notes-connections Wave 2 parallel with T02.
---

You implement T03 for `20260625-vault-notes-connections`.

**Files**: `src/js/vault/vault-curation.js`

Add commitVaultCurationItem, mergeNotesForEntry, applyPersonalFieldsToEntry, resolveRelatedAcceptedIds, buildBatchContext, getSiblingRelatedCandidates.

Ensure merge saves vault after mergeNormalizationResult.

criterio de éxito: backlink symmetry + notes append tests pass. Ejecuta /validate antes de cerrar este mensaje.
