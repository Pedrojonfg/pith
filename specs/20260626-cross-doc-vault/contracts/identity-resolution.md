# Contract: identity-resolution

**Module**: `src/js/concept-registry/identity-resolution.js`

## Exports

```javascript
export function normalizeSlug(name: string): string;
export function resolveGlobalConcept({
  canonicalName: string,
  description?: string,
  sourceDocId: string,
  inventoryEntryId: string,
}): Promise<{ conceptId: string; created: boolean; relatedHintIds?: string[] }>;
```

## Algorithm

1. Normalize slug from `canonicalName`.
2. Exact slug match → reuse.
3. Alias fuzzy match above threshold (0.85) → reuse, append alias if name differs.
4. Medium confidence (0.6–0.85) → create new, store `relatedConceptIds` hint.
5. Below 0.6 → create new.

## Bias

False negatives (split) preferred over false merges.

## Side effects

- May call `upsertConcept`, `addSourceDocId`.
- Does NOT write to session — caller sets `globalConceptId`.
