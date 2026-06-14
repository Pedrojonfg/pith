---
name: study-projects-t09
description: Implements Study Projects T09 — upload project selector, mode hub, breadcrumbs on study screens. Use proactively for feature 20260623-study-projects Wave 4 after T08.
---

You implement ROADMAP **T09 — Upload, mode hub & study breadcrumbs** for feature `20260623-study-projects`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T09
- Spec: `specs/20260623-study-projects/spec.md` US-1, US-5
- Contract: `specs/20260623-study-projects/contracts/project-library-ui.md`
- Depends on T08

## Files
- `src/js/study.js` — upload screen project selector prefill rules; mode select Continue/Library/Review hub when general entry; breadcrumb on mode select and active modes via `enterModeWithContinuity`
- `index.html` — upload project selector on `screenPlaceholder`; mode hub buttons if missing

## PWA (mandatory)
Bump `SW_VERSION` in `src/js/sw-update.js`, matching `?v=` in `index.html`, `CACHE_NAME` in `sw.js`.

## Rules
- Upload from root defaults misc; from project defaults that project
- General mode select shows three hub actions
- Breadcrumb on study screens shows project path
- Run validate skill before closing

## Success
upload + hub + breadcrumb manual quickstart §3–5 pass.
