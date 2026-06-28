# Feature Specification: Vault Graph projectDocIds TypeError Fix

**Feature ID**: `20260628-vault-graph-fix`  
**Status**: Approved  
**Priority**: Critical (crash — vault graph inaccessible)  
**Created**: 2026-06-28

## Problem

Opening the vault graph throws `TypeError: projectDocIds.has is not a function` at `vault-graph-adapter.js` when filtering sessions or concepts by project. Users cannot view the knowledge vault graph.

## User Scenarios & Testing

### User Story 1 — Open vault graph (P1)

A learner opens the vault graph from the vault branch screen. The graph renders nodes and edges without console errors.

**Acceptance**:

1. No `TypeError: projectDocIds.has is not a function` in the console.
2. Graph shows expected nodes (not empty when concepts exist).
3. With an active project filter, only concepts from project documents appear.

### User Story 2 — Project filter edge cases (P2)

When project scope is `all` or unset, graph shows all concepts. When project has no sessions, graph renders empty without crashing.

**Acceptance**:

1. `projectId` null, `all`, or missing → no crash; full or empty graph as appropriate.
2. `projectDocIds` null/undefined → no secondary crash from normalization.

## Requirements

### Functional Requirements

- **FR-001**: `projectDocIds` used with `.has()` MUST be a `Set` (or null when unscoped).
- **FR-002**: Normalization MUST be internal to `vault-graph-adapter.js`; exported function signatures unchanged.
- **FR-003**: Normalization MUST accept `Set`, array, or null/undefined (`?? []` for non-Set values).
- **FR-004**: Async resolution of project document IDs MUST be awaited before use.
- **FR-005**: PWA deploy markers (`SW_VERSION`, `?v=` on entry scripts, `CACHE_NAME`) MUST bump per project convention.

### Non-Goals

- Refactor `project-store.js` or project persistence.
- Broader vault-graph-adapter refactors.
- New UI error handling for this path.

## Assumptions

- Root cause may be a non-Set value (array) or an un-awaited async resolver returning a Promise; both are handled by await + Set normalization.
- `vault-graph-adapter.js` is loaded via the main module graph (`graph-mount.js`); bump `main.js` and SW versions, not a direct adapter import in `index.html`.

## Success Criteria

- Vault graph opens without TypeError in manual smoke test.
- Automated test verifies `normalizeProjectDocIds` / `buildVaultGraph` project filter uses `.has()` on a Set.
- SW update flow tests pass after version bump.
