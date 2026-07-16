# Feature Specification: Pack Import Flow

**Feature Branch**: `20260716-pack-import-flow`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Pack code & import flow — generate share code after publish; alternate create-session path to import a published pack as a new DocumentSession owned by the importer in the active project; re-run only importer Vault linking (DPP T1.6); no sync, no dedup, no marketplace."

**Source**: `20260716-pack-import-flow-spec.md`  
**Depends on**: `20260716-pack-export-backend` (`shared_packs`, `finalizePack`, `lookup_shared_pack_by_code`), session-store, session-types, document-preparation (T1.6 / post-cache user phases), `screenCreateSessionStart`, project-store  
**Blocks**: none

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive a share code after publishing (Priority: P1)

An authenticated pack owner finishes publishing a pack. The system assigns a short unique share code to the published pack and shows it with a one-tap copy action so the owner can send it out-of-band (chat, email, classroom).

**Why this priority**: Without a stable code, import has no discovery mechanism.

**Independent Test**: Publish a draft → row has unique non-null `code`; UI shows that code and copy succeeds.

**Acceptance Scenarios**:

1. **Given** a draft pack that finalize successfully publishes, **When** publish completes, **Then** `shared_packs.code` is a unique 6–8 character uppercase alphanumeric value (ambiguous chars avoided when practical) and is shown to the owner with a copy control.
2. **Given** two publishes in sequence, **When** codes are assigned, **Then** each code is unique (collision retries before persist).

---

### User Story 2 - Import a pack by code into the active project (Priority: P1)

An authenticated learner on the create-session start screen chooses “Use pack code”, enters a valid published code, confirms after seeing pack title and creator display name, and receives a new document session in their active project that is ready to study with the pack’s modes—without regenerating inventory, graph, blocks, or questions.

**Why this priority**: This is the core learner value of sharing packs.

**Independent Test**: Fixture published pack + authenticated importer → import creates a distinct DocumentSession with cloned snapshot artifacts; no LLM regeneration calls for inventory/blocks/questions.

**Acceptance Scenarios**:

1. **Given** a published pack with a code and an authenticated user with an active project, **When** they import that code, **Then** a new DocumentSession is persisted under that project with a new `docId`, cloned shared study artifacts and mode slices from the pack snapshot, and timestamps set to now.
2. **Given** the same code imported twice by the same user, **When** both imports complete, **Then** two independent DocumentSessions exist (no deduplication).
3. **Given** a pack published with source included, **When** imported, **Then** source-bearing fields present in the snapshot (e.g. raw markdown, images, cloze, slow) are present on the new session.
4. **Given** a pack published without source, **When** imported, **Then** the new session lacks those source-bearing fields and still has inventory/graph/modes that were published.

---

### User Story 3 - Preview before confirm; reject invalid codes (Priority: P1)

Before committing an import, the learner sees the pack title and creator name. Invalid or unpublished codes show a clear “invalid code” style error and do not create a session.

**Why this priority**: Prevents accidental imports and clarifies failure without silent no-ops.

**Independent Test**: Lookup by bad code / draft code fails with user-visible error; valid code shows title + creator before confirm.

**Acceptance Scenarios**:

1. **Given** a non-existent or unpublished code, **When** the user attempts import, **Then** they see a clear invalid-code error and no session is created.
2. **Given** a valid published code, **When** lookup succeeds, **Then** title and creator display name are shown before the user confirms import.

---

### User Story 4 - Importer Vault link only (Priority: P1)

After import, the new session is not linked to the creator’s Knowledge Vault. The system runs only the importer’s Vault-linking preparation step so concepts can later earn Vault entries for the importer the same way as a self-uploaded document.

**Why this priority**: Cross-user Vault leakage would be incorrect and unsafe; skipping link would break retrieval continuity for the importer.

**Independent Test**: Imported session has no creator Vault references; T1.6 (or equivalent isolated Vault-link phase) runs against the importer’s Vault/registry only.

**Acceptance Scenarios**:

1. **Given** a successful import, **When** inspecting the new session, **Then** it contains no creator Vault state and attribution records the source pack id and creator name for UI (“Imported from [creator]’s pack”).
2. **Given** that session, **When** Vault-linking runs, **Then** only the importer’s Vault/registry is used and study modes from the pack remain usable without regenerating resolved content.

---

### User Story 5 - Existing upload path unchanged (Priority: P2)

Learners who still upload a file on create-session start experience the same flow as before; pack-code is an additive branch.

**Why this priority**: Non-regression for the primary create path.

**Independent Test**: File staging → continue still creates/opens sessions as today; pack UI is optional and does not alter file handlers.

**Acceptance Scenarios**:

1. **Given** the create-session start screen, **When** the user uses file upload only, **Then** behavior matches pre-feature expectations (no required pack steps).

---

### Edge Cases

