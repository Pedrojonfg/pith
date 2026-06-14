---
name: kvc-t03-upload-flow
description: Implements Knowledge Vault Curation T03 — vault-curation.js, extractVaultCandidates API, candidate screen. Use proactively for feature 20260624-knowledge-vault-curation Wave 2 parallel with T02.
---

You implement T03 for feature `20260624-knowledge-vault-curation`.

**Context**: Contracts: `vault-curation-api.md`, `extract-vault-candidates-api.md`.

**Tasks**:
1. `src/js/vault/vault-curation.js` — NEW: `getStudiedConcepts`, `hasDefinitionFromDoc`, `commitVaultCuration`, `mapQualityToReviewObservation`
2. `src/js/api.js` — `extractVaultCandidates({ concepts, session, vault })` batch LLM JSON
3. `index.html` — `screenUploadToVaultCandidates` markup (concept list, definition textarea, review item cards with facet badges, Add selected/Cancel)
4. `src/js/study.js` — `enterUploadToVaultCandidates`, loading/error/retry, commit handler, wire `#btnUploadToVault`
5. `src/js/ui.js` — `renderVaultCandidateList`, facet badge helper using FACET_LABELS

**Defaults**: definitions checked if no prior def from docId; review items unchecked.

**Success**: Upload flow extracts, edits, commits definitions and review items idempotently.

criterio de éxito: T03 checkpoint in ROADMAP passes. Ejecuta /validate antes de cerrar este mensaje.
