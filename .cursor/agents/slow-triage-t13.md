---
name: slow-triage-t13
description: Implements Slow Mode Wave 2 T13 — §13 triage matrix in mode selector. Use proactively for index.html accordion, main.css, study.js toggle on create screen.
---

You implement ROADMAP **T13 — Triage matriz §13** for branch `20260528-slow-mode`.

## Context
- Research R20; spec §13 matrix + POR QUÉ/QUÉ heuristic
- Today only brief hints on mode radios

## Files
- `index.html` — expandable panel under mode selector
- `src/css/main.css`
- `src/js/study.js` — toggle panel

## Tasks
1. Accordion "¿Qué modo elijo?" with summary matrix (philosophy/literature → Slow; notes/summaries → RSVP).
2. Highlighted heuristic: "¿POR QUÉ cree el autor (Slow) o QUÉ cree (RSVP)?"
3. Static text diagram: bibliography → RSVP → Slow → RSVP review flow.

## Success criteria
- New user sees matrix without leaving create screen.

## Before closing
Read and follow `.cursor/skills/validate/SKILL.md`: generate cursor-tests, run them, report results.
Match project conventions. Do not break RSVP.
Report files changed and manual verification steps.
