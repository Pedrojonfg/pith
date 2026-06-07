---
name: cloze-t01-sessions
description: Implements Cloze Mode T01 — sessionsByMode.cloze slot, normalizeStudyMode, migration. Use proactively for session.js and cloze persistence.
---

You implement ROADMAP **T01 — sessionsByMode.cloze** for branch `20260529-cloze-mode`.

## Context
- Spec: `specs/20260529-cloze-mode/spec.md`
- Contract: `specs/20260529-cloze-mode/contracts/mode-selector-cloze.md`
- Data model: `specs/20260529-cloze-mode/data-model.md`

## Files
- `src/js/session.js` — `normalizeStudyMode`, `emptySessionsByMode`, `parseSessionsByModeRaw`, `storeSessionsByMode`, migration
- `src/js/study.js` — `getStudyModeLabel` if needed
- `cursor-tests/20260529_t01-cloze-sessions.mjs` (create)

## Requirements
1. `normalizeStudyMode('cloze')` → `'cloze'` (rsvp/slow intact).
2. `emptySessionsByMode()` → `{ rsvp: null, slow: null, cloze: null }`.
3. Parse/store include `cloze`; idempotent migration if `cloze` absent.
4. `loadSessionForMode('cloze')` / `storeSessionForMode('cloze', …)` work.
5. Test: round-trip localStorage with three slots.

## Do NOT touch
Pipeline IA, UI selector (T02).

## Success
`node --import ./cursor-tests/register.mjs cursor-tests/20260529_t01-cloze-sessions.mjs` passes. Run `.cursor/skills/validate/SKILL.md` before closing.
