# Quickstart QA: RSVP Assessment Questions Parity

**Feature**: `20260612-rsvp-assessment-questions-parity`

## Prerequisites

- `ASSESSMENT_BEFORE_PACKING: true`
- `ASSESSMENT_USE_QUESTIONS_UI: true` (default after implementation)
- API key configured
- Document with clear concepts (PDF or markdown)

## Automated tests

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260612_rsvp-assessment-questions-parity.mjs
```

## Manual QA checklist

### QA-AQP-1 — Visual parity (test)

- [x] Upload doc → Generate → after concept graph, assessment opens on **test screen** (not custom pre-packing card)
- [x] Question text renders markdown/LaTeX if present
- [x] Four A–D buttons (not radio list)
- [x] After answer: feedback panel visible (green/red styling)
- [x] "I don't know" / skip affordance present

### QA-AQP-2 — Socratic parity

- [x] With `n_socratic >= 1` in create form, assessment includes socratic phase after tests
- [x] Socratic screen matches study mode (textarea, submit)

### QA-AQP-3 — Count

- [x] Set create form to 3 test + 2 socratic → assessment has exactly 5 questions
- [x] Not ~4 generic MCQs

### QA-AQP-4 — Profile + pack

- [x] Complete assessment → results screen → accept → blocks editor populated
- [x] Skip assessment → still packs without profile

### QA-AQP-5 — Regression

- [x] Questions study mode per-block unchanged
- [x] RSVP study after blocks unchanged
- [x] `ASSESSMENT_BEFORE_PACKING: false` → legacy path

## Success criteria

All QA-AQP-1..5 pass; cursor-tests green.
