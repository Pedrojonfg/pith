# Contract: vault-graph

**Module**: `src/js/concept-registry/vault-graph-adapter.js`

## Exports

```javascript
export function buildVaultGraph({
  focusedDocId?: string | null,
  projectId?: string | null,
}): { nodes: VaultGraphNode[]; edges: VaultGraphEdge[] };

export function getConceptPageData(conceptId: string): {
  concept: Concept;
  activeBlocks: ConceptContentBlock[];
  historyBlocks: ConceptContentBlock[];
} | null;
```

## Node rules

- Cold (no `focusedDocId`): yellow + green global concepts only.
- With `focusedDocId`: above + gray inventory entries from that document.
- `projectId` filter: only concepts with `sourceDocIds` intersecting project document set.

## Edge rules

- Co-occurrence: shared `sourceDocIds` count as weight.
- Prerequisite: from document inventory dependency fields when present.
- Explicit link: from green content blocks mentioning other concept names/slugs.

## Rendering

Consumes existing `graph/view.js` + `canvas.js`; maturity passed via node metadata for CSS classes:
- `gray` → existing gap style
- `yellow` → `vault-node-yellow`
- `green` → `vault-node-green`; badge if `mastery < 0.3`
