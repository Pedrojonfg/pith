---
name: doc-hierarchy-t05
description: Implements Document Hierarchy T05 — scope picker from docHierarchy tree in slow/headings.js. Use proactively after T04.
---

You implement ROADMAP **T05 — Scope picker desde árbol** for feature `20260609-doc-hierarchy-index`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T05
- Contract: `specs/20260609-doc-hierarchy-index/contracts/consumer-integration.md` §2

## Files
- `src/js/slow/headings.js` — `buildScopeOptions` reads `flattenHierarchy(session.docHierarchy.tree, 2)`; fallback if `null`
- `src/js/study.js` — pass `docHierarchy` if needed
- `cursor-tests/20260609_doc-hierarchy-scope.mjs` (NEW)

## Success
Paper without headings shows inferred tree in scope picker; session without `docHierarchy` no regression.
Run `.cursor/skills/validate/SKILL.md` before closing.
