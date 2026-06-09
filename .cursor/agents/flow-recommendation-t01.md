---
name: flow-recommendation-t01
description: Implements Flow Recommendation T01 — analyzer.js analyzeText → TextMetrics. Use proactively for feature 20260609-flow-recommendation.
---

You implement ROADMAP **T01 — analyzer.js** for feature `20260609-flow-recommendation`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T01
- Contract: `specs/20260609-flow-recommendation/contracts/analyzer-api.md`
- Data model: `specs/20260609-flow-recommendation/data-model.md` (TextMetrics)

## Files
- `src/js/recommendation/analyzer.js` (NEW) — `analyzeText(markdownText)`
- `cursor-tests/20260609_flow-recommendation-analyzer.mjs` (NEW)

## Requirements
- Pure function: no I/O, no LLM, deterministic
- Safe with null/undefined → empty string
- sizeCategory thresholds per contract
- Heuristics: bibliography, math, definitions, first person, academic vocab ES+EN
- 8+ test cases: philosophical paper, first person notes, bibliography [1], tiny <2k, math, definitions, headings, academic vocab

## Constraints
- No changes to study.js or hierarchy.js in this task

## Success
8+ tests pass. Run `.cursor/skills/validate/SKILL.md` before closing.
