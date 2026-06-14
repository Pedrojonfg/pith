---
name: hub-t07-exposure-redirect
description: Implements Exposure/Retrieval Hub T07 — Slow phase 3 + RSVP complete redirect to hub. Use proactively after T03 for feature 20260622-exposure-retrieval-hub Wave 3.
---

You implement ROADMAP **T07 — Exposure completion → hub** for feature `20260622-exposure-retrieval-hub`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T07
- Contract: `specs/20260622-exposure-retrieval-hub/contracts/hub-navigation.md` (exposure completion table)
- Depends on T03

## Files
- `src/js/study.js` — Slow `slowPhase3FinishBtn` → `enterRetrievalHub`; RSVP complete CTA → hub
- `index.html` — `#btnPracticeRetrieval` on complete screen if needed

## Constraints
- Do NOT change embedded block test/socratic handlers

## Success
Slow phase 3 finish lands on hub; RSVP complete CTA lands on hub; mid-block RSVP unchanged.
Run validate skill before closing.
