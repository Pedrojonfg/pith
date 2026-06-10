---
name: rsvp-block-t01-recommender
description: Implements RSVP Block Recommend T01 — computeBlockCountRecommendation pure formula + unit tests. Use proactively for feature 20260611-rsvp-block-recommend.
---

You implement ROADMAP **T01 — Block count recommender** for feature `20260611-rsvp-block-recommend`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T01
- Contract: `specs/20260611-rsvp-block-recommend/contracts/block-count-recommender-api.md`
- Research: `specs/20260611-rsvp-block-recommend/research.md` R3

## Files
- `src/js/recommendation/block-count-recommender.js` (NEW) — `computeBlockCountRecommendation(signals)`, `formatBlockCountReasoning(rec)`
- `cursor-tests/20260611_rsvp-block-recommend.mjs` (NEW) — unit recommender section (≥12 cases)

## Requirements
- Clamp 5–60; export `MIN_BLOCKS`, `MAX_BLOCKS`, `WORDS_PER_BLOCK_TARGET`, `BASE_CONCEPTS_PER_BLOCK`
- No LLM; pure deterministic function
- `signalsUsed` and `factors` in output for tests
- `reasoning` EN 1–2 sentences via `formatBlockCountReasoning`
- Formula per contract: targetConceptsPerBlock, conceptN, wordN, sectionN, sizeCategory tiny cap, genre multipliers

## Test cases (min 12)
- 10 concepts, 3k words → low N (≥5)
- 80 concepts, dense philosophical → higher N
- tiny sizeCategory caps at 8
- clamp 5 and 60 boundaries
- missing meta defaults conceptualLoad 3
- lecture_notes / firstPersonRatio multiplier 0.95
- scientific_theoretical high load multiplier 1.10

## Constraints
- No changes to study.js, session.js, index.html in this task
- Follow patterns in `src/js/recommendation/recommender.js` and `analyzer.js`

## Success
Recommender unit tests pass with `node --import ./cursor-tests/register.mjs cursor-tests/20260611_rsvp-block-recommend.mjs`. Run `.cursor/skills/validate/SKILL.md` before closing.
