---
name: kvc-t01-vault-schema
description: Implements Knowledge Vault Curation T01 — vault types, schema migration, decay calibration, mastery weights. Use proactively for feature 20260624-knowledge-vault-curation Wave 1.
---

You implement T01 for feature `20260624-knowledge-vault-curation`.

**Context**: Branch `20260624-knowledge-vault-curation`. Spec: `specs/20260624-knowledge-vault-curation/spec.md`. Plan: `specs/20260624-knowledge-vault-curation/plan.md`. ROADMAP: `ROADMAP.md`.

**Tasks**:
1. `src/js/session-types.js` — add `CONCEPT_FACETS`, `FACET_LABELS` typedefs for ConceptFacet, VaultDefinition, VaultReviewItem
2. `src/js/vault/decay-calibration.js` — NEW: `appendDecayCalibrationLog`, FIFO cap 1000, key `mylearning_decay_calibration_log`
3. `src/js/vault/vault-store.js` — `migrateEntryCuration`, `reviewItems` on load/save, `upsertReviewItem`, `updateVaultReviewItemSm2`, `getVaultReviewItems`
4. `src/js/vault/mastery-model.js` — add `review_correct`, `review_partial`, `review_wrong` to OBSERVATION_WEIGHTS; store `facet` on observation; update `facetCoverage` in `updateMastery`
5. `src/js/sm2.js` — add `vault_review_item` to SOURCE_TYPES and LEGACY_SOURCE_MAP

**Success**: Migration adds empty definitions/facetCoverage/reviewItems; review weights work; sm2 normalizes vault_review_item.

criterio de éxito: T01 checkpoint in ROADMAP passes. Ejecuta /validate antes de cerrar este mensaje.
