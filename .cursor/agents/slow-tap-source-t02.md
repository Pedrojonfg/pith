---
name: slow-tap-source-t02
description: Implements Slow Mode Wave 2 T02 — tap-to-source bidirectional navigation and Y-anchored margin marks. Use proactively for sidebar.js jumpToAnnotation, reader.js highlightRange, renderMarginMarks.
---

You implement ROADMAP **T02 — Tap-to-source + margen Y** for branch `20260528-slow-mode`.

Contract: `specs/20260528-slow-mode/contracts/reader-sidebar-tap-to-source.md`
Depends on T01 (sidebar.js exists).

Files: sidebar.js (jumpToAnnotation), reader.js (highlightRange, click .annotation-mark), pagination.js (charOffsetToPage).

Tasks:
1. Click sidebar item or margin mark → jump to page + 2s pulse highlight
2. Position margin marks in Y via Range API; vertical fallback
3. Update renderMarginMarks() — stop stacking all at top

Success: Tap annotation on page 5 from sidebar on page 1 → navigates and highlights.

Before closing: follow .cursor/skills/validate/SKILL.md, run tests.
