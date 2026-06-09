---
name: markdown-canonical-t01
description: Implements Markdown Canonical T01 — pipeline index.js always emitMarkdown (HTML included). Use proactively at start of feature 20260532-markdown-canonical.
---

You implement ROADMAP **T01 — Pipeline markdown-only** for feature `20260532-markdown-canonical`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T01
- Contract: `specs/20260532-markdown-canonical/contracts/input-normalization-v3.md`
- Pipeline: `src/js/normalization/index.js`

## Files
- `src/js/normalization/index.js` — remove `emitHtmlMin` branch; always `emitMarkdown` for all formats including `html`
- `src/js/normalization/emit-markdown.js` — extend if needed for `kind: "list-item"` blocks from HTML extraction

## Requirements
1. `normalizeDocumentStructure({ format: "html", ... })` MUST return `normalizedFormat: "markdown"`.
2. `normalizedContent` MUST NOT contain HTML tags for HTML input.
3. Remove import/usage of `emitHtmlMin` from pipeline (file may remain for legacy reference but not imported in index.js).
4. Headings still emitted as `#`–`######` via emitMarkdown.
5. Preserve v2 `structure` and `warnings` in pipeline return.

## Success
- `normalizeDocumentStructure({ format: "html", rawContent: "<h1>Title</h1><p>Body</p>" })` → markdown without tags.
- Run `.cursor/skills/validate/SKILL.md`: create `cursor-tests/20260608_t01-markdown-canonical-pipeline.mjs` (or extend existing) and execute with `node --import ./cursor-tests/register.mjs`.

## Constraints
- No new npm deps; surgical diff only.
- Do NOT modify `input-normalization.js` (that's T02).
