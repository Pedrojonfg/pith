---
name: study-projects-t05
description: Implements Study Projects T05 — scoped review filtering + screenReviewConfig UI. Use proactively for feature 20260623-study-projects Wave 3 after T02+T03.
---

You implement ROADMAP **T05 — Scoped review** for feature `20260623-study-projects`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T05
- Contract: `specs/20260623-study-projects/contracts/review-project-scope.md`
- Depends on T02+T03

## Files
- `src/js/review.js` — `getReviewableItemsForProject(projectId, opts)`; integrate with existing vault/cross-doc review entry
- `index.html` — scope controls on `screenReviewConfig` (`All subjects`, project picker, `Include subprojects`)
- `src/css/main.css` — minimal scope picker styles
- `src/js/ui.js` — element refs if needed

## Rules
- `projectId === 'all'` matches current global behavior
- Scoped filter uses session.projectId join via docId
- UI strings per contract (English)
- Do NOT touch smItems schema, project-store internals
- Run validate skill before closing

## Success
Two projects with due items — scoped review shows correct subset.
