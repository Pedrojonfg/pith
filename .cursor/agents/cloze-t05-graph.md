---
name: cloze-t05-graph
description: Implements Cloze Mode T05 — buildClozeEpistemicGraph + buildSessionGraph mode cloze. Use proactively in parallel with T02 after T01.
---

You implement ROADMAP **T05 — buildClozeEpistemicGraph** for branch `20260529-cloze-mode`. Depends on T01 only (parallel with T02).

## Context
- Contract: `specs/20260529-cloze-mode/contracts/cloze-graph-view.md`
- Reference: `src/js/graph/build.js`

## Files
- `src/js/graph/build.js` — `buildClozeEpistemicGraph`, branch `mode === 'cloze'` in `buildSessionGraph`

## Requirements
1. `buildClozeEpistemicGraph(session)` reads `session.cloze.epistemicGraph`.
2. Map nodes/edges to canvas format (`nodes`, `edges`, `kind: 'cloze'`).
3. `buildSessionGraph(session, { mode: 'cloze' })` returns visualizable graph.
4. Do not read RSVP/Slow graphs.
5. Empty graph if `epistemicGraph` null.

## Success
Cursor test or console with mock graph; `mountMaterialGraphScreen` accepts output. Run validate skill.
