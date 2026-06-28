# Feature Specification: Adaptive WPM Calibration for RSVP

**Feature ID**: `20260628-adaptive-wpm-calibration`  
**Status**: Approved  
**Priority**: P2 — silent comprehension-driven speed tuning  
**Created**: 2026-06-28

## Goal

Automatically adjust each user's RSVP recommended WPM over time using MCQ performance as a comprehension signal. The user never self-reports understanding — the system infers it from results and updates silently.

## Non-goals

- Logarithmic slider scale (stays linear).
- Hard ceiling below 1000 wpm.
- Per-block mid-session interruption.
- Separate calibration mode or onboarding test.
- Changes to MCQ generation or scoring.
- Changes to Paced Reader / Slow Mode.

## User Scenarios

### US1 — Silent base adjustment (P1)

After completing a qualifying RSVP session (≥3 eligible blocks), WPM base adjusts +25 / 0 / −25 based on comprehension score. No toast or modal.

### US2 — Recommended marker (P1)

On the RSVP WPM slider, a "Recommended" marker shows the persisted WPM base. User may ignore it and set any speed.

## Requirements

- **FR-001**: Persist WPM base in `localStorage` key `pith_rsvp_wpm_base`, default 300, clamped [150, 1000].
- **FR-002**: Eligible block = ≥1 answered detail/inference MCQ (not skipped).
- **FR-003**: Qualifying session = ≥3 eligible blocks; fewer → no adjustment.
- **FR-004**: Detail/inference = `questionClass === "factual"`; gist = `questionClass === "conceptual"` or unclassified.
- **FR-005**: Per-block score = correct detail/inference / total detail/inference answered.
- **FR-006**: Session score = mean of per-block scores (not pooled item count).
- **FR-007**: Adjustment at session end: ≥0.75 → +25; 0.50–0.74 → 0; <0.50 → −25; clamp result.
- **FR-008**: Adjustment applies to WPM base, not session WPM; uses median session WPM across eligible blocks as evaluation context only.
- **FR-009**: RSVP slider shows "Recommended" marker at WPM base position.
- **FR-010**: Calibration runs only for `rsvp` and `questions` study modes; fire-and-forget at `screenComplete`.

## Assumptions

- `questionClass` in production inventory is `factual` | `conceptual` (pedagogical-principles layer), not legacy `inferential`/`applied` strings from early draft.
- MCQ responses join to block questions via `concept_id` on test items; responses store `user_answer` / `correct_answer` without `is_correct`.
- Per-block WPM recorded when RSVP reading finishes; paced-reader blocks fall back to session-start WPM.

## Success Criteria

- Qualifying session with score ≥0.75 increases base by 25 (within clamp).
- Session with <3 eligible blocks leaves base unchanged.
- Slider marker reflects base on next session load.
- No user-visible notification on adjustment.
