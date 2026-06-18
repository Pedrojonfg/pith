# Quickstart: Holistic Pre-Packing Assessment Coverage

## Prerequisites

- Document with `preparationStatus: ready` or completed concept inventory in RSVP flow
- `ASSESSMENT_BEFORE_PACKING` + Questions UI enabled

## Manual QA

1. Upload a 4+ section PDF (≥ 20 concepts).
2. Open RSVP → opt into pre-packing assessment.
3. **Expect**: status shows multi-batch progress ("Generating questions 1/3…").
4. **Expect**: question count ≫ 7 (check header progress total).
5. Answer through quiz — verify questions reference topics from later sections (not only intro).
6. Complete → knowledge_profile results → generate blocks.
7. Skip path: still works, no profile.

## Regression

- Per-block Questions `n_test`/`n_socratic` on create form unchanged.
- `cursor-tests/20260616_fix-pregen-assessment.mjs` prefetch still valid with new key shape.

## Run tests

```bash
node cursor-tests/20260618_holistic-assessment-coverage.mjs
```
