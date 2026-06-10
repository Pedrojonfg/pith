---
name: rsvp-block-t04-ui
description: Implements RSVP Block Recommend T04 — Recommend button markup, CSS, ui.js refs. Use proactively for feature 20260611-rsvp-block-recommend.
---

You implement ROADMAP **T04 — Recommend UI markup** for feature `20260611-rsvp-block-recommend`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T04
- Contract: `specs/20260611-rsvp-block-recommend/contracts/recommend-blocks-ui.md`

## Files
- `index.html` — `#recommendBlocksBtn`, `#recommendBlocksStatus`, `#recommendBlocksWhy` inside `#rsvpBlocksSection`
- `src/css/main.css` — `.recommend-blocks-*` minimal styles coherent with create screen
- `src/js/ui.js` — refs in `els`

## Requirements
- Copy EN per contract: button "Recommend block count", loading "Indexing concepts…", etc.
- `#recommendBlocksWhy` hidden by default; `aria-live="polite"`
- Button above or between Blocks label and `#blocksInput`
- No recommend logic — markup + CSS + refs only

## Constraints
- Do not wire click handlers (T05)
- Do not modify study.js business logic
- Match existing collapsible/form patterns in create screen

## Success
IDs present in index.html; refs in ui.js; styles applied. Run `.cursor/skills/validate/SKILL.md` before closing.
