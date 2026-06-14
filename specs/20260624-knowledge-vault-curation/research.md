# Research: Knowledge Vault Curation

**Feature**: `20260624-knowledge-vault-curation`

## R1: Vault schema version vs existing v2

**Decision**: Extend existing `schemaVersion: 2` in `vault-store.js` with `reviewItems[]` at vault root and per-entry `definitions[]`, `facetCoverage{}` via `migrateEntryCuration()` on load — no bump to v3.

**Rationale**: Codebase already migrated A+ entries to v2 with post-A+ fields. Spec's "1→2" intent is satisfied by additive fields on current v2; separate version bump would force redundant migration paths.

**Alternatives considered**: New schemaVersion 3 — rejected as unnecessary churn for additive-only changes.

## R2: App entry routing

**Decision**: `main.js` bootstrap calls `enterAppHome()` when API key present (replacing direct `enterModeSelectScreen()`). `enterModeSelectScreen()` only from library document open or mid-session back navigation with active doc.

**Rationale**: Matches spec superseding study-projects §7.3 home hub on modeSelect.

**Alternatives considered**: Keep modeSelect as home with hidden hub — rejected; spec requires explicit bifurcation.

## R3: Dual review pool item shape

**Decision**: Normalize vault `VaultReviewItem` to sm2-compatible queue items with `source: 'vault'`, `sourceType: 'vault_review_item'`, mapping `prompt`→title, `answer`→contentPreview; keep vault item id for SM-2 updates on vault.reviewItems array.

**Rationale**: Reuses existing SM-2 review UI with minimal DOM changes; `handleSm2QualityClick` branches on `source`.

**Alternatives considered**: Separate review UI for vault items — rejected as scope creep.

## R4: Quality → observation mapping for vault review

**Decision**: Map SM-2 quality buttons: ≥4 → review_correct, 3 → review_partial, <3 → review_wrong (aligned with Recall tutor quality bands).

**Rationale**: Spec defines observation types by outcome; SM-2 UI uses 0–5 quality — need bridge consistent with existing `mapMcqOutcomeToQuality` patterns.

**Alternatives considered**: Binary correct/wrong only — rejected; partial signal (+0.3) is spec requirement.

## R5: extractVaultCandidates LLM placement

**Decision**: New `extractVaultCandidates()` in `api.js` following `normalizeConceptsToVault` JSON prompt style; `vault-curation.js` orchestrates chunk lookup from session aligned chunks.

**Rationale**: All LLM calls live in api.js per project convention.

**Alternatives considered**: Separate recall-api.js — rejected; not recall-session specific.

## R6: Decay calibration log

**Decision**: New `decay-calibration.js` with `appendDecayCalibrationLog(entry)` capped at 1000 FIFO in `localStorage['mylearning_decay_calibration_log']`.

**Rationale**: Spec §5.4 instrumentation; isolated module keeps mastery-model pure.

**Alternatives considered**: Inline in review handler — rejected for testability.
