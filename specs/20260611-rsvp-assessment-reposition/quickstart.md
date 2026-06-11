# Quickstart: RSVP Assessment Reposition

**Feature**: `20260611-rsvp-assessment-reposition`

## Prerequisites

- API key configured for active LLM provider
- `ASSESSMENT_BEFORE_PACKING: true` in `src/js/config/flags.js`
- Medium academic PDF or TXT (~2–5 min read)

## Automated tests

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260611_rsvp-assessment-reposition.mjs
```

## Manual QA

> Automated suite: `node --import ./cursor-tests/register.mjs cursor-tests/20260611_rsvp-assessment-reposition.mjs` (38 cases, 2026-06-11).

### QA-AR-1 — Happy path with profile reduction

1. RSVP create → upload document → set N=8 → Generate
2. Wait for concept graph (all concepts visible)
3. Complete pre-packing quiz (answer mix of known/unknown)
4. Results show mastered count; diff shows `hasta 8 → M` where M ≤ 8
5. Accept → block list has M blocks
6. Open concept graph — **same node count** as step 2
7. Start study — dictionary resolves concept from full inventory

**Pass**: SC-002, SC-003

### QA-AR-2 — Skip assessment

1. Generate → on assessment screen click Skip
2. Packing runs without quiz
3. `session._meta.assessment_skipped === true`, no `knowledge_profile`
4. Block count up to N

**Pass**: SC-004

### QA-AR-3 — Ignore profile

1. Complete quiz → on results click "Ignorar y usar todos"
2. Block list length approaches N (full study)
3. `knowledge_profile` present AND `packing_ignored_profile === true`

**Pass**: SC-004

### QA-AR-4 — Legacy assessment absent

1. With flag on, complete through block confirmation
2. No post-block "initial assessment" prompt appears

**Pass**: SC-005

### QA-AR-5 — Parallel packing

1. Complete quiz on slow network
2. Results screen appears without long wait after last answer
3. Accept may show brief spinner then blocks

**Pass**: SC-006

### QA-AR-6 — Evaluator failure

1. Mock: force evaluate to return null (devtools or test hook)
2. Flow continues to pack without profile; no hard error

## Regression

- Block split cache still works with Recommend → Generate
- Resume existing RSVP session without `knowledge_profile`
- Questions mode unaffected
