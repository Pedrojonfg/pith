# Implementation Plan: Vault Graph projectDocIds Fix

**Feature**: `specs/20260628-vault-graph-fix`  
**Date**: 2026-06-28

## Technical Context

| Item | Detail |
|------|--------|
| Module | `src/js/concept-registry/vault-graph-adapter.js` |
| Entry | `graph-mount.js` → `buildVaultGraph` |
| Crash site | `.has()` on `projectDocIds` in filter at ~line 104 |
| Resolver | `resolveProjectDocIds(projectId)` — async, already returns `new Set(...)` |

## Root Cause (confirmed)

`resolveProjectDocIds` is `async` but was called without `await` in `buildVaultGraph`. The value passed to filters is a `Promise`, which has no `.has()` method. Defensive `Set` normalization covers array callers if introduced later.

## Implementation

1. Add `normalizeProjectDocIds(value)` — return `null` if nullish; return Set as-is; else `new Set(value ?? [])`.
2. In `buildVaultGraph`: `const projectDocIds = normalizeProjectDocIds(await resolveProjectDocIds(projectId));`
3. Bump `SW_VERSION`, `index.html` `main.js?v=`, `CACHE_NAME`.
4. Add `cursor-tests/20260628_vault-graph-project-doc-ids.mjs` with happy/edge/failure cases.

## Constitution Check

- Minimal diff; no store changes.
- English-only code/comments.
- PWA versioning rules satisfied.

## Gates

All pass — single-file bug fix, no new LLM calls, no UI additions.
