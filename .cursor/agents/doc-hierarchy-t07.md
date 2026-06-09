---
name: doc-hierarchy-t07
description: Implements Document Hierarchy T07 — Phase 0 chunks from getChunksFromHierarchy in slow/phase0.js. Use proactively after T04.
---

You implement ROADMAP **T07 — Chunks Fase 0 desde árbol** for feature `20260609-doc-hierarchy-index`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T07
- Contract: `specs/20260609-doc-hierarchy-index/contracts/consumer-integration.md` §4

## Files
- `src/js/slow/phase0.js` — replace arbitrary chunking; structural tree context in prompts
- `cursor-tests/20260609_doc-hierarchy-phase0.mjs` (NEW)

## Success
Chunks contiguous, no overlap, cover full text; section titles in each chunk.
Run `.cursor/skills/validate/SKILL.md` before closing.
