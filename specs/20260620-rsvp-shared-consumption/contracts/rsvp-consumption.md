# Contract: RSVP Shared Consumption

## resolvePreparedRsvpInventory(doc)

- Returns `doc.shared.conceptInventory` when `isTier1PreparationComplete(doc)` and array non-empty.
- Otherwise `null`.

## resolveRsvpInventoryForPack(doc, fingerprint)

Priority:
1. `resolvePreparedRsvpInventory(doc)` — seeds `setBlockSplitCache` with fingerprint
2. Valid `getBlockSplitCache()` for fingerprint
3. `null` → caller runs legacy LLM inventory

## Block recommendation

When Tier 1 complete: `applySharedBlockRecommendationToUi` only; no `handleRecommendBlockCount` LLM.

## Assessment UI

`#rsvpAssessmentOption.hidden === false` when mode is `rsvp`, online, `isPrePackingAssessmentEnabled()`, and `materialBootstrapActive`.

## Generate (prepared doc)

- Assessment off: `packInventoryToBlocks(sharedInventory, nBlocks, ...)`
- Assessment on: shared inventory + assessment items LLM only
- Never `runConceptInventoryWithFallback` / `twoPhaseConceptSplit` for inventory when prepared
