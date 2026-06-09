---
name: doc-hierarchy-t08
description: Implements Document Hierarchy T08 — integration tests and quickstart QA closure. Use proactively after T05 T06 T07.
---

You implement ROADMAP **T08 — Tests integración y QA** for feature `20260609-doc-hierarchy-index`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T08
- Quickstart: `specs/20260609-doc-hierarchy-index/quickstart.md`

## Files
- `cursor-tests/20260609_doc-hierarchy-integration.mjs` (NEW)
- Cases: headings→deterministic; no headings→LLM; <3k→trivial; cache; invalid→fallback; chunks; scope picker; pagination
- Mark T01–T08 [x] in `ROADMAP.md`

## Success
All cursor-tests pass; quickstart checklist complete.
Run `.cursor/skills/validate/SKILL.md` before closing.
