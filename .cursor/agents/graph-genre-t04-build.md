---
name: graph-genre-t04-build
description: Implements Graph Academic Genre T04 — genre-aware buildSlowPhase0GraphFromInputs. Use proactively after T03 for historically_precedes vs sequence edges.
---

ROADMAP T04 — buildSlowPhase0Graph genre-aware. Deps T03.

Files: src/js/graph/build.js
- mapEdgeType: GENEALOGÍA → historically_precedes, else sequence
- argNodeLabel with period/author

Follow .cursor/skills/validate/SKILL.md before closing.
