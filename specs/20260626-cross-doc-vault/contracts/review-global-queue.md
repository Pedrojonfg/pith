# Contract: review-global-queue

**Module**: `review.js` + `concept-registry/registry-store.js`

## Queue item shape

```typescript
interface GlobalReviewItem {
  source: 'global' | 'session_legacy';
  conceptId: string;
  globalConceptId: string;
  facet: ConceptFacet;
  canonicalName: string;
  prompt?: string;        // from vault review item or generated
  sm2: Sm2State;
}
```

## buildGlobalReviewQueue

```javascript
export function buildGlobalReviewQueue({ projectId?: string }): GlobalReviewItem[];
```

Merges:
1. Due `ConceptFacetSchedule` from registry (primary)
2. Legacy `shared.smItems` without `globalConceptId` mapping (transitional)

## onGlobalReviewAnswer

```javascript
export function onGlobalReviewAnswer({
  globalConceptId: string,
  facet: ConceptFacet,
  quality: number,
  sourceDocId?: string,
}): void;
```

Updates facet schedule via `sm2.js`, appends `VaultObservation`, recomputes mastery cache.

## Deprecation path

When all sessions migrated, remove `session_legacy` branch.
