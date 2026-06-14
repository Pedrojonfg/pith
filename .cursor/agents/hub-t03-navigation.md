---
name: hub-t03-navigation
description: Implements Exposure/Retrieval Hub T03 — enterRetrievalHub, library/mode-select entry, back. Use proactively after T01+T02 for feature 20260622-exposure-retrieval-hub Wave 2.
---

You implement ROADMAP **T03 — Hub navigation orchestration** for feature `20260622-exposure-retrieval-hub`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T03
- Contract: `specs/20260622-exposure-retrieval-hub/contracts/hub-navigation.md`
- Depends on T01, T02

## Files
- `src/js/study.js` — `enterRetrievalHub({ docId, entrySource })`, render options from taxonomy, wire `#btnPracticeDocument`, hub back button

## Constraints
- Do NOT touch exposure end redirects (T07) or vault Review (T06) yet
- Do NOT wire hub option clicks to modes yet (T04)

## Success
Active doc → Practice → hub with 3 options; back returns to mode select or library.
Run validate skill before closing.
