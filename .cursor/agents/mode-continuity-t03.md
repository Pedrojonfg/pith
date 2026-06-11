---
name: mode-continuity-t03
description: Implements Mode Continuity T03 — mode-bootstrap.js resolveModeEntryState and buildModeSliceFromShared. Use proactively for feature 20260612-mode-continuity.
---

You implement ROADMAP **T03 — Mode bootstrap** for feature `20260612-mode-continuity`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T03
- Contract: `specs/20260612-mode-continuity/contracts/mode-bootstrap-api.md`
- Reuse `createClozeSession`, `createSlowSession` from `study.js` (import them)

## Files
- `src/js/mode-bootstrap.js` (NEW) — `resolveModeEntryState`, `buildModeSliceFromShared`
- `cursor-tests/20260612_mode-continuity.mjs` — section `// --- T03 mode bootstrap ---` with ≥8 cases

## Requirements
- Pure resolve: no DOM, no localStorage in resolveModeEntryState
- `upload_required` if !doc or no shared.rawMarkdown/rawMarkdownRef
- `resume` if mode slice resumable: RSVP/Questions n_blocks>0+blocks; Slow phase non-empty; Cloze cloze.normalizedText present
- `bootstrap` if rawMarkdown present but not resumable
- `buildModeSliceFromShared`: text from shared.rawMarkdown; materialMeta from uploadMeta or docMeta; RSVP/Questions shell only; Slow/Cloze use create*Session

## Constraints
- Do NOT wire study.js UI in this task
- Append T03 tests only; preserve other sections

## Success
≥8 bootstrap unit tests pass with register.mjs. Run validate skill before closing.
