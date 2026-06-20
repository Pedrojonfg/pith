# Deep Dive: RSVP Shared Consumption Hardening

## 1. What we built

After document preparation (Tier 1), RSVP create now consumes `shared.conceptInventory` and `shared.blockRecommendation` instead of re-running concept inventory LLM calls. Block count appears instantly on bootstrap entry; Generate blocks runs pack and optional pre-packing assessment only. Legacy sessions without Tier 1 artifacts still use the old inventory path.

## 2. Design decisions

**Shared inventory bypasses fingerprint cache**
- Chosen: `resolveRsvpInventoryForPack` uses `isTier1PreparationComplete` and ignores block-split fingerprint (which included study notes).
- Alternative: Invalidate shared when study notes change and re-inventory — rejected per front-load contract (“never re-inventor” when prepared).
- Trade-off: Pack prompts still receive study notes; inventory identity stays stable.

**Pure helpers in `session-types.js` + thin `rsvp-shared-consumption.js`**
- Chosen: Testable pure functions in `session-types.js`; cache seeding in `rsvp-shared-consumption.js`.
- Alternative: Inline all logic in `study.js` — rejected for testability and coupling.
- Trade-off: Two modules instead of one; clearer contracts.

**Bootstrap UI order fix**
- Chosen: `setMaterialBootstrapUi` → `applySharedBlockRecommendationToUi` → `updateCreateScreenModeVisibility`.
- Alternative: Relax `hasMaterialForBlockRecommend` — rejected; bootstrap flag is the correct signal.
- Trade-off: Must preserve order in any future bootstrap entry points.

**No prompt rewrites**
- Prompts (`buildConceptInventoryPrompt`, `buildConceptPackPrompt`, `buildPrePackingAssessmentSystemPrompt`) were already two-phase: inventory extract once, pack/assessment consume inventory JSON. Bug was orchestration calling inventory LLM again, not prompt wording.

## 3. Concepts applied

| Concept | Where |
|--------|--------|
| **Tiered pipeline / cache hierarchy** | Tier 1 DPP → shared; Tier 3 RSVP reads shared first, then ephemeral `blockSplitCache`, then legacy LLM |
| **Fingerprint-based cache invalidation** | `block-split-cache.js` — bypassed for prepared docs only |
| **Feature flags** | `isPrePackingAssessmentEnabled()` gates assessment UI |
| **Guard clauses / early return** | `shouldSkipRsvpInventoryLlm`, `applySharedBlockRecommendationToUi` in recommend path |
| **Separation of concerns** | Inventory LLM (`callConceptInventoryLlm`) vs pack LLM (`deepSeekPackConceptsToBlocks`) vs assessment LLM (`generatePrePackingAssessmentItems`) |
| **Contract testing** | `cursor-tests/20260620_rsvp-shared-consumption.mjs` asserts wiring without browser imports |

## 4. Technical debt and improvements

**Well done:** Clear contract in `specs/.../contracts/rsvp-consumption.md`; legacy fallback preserved; SW bump with tests.

**Duct tape:** String-order assertions in tests for bootstrap sequence; Recall mode’s `runConceptInventoryForDoc` still re-inventories without checking shared (out of RSVP scope but same smell).

**Won’t scale:** Holistic assessment map-reduce still heavy on large docs — acceptable Tier 3 cost; not addressed here.

**Gap:** `packInventoryToBlocks` fallback to `deepSeekSplitIntoBlocks` (full material mono-split) can still run if pack LLM fails even on prepared docs — rare but contradicts “never re-inventor” in failure path.

## 5. Consolidation questions

1. Why does `isBlockSplitCacheValid` include `studyNotes` in the fingerprint, and when must prepared docs bypass it entirely?
2. Trace Generate blocks with assessment ON: which LLM calls fire, in order, and which inputs come from `shared` vs `cleanedText`?
3. What is the difference between `isTier1PreparationComplete`, `isDocumentPreparationReady`, and `shouldSkipRsvpInventoryLlm` — when does each gate apply?

## 6. Suggested update for .cursorrules

1. When Tier 1 preparation is complete, RSVP/Questions create flows MUST NOT call concept inventory LLM; use `shared.conceptInventory` via `resolveRsvpInventoryForPack`.
2. Bootstrapped create screens MUST set `materialBootstrapActive` before any path that calls `maybeAutoRecommendBlockCount` or reads `hasMaterialForBlockRecommend`.
3. New RSVP Tier-3 LLM work MUST consume inventory JSON (pack/assessment prompts); document understanding belongs in DPP Tier 1 only unless legacy session has no shared inventory.
