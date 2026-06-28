# Implementation Plan: Adaptive WPM Calibration

**Feature**: `specs/20260628-adaptive-wpm-calibration`  
**Date**: 2026-06-28

## Summary

Pure `wpm-calibration.js` module; wire session-complete hook and per-block WPM capture in `study.js`; recommended marker in `rsvp.js` + CSS.

## Files

| File | Change |
|------|--------|
| `src/js/rsvp/wpm-calibration.js` | New — comprehension, adjustment, localStorage |
| `src/js/config.js` | `LS_RSVP_WPM_BASE_KEY` |
| `src/js/study.js` | Record block WPM; call calibration at complete |
| `src/js/rsvp.js` | Recommended marker render |
| `index.html` | Marker wrapper markup |
| `src/css/main.css` | Marker styles |
| `cursor-tests/20260628_adaptive-wpm-calibration.mjs` | Unit tests |

## Implementation

1. Pure functions with injectable `storage` for tests.
2. `showSessionComplete`: fire-and-forget `maybeApplyRsvpWpmCalibration()`.
3. `beginRsvpForCurrentBlock`: capture session-start WPM; onDone records block WPM.
4. Marker positioned by slider min/max; label "Recommended" (English UI).
