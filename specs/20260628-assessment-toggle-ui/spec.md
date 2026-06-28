# Feature Specification: Assessment Toggle UI (RSVP)

**Feature ID**: `20260628-assessment-toggle-ui`  
**Status**: Approved  
**Priority**: High  
**Created**: 2026-06-28  
**Source**: `assessment-toggle-ui-SPEC.md`

## Problem

Pre-packing assessment is fully implemented but users cannot turn it on or off. The feature flag is hardcoded; a checkbox exists in markup but is not persisted and its container is not wired in `ui.js`.

## User Scenarios & Testing

### User Story 1 — Toggle assessment before RSVP (P1)

A learner configuring RSVP sees a toggle to enable or disable the quick pre-packing assessment. Default is ON (current production behavior).

**Acceptance**:

1. Toggle visible only in RSVP configure screen (`screenPlaceholder`), not Questions/Slow/Cloze/Recall.
2. Label: "Quick assessment before studying"; sublabel: "Adapts block difficulty to what you already know."
3. Default checked when no prior preference stored.
4. Unchecked → generate blocks skips `screenPrePackingAssessment` / results.
5. Checked → assessment runs as today.

### User Story 2 — Preference persists (P1)

Preference survives reload and applies across documents (global user setting, not per-session).

**Acceptance**:

1. Stored in `localStorage` key `pith_assessment_before_packing` as JSON boolean.
2. Reload restores last saved state on toggle.
3. Not stored in `DocumentSession`.

## Requirements

### Functional Requirements

- **FR-001**: RSVP-only toggle in `screenPlaceholder` using existing `create-checkbox-label` pattern.
- **FR-002**: Copy per spec (label + muted hint).
- **FR-003**: Persist preference via `localStorage`; default `true` when key absent.
- **FR-004**: `isPrePackingAssessmentEnabled()` reads persisted preference (not hardcoded flag). Keep `ASSESSMENT_BEFORE_PACKING` constant marked `@deprecated`.
- **FR-005**: Initialize checkbox from storage when placeholder renders for RSVP; save on change.
- **FR-006**: Toggle remains visible when preference is OFF so user can re-enable (RSVP + online only).
- **FR-007**: No changes to Questions mode assessment path.
- **FR-008**: PWA version bump per project convention.

### Non-Goals

- Settings screen toggle.
- Assessment flow changes.
- Toggle on non-RSVP modes.
- Animations or confirmation dialogs.

## Assumptions

- Existing `#rsvpAssessmentOption` / `#rsvpRunAssessment` elements are reused with updated copy.
- `isPrePackingAssessmentEnabled()` is the single runtime gate; call sites already use it.
- Offline RSVP hides toggle (existing behavior).

## Success Criteria

- Manual smoke: toggle ON/OFF changes assessment appearance; persists after reload.
- Non-RSVP modes: toggle hidden.
- Automated tests cover preference read/write and gate function.
- SW update flow test passes after bump.
