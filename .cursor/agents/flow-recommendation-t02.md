---
name: flow-recommendation-t02
description: Implements Flow Recommendation T02 — hierarchy.js pedagogical_meta + fallback. Use proactively for feature 20260609-flow-recommendation.
---

You implement ROADMAP **T02 — hierarchy pedagogical meta** for feature `20260609-flow-recommendation`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T02
- Contract: `specs/20260609-flow-recommendation/contracts/hierarchy-pedagogical-meta.md`

## Files
- `src/js/normalization/hierarchy.js` — prompt JSON `{ tree, pedagogical_meta }`, parse, `buildDeterministicPedagogicalMeta`, return with `pedagogicalMeta`
- `src/js/normalization/hierarchy-cache.js` — cache `pedagogicalMeta` on LLM hits
- Tests in `cursor-tests/` (extend hierarchy tests or new file)

## Requirements
- Import `analyzeText` from `../recommendation/analyzer.js` for `buildDeterministicPedagogicalMeta`
- LLM path: parse pedagogical_meta from JSON response
- Deterministic/trivial/fallback paths use `buildDeterministicPedagogicalMeta`
- Backward compatible: callers using `.tree` only still work

## Success
Philosophical paper via LLM mock → `pedagogicalMeta.genre === 'philosophical'` and `argumentativeDensity >= 4`; deterministic mode returns meta without LLM. Run validate skill before closing.
