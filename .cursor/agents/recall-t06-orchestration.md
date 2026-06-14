---
name: recall-t06-orchestration
description: Implements Recall Mode T06 — study.js full Recall flow (enter, generate, tutor loop, resume). Use proactively for feature 20260621-recall-mode Wave 3 after T02–T05.
---

You implement ROADMAP **T06 — study.js Recall orchestration** for feature `20260621-recall-mode`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T06
- Contract: `specs/20260621-recall-mode/contracts/recall-entry-bootstrap.md`
- Quickstart: `specs/20260621-recall-mode/quickstart.md` Waves 3–5
- Depends on T02–T05

## Files
- `src/js/study.js` — `enterModeWithContinuity` recall branch, generation progress UI, submit → tutor → next, resume, session summary, `updateFlowProgress` on complete
- Wire mode select / flow panel → Recall
- Bump SW_VERSION if touching `src/js/**`

## Requirements
- Bootstrap skips re-upload when inventory exists
- generate_fresh runs inventory then questions
- Mid-session resume at currentIndex
- Generation failure shows retry (no silent fail)
- Status transitions: generating → ready → in_progress → complete

## Success
Quickstart Waves 3–5 pass manually in browser. Run validate skill before closing.
