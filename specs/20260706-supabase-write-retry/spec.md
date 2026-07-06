# Feature Specification: Supabase Write Retry with Backoff

**Feature directory**: `specs/20260706-supabase-write-retry/`  
**Created**: 2026-07-06  
**Status**: Ready

## Problem Statement

Session, vault, project, and concept-registry writes to Supabase are fire-and-forget at the sync layer. A single transient upsert failure is silently lost until the next authenticated boot on the same device re-syncs from localStorage.

## User Scenarios & Testing

### US1 — Transient network blip during session save
User edits a session while online; a momentary network drop occurs during Supabase upsert. The write retries within the same page session and lands without user action.

### US2 — SM-2 grade during flaky connection
User grades a review card; the session write fails once then succeeds on retry. Scheduling state stays consistent across devices.

### US3 — Vault close on 503
Session-close vault update hits a transient 5xx; retries succeed within the backoff window.

### US4 — Auth expired mid-retry
Upsert fails with 401; no further retries; failure is logged without unhandled rejection.

## Functional Requirements

- **FR-001 (R1)**: Single generic `withRetry(fn, options)` in `src/js/net/retry.js`; all in-scope writes route through it.
- **FR-002 (R2)**: Retry only transient failures (network throw, HTTP 408/429/500/502/503/504). No retry on 401/403/400/422 or pre-flight validation errors.
- **FR-003 (R3)**: Backoff delays 500ms, 1500ms, 4000ms between attempts with ±20% jitter; default 3 retries (4 attempts total).
- **FR-004 (R4)**: Preserve fire-and-forget at call sites that do not await; no new blocking UI.
- **FR-005 (R5)**: In scope: `upsertSessionInStore`, vault/project/registry upsert paths, `upsertSmItem` (via session persist). Blocks/responses upload out of scope.
- **FR-006 (R6)**: On exhaustion, log via `console.warn('[withRetry]', …)`; reject promise; no unhandled rejections.
- **FR-007 (R7)**: Keyed supersession — newer write to same key cancels in-flight retry of older write; stale payload must not win.
- **FR-008 (R8)**: All in-scope upserts are idempotent Postgres upserts on conflict.

## Non-Goals

- Durable offline queue across page reload
- Sync status UI
- Retry on blocks/responses upload (separate follow-up)
- Retry on non-transient client/auth errors

## Success Criteria

- SC-001: Unit tests cover happy path, transient exhaustion, non-retry statuses, jitter bounds.
- SC-002: Simulated offline during session save recovers within retry window.
- SC-003: Long offline exhausts gracefully; localStorage/cache unchanged; no crash.
- SC-004: Rapid double-write to same key persists the newer payload.

## Assumptions

- No structured app logger exists; `console.warn` with `[withRetry]` prefix is the exhaustion log (open question #1 resolved).
- Supabase JS client refreshes auth tokens transparently; no extra token check in retry loop (open question #4).
- Supersession uses per-key generation counter, not AbortController (open question #5).

## Key Entities

- `withRetry`, `withKeyedRetry`, `isTransientError`
- Write keys: `session:{docId}`, `vault:{userId}`, `projects:{userId}`, `registry:{userId}`
