# Implementation Plan: Vault Study Trail

**Feature**: `specs/20260628-vault-study-trail`  
**Date**: 2026-06-28

## Technical Context

| Item | Detail |
|------|--------|
| Data | `entry.observations[]` on vault entries |
| UI host | `renderDetail()` in `debug-ui.js` |
| Styles | `.vault-detail` block in `main.css` (~3059+) |
| Icons | Inline SVG (no Lucide dependency) |

## Implementation

1. **`study-trail.js`**: Pure exports — `mapObservationToTrailRow`, `buildStudyTrailRows`, `formatStudyTrailRelativeTime`, `MAX_STUDY_TRAIL_EVENTS = 50`, mode SVG snippets.
2. **`main.css`**: `.vault-study-trail`, row, badge, empty, footer classes.
3. **`debug-ui.js`**: Append collapsible `<details class="vault-study-trail">`; lazy list render on first `toggle` open.
4. **Tests**: `cursor-tests/20260628_vault-study-trail.mjs`
5. **SW bump**: `sw-update.js`, `index.html` if needed, `sw.js` CACHE_NAME

## Constitution Check

- Read-only view; no LLM; English UI.
- Compress: collapsible default closed; lazy render.
- Minimal diff; no new CSS file.

## Gates

All pass.
