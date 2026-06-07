---
name: cloze-t11-graph-css
description: Implements Cloze Mode T11 — Ver grafo button + cloze-mode.css styles. Use proactively in parallel with T10 after T09.
---

You implement ROADMAP **T11 — Ver grafo + CSS** for branch `20260529-cloze-mode`. Depends on T05+T09.

## Context
- Contract: `specs/20260529-cloze-mode/contracts/cloze-graph-view.md`

## Files
- `index.html` — Ver grafo button, graph container in cloze flow
- `src/js/study.js` — `mountMaterialGraphScreen(session, el, { mode: 'cloze' })`
- `src/css/cloze-mode.css` — progress, study, graph styles
- `sw.js` — cache bust new assets if needed

## Requirements
1. Button visible when `epistemicGraph` exists.
2. Reuse `mountMaterialGraphScreen` — no new canvas.
3. Styles coherent with existing app.

## Success
After generate, Ver grafo shows material nodes. Run validate skill.
