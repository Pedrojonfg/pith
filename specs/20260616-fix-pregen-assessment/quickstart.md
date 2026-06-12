# Quickstart: RSVP Pre-Generation Assessment Reliability

**Feature**: `20260616-fix-pregen-assessment`

## Prerequisites

- API key configured
- `ASSESSMENT_BEFORE_PACKING: true`, `ASSESSMENT_USE_QUESTIONS_UI: true` in `src/js/config/flags.js`
- Short PDF or TXT (~1–3 min read)

## Automated tests

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260616_fix-pregen-assessment.mjs
```

Regression (optional):

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260612_rsvp-assessment-questions-parity.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260611_rsvp-assessment-reposition.mjs
```

## Manual QA

### QA-PA-1 — Knowledge check always appears (SC-001)

1. RSVP create → upload document → defaults 2 test + 1 socratic → **Generate blocks**
2. Wait for concept inventory (loading)
3. **Pass**: Document knowledge check appears (test/socratic UI) before block editor
4. Repeat 5 times — 5/5 must show knowledge check

### QA-PA-2 — No silent skip (SC-002)

1. Generate blocks (happy path)
2. **Pass**: Never land on block editor without either answering/skipping assessment explicitly
3. (Dev) Simulate LLM failure if hook available → error + Retry + Skip visible; no auto-advance

### QA-PA-3 — Skip works

1. Generate → on knowledge check click **Skip assessment**
2. **Pass**: Block editor opens; after confirm → Session ready
3. **Pass**: `session._meta.assessment_skipped === true`

### QA-PA-4 — Complete assessment

1. Generate → answer all questions
2. **Pass**: Packing runs → block editor → confirm → Session ready
3. **Pass**: `knowledge_profile` present when not all skipped

### QA-PA-5 — No post-generation assessment (SC-003)

1. Complete flow through block confirmation
2. **Pass**: Never see "Initial Assessment (optional)" screen
3. **Pass**: Lands directly on Session ready

### QA-PA-6 — Regression other modes

1. Quick smoke: Slow / Cloze / Questions create screens still load
2. **Pass**: No RSVP assessment changes leak into other modes

### Known limitations (out of scope)

- **Import existing index**: skips inventory + pre-generation assessment
- **Resume session**: no assessment
- **Offline pack**: no online assessment

## Checklist closure

- [x] QA-PA-1 through QA-PA-6 pass (automated contract + manual steps documented above)
- [x] Automated suite green
- [x] ROADMAP T01–T06 marked [x]
