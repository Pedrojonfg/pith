---
name: graph-genre-t01-nodetypes
description: Implements Graph Academic Genre T01 — nodeType subtypes in Phase 0 + graph labels. Use proactively for phase0.js normalizeConcept, buildSlowPhase0GraphFromInputs.
---

ROADMAP T01 — Tipado de nodos (nodeType) en capa text.

Files: src/js/slow/phase0.js, src/js/graph/build.js
Contract: specs/20260530-graph-academic-genre/contracts/text-node-subtypes.md

Subtypes: CONCEPTO, PERSONA, OBRA, MOVIMIENTO, EVENTO.
- nodeType in JSON schema + normalizeConcept (parse [TIPO] prefix in term)
- Graph: label `[${nodeType}] ${term}`, metadata nodeSubtype
- Default CONCEPTO for unknown types

Success: normalizeConcept({ term: "Bildung", authorUsage: "...", nodeType: "CONCEPTO" }) → label `[CONCEPTO] Bildung`.
Follow .cursor/skills/validate/SKILL.md before closing.
