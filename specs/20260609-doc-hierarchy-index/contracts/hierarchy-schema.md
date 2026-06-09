# Contract: Hierarchy Schema & Validation

**Module**: `src/js/normalization/hierarchy.js`

## Exports

```js
export async function buildDocumentHierarchy(markdownText, llmFn, options = {})
// options: { useCache?: boolean, textHash?: string, minLlmChars?: 3000, includeSummary?: boolean }
// → { method, tree, textHash }

export function buildDeterministicHierarchy(markdownText) → HierarchyNode[]
export function buildTrivialHierarchy(markdownText) → HierarchyNode[]
export function validateHierarchy(tree, textLength) → { valid: boolean, errors: string[] }
export function flattenHierarchy(tree, maxLevel = 2) → HierarchyNode[]
export function getChunksFromHierarchy(tree, markdownText, maxChunkSize = 12000) → HierarchyChunk[]
```

## validateHierarchy rules

1. `tree` is non-empty array
2. Each node: `title` non-empty string, `level` in 1..3, integer offsets
3. `0 <= startOffset < endOffset <= textLength`
4. Siblings: contiguous, non-overlapping
5. Root span: first `startOffset === 0`, last `endOffset === textLength`

## flattenHierarchy

- BFS traversal
- Include nodes with `level <= maxLevel` (default 2)
- Preserve `startOffset`/`endOffset` absolutos

## getChunksFromHierarchy

- Merge adjacent small sections until `maxChunkSize`
- Split oversized sections at child boundaries when possible; else hard split at `maxChunkSize` preserving title of parent
- Output MUST cover full text length

## Tests

- `cursor-tests/20260609_doc-hierarchy-pure.mjs` — deterministic, trivial, validate, flatten, chunks
