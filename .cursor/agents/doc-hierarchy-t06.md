---
name: doc-hierarchy-t06
description: Implements Document Hierarchy T06 — pagination section boundary snap in slow/pagination.js and reader.js. Use proactively after T04.
---

You implement ROADMAP **T06 — Paginación respeta fronteras** for feature `20260609-doc-hierarchy-index`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T06
- Contract: `specs/20260609-doc-hierarchy-index/contracts/consumer-integration.md` §3

## Files
- `src/js/slow/pagination.js` — option `sectionBoundaries`, `sectionSnapSlack: 200`
- `src/js/slow/reader.js` — pass boundaries from `docHierarchy` (scope-relative)
- `cursor-tests/20260609_doc-hierarchy-pagination.mjs` (NEW)

## Success
Known sections — cuts at boundaries, not mid-section.
Run `.cursor/skills/validate/SKILL.md` before closing.
