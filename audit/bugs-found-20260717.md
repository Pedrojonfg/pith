# Bugs found during overnight debug-enrich — 2026-07-17

Logging-only pass; suspected issues noted here, **not fixed**.

| process id | file | line | description |
|------------|------|------|-------------|
| `dpp-t1.4-block-recommendation` | `src/js/document-preparation.js` | ~480–484 | `runPhaseT14` stores `rationale: recommendation.rationale`, but `computeBlockCountRecommendation` returns `reasoning` (not `rationale`) → `blockRecommendation.rationale` is always undefined; full object is also stuffed into `signals` |
