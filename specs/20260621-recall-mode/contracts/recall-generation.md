# Contract: recall-generation

**Module**: `src/js/api.js` — `generateRecallQuestions`  
**FR**: FR-002–FR-005, FR-007–FR-008

## Signature

```javascript
generateRecallQuestions({
  rawMarkdown,
  conceptInventory,
  pedagogicalMeta,
  assessmentSignals?,   // optional weak-concept weighting
  config,               // RecallConfig
  lang,
}) → Promise<RecallQuestion[]>
```

## Prompt rules (system)

- Generate synthesis-level open-ended questions only (no MCQ).
- Types: synthesis, relational, argumentative, applicative.
- Each question: 1–3 `concept_ids` from inventory, `source_chunk` excerpt from markdown.
- Must include ≥1 synthesis question.
- Distribute remaining types per `pedagogicalMeta.primaryLearningGoal`.
- If `assessmentSignals` provided: bias toward weak `canonicalId`s.
- Temperature ~0.4 for diversity.

## Parser output shape

```json
[
  {
    "id": "rq1",
    "recall_type": "synthesis",
    "question": "...",
    "concept_ids": ["c1", "c2"],
    "source_chunks": ["..."]
  }
]
```

## Validation

- Reject if zero questions or missing synthesis.
- Reject unknown `concept_ids`.
- `source_chunks` non-empty for each question.

## Errors

Throw visible error message; caller shows retry UI (study.js).
