# Quickstart QA: Mode Recommendation Onboarding

## Automated

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260724_onboarding-recommender.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260724_onboarding-shared-validation.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260724_onboarding-nav.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260724_onboarding-params-wiring.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260724_student-intent-appendix.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260724_onboarding-panel.mjs
node cursor-tests/20260606_validate-sw-update-flow.mjs
```

QA status (2026-07-23): all above green. SW_VERSION `20260724_01`, CACHE_NAME `pith-v154`.

## Manual

1. Upload a document → resolve scope → land on Onboarding Questionnaire (English copy; not called assessment/test).
2. Answer R-Q1–R-Q4; leave R-Q5 empty → Submit → mode select shows recommendation panel with flow + Start.
3. Repeat with R-Q5 filled → generate a block / open guide → confirm STUDENT INTENT appendix present in request payload (network or debug).
4. Prefer original text → flow starts with Slow; prefer explained + urgent → RSVP; explained + moderate → Read.
5. Prefer memorize → Cloze in flow; understand/both → Questions.
6. Choose avoid Socratic → params disable Socratic; Questions path uses quiz-only path.
7. If practice ontology present with match full/partial → Practice appears after theory; otherwise omitted. Start on Practice alerts until `modes.practice` exists.
8. Manual mode picker still works as fallback.
9. Reload session → onboarding not shown again; intent/responses unchanged.

## Follow-ups / backlog

- Calibrate placeholder constants after usage data (incl. `IMAGE_DENSITY_THRESHOLD`).
- Hard-wire Socratic turn-cap override when `socratic-loop-config` is on main.
- Full Practice mode entry when practice-ontology merges (`MODE_KEYS` + slice).
