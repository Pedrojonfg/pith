# Contract: Cloze MC Study Session

**Feature**: `20260529-cloze-mode` | **FR**: FR-010, FR-010a

## Entry

- From create/resume when `pipelineStatus === 'ready'` and `validItems.length > 0`.
- Button **Estudiar** o auto-navigate post-generación.

## Item serving

- Queue: `items.filter(i => i.qa_status === 'valid')`, shuffled once at session start (or resume preserves order + index).
- Render: `sentence_with_blank` + 4 MC options.
- Reuse `shuffleTestQuestionOptions` before display.

## Interaction

1. User selects option → **Confirmar**.
2. Immediate feedback: correcto / incorrecto + highlight correct answer.
3. Advance `studyIndex`; persist after each item.
4. End screen: `correct/shown` summary.

## Non-goals v1

- No SR scheduling (`next_review`, `sm2_*` unused).
- No explanation generation (optional field deferred).
- No weak/rejected items in queue.

## Resume

- Restore `studyIndex`, `studyStats`.
- Same shuffled order stored in `cloze.studyOrder` (item ids).

## Module

- `src/js/cloze/study.js` — screen logic.
- May import helpers from `review.js` / `shuffle-options.js` / `markdown.js`.
- Do not break RSVP review flow.
