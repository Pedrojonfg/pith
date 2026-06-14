---
name: kvc-t04-review-dual-pool
description: Implements Knowledge Vault Curation T04 — dual review pool merge and vault item SM-2 routing. Use proactively for feature 20260624-knowledge-vault-curation Wave 3 parallel with T05.
---

You implement T04 for feature `20260624-knowledge-vault-curation`.

**Context**: Contract: `specs/20260624-knowledge-vault-curation/contracts/review-dual-pool.md`.

**Tasks**:
1. `src/js/review-project-scope.js` — merge vault.reviewItems with smItems; `normalizeVaultReviewItemForQueue`; filter by project scope
2. `src/js/review.js` — `handleSm2QualityClick` branches on `source==='vault'`; update vault item SM-2; call `applyVaultReviewItemObservation` with facet; show facet in `renderSm2ReviewItem`
3. `src/js/vault/vault-curation.js` — `applyVaultReviewItemObservation` uses mastery update + decay calibration log
4. `src/js/session-store.js` — `getVaultReviewDueCount` includes due vault reviewItems

**SM-2 mapping**: quality ≥4 → review_correct; 3 → review_partial; <3 → review_wrong.

**Success**: Scoped review shows vault items; answering updates mastery, facetCoverage, item sm2.

criterio de éxito: T04 checkpoint in ROADMAP passes. Ejecuta /validate antes de cerrar este mensaje.
