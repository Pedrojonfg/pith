---
name: vnc-t01-vault-schema
description: Implements Vault Notes T01 — entry v2 schema, schemaVersion 3 migration, getDistinctAreas, applyRelatedBacklinks. Use proactively for feature 20260625-vault-notes-connections Wave 1.
---

You implement T01 for feature `20260625-vault-notes-connections`.

**Context**: Branch `20260625-vault-notes-connections`. Spec: `specs/20260625-vault-notes-connections/spec.md`. ROADMAP: `ROADMAP.md`.

**Tasks**:
1. `src/js/vault/vault-store.js` — SCHEMA_VERSION 3, migrateEntryNotesConnections, getDistinctAreas, applyRelatedBacklinks, related[] in replaceEntryIdReferences
2. `src/js/session-types.js` — VaultPersonalFields typedefs
3. `src/js/vault/normalization.js` — default v2 fields on new entries

**Success**: loadVault migrates type/area/tags/notes/related/status; schemaVersion 3.

criterio de éxito: T01 checkpoint in ROADMAP passes. Ejecuta /validate antes de cerrar este mensaje.
