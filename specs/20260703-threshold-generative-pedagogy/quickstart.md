# Quickstart QA: Threshold Concepts & Generative Pedagogy

## Prerequisites

- DPP completes with concept inventory ≥ 5 concepts
- Comprehension gate enabled (default)

## T01 — Threshold tagging

1. Upload a medium academic PDF.
2. In devtools / vault debug, inspect `shared.conceptInventory`.
3. Expect ~12% entries with `isThreshold: true` and `thresholdScore`.

## T02 — RSVP ordering & profile

1. Start RSVP study.
2. Open block index: threshold concept blocks should appear before dependent blocks.
3. Inspect generated block with threshold: `explanation_profile` = `threshold_expanded`, word count > 300.

## T03 — WPM cap

1. Set RSVP WPM to 500 in UI.
2. Enter threshold block: effective speed should cap at 250.

## T04 — Generative Socratic

1. Complete RSVP block with Socratic question.
2. Question text should include why/explain-own-words pattern.

## T05 — Threshold comprehension gate

1. Answer MCQ correctly for threshold concept only.
2. Verify no SM-2 item created.
3. Complete Socratic or Recall with adequate quality → SM-2 allowed.

## Regression

- Cloze generation unchanged.
- Guide chat prompts unchanged.
- MCQ stems unchanged.
