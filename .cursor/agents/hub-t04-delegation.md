---
name: hub-t04-delegation
description: Implements Exposure/Retrieval Hub T04 — hub picks delegate to enterModeWithContinuity. Use proactively after T03 for feature 20260622-exposure-retrieval-hub Wave 3.
---

You implement ROADMAP **T04 — Hub mode delegation** for feature `20260622-exposure-retrieval-hub`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T04
- Contracts: `hub-navigation.md`, `mode-bootstrap.js` existing paths
- Depends on T03

## Files
- `src/js/study.js` — click handlers on `[data-retrieval-mode]` → `enterModeWithContinuity(mode)`

## Requirements
- Each hub option enters correct mode (bootstrap/resume/generate per existing rules)
- No duplicated mode-entry logic in hub module
- Cloze cold start works from hub without intermediate screen

## Success
Hub → Recall/Questions/Cloze each reach study screen on test doc.
Run validate skill before closing.
