---
name: hub-t10-qa
description: Closes Exposure/Retrieval Hub T10 — integration tests + ROADMAP quickstart QA. Use proactively after T01–T09 for feature 20260622-exposure-retrieval-hub Wave 5.
---

You implement ROADMAP **T10 — Integration tests + QA closure** for feature `20260622-exposure-retrieval-hub`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T10
- `specs/20260622-exposure-retrieval-hub/quickstart.md`
- All contracts

## Files
- `cursor-tests/20260622_exposure-retrieval-hub.mjs` — taxonomy, hub navigation, signals ordering, vault queue, migration fixture
- `ROADMAP.md` — mark T01–T10 `[x]`
- `specs/20260622-exposure-retrieval-hub/quickstart.md` — note manual QA gaps if any

## Tests must cover
- `getDocumentRetrievalModes()` shape
- `getSmItemsDueToday()` used for vault queue
- Questions block prioritization with seeded signals
- `review` not in hub list
- RSVP mid-block path not redirected to hub (regression note in tests)

## Success
`node cursor-tests/20260622_exposure-retrieval-hub.mjs` green; ROADMAP all [x].
Run validate skill before closing.
