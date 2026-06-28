# Feature Specification: Multi-File Upload with Source Provenance

**Feature ID**: `20260702-multifile-upload`  
**Status**: Approved  
**Created**: 2026-06-28  
**Input**: SPEC-multifile.md

## User Scenarios & Testing

### User Story 1 — Stage multiple files before DPP (Priority: P1)

A user creating a session can add 1–5 study files, remove any before confirmation, and continue once a session name is set.

**Why this priority**: Core workflow unblock for multi-source study.

**Independent Test**: Stage 2 PDFs, remove one, continue with 1 file — DPP runs on remaining content.

**Acceptance Scenarios**:

1. **Given** empty staging, **When** user adds a file, **Then** row shows name, size, and remove control.
2. **Given** 5 files staged, **When** user views staging, **Then** "Add another file" is hidden.
3. **Given** staged files and session name, **When** user clicks Continue, **Then** normalization + tier-1 DPP start.

---

### User Story 2 — Mechanical source provenance (Priority: P1)

Blocks, Recall questions, and Cloze items carry optional source file ids derived from chunk context without LLM cost.

**Why this priority**: Enables future UI and analytics; zero runtime LLM overhead.

**Independent Test**: Two-file session produces blocks whose `sourceFileIds` reflect file boundaries.

**Acceptance Scenarios**:

1. **Given** concatenated markdown with file sentinels, **When** blocks are packed, **Then** no block spans a sentinel boundary.
2. **Given** legacy single-file session, **When** loaded, **Then** no errors and `files` is treated as empty.

---

### User Story 3 — Slow mode file selector (Priority: P2)

When a session has multiple uploaded files, Slow scope picker includes a file selector defaulting to the first file.

**Why this priority**: Slow mode reads one text scope at a time.

**Independent Test**: Multi-file session shows selector; single-file session does not.

**Acceptance Scenarios**:

1. **Given** 2+ files in `uploadMeta.files`, **When** user opens Slow scope, **Then** file selector lists file names.
2. **Given** file B selected, **When** scope list renders, **Then** sections belong to file B only.

---

### Edge Cases

- Empty file rejected at normalization.
- Duplicate file names allowed (distinct `fileId`).
- Post-DPP file removal not supported.
- Session name auto-fills from first file unless user edited manually.

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow staging 1–5 files on create-session screen before DPP.
- **FR-002**: User MUST be able to remove staged files before Continue without confirmation.
- **FR-003**: Continue MUST require ≥1 staged file and non-empty session name.
- **FR-004**: `uploadMeta.files[]` MUST persist one `SourceFileMeta` per file in upload order.
- **FR-005**: Multi-file normalization MUST concatenate per-file markdown with hard section breaks between files.
- **FR-006**: Block packing MUST NOT cross file sentinel boundaries.
- **FR-007**: Blocks MAY include `sourceFileIds: string[]` when provenance is known.
- **FR-008**: Recall questions and Cloze items MAY include `sourceFileId` derived from source text, not LLM.
- **FR-009**: Slow scope MUST show file selector only when `files.length > 1`.
- **FR-010**: Legacy sessions without `files` MUST load without errors.

### Key Entities

- **SourceFileMeta**: Stable `fileId`, display name, format, size, `addedAt`.
- **Source sentinel**: HTML comment marking file boundary in concatenated markdown.

## Success Criteria

- **SC-001**: Users can create a session from 2 files without separate sessions.
- **SC-002**: Single-file upload behavior matches pre-feature regression baseline.
- **SC-003**: 100% of packed blocks in a 2-file test respect sentinel boundaries.
- **SC-004**: Legacy sessions open without console errors related to `uploadMeta.files`.

## Assumptions

- Normalization pipeline returns flat markdown; provenance uses sentinels + char-offset resolution.
- Block packing entry point is `assignAlignedChunksSequential` in `chunk-alignment.js`.
- Create-session handlers live in `study.js` (no separate module).
- Section extraction for Slow scope uses `buildScopeOptions` on `slow.normalizedTextFull`; file filtering slices markdown by sentinel regions.
