---
name: slow-phase0-edit-t04
description: Implements Slow Mode Wave 2 T04 — editable Phase 0, fillable argument map, re-read rules. Use proactively for phase0.js prequestions/fillableBlanks, screenSlowPhase0 UI, study.js handlers.
---

You implement ROADMAP **T04 — Fase 0 editable + mapa rellenable + re-lectura** for branch `20260528-slow-mode`.

## Context
- Contract: `specs/20260528-slow-mode/contracts/phase0-editing-fillable.md`
- Today `renderSlowPhase0Content()` is read-only; `skipSlowPhase0` always allows skip.

## Files
- `index.html` — `screenSlowPhase0` editable fields
- `src/js/study.js` — `renderSlowPhase0Content`, `wireSlowPhase0Handlers`, `skipSlowPhase0`
- `src/js/slow/phase0.js` — schema `prequestions`, `fillableBlanks`
- `index.html` / `study.js` — fillable map toggle on scope screen

## Tasks
1. Edit: prequestions (list), argument map nodes, add concepts from dictionary (`graphTermId`).
2. Toggle **Mapa rellenable** in scope → Phase 0 with blanks; fill during Phase 1 (save page).
3. `phase0SeenKey`: re-read → collapsed; **first read** without "Continuar sin orientación".
4. Findings `✦` visible in Phase 1 only if fillable map active.

## Success criteria
- Second session same scope → Phase 0 collapsed; first without skip; editable map persists.

## Before closing
Read and follow `.cursor/skills/validate/SKILL.md`: generate cursor-tests, run them, report results.
Match project conventions. Do not break RSVP.
Report files changed and manual verification steps.
