---
name: markdown-canonical-t03
description: Implements Markdown Canonical T03 — migrate-html-min.js + session load hook for legacy html_min sessions. Use proactively in parallel with T01 at feature start.
---

You implement ROADMAP **T03 — Migración sesiones html_min** for feature `20260532-markdown-canonical`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T03
- Contract: `specs/20260532-markdown-canonical/contracts/session-migration.md`

## Files
- `src/js/normalization/migrate-html-min.js` (create) — `htmlMinToMarkdown`, `migrateLegacyHtmlMinSession`
- `src/js/study.js` and/or `src/js/session.js` — hook on Slow/Cloze session load
- `cursor-tests/fixtures/legacy-html-min-session.json` (create)

## Requirements
1. `htmlMinToMarkdown(text)` — deterministic: h1-h6 → `#`, p → paragraphs, li → `- `, strip other tags.
2. `migrateLegacyHtmlMinSession(session)` — per contract; set `_migratedFromHtmlMin: true`; idempotent.
3. Hook when loading session from localStorage/import if `session.slow?.normalizedFormat === "html_min"` or cloze slot.
4. Fixture with legacy html_min session for tests.

## Success
- Fixture legacy session loads; after migration `parseHeadings` finds headings.
- Run `.cursor/skills/validate/SKILL.md`: create `cursor-tests/20260608_t03-migrate-html-min.mjs` and execute.

## Constraints
- No re-normalize from source file; lazy migration only.
- No new npm deps.
