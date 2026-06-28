# Implementation Plan: Assessment Toggle UI

**Feature**: `specs/20260628-assessment-toggle-ui`  
**Date**: 2026-06-28

## Technical Context

| Item | Detail |
|------|--------|
| Markup | `#rsvpAssessmentOption`, `#rsvpRunAssessment` in `index.html` (exists, wrong copy) |
| Gate | `isPrePackingAssessmentEnabled()` in `flags.js` — reads hardcoded flag |
| Session gate | `shouldRunPrePackingAssessment()` in `study.js` — flag + offline + checkbox |
| Visibility | `updateCreateScreenModeVisibility` — missing `els.rsvpAssessmentOption` in `ui.js` |
| Pattern | `getSourceFidelityStrictPreference` / `saveSourceFidelityStrictPreference` in `flags.js` |

## Root Cause

1. `rsvpAssessmentOption` not registered in `ui.js` → toggle always hidden.
2. No localStorage read/write for user preference.
3. `isPrePackingAssessmentEnabled()` ignores user preference.

## Implementation

1. **config.js**: `LS_ASSESSMENT_BEFORE_PACKING_KEY = "pith_assessment_before_packing"`.
2. **flags.js**: `getAssessmentBeforePackingPreference()`, `saveAssessmentBeforePackingPreference()`; update `isPrePackingAssessmentEnabled()`; `@deprecated` on static flag.
3. **index.html**: Update label/hint copy per spec.
4. **ui.js**: Add `rsvpAssessmentOption` to `els`.
5. **study.js**: `syncRsvpAssessmentToggleFromPreference()`, change listener, fix visibility (RSVP + !offline only).
6. **SW bump** + `cursor-tests/20260628_assessment-toggle-ui.mjs`.

## Constitution Check

- Minimal diff; reuse existing checkbox markup.
- English-only UI copy.
- No new LLM calls.
- PWA versioning rules satisfied.

## Gates

All pass.
