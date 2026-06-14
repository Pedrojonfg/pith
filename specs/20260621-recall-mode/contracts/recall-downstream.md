# Contract: recall-downstream

**Modules**: `src/js/sm2-ingest.js`, `assessment-signals.js`, `recommender.js`, `vault/mastery-model.js`  
**FR**: FR-012, FR-013, FR-016

## ingestSm2FromRecallAnswer

```javascript
ingestSm2FromRecallAnswer({
  docId,
  question,           // RecallQuestion with tutor_feedback
  sessionId?,
}) → void
```

For each `concept_id` in `question.concept_ids`:

```javascript
registerOrUpdateSmItem(docId, {
  sourceType: 'recall_question',
  sourceId: question.id,
  title: truncate(question.question, 80),
  contentPreview: concept_ids.join(', '),
  quality: RECALL_QUALITY_TO_SM2[tutor_feedback.quality],
});
```

## syncAssessmentSignalsFromRecall

```javascript
syncAssessmentSignalsFromRecall(docId, question) → void
```

For each concept_id:

- `partial` | `insufficient` → increment weak weight, `sourceMode: 'recall'`, `lastResult: 'wrong'`
- `strong` | `adequate` → `lastResult: 'correct'`, reduce weight per existing formula

## Flow recommender hooks

Extend `recommender.js` / flow tracker:

```javascript
shouldSuggestRecall({ doc, completedModes, pedagogicalMeta, assessmentSignals }) → boolean
```

Rules (FR-016):

- RSVP done && argumentativeDensity >= 3
- Slow done
- Cloze next && assessmentSignals.length < MIN_SIGNALS

## Vault (optional)

```javascript
recordRecallObservation({ docId, conceptId, quality, recall_type })
```

Map recall_type to declarative vs procedural dimension for applicative.

## Cloze consumer

No Cloze code change required if `prioritizeByAssessmentSignals` already weights by `sourceMode` and weight; verify integration test in T09.
