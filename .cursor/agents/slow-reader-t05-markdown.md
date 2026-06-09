---
name: slow-reader-t05-markdown
description: Implements Slow Reader Desktop T05 — markdown page render + selection-to-plain-offset mapping for annotations. Use proactively after T01 for reader.js and slow-mode.css.
---

You implement ROADMAP **T05 — Markdown render y offsets de selección** for feature `20260533-slow-reader-desktop`.

## Files
- `src/js/slow/reader.js`:
  - Import `markdownToHtml` from `markdown.js`
  - `renderSlowReaderPage`: if `normalizedFormat === 'markdown'`, innerHTML + `md-content`; else textContent
  - `selectionToScopeOffsetsFromRendered` or equivalent for HTML DOM
  - Update `selectionToScopeOffsets`, `measureMarkY`, `highlightRange` for HTML content
- `src/css/slow-mode.css` — `.slow-reader-page.md-content` styles

## Contracts
`reader-markdown-render.md`, `specs/20260528-slow-mode/contracts/annotation-char-offsets.md`

## Success criteria
- SC-002/SC-003: headings visible; annotation after selecting bold text preserves correct offset.

## Before closing
Read and follow `.cursor/skills/validate/SKILL.md`.
