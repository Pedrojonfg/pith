# Implementation Plan: Cross-Device Persistence Completion

**Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)

## Summary

Extend Supabase persistence to projects, vault, concept registry, externalized blocks, and active doc pointer. Write-through localStorage cache, async Supabase sync, idempotent boot hydrate and migration.

## Technical Context

**Language**: JavaScript ES modules (PWA)  
**Dependencies**: `@supabase/supabase-js`, existing `session-persist-supabase.js` patterns  
**Testing**: `cursor-tests/20260705_cross_device_persistence.mjs`  
**Constraints**: No second migration flag; offline-safe; SW version bump on deploy

## Project Structure

```text
supabase/migrations/20260705_cross_device_persistence.sql
src/js/user-data-persist-supabase.js   # low-level table + storage ops
src/js/user-store-sync.js              # hydrate + idempotent local→remote migration
src/js/session-store.js                # projects + active doc sync
src/js/vault/vault-store.js            # vault sync
src/js/concept-registry/registry-store.js
src/js/block-store.js                  # storage upload/download
src/js/auth.js                         # extended migration
src/js/main.js                         # hydrate on boot
```

## Implementation sequence

1. Schema + RLS + buckets (T01)
2. Persist helpers + sync module (T02)
3. Projects store (T03)
4. Vault store (T04)
5. Registry store (T05)
6. Active doc + blocks (T06)
7. Migration + hydrate wiring (T07)
8. Tests + SW bump (T08)

## Constitution Check

Pass — minimal intervention, reuses existing Supabase auth and storage patterns.
