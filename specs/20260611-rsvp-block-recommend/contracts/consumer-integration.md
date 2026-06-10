# Contract: Consumer Integration (study.js)

**Feature**: `20260611-rsvp-block-recommend`

## Upload path (unchanged meta collection)

On file read in RSVP create (`generateBlocksBtn` handler prerequisites):
- `ensureDocumentSessionForUpload` + `computeAndPersistModeRecommendation` continue as today
- **Do not** auto-run concept inventory on upload

## New handler: `handleRecommendBlockCount`

```text
1. Validate file + API key (same as generate)
2. readAndCleanMaterialText if not cached in state
3. fingerprint = buildBlockSplitFingerprint(...)
4. If cache valid → skip inventory
   Else → inventory = await runConceptInventory(...)
           setBlockSplitCache({ fingerprint, conceptInventory, recommendation: null })
5. signals = assemble from textMetrics, pedagogicalMeta, sectionCount, inventory.length
6. recommendation = computeBlockCountRecommendation(signals)
7. Update cache.recommendation
8. blocksInput.value = recommendation.nBlocks
9. Render recommendBlocksWhy
```

## Modified handler: `generateBlocksBtn`

```text
After validation:
  if (isBlockSplitCacheValid(cache, fingerprint)) {
    result = await packInventoryToBlocks(cache.conceptInventory, nBlocks, cleanedText, ...)
  } else {
    result = await twoPhaseConceptSplit(cleanedText, nBlocks, ...)
    // optional: populate cache from result for consistency
  }
// rest unchanged: render block editor, graph, showScreen('blocks')
```

## Invalidation wiring

- `fileInput` `change` listener → `invalidateBlockSplitCache()` + clear recommend UI
- `studyNotesInput` `input` debounced 500ms → same
- `updateCreateScreenModeVisibility` when mode !== rsvp → same

## Imports

```js
import { analyzeText } from './recommendation/analyzer.js'
import { computeBlockCountRecommendation, formatBlockCountReasoning } from './recommendation/block-count-recommender.js'
import { runConceptInventory, packInventoryToBlocks, twoPhaseConceptSplit } from './session.js'
```

## Non-goals

- No changes to Slow/Cloze/Questions create flows
- No persistence to DocumentSession for block recommendation v1
- No changes to post-generate `materialGraphContext` shape
