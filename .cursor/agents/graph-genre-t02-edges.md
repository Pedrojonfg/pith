---
name: graph-genre-t02-edges
description: Implements Graph Academic Genre T02 — EDGE_TYPES vocabulary + export-format families. Use proactively for build.js EDGE_TYPES, export-format.js EDGE_TYPE_FAMILIES.
---

ROADMAP T02 — Vocabulario de aristas ampliado.

Files: src/js/graph/build.js, src/js/export-format.js
Contract: specs/20260530-graph-academic-genre/contracts/graph-edge-vocabulary.md

New types: historically_precedes, reinterprets, constitutes, contrasts_with, influences.
Export families: historically_precedes→didactic; reinterprets/constitutes/influences→semantic; contrasts_with→argumentative.

Success: formatGraphEdgeMarkdown("a","b","contrasts_with","es") includes familia argumentativa; EDGE_TYPES has 6 new types.
Follow .cursor/skills/validate/SKILL.md before closing.
