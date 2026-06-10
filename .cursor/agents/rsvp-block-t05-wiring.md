---
name: rsvp-block-t05-wiring
description: Implements RSVP Block Recommend T05 — study.js handlers, generate branch with cache, invalidation. Use proactively after T01–T04 for feature 20260611-rsvp-block-recommend.
---

You implement ROADMAP **T05 — Study.js wiring** for feature `20260611-rsvp-block-recommend`.

## Prerequisites
T01 (recommender), T02 (session split exports), T03 (cache helpers), T04 (DOM IDs) must be complete.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T05
- Contract: `specs/20260611-rsvp-block-recommend/contracts/consumer-integration.md`

## Files
- `src/js/study.js` — `handleRecommendBlockCount`, modify generate handler, invalidation, recommend btn visibility

## Flows
- Recommend: cache hit → skip inventory; miss → `runConceptInventory` → `computeBlockCountRecommendation` → pre-fill blocks
- Generate: cache valid → `packInventoryToBlocks`; else → `twoPhaseConceptSplit`
- Invalidate on file/notes/mode change; NOT on blocksInput change
- Show/hide `#recommendBlocksBtn` when studyMode !== rsvp

## Imports
```js
import { computeBlockCountRecommendation, formatBlockCountReasoning } from './recommendation/block-count-recommender.js'
import { runConceptInventory, packInventoryToBlocks, twoPhaseConceptSplit } from './session.js'
```

## Constraints
- No auto-recommend on upload
- RSVP-only; no Slow/Cloze/Questions changes
- Reuse `analyzeText`, pedagogical meta, section count for signals assembly

## Success
QA-REC-1 and QA-REC-2 manually verifiable; manual generate path no regression. Run `.cursor/skills/validate/SKILL.md` before closing.
