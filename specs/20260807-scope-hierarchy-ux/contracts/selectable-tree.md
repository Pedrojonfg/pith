# Contract: Selectable hierarchy tree

**Module**: `src/js/scope-selection.js`

## `listSelectableHierarchyTree(tree, maxLevel = 2)`

Returns `SelectableHierarchyNode[]` roots:

```js
/** @typedef {{ id: string, node: HierarchyNode, children: SelectableHierarchyNode[] }} SelectableHierarchyNode */
```

### Rules

1. Include a node iff `node.level <= maxLevel`.
2. Recurse into original `node.children`; attach only selectable descendants under `children`.
3. `id = hierarchyNodeId(node)` (existing slugify rules).
4. Do not mutate the input tree.
5. Document order: roots and siblings follow hierarchy walk order (same as structure inference).

## `listSelectableHierarchyNodes(tree, maxLevel = 2)`

MUST remain available. MAY be implemented as depth-first flatten of `listSelectableHierarchyTree` preserving document order. Callers that need only ordered ids keep using this API.
