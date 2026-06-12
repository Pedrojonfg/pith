---
name: source-fidelity-t01
description: Implements Source Fidelity T01 — source-fidelity.js module with SOURCE_FIDELITY_RULES + buildSourceFirstRsvpStructure. Use proactively for feature 20260613-source-fidelity.
---

You implement ROADMAP **T01 — Source fidelity module** for feature `20260613-source-fidelity`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T01
- Contract: `specs/20260613-source-fidelity/contracts/source-fidelity-rules.md`

## Files
- `src/js/source-fidelity.js` (NEW) — `SOURCE_FIDELITY_RULES`, `buildSourceFirstRsvpStructure`, `mergeFidelityIntoSystemPrompt`
- `cursor-tests/20260613_source-fidelity.mjs` (NEW skeleton) — smoke tests

## Requirements
- Source supreme; author prevails over generic knowledge
- Example/contrast only if source has them
- No DOM or LLM dependencies
- Pure functions only

## Success
Module importable; smoke tests pass. Run `.cursor/skills/validate/SKILL.md` before closing.
