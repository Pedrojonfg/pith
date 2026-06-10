# Contract: Block Split Cache & Session Split API

**Modules**: `src/js/session.js`, `src/js/study.js` (or `src/js/block-split-cache.js` if extracted)

## Session.js exports

```js
/**
 * Phase 1 only — concept inventory LLM call.
 * @returns {Promise<{ inventory: object[], concept_count: number }>}
 */
export async function runConceptInventory(material, { llmModel, studyNotes, language, onProgress } = {})

/**
 * Phase 2 only — pack cached inventory into N blocks + chunks + dedup.
 * @returns {Promise<{ blockIndex, splitRunMeta, conceptInventory }>}
 */
export async function packInventoryToBlocks(inventory, nBlocks, material, { llmModel, studyNotes, language, onProgress } = {})

/**
 * Existing wrapper — inventory + pack (unchanged behavior for manual path).
 */
export async function twoPhaseConceptSplit(material, nBlocks, opts)
```

## Cache helpers (study.js or dedicated module)

```js
export function buildBlockSplitFingerprint({ file, studyNotes, wordCount })
export function isBlockSplitCacheValid(cache, fingerprint)
export function invalidateBlockSplitCache()
export function getBlockSplitCache()
export function setBlockSplitCache({ fingerprint, conceptInventory, recommendation })
```

## Invalidation triggers (normative)

| Event | Action |
|-------|--------|
| `fileInput` change | `invalidateBlockSplitCache()` + clear recommend UI |
| `studyNotesInput` change (debounced) | same |
| `studyMode` !== `rsvp` | same |
| `blocksInput` change | **no invalidation** |
| Recommend click, valid cache | skip `runConceptInventory` |
| Generate click, valid cache | `packInventoryToBlocks` only |
| Generate click, no cache | full `twoPhaseConceptSplit` |

## Progress messages

| Step | User-visible status |
|------|---------------------|
| Recommend indexing | `Indexing concepts…` |
| Recommend done | `Recommended N blocks` (brief) |
| Generate pack (cached) | `Packing N blocks…` (no "Indexing concepts…") |
| Generate full | unchanged today |

## Error handling

- Inventory fails on Recommend → error banner; cache empty; blocks input unchanged
- Pack fails on Generate → existing error path; inventory remains cached for retry
