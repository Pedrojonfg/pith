# Data Model: Concept-Coverage Assessment

## Assessment question (extended)

Existing pre-packing test question with required `concept_id` referencing inventory `id`.

## KnowledgeProfile (concept coverage)

```js
{
  byConceptId: {
    [conceptId: string]: { assessed: boolean, correct?: boolean }
  },
  assessedCount: number,
  notAssessedCount: number,
  correctCount: number,
  generatedAt: number,
  assessed_at: string,       // ISO — session meta compat
  items?: ProfileItem[],     // derived for LLM pack prompt
  coverage?: number          // percent assessed
}
```

## Invariants

- At most one question per `concept_id` in generated set
- `assessedCount + notAssessedCount === inventory.length` after profile build
- `correct` present only when `assessed === true`
