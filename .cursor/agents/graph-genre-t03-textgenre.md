---
name: graph-genre-t03-textgenre
description: Implements Graph Academic Genre T03 — textGenre detection in Phase 0 prompts + validation. Use proactively for phase0.js prompts, validatePhase0Orientation, normalizeArgumentMapNode.
---

ROADMAP T03 — Detección género textual Phase 0.

Files: src/js/slow/phase0.js
Contract: specs/20260530-graph-academic-genre/contracts/phase0-text-genre.md

Genres: ARGUMENTO_LINEAL, GENEALOGÍA, DEBATE, DEFINICIÓN, ANÁLISIS_DE_CASO.
- textGenre in prompts (single + synthesis)
- argumentMap fields: period (GENEALOGÍA), author (DEBATE)
- Default ARGUMENTO_LINEAL if missing/invalid

Success: validatePhase0Orientation with textGenre GENEALOGÍA returns valid object.
Follow .cursor/skills/validate/SKILL.md before closing.
