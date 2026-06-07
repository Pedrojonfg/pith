# Contract: Orphan Node Pruning

**Feature**: `20260530-graph-academic-genre` | **FR**: FR-008

## Function

```js
/**
 * Remove nodes with no incident edges, except user-layer notes.
 * @param {{ nodes: object[], edges: object[] }} graph
 * @returns {{ nodes: object[], edges: object[] }}
 */
export function pruneOrphanNodes(graph) {
  const connectedIds = new Set(graph.edges.flatMap((e) => [e.from, e.to]));
  const pruned = graph.nodes.filter(
    (n) => connectedIds.has(n.id) || n.layer === "user",
  );
  if (pruned.length < graph.nodes.length) {
    console.warn(
      `[graph] Pruned ${graph.nodes.length - pruned.length} orphan nodes`,
    );
  }
  return { ...graph, nodes: pruned };
}
```

## Call sites

1. End of `buildSlowPhase0GraphFromInputs` — before return
2. End of `buildSlowEnrichedGraphFromInputs` — before return
3. `mountMaterialGraphScreen` in `view.js` — before `persistEnrichedGraph`

## Invariants

- Never prune `layer === 'user'` (annotations may exist before graphLinks)
- Edges array unchanged
- Idempotent: second call produces same graph

## Test cases

| Scenario | Before | After |
|----------|--------|-------|
| text node, no edges | 1 text node | 0 nodes |
| user node, no edges | 1 user node | 1 user node (kept) |
| text + user + edge user→text | 2 nodes | 2 nodes |
| arg chain G1→G2 | 2 arg nodes | 2 nodes |
