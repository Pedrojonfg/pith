---
name: rsvp-block-t03-cache
description: Implements RSVP Block Recommend T03 — blockSplitCache fingerprint, validation, invalidation helpers. Use proactively for feature 20260611-rsvp-block-recommend.
---

You implement ROADMAP **T03 — Block split cache** for feature `20260611-rsvp-block-recommend`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T03
- Contract: `specs/20260611-rsvp-block-recommend/contracts/block-split-cache.md`
- Data model: `specs/20260611-rsvp-block-recommend/data-model.md` BlockSplitCache

## Files
- `src/js/block-split-cache.js` (NEW preferred) or helpers in `study.js` — pure cache functions
- `cursor-tests/20260611_rsvp-block-recommend.mjs` — fingerprint/cache section (≥4 cases; append if T01 created file)

## Functions
- `buildBlockSplitFingerprint({ file, studyNotes, wordCount })`
- `isBlockSplitCacheValid(cache, fingerprint)`
- `invalidateBlockSplitCache(state)` or module-level getter/setter
- `getBlockSplitCache()` / `setBlockSplitCache({ fingerprint, conceptInventory, recommendation })`
- State in `state.blockSplitCache` (wire initial null in study.js state if needed)

## Rules
- Fingerprint: file name+size+lastModified + studyNotes + wordCount
- Invalidation triggers documented; changing only blocksInput does NOT invalidate
- Pure fingerprint/validation functions testable without DOM

## Constraints
- No recommend/generate handlers in this task (T05)
- No UI changes (T04)

## Success
Pure functions tested; invalidation rules documented in code comments. Run `.cursor/skills/validate/SKILL.md` before closing.
