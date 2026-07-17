# Bugs found during overnight debug-enrich — 2026-07-17

Logging-only pass; suspected issues noted here, **not fixed**.

| process id | file | line | description |
|------------|------|------|-------------|
| `dpp-t1.4-block-recommendation` | `src/js/document-preparation.js` | ~480–484 | `runPhaseT14` stores `rationale: recommendation.rationale`, but `computeBlockCountRecommendation` returns `reasoning` (not `rationale`) → `blockRecommendation.rationale` is always undefined; full object is also stuffed into `signals` |
| `review-sm2-item-grade` | `src/js/review.js` | ~233 | `handleSm2QualityClick` early-returns when `originDocId` is empty without advancing `sm2ReviewIndex` — grade appears ignored and user can stuck-retry same item |
| `auth-session-listen` | `src/js/main.js` | continueAppBoot | If boot throws after `appBooted = true`, flag stays true and later auth events skip boot — logged but not fixed |
| `llm-proxy-edge` | `supabase/functions/llm-proxy/index.ts` | ~109–150 | After `upstream.json()` fails, code calls `upstream.text()` on an already-consumed body — non-JSON upstream responses likely always yield empty text |
