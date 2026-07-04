# Feature Specification: Fix DPP Guard Status Race

**Feature ID**: `20260709-fix-dpp-guard-race`  
**Status**: Approved  
**Priority**: P0 — critical funnel blocker  
**Created**: 2026-07-09  
**Supersedes**: `20260629-fix-dpp-persist-race`, `20260629-fix-dpp-prep-ui`

**Input**: Fix DPP status race condition causing infinite guard wait after preparation completes (`spec-dppguard.md`).

## Problem

After DPP tier-1 completes in memory (`status: ready`, concept inventory populated), downstream readers observe stale `preparation.status: running`. The concept inventory guard polls for up to 11 minutes with no early exit, blocking mode select for all users unless they reload or wait out the timeout.

## User Scenarios & Testing

### User Story 1 — Reach mode select immediately after DPP (Priority: P1)

**Why this priority**: Blocks the primary study funnel for every document upload.

**Independent Test**: Upload a document; when DPP logs completion with populated inventory, mode select appears without a multi-minute spinner.

**Acceptance Scenarios**:

1. **Given** tier-1 gate artifacts (inventory + block recommendation) are present, **When** persisted status still reads `running` but no pipeline is in flight, **Then** the guard proceeds to mode select without polling.
2. **Given** DPP pipeline logs terminal completion, **When** the user enters mode select, **Then** persisted status matches the pipeline result within one session reload.

---

### User Story 2 — Actionable failure instead of silent hang (Priority: P2)

**Why this priority**: Safety net when preparation genuinely stalls.

**Independent Test**: Simulate a stuck preparation with no artifacts; confirm user sees an error message within 90 seconds.

**Acceptance Scenarios**:

1. **Given** preparation remains `running` with no tier-1 artifacts and no in-flight pipeline, **When** the guard poll exceeds its ceiling, **Then** the create-session screen shows an actionable error, not an infinite spinner.

---

### User Story 3 — Reload during wait re-evaluates fresh state (Priority: P3)

**Why this priority**: Users reload when the UI appears hung.

**Independent Test**: Reload mid-wait after DPP completes; mode select opens on return.

**Acceptance Scenarios**:

1. **Given** a user reloads during guard wait, **When** `enterModeSelectAfterTier1Gate` runs again, **Then** it reads fresh session state and does not assume a prior poll loop outcome.

---

### Edge Cases

- Split persist: inventory and block recommendation persisted but status still `running`.
- Superseded `runId` on store vs completed in-memory run.
- Tier-1 upload (`stopAfterTier: 1`) completes without `modeRecommendation` (T1.5 deferred) — guard must not require mode rec for gate bypass.
- Regression: `20260622-fix-dpp-recalculation-guard` decisions unchanged for valid/invalid/failed/degraded paths.

## Requirements

### Functional Requirements

- **FR-001 (R1)**: Each guard poll tick MUST re-fetch authoritative session state from session store; no closed-over preparation snapshot.
- **FR-002 (R2)**: Terminal DPP status MUST NOT be logged or emitted until the final persistence write resolves.
- **FR-003 (R3)**: When `running`/`pending` status carries a superseded `runId` and tier-1 gate artifacts are present with no in-flight pipeline, the guard MUST treat preparation as complete, not wait.
- **FR-004 (R4)**: Guard poll ceiling MUST be 60–90 seconds with explicit timeout UX on create-session / mode-select entry.
- **FR-005 (R5)**: `enterModeSelectAfterTier1Gate` MUST re-evaluate fresh state on every entry (no resumed poll assumptions).
- **FR-006**: Tier-1 gate bypass MUST align with `isTier1PreparationComplete` artifact requirements (`hasTier1GateArtifacts`), not deferred post-gate fields like `modeRecommendation`.
- **FR-007**: `repairStuckRunningPreparationIfNeeded` MUST promote `running` → terminal when tier-1 gate artifacts are present (same artifact bar as FR-006).

## Success Criteria

- **SC-001**: 100% of test uploads with tier-1 completion reach mode select within 5 seconds of pipeline finish (no 11-minute wait).
- **SC-002**: Artificial delayed persist test: guard resolves within one poll cycle after write lands.
- **SC-003**: Poll timeout surfaces user-visible error within 90 seconds.
- **SC-004**: Existing DPP recalculation guard cursor-tests remain green.

## Assumptions

- DPP persistence overhaul (`runId`, `persistFinal`, `commitPreparedDocToStore`) is correct; this fix wires the guard to benefit from it.
- Tier-1 upload path uses `stopAfterTier: 1` (gate phases only); mode recommendation may arrive later.
- No Supabase schema changes required.

## Non-Goals

- Rewriting DPP phase execution model.
- Document processing quality (headings, tables) — separate feature.
- Changing `runId` stale-detection design from persistence overhaul.