- Empty / whitespace / wrong-case code input: normalize (trim, uppercase) before lookup; still fail closed if no published match.
- User not authenticated or no active project: import fails closed with a clear message; no orphan session.
- Pack snapshot missing optional mode slices: clone what exists; session remains valid for present modes.
- Cloze slice present: clone without rewriting; internal cloze metadata must not bind the importer to the creator’s `docId`.
- Creator display name unavailable: show a safe fallback label (e.g. “Unknown creator”) while still allowing import if the pack is published.
- Concurrent imports of the same code: each succeeds as a separate session.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After a successful publish, the system MUST assign a unique share `code` (6–8 chars, uppercase A–Z and digits; prefer excluding ambiguous glyphs `0/O/1/I/L`) to the published `shared_packs` row, retrying generation on collision.
- **FR-002**: The system MUST show the assigned code to the publisher with a copy action.
- **FR-003**: Create-session start MUST offer an additive “Use pack code” path (input + Import) alongside existing file upload / no-file flows without changing those flows’ required steps.
- **FR-004**: Lookup MUST use the existing published-by-code RPC; only `status='published'` packs are importable. Invalid/unpublished codes MUST surface a clear invalid-code error and MUST NOT create a session.
- **FR-005**: Before confirm, the UI MUST show pack `title` and creator display name (or safe fallback).
- **FR-006**: `importPackAsSession(packCode, importingUserId, projectId)` MUST create a new DocumentSession owned by the importer in `projectId` with a new `docId` that does not collide with content-hash `docId`s of uploaded documents.
- **FR-007**: Import MUST deep-clone from the pack snapshot into the new session: `docMeta`, `docHierarchy`, `conceptInventory`, `conceptGraph`, `modeRecommendation`, and present mode slices (`rsvp`, `questions`, `recall`, and `cloze` when present). Source-bearing fields (`rawMarkdown`, `images`, `slowSlice` / slow) MUST be copied only when present in the published snapshot.
- **FR-008**: Import MUST NOT regenerate inventory, graph, blocks, or questions via LLM.
- **FR-009**: Import MUST NOT copy any creator Knowledge Vault state. After persist, the system MUST run importer-scoped Vault linking equivalent to DPP T1.6 (isolated or via the documented post-cache user-phase entry that includes T1.6) against the importer’s Vault/registry only.
- **FR-010**: The new session MUST record attribution (`sourcePackId` plus creator display name) in extended `uploadMeta` with `originalFormat: "pack"` so UI can show an imported-from label without breaking library rendering.
- **FR-011**: Re-importing the same code MUST always create a new independent session (no dedup). There is no sync from later pack changes, no expiry/revocation UI, no import analytics, and no public pack browse screen.
- **FR-012**: Pack-code generation MAY be implemented as part of finalize/publish completion in the export path; import UI and `importPackAsSession` live in this feature.

### Key Entities

- **Share code**: Short unique public identifier for a published pack.
- **Published pack**: Immutable snapshot already produced by pack export backend.
- **Imported DocumentSession**: New local session for the importer, cloned from snapshot + attribution + importer Vault link.
- **Pack attribution**: `uploadMeta` extension linking session → source pack and creator label.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After publish, owners can copy a share code in under 10 seconds without leaving the publish confirmation.
- **SC-002**: Learners can go from entering a valid code to a study-ready session in under 2 minutes on a typical pack (no content regeneration wait for already-resolved artifacts).
- **SC-003**: 100% of imports of the same code in test fixtures produce distinct sessions.
- **SC-004**: 0 creator Vault references appear on imported sessions in automated checks.
- **SC-005**: File-upload create-session path retains prior acceptance behavior (no new required steps).
- **SC-006**: Invalid codes never create sessions in automated negative tests.

## Assumptions

- Pack export backend (`shared_packs`, `finalizePack`, `lookup_shared_pack_by_code`) is already available; this feature assigns `code` at publish time and consumes the RPC from the client.
- **docId scheme (Open Q1)**: Imported sessions use an explicit `docId` override of the form `pack-{packId}-{base36Timestamp}` (or equivalent uniqueness), passed into `createSession` / session persist APIs — never `computeDocId` of cloned markdown (would collide with the creator’s session).
- **Attribution (Open Q2)**: Extend `uploadMeta` (not a new top-level shared field): `originalFormat: "pack"`, `sourcePackId`, `sourcePackOwnerName` (and optional `sourcePackTitle`). Library list UI ignores `uploadMeta` today; attribution is shown on create confirm and a light session label where cheap.
- **T1.6 isolation (Open Q3)**: Prefer calling an exported thin runner for T1.6 alone if low-cost; otherwise seed `preparation` so the session is Tier-1-ready and invoke the existing post-cache user-phases entry that includes T1.6, accepting T1.8/T1.9 if they are idempotent no-ops when inputs are missing. Do not re-run T1.1–T1.5.
- **Cloze clone (Open Q4)**: Clone cloze slice as published; strip or rewrite any embedded creator `docId` references if found during implementation research; if none, copy as-is.
- Creator display name comes from existing auth/profile lookup if available; otherwise fallback string.
- Ambiguous-character exclusion for codes is best-effort UX, not a hard security property (codes are not passwords).
- Publish remains immutable; no post-publish sync to importers.
