---
name: doc-hierarchy-t03
description: Implements Document Hierarchy T03 — hierarchy-cache.js localStorage cache with TTL and LRU. Use proactively in parallel with T01.
---

You implement ROADMAP **T03 — hierarchy-cache.js** for feature `20260609-doc-hierarchy-index`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T03
- Data model: `specs/20260609-doc-hierarchy-index/data-model.md` (HierarchyCacheEntry)

## Files
- `src/js/normalization/hierarchy-cache.js` (NEW) — `hashText`, `getCachedHierarchy`, `setCachedHierarchy`
- Integrate in `buildDocumentHierarchy` with `useCache: true` (may stub integration if T02 not done yet — wire when hierarchy.js has buildDocumentHierarchy)
- `cursor-tests/20260609_doc-hierarchy-cache.mjs` (NEW)

## Requirements
- localStorage key `pith_hierarchy_{textHash}`
- TTL 7 days, LRU max 20 entries, index `pith_hierarchy_index`

## Success
Second call with same text does not invoke `llmFn` (mocked test).
Run `.cursor/skills/validate/SKILL.md` before closing.
