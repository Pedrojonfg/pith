# Research: Supabase Write Retry

**Date**: 2026-07-06

## Q1 — Structured logging?

**Decision**: Use `console.warn('[withRetry]', …)` on exhaustion.  
**Rationale**: No shared structured logger in `src/js/`; existing sync paths use `console.warn` with bracketed prefixes (`[user-store-sync]`, `[vault-store]`).

## Q2 — Idempotency (R8)

| Call site | Mechanism | Idempotent? |
|-----------|-----------|-------------|
| `upsertSessionRow` | `upsert` on `(id, user_id)` conflict | Yes |
| `upsertUserVault` | `upsert` on `user_id` | Yes |
| `upsertUserProjects` | `upsert` on `user_id` | Yes |
| `upsertUserConceptRegistry` | `upsert` on `user_id` | Yes |
| `upsertSmItem` | Merges into session then session upsert | Yes (full session snapshot upsert) |

## Q3 — Error handling audit (T2)

| Call site | Awaits? | Error handling |
|-----------|---------|----------------|
| `upsertSessionInStore` | Via `saveActiveSession` (awaited) | Propagates to caller; block-store catches |
| `scheduleVaultSync` | No (queued) | `scheduleUserDataSync` `.catch` → `console.warn` |
| `scheduleProjectsSync` | No | Same |
| `scheduleRegistrySync` | No | Same |
| `upsertSmItem` | Awaited by review.js | Propagates; cloze wraps in try/catch |

No call site lacks rejection handling for fire-and-forget paths. Session path rejections remain caller-visible (unchanged contract).

## Q4 — Auth token refresh

**Decision**: Rely on Supabase client `getUser()` / fetch interceptor. No per-retry auth check.  
**Rationale**: `getAuthUserId()` already used before writes; 401 fails fast per R2.

## Q5 — Supersession mechanism

**Decision**: Per-key generation counter in `withKeyedRetry`.  
**Rationale**: No `AbortController` on existing Supabase calls; generation check before each attempt is minimal and sufficient.
