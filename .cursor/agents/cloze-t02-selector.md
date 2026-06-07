---
name: cloze-t02-selector
description: Implements Cloze Mode T02 — third mode in create screen UI (Cloze Detection radio + hints). Use proactively for index.html, main.css, study.js mode selector.
---

You implement ROADMAP **T02 — Selector 3 modos UI** for branch `20260529-cloze-mode`. Depends on T01.

## Context
- Contract: `specs/20260529-cloze-mode/contracts/mode-selector-cloze.md`
- ROADMAP: `ROADMAP.md` PROMPT T02

## Files
- `index.html` — radio `studyMode` value `cloze`, descriptive hint
- `src/css/main.css` — layout for 3 options if needed
- `src/js/study.js` — `getStudyModeLabel`, `resetModeSelectUi`, hints, `updateCreateScreenModeVisibility` for cloze

## Requirements
1. Three modes visible without preselection: RSVP, Slow Mode, Cloze Detection.
2. Cloze hint: active recall with cloze items on material.
3. When cloze selected: hide RSVP controls (blocks) and Slow (critical mode, scope).
4. No regression on RSVP/Slow selection.

## Do NOT implement
Routing create/resume (T03), pipeline (T04+).

## Success
Manual: create screen shows 3 modes; each mode shows correct control visibility. Run validate skill before closing.
