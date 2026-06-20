# Research: RSVP Shared Consumption

## Root cause

`study.js` gates inventory reuse on `isBlockSplitCacheValid(fingerprint)` which includes `studyNotes`. After prep, `shared.conceptInventory` exists but fingerprint mismatch (notes, bootstrap file stub) triggers `runConceptInventoryWithFallback` in both `handleRecommendBlockCount` and `generateBlocksForm` submit.

## Decision

When `isTier1PreparationComplete(doc)`, bypass fingerprint for inventory source; seed block-split cache from shared for pack only. Study notes affect pack LLM prompts, not inventory identity.

## References

- `specs/20260618-document-preparation-frontload/contracts/mode-consumption.md`
- `applySharedBlockRecommendationToUi` already seeds cache but submit path ignores shared when cache invalid.
