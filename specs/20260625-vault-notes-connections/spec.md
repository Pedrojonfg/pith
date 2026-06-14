# Feature Specification: Vault Personal Notes, Connections & Resumable Upload

**Feature Branch**: `20260625-vault-notes-connections`

**Created**: 2026-06-14

**Status**: Draft

**Input**: User description: "Extend Knowledge Vault entries with personal notes, areas, tags, bidirectional related connections, and a resumable upload queue for Upload to Vault curation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Personal notes on vault entries (Priority: P1)

During Upload to Vault, the learner receives an LLM-drafted markdown note (definition, context, notes) for each studied concept, edits it, and commits it as part of the vault entry — giving the vault a place for their own words, not only algorithmic mastery data.

**Why this priority**: Notes are the core reason to return to a personal vault; without them the feature delivers no new user-facing value.

**Independent Test**: Study one concept → Upload to vault → accept a note draft → commit → open vault entry and see markdown note with timestamp.

**Acceptance Scenarios**:

1. **Given** default settings, **When** curation loads, **Then** each concept shows an editable markdown note draft with definition/context sections.
2. **Given** an accepted note, **When** the user commits, **Then** the vault entry stores `notes`, `notesUpdatedAt`, and `status: ready`.
3. **Given** settings with auto-draft notes off, **When** curation loads, **Then** the note field is blank for manual entry.
4. **Given** re-curation of an entry that already has notes, **When** the user commits new notes, **Then** content is appended as a dated subsection, never overwritten.

---

### User Story 2 - Areas, tags, and related connections (Priority: P1)

The learner categorizes concepts with suggested areas and tags, and links related concepts via checkboxes — including siblings in the same batch and vault neighbors suggested by dedup — with bidirectional backlinks written on commit.

**Why this priority**: User-made connections differentiate a personal vault from a flat concept list.

**Independent Test**: Upload two related concepts in one batch → link them → commit → verify both entries list each other in `related`.

**Acceptance Scenarios**:

1. **Given** existing vault areas, **When** area is suggested, **Then** the system prefers existing area values before proposing new ones.
2. **Given** sibling concepts in the batch, **When** curation renders, **Then** they appear as related candidates (top 2–3 pre-checked when sensible).
3. **Given** accepted related IDs on commit, **When** processing completes, **Then** target entries gain a backlink without changing their `status` or other fields.
4. **Given** empty related after curation, **When** the user commits, **Then** a non-blocking warning appears but commit proceeds.

---

### User Story 3 - Resumable upload queue (Priority: P1)

After confirming Upload to Vault, processing runs sequentially in the background (dedup → commit → backlinks per concept). Progress persists across navigation and app restarts; interrupted items retry without duplicating completed work.

**Why this priority**: Extended curation is LLM-heavy; without resumability users lose work on interruption.

**Independent Test**: Start upload of 3 concepts → close tab after 1 completes → reopen → resume banner shows → only remaining items process.

**Acceptance Scenarios**:

1. **Given** confirmed selections, **When** processing starts, **Then** a persisted queue tracks each concept as pending/processing/done/error.
2. **Given** an item completes, **When** vault writes finish, **Then** that item is marked done before the next starts.
3. **Given** app reload with pending queue items, **When** the app boots, **Then** a resume banner shows count and allows resume; stale `processing` items retry as pending.
4. **Given** one item fails, **When** others remain, **Then** processing continues; user can retry failed items individually or all errors.
5. **Given** navigation away from curation screen, **When** queue is active, **Then** processing continues in the same tab.

---

### User Story 4 - Schema migration for existing vaults (Priority: P2)

Existing vault entries migrate lazily to the extended model with sensible defaults; legacy `topic` and import paths keep working.

**Why this priority**: Must not break existing users or CSV/JSON import.

**Independent Test**: Load vault with v1-style entries → verify new fields populated per migration table → CSV import still uses `topic`.

**Acceptance Scenarios**:

