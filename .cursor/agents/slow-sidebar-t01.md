---
name: slow-sidebar-t01
description: Implements Slow Mode Wave 2 T01 — reader sidebar with annotations, dictionary, IA placeholder. Use proactively for sidebar.js, slow-mode.css layout 80/20, reader.js integration.
---

You implement ROADMAP **T01 — Sidebar reader completa** for branch `20260528-slow-mode`.

## Context
- `#slowReaderSidebar` exists in `index.html` but is `hidden` and empty.
- Contract: `specs/20260528-slow-mode/contracts/reader-sidebar-tap-to-source.md`
- Research: R13 in `specs/20260528-slow-mode/research.md`

## Files
- `index.html` — sidebar structure in `screenSlowReader`
- `src/css/slow-mode.css` — 80/20 layout, collapsible tab
- `src/js/slow/sidebar.js` (new) — `renderSlowSidebar(session)`, `wireSidebarToggle()`
- `src/js/slow/reader.js` — remove permanent `hidden`; call render on page/annotation change
- `src/js/study.js` — wire if needed

## Tasks
1. Three sections: **Mis anotaciones** (grouped by type with counter), **Diccionario** (phase0 concepts + `getSortedSessionConcepts`), **Preguntar a IA** (placeholder input for T03).
2. Collapsible sidebar: discrete tab; persist `slow.sidebarOpen` in session.
3. Annotation list: symbol, 40-char excerpt, derived page number via `charOffsetToPage`.

## Success criteria
- After 3 annotations, sidebar shows `≈ Paráfrasis (1)` etc. with correct page.
- Sidebar populated and collapsible.

## Before closing
Read and follow `.cursor/skills/validate/SKILL.md`: generate cursor-tests, run them, report results.
Match ES module style with `?v=20260528_1` cache bust. Do not break RSVP.
Report files changed and manual verification steps.
