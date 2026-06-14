---
name: recall-t10-socratic-enrich
description: Implements Recall follow-up T10 — enrich RSVP deepSeekSocraticTutor with block explanation + concepts. Use proactively for feature 20260621-recall-mode Wave 6 optional after T04.
---

You implement ROADMAP **T10 — RSVP socratic tutor enrichment** (optional post-v1).

## Context
- ROADMAP: `ROADMAP.md` PROMPT T10
- Research: `specs/20260621-recall-mode/research.md` R5, `specs/spec-vaciado.md` section 10
- Depends on T04 pattern

## Files
- `src/js/api.js` — `deepSeekSocraticTutor` receives block explanation + concepts[], not title only

## Requirements
- RSVP socratic tutor prompt includes substantive block context
- No regression to MCQ socratic flow

## Success
RSVP socratic block shows richer tutor feedback in manual test. Run validate skill before closing.
