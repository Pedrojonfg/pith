---
name: flow-panel-t05-chrome-tests
description: Implements Flow Panel Chrome Polish T05 — chrome regression cursor-tests. Use proactively after T01 for feature 20260610-flow-panel-chrome-polish.
---

You implement ROADMAP **T05 — Chrome regression tests** for feature `20260610-flow-panel-chrome-polish`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T05
- Contract: `specs/20260610-flow-panel-chrome-polish/contracts/chrome-visibility.md`

## Files
- `cursor-tests/20260610_flow-panel-chrome-polish.mjs` — chrome section (12+ cases)

## Success
Suite passes with `node --import ./cursor-tests/register.mjs`. Run validate skill before closing.
