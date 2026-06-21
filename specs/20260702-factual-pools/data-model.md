# Data Model: Factual Question Stem Pools

## Session runtime (_meta.factualStemRotation)

| Field | Type | Notes |
|-------|------|-------|
| usedByCategory | `Record<string, number[]>` | category → used pool indices this session |

Not persisted across sessions.

## FactualCategory

`'date' | 'number_with_unit' | 'proper_noun' | null`

`null` → not eligible for templated path (includes definition, enumeration, conceptual).

## generation_method (on question meta)

| Value | Meaning |
|-------|---------|
| `template_validated` | Templated stem + sourced distractors + passed validation |
| `llm` | Full LLM generation (fallback or non-eligible category) |
| `template` | Reserved; not emitted in v1 patch |

## TemplatedFactualItem

| Field | Type |
|-------|------|
| conceptId | string |
| category | FactualCategory |
| fact | string (correct answer) |
| question | string |
| candidateDistractors | string[] |
| generation_method | `'template_validated'` (pending validation) |

## ValidationBatchItem

| Field | Type |
|-------|------|
| fact | string |
| candidateDistractors | string[] |

## ValidationBatchResult

| Field | Type |
|-------|------|
| fact | string |
| approvedDistractors | string[] |
| rejected | `{ candidate, reason }[]` |

## MCQ question extension (block questions[])

Optional meta on generated test questions:

| Field | Type |
|-------|------|
| generation_method | string |
| factualCategory | FactualCategory |
| conceptId | string |
