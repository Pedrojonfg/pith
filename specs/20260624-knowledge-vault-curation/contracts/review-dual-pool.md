# Contract: Review Dual Pool

**Modules**: `review-project-scope.js`, `review.js`

## getReviewableItemsForProject(projectId, opts)

Returns merged array:

```javascript
[
  ...smPoolItems.map(i => ({ ...i, source: 'session' })),
  ...vaultPoolItems.map(i => ({ ...i, source: 'vault' }))
]
```

### vaultPoolItems filter

```javascript
vault.reviewItems.filter(item =>
  scopeIds.has(getSession(item.sourceDocId)?.projectId)
)
```

Map to queue-compatible shape with `sourceType: 'vault_review_item'`.

## handleSm2QualityClick branch

| source | Update target |
|--------|---------------|
| session | `upsertSmItem(docId, updated)` |
| vault | `updateVaultReviewItemSm2` + `applyVaultReviewObservationWithFacet` |

## Observation mapping

| quality | observation type | rawSignal |
|---------|------------------|-----------|
| ≥4 | review_correct | +1.0 |
| 3 | review_partial | +0.3 |
| <3 | review_wrong | -0.5 |

Updates `facetCoverage[facet]` on vault entry when facet present.

## Decay calibration

After vault observation, call `appendDecayCalibrationLog` with predicted vs observed.
