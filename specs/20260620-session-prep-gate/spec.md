# Feature Specification: Session Preparation Gate

**Feature Branch**: `20260620-195418-session-prep-gate`

**Created**: 2026-06-20

**Status**: Draft

**Input**: Block navigation to mode select until Tier 1 document preparation completes (shared inventory, flow recommendation, block recommendation). Loading screen during wait; auto-advance when ready; partial Tier 1 OK; all upload→mode-select paths; back to library allowed with background prep.

**Extends**: `20260618-document-preparation-frontload` (DPP orchestration); adds UX gate only.

## Clarifications

### Session 2026-06-20

- Q: Minimum prep before mode select? → A: **Tier 1 only** (structure, concepts, flow recommendation, block count).
- Q: Partial failure? → A: **Pass if Tier 1 artifacts exist** (`partial` status); warn which modes lack Tier 2.
- Q: Which flows? → A: **All paths** that upload then open mode select (create session, hub upload, interview synthesis).
- Q: Navigate away during prep? → A: **Yes** — prep continues; resumable on return.
- Q: After prep completes? → A: **Auto-advance** to mode select (no second Continue).

## User Scenarios & Testing

### User Story 1 - Create session waits on processing (Priority: P1)

Student uploads a file, names the session, taps Continue. A full-screen “Processing document…” state appears with phase labels until Tier 1 completes, then mode select opens automatically with flow recommendation and RSVP block count pre-filled.

**Acceptance Scenarios**:

1. **Given** a new upload, **When** user taps Continue, **Then** mode select does not render until `isTier1PreparationComplete` is true.
2. **Given** Tier 1 ready, **When** mode select opens, **Then** `shared.modeRecommendation` and `shared.blockRecommendation.nBlocks` are populated.
3. **Given** prep in progress, **When** user taps ← Library, **Then** prep continues; reopening session resumes or completes gate.

### User Story 2 - Hub upload uses same gate (Priority: P1)

Upload from retrieval hub / `recommendFlowFromUploadedFile` shows the same processing screen before mode select.

### User Story 3 - Tier 2 continues in background (Priority: P2)

After Tier 1 gate passes, Tier 2 (Cloze items, Recall, Slow orientation) runs without blocking mode select.

## Functional Requirements

- **FR-001**: `isTier1PreparationComplete` MUST require `conceptInventory.length > 0`, `blockRecommendation.nBlocks`, and `modeRecommendation`.
- **FR-002**: `ensureTier1Preparation` MUST dedupe concurrent Tier 1 runs per `docId`.
- **FR-003**: All upload→mode-select entry points MUST await Tier 1 via `ensureTier1Preparation` and show unified processing UI.
- **FR-004**: On Tier 1 success, system MUST auto-navigate to mode select (no second confirm).
- **FR-005**: On Tier 1 failure, user MUST see actionable error (API key, retry); MUST NOT show “continue anyway”.
- **FR-006**: After gate passes, `kickoffTier2PreparationInBackground` MUST run Tier 2 without blocking UI.
- **FR-007**: Create-session copy MUST NOT promise background analysis while choosing modes.

## Out of Scope

- Slow/Cloze direct upload paths that skip mode select
- Changing Tier 3 RSVP pack/assessment timing

## Assumptions

- DPP module and `shared.preparation` from front-load spec are implemented.
- `reviewGenerating` screen reused for processing overlay.
