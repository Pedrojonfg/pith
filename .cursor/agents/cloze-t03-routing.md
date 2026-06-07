---
name: cloze-t03-routing
description: Implements Cloze Mode T03 — study.js routing for create/resume/new cloze session. Use proactively after T02 selector exists.
---

You implement ROADMAP **T03 — Routing study.js cloze** for branch `20260529-cloze-mode`. Depends on T01+T02.

## Context
- Spec FR-001, FR-009
- ROADMAP: `ROADMAP.md` PROMPT T03

## Files
- `src/js/study.js` — `enterCreateScreenForMode`, `wireStudyModeSelector`, `continueSessionBtn`, `newSessionModeBtn`, `updateCreateScreenModeVisibility`, `resumeClozeSession` (new)
- `src/js/main.js` — bootstrap if needed

## Requirements
1. Cloze + existing slot → Continue / New session panel.
2. Continue loads `sessions_by_mode.cloze` into `state.activeSession`.
3. New session replaces only `cloze` slot (confirm if session existed).
4. `state.studyMode = 'cloze'` coherent throughout.
5. Do NOT implement pipeline or MC study yet (T04+).

## Success
Continue/new cloze session without crossing rsvp/slow data. Run validate skill.
