# Implementation Plan: Shared DPP Cache

**Feature**: `specs/20260704-shared-dpp-cache`  
**Date**: 2026-07-04  
**Spec**: [spec.md](./spec.md)

## Summary

Add global Supabase `document_preparation_cache` keyed by `docId:pipelineVersion`. Lookup before tier-1 DPP; upsert only on `isTier1PreparationComplete`. Fix `resolveFinalStatus` to stop marking ready with inventory-only. Dev wipe script for user data. Pure modules + cursor-tests.

## Technical Context

**Language**: JavaScript ES modules (PWA)  
**Storage**: Supabase Postgres + existing `document_sessions` per user  
**Testing**: `cursor-tests/20260704_shared-dpp-cache.mjs`  
**Constraints**: English UI; SW_VERSION bump on `src/js` changes; no user cache-clear UI; offline skips shared cache

## Constitution Check

- Pure functions for extract/hydrate/cache key — pass
- Integration tests for cache hit/miss and write gate — pass
- No localStorage wipe in migration — pass (dev script opt-in)

## Project Structure

```text
supabase/migrations/20260704_document_preparation_cache.sql
src/js/shared-dpp-cache.js
src/js/shared-dpp-cache-persist.js
src/js/document-preparation.js      # resolveFinalStatus, cache hit path
src/js/dpp-persistence.js           # upsert hook after persistFinal
src/js/study.js                     # startDocumentPreparation integration
src/js/session.js                   # resolveCreateSessionPrepStatus align
scripts/dev-wipe-user-data.md
src/js/dev/wipe-user-data.js
cursor-tests/20260704_shared-dpp-cache.mjs
```

## Implementation Phases

### Phase A — Schema + pure module
Migration + `shared-dpp-cache.js` (key, extract, hydrate, version constant).

### Phase B — Supabase persist + write gate
`shared-dpp-cache-persist.js`; fix `resolveFinalStatus`; align prep status message.

### Phase C — Pipeline integration
Cache lookup in `startDocumentPreparation`; upsert on final; user-specific phases after hit.

### Phase D — Dev wipe + QA
Script + cursor-tests + quickstart.

## Complexity Tracking

| Item | Justification |
|------|---------------|
| Global cache table | Cross-user LLM savings — explicit product goal |
| User phases after hit | T1.6/T1.8/T1.9 are user/project scoped |
