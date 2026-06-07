---
name: slow-ia-overlay-t03
description: Implements Slow Mode Wave 2 T03 — dismissable IA overlay and ia-query annotations. Use proactively for ai-context.js, sidebar.js query, reader.js overlay, annotations.js ia-query type.
---

You implement ROADMAP **T03 — Overlay IA + anotaciones query** for branch `20260528-slow-mode`.

Contract: specs/20260528-slow-mode/contracts/reader-sidebar-tap-to-source.md (IA section)

Files: ai-context.js, sidebar.js, reader.js, annotations.js, slow-mode.css (.slow-ia-overlay)

Tasks:
1. Sidebar "Preguntar a IA" → askSlowReaderIA → overlay with answer (≤3 sentences)
2. Dismiss: ×, swipe down, Escape; focus returns to text
3. Persist query+response as special annotation linked to current offset
4. Show existing aiReply on ⚑/⇑ in same overlay

Success: Sidebar question → overlay → dismiss → reading position preserved.

Before closing: follow .cursor/skills/validate/SKILL.md, run tests.
