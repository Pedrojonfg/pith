---
name: flow-panel-t01-chrome
description: Implements Flow Panel Chrome Polish T01 — resolveChromeVisibility + syncFloatingChrome FAB rules. Use proactively for feature 20260610-flow-panel-chrome-polish.
---

You implement ROADMAP **T01 — Chrome visibility** for feature `20260610-flow-panel-chrome-polish`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T01
- Contract: `specs/20260610-flow-panel-chrome-polish/contracts/chrome-visibility.md`

## Files
- `src/js/ui.js` — export `resolveChromeVisibility(ctx)`, refactor `syncFloatingChrome`; narrow `SCREENS_WITH_GUIDE_TOGGLE`
- `src/js/dictionary.js` — trigger chrome re-sync when concept visibility changes

## Rules
- Block-read FAB: RSVP + test/socratic + blockReadWanted + !assessment
- Guide FAB: cloze/questions + test/socratic/between(hasConcepts) + !offline + !assessment
- Never on modeSelect, create, slow, assessment screens

## Success
Pure testable `resolveChromeVisibility`; FABs hidden on mode select. Run validate skill before closing.
