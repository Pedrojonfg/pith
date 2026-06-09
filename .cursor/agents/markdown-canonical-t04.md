---
name: markdown-canonical-t04
description: Implements Markdown Canonical T04 — simplify headings.js (markdown primary, html_min legacy). Use proactively after T01 completes.
---

You implement ROADMAP **T04 — headings.js simplificado** for feature `20260532-markdown-canonical`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T04
- Depends on T01 (new uploads emit markdown)

## Files
- `src/js/slow/headings.js` — markdown as default path; `html_min` parser only for legacy

## Requirements
1. `parseHeadings("#### X", "markdown")` returns correct heading.
2. Default format assumption should be markdown when format omitted or unknown.
3. Keep `html_min` parser for legacy sessions not yet migrated.
4. `buildScopeOptions` works with markdown-normalized HTML uploads.

## Success
- Unit tests via validate skill: `cursor-tests/20260608_t04-headings-markdown.mjs`
- Run `.cursor/skills/validate/SKILL.md` before closing.

## Constraints
- Surgical changes to headings.js only unless tests require fixtures.
