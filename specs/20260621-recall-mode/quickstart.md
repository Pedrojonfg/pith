# Quickstart QA: Recall Mode

**Feature**: `20260621-recall-mode`  
**Branch**: `20260621-recall-mode`

## Prerequisites

- API key configured (generation + tutor)
- Active document with normalized markdown
- Mode continuity + SM-2 features merged

## Automated

```bash
node cursor-tests/20260621_recall-mode.mjs
```

## Wave 1 — Session slot + entry resolution (T01–T02)

1. DevTools: create doc with inventory → `resolveModeEntryState(doc, 'recall')` returns `bootstrap`.
2. Doc without inventory but with markdown → `generate_fresh`.
3. Empty doc → `upload_required`.
4. In-progress slice → `resume`.

## Wave 2 — Generation API (T03)

1. Mock or live call `generateRecallQuestions` with sample inventory.
2. Parser returns ≥3 questions with ≥1 synthesis.
3. Each question has valid `concept_ids` and non-empty `source_chunks`.

## Wave 3 — Study UI (T04–T05)

1. Open Recall from mode select after RSVP.
2. No second upload prompt.
3. Answer field accepts multi-paragraph text; no timer visible.
4. Progress shows `1 / N`.

## Wave 4 — Tutor loop (T05)

1. Submit answer → critique + suggested answer + quality appear.
2. Next advances index; prior answer persisted on slice.
3. Empty submit blocked or warned.

## Wave 5 — Downstream writes (T06–T07)

1. Answer with `partial` quality → `assessmentSignals` includes concept with recall weak weight.
2. `shared.smItems` contains `recall_question` entry with mapped quality.
3. Start Cloze on same doc → weak concepts prioritized in first batch.

## Wave 6 — Flow recommender (T08)

1. Complete RSVP on argumentative doc → flow panel suggests Recall before Cloze.
2. Complete Slow → Recall suggested.

## Wave 7 — Cold entry (T04)

1. New doc, Recall first mode.
2. Inventory runs once; questions appear without RSVP UI.

## Wave 8 — QA closure (T09)

1. Integration test green.
2. ROADMAP T01–T09 marked `[x]`.
3. If `index.html` / `src/js/**` changed: bump SW_VERSION + run `cursor-tests/20260606_validate-sw-update-flow.mjs`.

## Regression

- Other modes still bootstrap correctly
- SM-2 RSVP/Cloze ingestion unchanged
- Mode select shows Recall entry without breaking layout

## Out of scope (must NOT block v1)

- Section scope picker
- Voice / Web Speech
- Cross-document recall
- RSVP socratic retrofit (T10–T11 optional follow-up)
