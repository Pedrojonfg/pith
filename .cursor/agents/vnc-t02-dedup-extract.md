---
name: vnc-t02-dedup-extract
description: Implements Vault Notes T02 — extended normalizeConceptsToVault and extractVaultCandidates with notes/area/tags/related. Use proactively for feature 20260625-vault-notes-connections Wave 2 parallel with T03.
---

You implement T02 for `20260625-vault-notes-connections`.

**Files**: `src/js/api.js`

Extend:
- `normalizeConceptsToVault` — batchContext, areaSuggestion, relatedCandidates per mapping
- `extractVaultCandidates` — notes, area, tags; autoDraftNotes flag

**Contracts**: `specs/20260625-vault-notes-connections/contracts/dedup-related-api.md`

criterio de éxito: JSON response shapes match contract. Ejecuta /validate antes de cerrar este mensaje.
