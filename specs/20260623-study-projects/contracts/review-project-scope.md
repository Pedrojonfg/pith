# Contract: Review Project Scope

**Module**: `src/js/review.js`

## getReviewableItemsForProject(projectId, opts?)

```javascript
/**
 * @param {string} projectId - 'all' or concrete project id
 * @param {{ includeDescendants?: boolean }} [opts]
 * @returns {SmItem[]} flattened smItems
 */
```

### Algorithm

1. If `projectId === 'all'` → return existing global pool (current vault/cross-doc behavior).
2. Build `scopeIds`:
   - `includeDescendants === true` (default): `[projectId, ...getDescendantIds(projectId)]`
   - else: `[projectId]`
3. Filter sessions: `scopeIds.has(session.projectId)`
4. FlatMap: `session.shared.smItems || []`
5. Normalize items via existing `normalizeSmItem` if applicable

### Vault entry cross-project sources

Item included if **any** source document's session is in scope. No change to vault schema — join at query time only.

## UI: screenReviewConfig

| Control | Values | Default |
|---------|--------|---------|
| Scope | `All subjects` \| project picker | `All subjects` |
| Include subprojects | checkbox | checked when project selected |

### Breadcrumb

`Review › All subjects` or `Review › [Project name]`

## Integration with vault review

If vault-level review (`runVaultSm2ReviewSession`) exists from hub feature:

- Scope picker applies **before** queue build when user selects project scope
- `All subjects` delegates to existing cross-document aggregation

## Non-goals

- Persist last-used scope (optional future)
- Filter by docTopics
