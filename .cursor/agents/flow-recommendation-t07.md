---
name: flow-recommendation-t07
description: Implements Flow Recommendation T07 — recommendation panel UI on mode select screen. Use proactively after T06 for feature 20260609-flow-recommendation.
---

You implement ROADMAP **T07 — Panel UI** for feature `20260609-flow-recommendation`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T07
- Contract: `specs/20260609-flow-recommendation/contracts/recommendation-ui.md`

## Files
- `index.html` — markup `#recommendationPanel` and children
- `src/js/study.js` — `renderRecommendationPanel`, wire CTAs
- `src/css/main.css` — minimal linear steps styles

## Requirements
- State A: intro when currentStepIndex===0 && !userOverride && no completedSteps
- State B: progress when completedSteps.length > 0
- State C: hidden on userOverride or no recommendation
- Spanish copy; "(aprox.)" on times
- Override RSVP → opens RSVP and userOverride=true

## Success
Philosophical paper → panel "Slow → Cloze → Revisión" with time and reason; override works. Run validate skill before closing.
