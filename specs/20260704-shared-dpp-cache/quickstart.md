# Quickstart QA: Shared DPP Cache

## Prerequisites

- Authenticated user with API key
- Supabase migration applied
- Hard refresh after SW bump

## Scenarios

### Q1 — Cache miss then hit (same user)

1. Upload unique PDF A; wait for "Document ready".
2. DevTools → Supabase: row in `document_preparation_cache` for docId.
3. Delete user session row only (not cache); re-upload same PDF.
4. **Expect**: Faster prep; logs show cache hit; tier-1 LLM phases skipped.

### Q2 — Incomplete run no cache

1. Mock or disconnect auth mid-DPP.
2. **Expect**: No new cache row; status not gate-ready.

### Q3 — Dev wipe

1. Run dev wipe per `scripts/dev-wipe-user-data.md` (`wipeUserDevData({ confirm: true })` in browser console).
2. **Expect**: User sessions gone; cache rows remain.

### Q4 — Create session staging (regression)

1. Staged file + stale active session.
2. **Expect**: Continue enabled and upload proceeds.

## Automated

```bash
node cursor-tests/20260704_shared-dpp-cache.mjs
```
