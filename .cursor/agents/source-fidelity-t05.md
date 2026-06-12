---
name: source-fidelity-t05
description: Implements Source Fidelity T05 — chunk-alignment.js assignAlignedChunks. Use proactively for feature 20260613-source-fidelity.
---

You implement ROADMAP **T05 — Chunk alignment module** for feature `20260613-source-fidelity`.

## Context
- Contract: `specs/20260613-source-fidelity/contracts/chunk-alignment.md`

## Files
- `src/js/chunk-alignment.js` (NEW) — `assignAlignedChunks`
- `cursor-tests/20260613_source-fidelity.mjs` — ≥4 alignment tests

## Requirements
- `anchor_quality`: strong | weak | proportional_fallback
- `chunk_match_terms` in metadata
- Overview block 1 = intro slice

## Success
≥4 deterministic alignment tests pass. Run validate skill before closing.
