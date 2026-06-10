---
name: rsvp-block-t02-split-refactor
description: Implements RSVP Block Recommend T02 — runConceptInventory + packInventoryToBlocks refactor in session.js. Use proactively for feature 20260611-rsvp-block-recommend.
---

You implement ROADMAP **T02 — Split phase refactor** for feature `20260611-rsvp-block-recommend`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T02
- Contract: `specs/20260611-rsvp-block-recommend/contracts/block-split-cache.md`

## Files
- `src/js/session.js` — export `runConceptInventory`, `packInventoryToBlocks`; `twoPhaseConceptSplit` delegates to both without changing external behavior

## Requirements
- `runConceptInventory` = only `deepSeekConceptInventory` + progress "Indexing concepts…"
- Returns `{ inventory, concept_count }`
- `packInventoryToBlocks` = pack + chunks + dedup (no re-indexing)
- Returns `{ blockIndex, splitRunMeta, conceptInventory }` matching current twoPhaseConceptSplit shape
- `twoPhaseConceptSplit` = call inventory then pack; fallback mono split only in wrapper catch block
- Preserve existing progress messages, dedup, pack_meta, concept_ids logic

## Constraints
- No changes to study.js handlers in this task (T05 wires them)
- External behavior of `twoPhaseConceptSplit` must remain identical for manual generate path
- Minimal diff — extract, don't rewrite

## Success
Exports available; manual RSVP generate path unchanged. Run `.cursor/skills/validate/SKILL.md` before closing.
