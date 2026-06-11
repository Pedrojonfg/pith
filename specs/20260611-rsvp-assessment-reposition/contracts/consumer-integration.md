# Contract: Consumer Integration

**Feature**: `20260611-rsvp-assessment-reposition`

## Prerequisites

- `runConceptInventory` / `packInventoryToBlocks` split (`20260611-rsvp-block-recommend`)
- `state.blockSplitCache` for inventory reuse
- `buildRsvpMaterialGraph` unchanged — always full inventory

## Modified: `generateBlocksForm` submit handler

```text
1. resolveMaterialForGenerate + fingerprint (unchanged)
2. inventory = cache valid ? cache.conceptInventory : await runConceptInventory(...)
3. persist cache; render full graph (all concepts)
4. if !isPrePackingAssessmentEnabled():
     packInventoryToBlocks(inventory, nBlocks, ...) → blocks editor (OLD PATH)
5. NEW PATH:
     prefetch generatePrePackingAssessmentItems(inventory) // non-blocking
     showScreen('prePackingAssessment')
     on skip → pack without profile → blocks editor
     on quiz complete → evaluate → save session._meta.knowledge_profile
     if ASSESSMENT_PARALLEL_PACKING → packingPromise = pack(..., { knowledgeProfile })
     show results (or skip if no mastered)
     on accept → await packingPromise → blocks editor
     on ignore → repack without profile, set packing_ignored_profile
```

## Modified: `session.js`

- Helpers: `setKnowledgeProfile`, `setAssessmentSkipped`, `setPackingIgnoredProfile`
- Persist on `saveActiveSession` / block index write

## Removed / gated: legacy RSVP assessment

When `isPrePackingAssessmentEnabled()`:

- Do not show `assessmentChoiceWrap` after blocks confirmed
- Do not call `generateAssessmentQuestions(blockIndex, ...)`
- Do not call `applyAssessmentResults` for initial RSVP calibration

Gap synthesis from `20260523` tied to legacy flow — gate similarly.

## `addConceptsToShared` (mode continuity)

After inventory, still promote **full** inventory to `shared.conceptInventory` — never filtered.

## Exports / study order

- `blockIndex` length drives RSVP progression
- Dictionary built from full inventory + block chunks

## Files touched (expected)

```
src/js/config/flags.js          NEW
src/js/api.js                   assessment + pack prompt
src/js/session.js               meta helpers, packInventoryToBlocks
src/js/study.js                 flow orchestration, screens
src/js/ui.js                    els refs
index.html                      screens + hide legacy assessment
src/css/main.css                styles
cursor-tests/20260611_rsvp-assessment-reposition.mjs
```
