---
name: slow-graph-t11
description: Implements Slow Mode Wave 2 T11 — enriched graph view with 2 layers list/tree UI. Use proactively for graph-view.js, screenSlowGraph, phase3.js graph button, dictionary.js integration.
---

ROADMAP T11 — Vista grafo enriquecida. Depends T05+T08.

Contract: specs/20260528-slow-mode/contracts/graph-enriched-view.md

Files: graph-view.js (new), index.html, dictionary.js, phase3.js

Tasks:
1. buildEnrichedGraph(session) → [Texto] / [Pedro:] nodes + edges
2. List/tree navigable UI (no canvas v2)
3. Tap user node → jumpToAnnotation
4. Write integration to dictionary or slow.graphNodes

Success: After Phase 3 "Ver grafo" shows ≥1 user node linked to annotation.

Follow .cursor/skills/validate/SKILL.md before closing.
