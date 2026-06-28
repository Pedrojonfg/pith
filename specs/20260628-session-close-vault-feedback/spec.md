# Feature Specification: Session Close Vault Feedback

**Feature ID**: `20260628-session-close-vault-feedback`  
**Status**: Approved  
**Priority**: Medium  
**Created**: 2026-06-28  
**Source**: `session-close-vault-feedback-SPEC.md`

## Problem

The Retrieval Hub is functional but cold after a study session — it offers mode buttons without reflecting vault progress. Learners need a quiet confirmation that their study effort added or reinforced knowledge in the vault.

## User Scenarios & Testing

### User Story 1 — Summary after exposure (P1)

After completing RSVP or Slow Mode, the learner lands on the Retrieval Hub and sees a compact vault summary above the mode buttons.

**Acceptance**:

1. Panel appears at top of `screenRetrievalHub` when `entrySource === "exposure_complete"`.
2. Shows N concepts added and M reinforced from real session data.
3. When N > 0, lists up to 5 concept names with overflow hint.
4. Hub mode buttons render immediately; summary loads asynchronously (R7).

### User Story 2 — Reinforced-only session (P1)

When no new concepts were promoted but existing vault concepts were reinforced, show header "What you learned this session" and reinforced count line.

### User Story 3 — No vault changes (P2)

When N = 0 and M = 0 after a session, show neutral encouragement: "Keep going — concepts will land in your vault as you study."

### User Story 4 — Cold hub entry (P2)

When the hub opens from the library without a preceding session, the summary panel is hidden (no crash, no empty panel).

## Requirements

### Functional Requirements

- **FR-001**: Summary panel above mode buttons on `screenRetrievalHub` after completed sessions.
- **FR-002**: **Added** = concept not previously linked to vault for this doc; **Reinforced** = concept already in vault for this doc with a positive signal this visit.
- **FR-003**: Headers: "New in your vault" (N > 0) or "What you learned this session" (N = 0, M > 0).
- **FR-004**: Reinforced line: "+ M concepts reinforced" (muted); omit when M = 0.
- **FR-005**: Empty state copy per spec; no emoji or exclamation marks.
- **FR-006**: Read-only — no changes to promotion or vault writes (R5).
- **FR-007**: Query through vault-store abstraction; no inline Supabase in UI (R6).
- **FR-008**: Focus Mode design — no animation, confetti, or gamification (R4).
- **FR-009**: PWA version bump per project convention.

### Non-Goals

- Streaks, XP, mode breakdown, historical comparison, click-through to concept detail.

## Assumptions

- Vault entries live in localStorage via `vault-store.js` (confirmed; Supabase not used for entry CRUD).
- Session boundary uses Option B: timestamp window from earliest study interaction in loaded mode slices (`resolveStudyVisitStartedAt`).
- Positive signals reuse `collectObservations` types from `session-close.js`.
- Concept titles come from `session.shared.conceptInventory`.

## Success Criteria

- **SC-001**: After exposure completion, learners see accurate added/reinforced counts within 2s without blocking hub buttons.
- **SC-002**: Cold library entry shows no summary panel.
- **SC-003**: Panel compresses on narrow viewports without horizontal overflow.
