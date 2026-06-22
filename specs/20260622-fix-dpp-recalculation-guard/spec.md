# Feature Specification: Fix DPP Recalculation Guard

**Feature ID**: `20260622-fix-dpp-recalculation-guard`  
**Status**: Approved  
**Priority**: A — Urgent (wastes API budget, breaks UX)  
**Created**: 2026-06-22  
**Depends on**: `20260622-fix-inventory-merge-truncation`

## Problem

Concept inventory runs three times per upload (DPP, mode entry, generate blocks) because each path independently decides inventory is inadequate. After merge-truncation fix, triple-run still occurs on legitimate failures via silent retries.

## User Scenarios

### US1 — Single inventory run (P1)

Upload completes DPP once. Entering RSVP and generating blocks must not re-call inventory LLMs.

**Acceptance**: Console shows `[DPP-GUARD] isConceptInventoryValid → TRUE` on mode entry and generate; no duplicate inventory API calls.

### US2 — Failed preparation surfaced (P1)

When `preparation.status === 'failed'`, user sees error with manual "Retry preparation" — no automatic retry loop.

### US3 — In-progress preparation (P2)

When status is `running`/`pending`, user sees waiting state; UI polls every 3s and proceeds when inventory becomes valid.

### US4 — Sparse but terminal inventory (P2)

When status is `ready`/`partial` but count below minimum, proceed with degraded inventory — no retry, no error UI.

## Requirements

- **FR-001**: `isConceptInventoryValid(session)` in `session.js` using `MIN_CONCEPTS_ABSOLUTE` and `MIN_CHARS_PER_CONCEPT` from flags.
- **FR-002**: Guard at DPP T1.2 (`document-preparation.js`), mode entry (`mode-bootstrap.js` + `study.js` gate), block generation (`study.js`).
- **FR-003**: On `failed` + invalid inventory: surface error, no auto-retry; "Retry preparation" calls `startDocumentPreparation` with `forceRerun: true`.
- **FR-004**: On `running`/`pending`: show loading, poll 3s, proceed when valid.
- **FR-005**: On `ready`/`partial` + sparse: log degraded, proceed with available inventory.
- **FR-006**: `[DPP-GUARD]` logs at every decision point.
- **FR-007**: `forceRerun` resets status to `pending`, clears `failReason`, keeps old inventory until new run succeeds.
- **FR-008**: Exhaustive search for inventory trigger call sites in `src/js/`.

## Non-Goals

No DPP scheduler refactor; no persistent retry across reloads; retry UI only on mode select and block generation screens.

## Assumptions

- Merge-truncation spec constants and `minViableConcepts` are present in `flags.js`.
- `startDocumentPreparation` lives in `study.js` and delegates to `document-preparation.js`.
