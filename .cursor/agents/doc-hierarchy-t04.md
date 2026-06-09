---
name: doc-hierarchy-t04
description: Implements Document Hierarchy T04 — upload integration study.js session.js loading UI. Use proactively after T02 and T03.
---

You implement ROADMAP **T04 — Integración upload y sesión** for feature `20260609-doc-hierarchy-index`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T04
- Contract: `specs/20260609-doc-hierarchy-index/contracts/consumer-integration.md` §1

## Files
- `src/js/session.js` — `docHierarchy: null` in defaults
- `src/js/study.js` — call `buildDocumentHierarchy` post-upload; wire `llmFn` from `llm.js`/`api.js`; non-blocking loading state
- `index.html` / CSS minimal loading indicator on scope picker if needed
- `cursor-tests/20260609_doc-hierarchy-upload.mjs` (NEW)

## Requirements
- No API key in LLM mode → `docHierarchy = null`
- After upload ≥3000 chars, `session.docHierarchy` valid

## Success
Loading visible in LLM mode; session shape correct.
Run `.cursor/skills/validate/SKILL.md` before closing.
