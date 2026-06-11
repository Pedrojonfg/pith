# Contract: Feature Flags

**Feature**: `20260611-rsvp-assessment-reposition`  
**Module**: `src/js/config/flags.js` (NEW)

```js
export const ASSESSMENT_FLAGS = {
  ASSESSMENT_BEFORE_PACKING: true,
  ASSESSMENT_ITEMS_MAX: 7,
  ASSESSMENT_MASTERY_THRESHOLD: 0.85,
  ASSESSMENT_SHOW_DIFF: true,
  ASSESSMENT_PARALLEL_PACKING: true,
};

export function isPrePackingAssessmentEnabled() {
  return ASSESSMENT_FLAGS.ASSESSMENT_BEFORE_PACKING === true;
}
```

## Consumers

| Flag | Consumer behavior |
|------|-------------------|
| `ASSESSMENT_BEFORE_PACKING` | Gate new flow; hide legacy post-block assessment UI |
| `ASSESSMENT_ITEMS_MAX` | Cap quiz length |
| `ASSESSMENT_MASTERY_THRESHOLD` | Pack + results copy |
| `ASSESSMENT_SHOW_DIFF` | Show `N → M` on results |
| `ASSESSMENT_PARALLEL_PACKING` | Start pack on evaluate without waiting Accept |

## Rollback

Set `ASSESSMENT_BEFORE_PACKING: false` restores legacy RSVP assessment-after-blocks without removing new code paths.
