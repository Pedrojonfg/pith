# Contract: promotion-rules

**Module**: `src/js/concept-registry/promotion.js`

## Exports

```javascript
export async function onConceptEngagement({
  session: DocumentSession,
  conceptId: string,       // inventory canonicalId
  facet: ConceptFacet,
  quality: number,         // 0-5 SM-2 quality
  source: 'rsvp'|'questions'|'cloze'|'recall'|'slow',
  contentText?: string,   // for green promotion
  recallType?: string,
}): Promise<{ globalConceptId: string; maturity: string; promotedToGreen: boolean }>;

export function qualifiesForGreen(facet: ConceptFacet, quality: number, source: string): boolean;
export function backfillGlobalConceptIds(session: DocumentSession, globalConceptId: string, inventoryEntryId: string): void;
```

## Gray → Yellow triggers

Any first engagement with quality signal from RSVP, Questions, Cloze, Recall (any facet), Slow checkpoint with explicit quality.

## Yellow → Green triggers

- Recall: synthesis, relational, argumentative with quality ≥ 2
- Slow Phase 3: steel-man, devil's-advocate (argumentative facet)
- Applicative alone: schedule only, no content block

## Effects

1. `resolveGlobalConcept` if `globalConceptId` null
2. `upsertFacetSchedule` with SM-2 update from quality
3. Optional `appendContentBlock` + maturity green
4. `backfillGlobalConceptIds` on inventory + assessmentSignals
