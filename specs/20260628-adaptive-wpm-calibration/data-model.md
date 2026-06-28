# Data Model: Adaptive WPM Calibration

## localStorage: pith_rsvp_wpm_base

| Field | Type | Validation |
|-------|------|------------|
| value | integer | [150, 1000], default 300 |

## session._meta (runtime, optional)

| Field | Type | Notes |
|-------|------|-------|
| rsvp_session_start_wpm | number | WPM at first RSVP block start |
| rsvp_block_wpm | `Record<string, number>` | Block index → effective WPM after reading |

## CalibrationResult (transient)

| Field | Type |
|-------|------|
| previous | number |
| next | number |
| adjustment | number |
| sessionScore | number |
