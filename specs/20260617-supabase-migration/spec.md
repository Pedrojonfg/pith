# Feature Specification: Supabase Migration

**Feature Branch**: `20260617-supabase-migration`

**Created**: 2026-06-19

**Status**: Active — supersedes localStorage persistence in `20260609-unified-session` (persistence layer only; DocumentSession schema unchanged).

**Input**: Replace localStorage document session persistence with Supabase (Postgres + Storage + Google OAuth).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and sync sessions (Priority: P1)

A returning user signs in with Google and sees their study library restored from the cloud.

**Why this priority**: Without auth and cloud persistence, no cross-device value.

**Independent Test**: Sign in → library lists migrated sessions → open a document → reload → progress persists.

**Acceptance Scenarios**:

1. **Given** no Supabase session, **When** the app boots, **Then** the auth screen is shown.
2. **Given** a valid Google account, **When** the user completes OAuth, **Then** the app proceeds to home/settings.
3. **Given** local sessions in localStorage, **When** first authenticated boot runs, **Then** sessions are migrated to Supabase once.

---

### User Story 2 - Study without data loss (Priority: P1)

A signed-in user uploads and studies documents; saves persist to Postgres and markdown to Storage.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they upload a document, **Then** it appears in the library after reload.
2. **Given** a large document, **When** saved, **Then** raw markdown is stored in Storage and session JSON in Postgres.
3. **Given** two users, **When** each lists sessions, **Then** RLS isolates data per user.

---

### User Story 3 - Sign out (Priority: P2)

A user can sign out and return to the auth screen.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they tap Sign out, **Then** auth session clears and auth screen shows.

### Edge Cases

- Offline writes: show offline banner; uploads disabled (Phase 1).
- Corrupt localStorage during migration: skip bad rows, set migration flag.
- Legacy `mylearning_*` keys: rebrand migration runs before Supabase migration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist `DocumentSession` data per authenticated user in Supabase Postgres (`document_sessions`).
- **FR-002**: System MUST store `rawMarkdown` in private Storage bucket `markdown_files/{user_id}/{docId}.md`.
- **FR-003**: System MUST gate app boot on Supabase Auth session; unauthenticated users see auth screen only.
- **FR-004**: System MUST support Google OAuth sign-in (Phase 1).
- **FR-005**: System MUST migrate existing localStorage sessions once per browser (`pith_supabase_migrated` flag).
- **FR-006**: `session-store.js` public API MUST remain shape-compatible; async methods require `await` at call sites.
- **FR-007**: Active document pointer (`pith_active_doc_id`) MAY remain in localStorage (UI state).
- **FR-008**: Project store and vault localStorage keys are out of scope for this migration.

### Key Entities

- **document_sessions**: `id` (docId), `user_id`, `session_data` (JSONB), `markdown_ref`, timestamps.
- **markdown_files**: private bucket, path `{user_id}/{docId}.md`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Authenticated users retain sessions across browser reloads.
- **SC-002**: First boot after migration imports 100% of valid local sessions without duplicate runs.
- **SC-003**: Users complete Google sign-in and reach the app within one redirect cycle.
- **SC-004**: No user can read another user's sessions (RLS verified).

## Assumptions

- Supabase project **Pith** (`mnoczpssewnymuxeniyo`) is provisioned via MCP.
- Google OAuth is configured manually per `GOOGLE_OAUTH_SETUP.md`.
- Anon key is committed; service_role never exposed client-side.
- `@supabase/supabase-js` loaded via ESM CDN (`esm.sh`) for browser compatibility.
