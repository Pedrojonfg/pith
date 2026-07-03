# Implementation Plan: Shared Pre-Mode Assessment

**Spec:** [spec.md](./spec.md) | **Date:** 2026-07-02

## Summary

Relocate pre-packing assessment from RSVP create to a shared opt-in gate between Tier 1 DPP and mode select. Persist `shared.knowledgeProfile`, recompute T1.5 recommendation with profile, remove RSVP-embedded path.

## Technical Context

**Modules:** `knowledge-profile-shared.js` (new), `document-preparation.js`, `study.js`, `recommender.js`, `session-types.js`, `session.js`, `flags.js`, `index.html`

**Testing:** `cursor-tests/20260702_shared-pre-mode-assessment.mjs`

## Implementation

### 1. Schema (`session-types.js`, `knowledge-profile-shared.js`)

- `shared.knowledgeProfile`, `shared.assessmentGate`
- `hasTier1GateArtifacts` (inventory + blockRec, no modeRec)
- Profile normalize / pack bridge / redo reset

### 2. DPP scheduling (`document-preparation.js`)

- Remove T1.5 from gate phases
- Export `runModeRecommendationPhase(doc, ctx, { knowledgeProfile })`

### 3. Gate flow (`study.js`, `index.html`)

- `screenAssessmentGate` opt-in UI
- Wire `enterModeSelectAfterTier1Gate` → gate → assessment → T1.5 → mode select
- Interview + flag guards

### 4. Recommender (`recommender.js`)

- Optional `knowledgeProfile` adjusts primary/quick mode ordering when high mastery ratio

### 5. RSVP cleanup (`study.js`)

- Remove `shouldRunPrePackingAssessment` from generate blocks
- `packInventoryToBlocks` reads profile from `shared.knowledgeProfile`

### 6. Redo + SW bump

- Mode select redo button + reset table
- SW_VERSION / CACHE_NAME / `?v=` imports
