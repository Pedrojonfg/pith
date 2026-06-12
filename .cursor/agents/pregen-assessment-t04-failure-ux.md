---
name: pregen-assessment-t04-failure-ux
description: Implements fix-pregen-assessment T04 — visible error, Retry + explicit Skip on assessment generation failure. Use proactively after T02 for feature 20260616-fix-pregen-assessment.
---

You implement ROADMAP **T04 — UX fallo generación** for feature `20260616-fix-pregen-assessment`. Depends on **T02**.

## Context
- Contract: `assessment-failure-ux.md`, FR-004

## Files
- `src/js/study.js` — `retryPrePackingAssessmentGeneration()`, wire error state in runner catch; Retry + Skip buttons
- `index.html` — only if needed (prefer `#testError` / `#testAssessmentChrome`)

## Rules
- Retry clears `itemsPromise` and re-enters runner with current config
- Skip only on explicit click (`handlePrePackingSkip`)
- Copy: "Could not load knowledge check questions." / "Try again" / "Skip assessment"

## Success
Simulated failure does not reach block editor without user action. Run validate before closing.
