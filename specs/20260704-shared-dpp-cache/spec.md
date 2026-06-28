# Feature Specification: Shared Document Preparation Cache

**Feature ID**: `20260704-shared-dpp-cache`  
**Status**: Approved  
**Created**: 2026-07-04  
**Input**: Content-keyed global DPP artifact cache; write only on full tier-1 completion; per-user study state separate; no user-facing cache clear; dev wipe for local + cloud.

## Problem

Document preparation (DPP) artifacts are stored only inside per-user sessions. Identical document content (`docId` hash) re-runs expensive LLM work for every user. Worse, incomplete or broken preparation states were persisted during development, blocking uploads and polluting user sessions.

## Goals

- **G1**: Same document content prepared once → reusable for any authenticated user.
- **G2**: Shared cache written **only** when tier-1 preparation is fully complete (inventory + block + mode recommendations).
- **G3**: User study progress (modes, SM-2, annotations, vault personal state) stays per-user.
- **G4**: Incomplete/failed runs must not enter shared cache or block future uploads.
- **G5**: No end-user “clear cache” control.

## Non-goals

- Cross-user sharing of study progress, titles, or project assignment.
- Automatic migration/repair of all legacy zombie sessions (dev wipe is sufficient for now).
- Tier-2 mode slices (Cloze, Recall, Slow orientation) in shared cache v1.
- User-facing cache management UI.

## User Scenarios

### US1 — Cross-user reuse (P1)

**Given** user A fully prepared document D, **When** user B uploads the same content, **Then** B reaches mode select without re-running tier-1 LLM phases, within normal UI timing.

**Independent test**: Two auth fixtures, same markdown, second upload skips T1.2 inventory LLM (observable via logs or mock).

### US2 — No cache on incomplete prep (P1)

**Given** DPP fails or stops before tier-1 complete, **When** preparation ends, **Then** no shared cache row is written and user session is not marked gate-ready unless `isTier1PreparationComplete`.

**Independent test**: Force T1.4 failure → no cache row; Continue stays blocked until retry succeeds.

### US3 — Dev data wipe (P2)

**Given** a developer is authenticated, **When** they run the dev wipe script, **Then** their localStorage Pith keys and Supabase `document_sessions` + user markdown prefix are removed; shared cache table is untouched.

## Edge Cases

- Pipeline version bump invalidates old cache keys; miss → full DPP run.
- Cache hit but user-specific phases (vault link, novelty, doc similarity) still run for the current user/project.
- Offline mode: no shared cache read/write; local-only behavior unchanged.
- Concurrent first uploads of same doc: last complete write wins; dedupe flight prevents duplicate LLM on one device.

## Requirements

### Functional Requirements

- **FR-001**: System MUST key shared preparation cache by content identity (`docId`) plus pipeline version.
- **FR-002**: System MUST lookup shared cache before running tier-1 LLM phases on upload.
- **FR-003**: System MUST write shared cache only when `isTier1PreparationComplete(session)` is true after a successful run.
- **FR-004**: System MUST hydrate user session shared artifacts from cache on hit; user-specific fields remain per-user.
- **FR-005**: System MUST NOT expose any learner-facing control to delete shared cache.
- **FR-006**: System MUST align final preparation status with tier-1 complete predicate (no `ready`/`partial-final` with inventory only).
- **FR-007**: Dev-only script MUST wipe authenticated user's localStorage Pith keys and Supabase user sessions + markdown storage prefix.

### Key Entities

- **SharedPreparationCacheEntry**: content key, pipeline version, tier-1 artifact bundle, timestamps.
- **DocumentSession (user)**: per-user row; modes and personal shared fields not in global cache.
- **PipelineVersion**: string constant bumped when DPP schema/phases change.

## Success Criteria

- **SC-001**: Second user uploading identical content skips tier-1 LLM phases when cache exists (verified in integration test with mock LLM counter).
- **SC-002**: Zero shared cache rows created when tier-1 incomplete after DPP run.
- **SC-003**: Upload blocked by stale incomplete session is not reintroduced (staging + complete gate unchanged).
- **SC-004**: Dev wipe clears user data from localStorage and Supabase without touching shared cache.

## Assumptions

- Same precedent as `pith_book_cache`: global table, app-enforced write policy, RLS disabled or read-all for authenticated.
- `docId` remains SHA-1 of normalized markdown (existing `computeDocId`).
- User-specific DPP phases T1.6, T1.8, T1.9 run after cache hydrate.
- Depends on `20260629-dpp-persistence-overhaul` patterns (`persistFinal`, runId).
- Logged-in users use Supabase; dev wipe requires auth.
