# Contract: assessment-signals-consumers

**Modules**: `src/js/assessment-signals.js`, Questions study path in `study.js`, `src/js/recall-api.js`, `src/js/cloze/study.js`  
**FR**: FR-007

## Shared helper (existing)

```javascript
prioritizeByAssessmentSignals(items, signals, options?) → items[]
```

## Questions mode (NEW wiring)

When resolving block order for Questions study:

1. Load `getAssessmentSignals(docId)` or `doc.shared.assessmentSignals`.
2. Build proxy items: `{ id: blockIndex, conceptIds: block.concept_ids, blockIndex }`.
3. Apply `prioritizeByAssessmentSignals(proxies, signals)`.
4. Study blocks in returned order.

Apply on:
- Hub entry via `enterModeWithContinuity('questions')`
- Direct mode select entry (parity)

## Recall mode (verify existing)

`recall-api.js` `extractWeakConceptIdsForRecall` — confirm hub path passes signals (already in `recall-study.js`). No change unless hub bypasses controller.

## Cloze mode (verify existing)

`cloze/study.js` already prioritizes — confirm hub entry uses same `enterClozeStudyScreen` path.

## Empty signals

If `signals.length === 0`, preserve default block/item order — no error.

## Tests

- Seed doc with signals on concepts A, B; Questions first studied blocks include A or B in first half.
- Cloze + Recall regression: still prioritize when entering via hub.
