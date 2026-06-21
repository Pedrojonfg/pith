# Contract: `finalizeBlockQuestionAnswer`

**Module:** `src/js/block-answer-signals.js`

## `finalizeBlockQuestionAnswer(params)`

```js
/**
 * @param {object} params
 * @param {string} params.docId
 * @param {object} params.slice - active mode slice with _responses
 * @param {'rsvp'|'questions'} params.sourceMode
 * @param {number} params.blockIndex
 * @param {object} params.block
 * @param {'test'|'socratic'} params.questionType
 * @param {number} params.questionIndex
 * @param {object} [params.mcqOutcome] - { correct, firstTry?, usedHint?, skipped? }
 * @param {string} [params.socraticAnswer] - student answer text for promotion content
 * @returns {Promise<void>}
 */
export async function finalizeBlockQuestionAnswer(params)
```

### Behavior

1. Normalize `sourceMode` to `rsvp` or `questions`; no-op for other modes.
2. `syncAssessmentSignalsToShared(docId, slice, sourceMode)`.
3. Resolve `conceptIds` from `block.concept_ids` or `block.concepts`.
4. **test:** `registerOrUpdateSmItem` with `mapMcqOutcomeToQuality(mcqOutcome)`; `promoteFromMcqBlock`.
5. **socratic:** `registerOrUpdateSmItem` with quality **4**; `promoteFromSocraticBlock` with facet `synthesis`.

### Call sites

- `handleTestAnswer` after `recordResponse` (not pre-packing runner)
- Socratic submit after successful tutor + second `recordResponse`

### Non-goals

- Pre-packing assessment (`isPrePackingAssessmentRunner`)
- Cloze / Recall paths

## `promoteFromSocraticBlock`

**Module:** `src/js/concept-registry/ingest.js`

Same signature shape as `promoteFromMcqBlock` but facet defaults to `synthesis` and accepts `contentText` for green promotion eligibility.
