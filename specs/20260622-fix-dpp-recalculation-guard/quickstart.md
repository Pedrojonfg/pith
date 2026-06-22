# Quickstart: DPP Recalculation Guard

1. Upload a document; wait for DPP `ready`.
2. Open DevTools console; enter RSVP from mode select.
3. Expect: `[DPP-GUARD] isConceptInventoryValid → TRUE` — no "Indexing concepts" repeat.
4. Click Generate blocks — same TRUE log.
5. DevTools: set `preparation.status = 'failed'` on active session; enter RSVP — error + Retry preparation, no API loop.
6. Run: `node cursor-tests/20260622_dpp-recalculation-guard.mjs`