1. **Given** an entry with `sources.length > 0`, **When** migrated, **Then** `status` defaults to `ready`.
2. **Given** an entry with empty `sources`, **When** migrated, **Then** `status` defaults to `pending`.
3. **Given** an entry with `topic` set, **When** migrated, **Then** `area` defaults to `[topic]`.
4. **Given** CSV/JSON import, **When** rows merge, **Then** `topic` field behavior is unchanged.

---

### Edge Cases

- Single-concept batch with no related candidates: soft warning, commit allowed.
- Dedup returns merge to entry outside batch: backlinks still apply to neighbors.
- Queue interrupted mid-backlink: item retries from dedup without duplicating prior done items.
- User clears note draft entirely but accepts definition: note may be empty; entry still becomes `ready` if other curation accepted.
- Related ID references deleted entry: skip invalid ID on commit.
- Vault with hundreds of entries: dedup prompt stays bounded via area filter + title similarity cap.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extend vault entries with `type`, `area`, `tags`, `notes`, `notesUpdatedAt`, `related`, and `status` per v2 entry schema.
- **FR-002**: System MUST migrate existing entries lazily on vault load with defaults documented in Assumptions; vault container schema version MUST increment.
- **FR-003**: System MUST retain `topic` for legacy compatibility; Upload to Vault MUST set `topic = area[0]` on new curated entries.
- **FR-004**: Upload curation MUST suggest editable `notes`, `area` (multi-value), `tags`, and `related` checkboxes alongside existing definition and review items.
- **FR-005**: System MUST prefer existing vault `area` values when suggesting areas; new areas only when none fit.
- **FR-006**: Related candidates MUST include batch siblings plus dedup-suggested vault neighbors not marked duplicate.
- **FR-007**: Dedup normalization MUST extend to return `areaSuggestion` and `relatedCandidates` per concept in the same call as merge/alias/new decision.
- **FR-008**: On commit, system MUST write bidirectional `related[]` backlinks; neighbor updates MUST touch `related[]` only.
- **FR-009**: On merge commit, system MUST union tags and area, merge notes via append-only rule, and set `status` to `ready`.
- **FR-010**: System MUST persist upload queue in `pith_vault_upload_queue` with per-item status and error messages.
- **FR-011**: Queue controller MUST process items sequentially (dedup → commit → backlinks), flush vault after each item, and run globally (not screen-local).
- **FR-012**: On app boot, system MUST show resume banner when queue has pending/error/stale-processing items.
- **FR-013**: System MUST provide a settings toggle defaulting to auto-draft notes on.
- **FR-014**: System MUST show non-blocking warning when committing with empty `related[]`.

### Key Entities

- **KnowledgeVaultEntry (v2)**: Canonical concept record with mastery fields plus `type`, `area[]`, `tags[]`, `notes`, `notesUpdatedAt`, `related[]` (entry IDs), `status` (`pending`|`ready`).
- **VaultUploadQueue**: Persisted batch job with `docId`, `createdAt`, and items each holding `conceptId`, status, optional error, and accepted curation payload.
- **BatchContext**: Document id, full concept inventory slice for the batch, and distinct existing vault areas — input to curation and dedup.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete Upload to Vault with notes and at least one related link for a multi-concept batch in under 10 minutes including edits.
- **SC-002**: After simulated interruption (reload mid-queue), 100% of already-done items are not re-committed or duplicated.
- **SC-003**: Bidirectional related links are symmetric within one commit operation (if A lists B, B lists A).
- **SC-004**: Legacy vault entries load without data loss; migration adds new fields for 100% of entries on first load.
- **SC-005**: 95% of upload sessions with 5+ concepts complete without requiring manual queue repair when network is stable.

## Assumptions

- Only `type: CONCEPT` is written in this release; other type values are schema-reserved.
- Wikilink parsing in `notes` is out of scope; `[[Title]]` remains plain text.
- Background processing while the app is fully closed is out of scope; resume on next open only.
- Obsidian vault import is out of scope.
- Dedup LLM prompt is capped to entries sharing likely batch areas plus top-K title matches.
- Auto-draft notes default is on; stored in local user preferences.
- `status: ready` means the entry passed Upload to Vault curation at least once.
