# Feature Specification: Fix DPP Preparation UI Status

**Feature ID**: `20260629-fix-dpp-prep-ui`  
**Status**: Approved  
**Priority**: P1 — misleading UX after successful DPP  
**Created**: 2026-06-29

## Problem

After DPP completes (`status: ready` in logs), create-session screen still shows "Preparing document?". Callback uses `isTier1PreparationComplete` which requires block/mode recommendations, and `getActiveSession` may return stale prep from persist race.

## User Scenarios

### US1 — Clear ready message (P1)

After tier-1 DPP succeeds, status text reads "Document ready. You can continue." (or equivalent).

### US2 — Failed/partial messaging (P2)

- `failed` + failReason → visible error with retry hint
- `partial` + sparse inventory → ready-with-banner message, not infinite preparing

## Requirements

- **FR-001**: `handleCreateSessionStartFilePicked` `.then` MUST resolve status from returned pipeline result AND fresh session.
- **FR-002**: Treat `preparation.status` of `ready` or `partial` (with inventory) as complete for create-screen status.
- **FR-003**: Do not show "Preparing document?" after pipeline promise settles unless status is still `running`/`pending`.

## Assumptions

- Depends on persist-race fix for reliable `getSession`; UI logic must still handle `ready` from pipeline return value.

## Success Criteria

- Philosophy sample upload shows "Document ready" within 60s on localhost with real auth.
