# Data Model — Block Answer Signals

No new persisted schema. Uses existing:

| Store | Field | Writer |
|-------|-------|--------|
| `DocumentSession.shared` | `assessmentSignals[]` | `syncAssessmentSignalsToShared` |
| `DocumentSession.shared` | `smItems[]` | `registerOrUpdateSmItem` |
| Concept registry | global concept + facets | `onConceptEngagement` via ingest helpers |

## Slice inputs

- `slice.blocks[]` — block metadata + questions
- `slice._responses.blocks[bi].questions[qi]` — answer records from `recordResponse`
- `sourceMode` — `'rsvp' | 'questions'` on each merged signal

## SM-2 source keys

| Question type | sourceType | sourceId |
|---------------|------------|----------|
| test (MCQ) | `rsvp_block` | block id or block index |
| socratic | `rsvp_block` | `{blockId}:socratic:{questionIndex}` |

## Idempotency

- Signals: `mergeAssessmentSignals` by `canonicalId`
- smItems: `registerOrUpdateSmItem` finds existing by `sourceType` + `sourceId`
- Registry: `onConceptEngagement` upserts facet schedule
