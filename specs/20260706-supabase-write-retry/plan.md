# Implementation Plan: Supabase Write Retry

**Feature**: `specs/20260706-supabase-write-retry/`  
**Date**: 2026-07-06

## Technical Context

- Supabase writes use `@supabase/supabase-js` via `session-persist-supabase.js` and `user-data-persist-supabase.js`.
- Vault/projects/registry sync through `user-store-sync.js` `scheduleUserDataSync` queue (already fire-and-forget with `.catch`).
- Sessions persist via `upsertSessionInStore` in `session-store.js` (awaited by `saveActiveSession`).
- `upsertSmItem` → `saveActiveSession` → `upsertSessionInStore`.

## Constitution Check

- Minimal new module (`net/retry.js`); no new dependencies.
- English internal naming; no UI additions.
- PWA version bump required when touching `src/js/**`.

## Phase 0 — Research

See `research.md` for call-site audit, idempotency confirmation, logging decision.

## Phase 1 — Design

### Module: `src/js/net/retry.js`

| Export | Role |
|--------|------|
| `isTransientError(err)` | Classify retry eligibility |
| `withRetry(fn, options)` | Generic backoff wrapper |
| `withKeyedRetry(key, fn, options)` | Generation-based supersession (R7) |
| `WriteSupersededError` | Non-retryable cancel signal |

### Wiring

| Call site | Key | Location |
|-----------|-----|----------|
| Session upsert | `session:{docId}` | `upsertSessionInStore` in `session-store.js` |
| Vault | `vault:{userId}` | `scheduleVaultSync` in `user-store-sync.js` |
| Projects | `projects:{userId}` | `scheduleProjectsSync` |
| Registry | `registry:{userId}` | `scheduleRegistrySync` |
| SM-2 | (same as session) | Covered by session wire + dedicated test |

## Tasks (risk-ordered)

1. **T01** — `withRetry` + unit tests (isolated)
2. **T02** — Call-site audit documented in `research.md`
3. **T03** — Wire `upsertSessionInStore` with `withKeyedRetry`
4. **T04** — SM-2 path regression test (`upsertSmItem` → session persist)
5. **T05** — Wire vault/projects/registry in `user-store-sync.js`
6. **T06** — Keyed supersession tests (R7); confirm `withKeyedRetry` on all wires

## Testing

- `cursor-tests/20260706_t01-with-retry.mjs` — unit
- `cursor-tests/20260706_t04-sm2-retry-path.mjs` — SM-2 contract
- `cursor-tests/20260706_t06-keyed-supersession.mjs` — R7
