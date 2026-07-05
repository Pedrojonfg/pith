# Feature Specification: Cross-Device Persistence Completion

**Feature directory**: `specs/20260705-cross-device-persistence-completion/`  
**Extends**: `20260617-supabase-migration` (FR-007/FR-008 scoped projects, vault, registry, blocks OUT)  
**Created**: 2026-07-05

## Problem Statement

Four localStorage-only stores do not survive device switch or full cache clear for authenticated users: Projects, Knowledge Vault, Concept Registry, and externalized RSVP/Questions blocks. Active document pointer is also local-only.

## User Scenarios & Testing

### US1 — New device login
Authenticated user opens app on a second device and sees existing projects, vault entries, concept registry, and can resume sessions with externalized blocks.

### US2 — Existing user upgrade
User with local data logs in after deploy; one-shot migration pushes projects, vault, registry, and blocks to Supabase without data loss.

### US3 — Offline edit
User edits a project offline; no error thrown; next online save syncs to Supabase (last-write-wins).

### US4 — Site data wipe
After clearing site data and re-auth, projects, vault, registry, blocks, and active document reappear from Supabase.

## Functional Requirements

- **FR-001**: Projects MUST persist to Supabase `user_projects` for authenticated users with localStorage write-through cache.
- **FR-002**: Knowledge Vault MUST persist to Supabase `user_vault` with same cache pattern.
- **FR-003**: Concept registry MUST persist to Supabase `user_concept_registry` with same cache pattern.
- **FR-004**: Externalized blocks/responses (>200KB) MUST persist to Supabase Storage buckets `blocks_files` and `responses_files`.
- **FR-005**: Active document pointer MUST mirror to `user_prefs.active_doc_id` (UX convenience, non-blocking fallback).
- **FR-006**: Offline writes MUST succeed locally without throwing; Supabase sync is best-effort async.
- **FR-007**: `migrateLocalStorageToSupabase()` MUST be extended idempotently for all four stores (including users who already migrated sessions).
- **FR-008**: On authenticated boot, Supabase is source of truth when a remote row exists; hydrate localStorage cache before UI reads.
- **FR-009**: Last-write-wins; no real-time multi-device sync or conflict UI.

## Non-Goals

- Real-time sync, conflict merge UI, cross-user sharing.
- Migrating API keys, guide chat, or device-local prefs (FR-008 from prior migration stands).
- Normalizing store internals into per-entity Postgres rows.

## Success Criteria

- SC-001: Second browser shows same project/vault/registry counts without re-creation.
- SC-002: Pre-upgrade local data appears in Supabase after first login post-deploy.
- SC-003: Offline project edit does not throw; online save updates remote row.
- SC-004: Large-document blocks resume after full localStorage wipe + re-auth.

## Assumptions

- Vault embeddings remain in separate Supabase table (`vault_embedding` migration); vault blob includes entries only.
- Project persistence lives in `session-store.js` (`loadProjectStore`/`persistProjectStore`), not `project-store.js` pure helpers.
- Single JSONB row per user per store mirrors current localStorage blob model.

## Key Entities

- `user_projects`, `user_vault`, `user_concept_registry`, `user_prefs` (Postgres)
- `blocks_files`, `responses_files` (Storage)
