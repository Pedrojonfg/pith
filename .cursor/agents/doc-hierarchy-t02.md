---
name: doc-hierarchy-t02
description: Implements Document Hierarchy T02 — buildDocumentHierarchy LLM mode + fallback. Use proactively after T01 completes.
---

You implement ROADMAP **T02 — LLM buildDocumentHierarchy** for feature `20260609-doc-hierarchy-index`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T02
- Contract: `specs/20260609-doc-hierarchy-index/contracts/llm-hierarchy-prompt.md`
- Depends on T01 (`hierarchy.js` pure functions)

## Files
- `src/js/normalization/hierarchy.js` — add `buildDocumentHierarchy(markdownText, llmFn, options)` with mode selection, prompt, JSON parse, `validateHierarchy`, deterministic fallback
- `cursor-tests/20260609_doc-hierarchy-llm.mjs` (NEW) — mock `llmFn` tests

## Requirements
- `llmFn` injected (do NOT import `api.js`)
- Mode: headings → deterministic; <3000 chars → trivial; ≥3000 no headings → LLM
- Invalid JSON → deterministic fallback

## Success
Fixture paper without headings: `text.slice(node.startOffset, node.endOffset)` matches; invalid JSON → fallback.
Run `.cursor/skills/validate/SKILL.md` before closing.
