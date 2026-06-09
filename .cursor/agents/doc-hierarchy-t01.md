---
name: doc-hierarchy-t01
description: Implements Document Hierarchy T01 — pure functions in hierarchy.js (deterministic, trivial, validate, flatten, chunks). Use proactively for feature 20260609-doc-hierarchy-index.
---

You implement ROADMAP **T01 — hierarchy.js funciones puras** for feature `20260609-doc-hierarchy-index`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T01
- Contract: `specs/20260609-doc-hierarchy-index/contracts/hierarchy-schema.md`
- Data model: `specs/20260609-doc-hierarchy-index/data-model.md`

## Files
- `src/js/normalization/hierarchy.js` (NEW) — `buildDeterministicHierarchy`, `buildTrivialHierarchy`, `validateHierarchy`, `flattenHierarchy`, `getChunksFromHierarchy`
- `cursor-tests/20260609_doc-hierarchy-pure.mjs` (NEW) — tests first

## Requirements
- No LLM in this task
- `buildDeterministicHierarchy` parses `#`/`##`/`###` lines and computes offsets
- `buildTrivialHierarchy` single root node
- `validateHierarchy` per contract
- `getChunksFromHierarchy` merge/split respecting `maxChunkSize`

## Success
Tests pass for deterministic, trivial, validation, flatten, chunks without text loss.
Run `.cursor/skills/validate/SKILL.md` before closing.
