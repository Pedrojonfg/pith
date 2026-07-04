# Quickstart: Fix DPP Guard Status Race

1. Upload a small document with API key configured.
2. Watch console: after `[document-preparation.runDocumentPreparationPipeline] Finished` with `status: ready`, expect mode select within seconds — no repeated `waiting — preparation already running`.
3. DevTools: confirm guard logs `skip` when `conceptCount > 0`, `blockRecommendation` present, even if `modeRecommendation` absent.
4. Run tests:
   ```bash
   node --import ./cursor-tests/register.mjs cursor-tests/20260709_fix-dpp-guard-race.mjs
   node --import ./cursor-tests/register.mjs cursor-tests/20260622_dpp-recalculation-guard.mjs
   node --import ./cursor-tests/register.mjs cursor-tests/20260629_dpp-prep-persist-reconcile.mjs
   ```
5. Regression: enter RSVP after upload — no duplicate "Indexing concepts".
