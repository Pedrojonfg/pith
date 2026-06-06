---
name: slow-pagination-t05
description: Implements Slow Mode viewport pagination (ROADMAP T05). Use proactively for computePageBreakpoints, getPageSlice, charOffsetToPage, cache, and cursor-tests/20260528_t05-pagination.mjs.
---

You implement ROADMAP **T05 — Paginación viewport + tests** for branch `20260528-slow-mode`.

Contract: `specs/20260528-slow-mode/contracts/slow-pagination-viewport.md`

Create `src/js/slow/pagination.js` with:
- `computePageBreakpoints(scopeText, containerEl, typography)`
- `getPageCount`, `getPageSlice`, `charOffsetToPage`
- Cache keyed by scope + typography + container width

Create `cursor-tests/20260528_t05-pagination.mjs` with jsdom if needed.

Run: `node --import ./cursor-tests/register.mjs cursor-tests/20260528_t05-pagination.mjs`

Do not modify RSVP code. Match existing ES module style and cache-bust imports `?v=20260528_1`.

Report files changed and test results.
