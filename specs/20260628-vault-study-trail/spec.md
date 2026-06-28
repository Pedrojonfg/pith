# Feature Specification: Vault Study Trail

**Feature ID**: `20260628-vault-study-trail`  
**Status**: Approved  
**Priority**: Medium  
**Created**: 2026-06-28  
**Source**: `vault-study-trail-SPEC.md`

## Problem

Vault entries accumulate per-study signals in `observations[]`, but the concept detail view only shows a raw "Recent observations" debug list. Learners cannot see a clear chronological study history with mode, outcome, and relative time.

## User Scenarios & Testing

### User Story 1 — Collapsed trail summary (P1)

A learner opens a vault concept detail panel and sees a collapsed "Study trail" section at the bottom with an event count.

**Acceptance**:

1. Section header: "Study trail".
2. Collapsed by default; shows "N events" (or empty state when N=0).
3. Section lives inside `renderDetail` output (vault overlay + graph detail panel).

### User Story 2 — Expand trail (P1)

When expanded, the learner sees up to 50 most recent events, newest first.

**Acceptance**:

1. Each row: mode icon, mode label, result badge, relative date.
2. Lazy render on first expand only (R5).
3. Footer "… and N more earlier events" when truncated.

### User Story 3 — Empty trail (P2)

Concepts with no observations show muted centered copy: "No study history yet for this concept."

## Requirements

### Functional Requirements

- **FR-001**: Read events from `entry.observations[]` (confirmed field name in `vault-store.js` / A+ data model).
- **FR-002**: Map `VaultObservation.type` to display mode (RSVP, Slow read, Cloze, Recall, Review) and result badge (Correct, Missed, Reviewed, Added, Added to vault, —).
- **FR-003**: Collapsible `<details>` section at bottom of concept detail; read-only (R4).
- **FR-004**: `formatStudyTrailRelativeTime` — no external library; covers just now through months ago.
- **FR-005**: Mode icons as inline SVG (Lucide shapes); project does not load Lucide CDN — inline SVG only.
- **FR-006**: CSS in `main.css` using `--success`, `--error`, `--accent`, `--text-muted` variables.
- **FR-007**: No vault writes, no backfill (R7).
- **FR-008**: PWA version bump per project convention.

### Non-Goals

- Filtering, export, aggregate stats.
- Changes to observation ingestion.
- Replacing mastery debug fields above the trail.

## Assumptions

- `observations[]` is the canonical per-event log (`{ type, rawSignal, timestamp, docId, taskKind? }`).
- Observation types follow `OBSERVATION_WEIGHTS` in `mastery-model.js`; unknown types map to mode "Study" and result "—".
- `mcq_*` / `socratic_*` / `assessment_*` → RSVP; `cloze_*` → Cloze; `review_*` → Review; `recall_*` → Recall; no slow-specific types today → fallback RSVP for unrecognized study types.
- Existing "Recent observations" h4 list may remain for debug panel; Study trail is additive at bottom.

## Success Criteria

- Manual smoke per source spec Test section.
- Automated tests for mapper + relative time pure functions.
- SW update flow test passes after bump.
