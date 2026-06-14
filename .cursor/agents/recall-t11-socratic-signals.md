---
name: recall-t11-socratic-signals
description: Implements Recall follow-up T11 — RSVP socratic quality drives SM-2 and assessment signals. Use proactively for feature 20260621-recall-mode Wave 6 optional after T10.
---

You implement ROADMAP **T11 — RSVP socratic SM-2 + signals** (optional post-v1).

## Context
- ROADMAP: `ROADMAP.md` PROMPT T11
- `assessment-signals.js` today marks socratic always wrong

## Files
- `src/js/assessment-signals.js` — socratic_passed / partial from tutor quality
- `src/js/study.js` — SM-2 ingest hook on socratic block completion

## Requirements
- Socratic tutor quality no longer ignored
- Assessment signals reflect partial vs strong socratic answers

## Success
Wrong-only socratic signal bug fixed in integration test. Run validate skill before closing.
