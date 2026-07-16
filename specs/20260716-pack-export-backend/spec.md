# Feature Specification: Pack Export Backend

**Feature Branch**: `20260716-pack-export-backend`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Pack export backend — editable pack draft from DocumentSession, publish with copyright-safe payload conditioned on includeSourceDocument, Mistral rewrite of non-deletable excerpts. No UI. Blocks pack concept graph editor and pack import flow."

**Source**: `20260716-pack-export-backend-spec.md`  
**Depends on**: session-store, session-types, document-preparation (DPP), api/llm, Supabase auth  
**Blocks**: `20260716-pack-concept-graph-editor-spec.md`, `20260716-pack-import-flow-spec.md`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create editable pack draft (Priority: P1)

An authenticated study-session owner asks the system to prepare a shareable pack from an existing document session. The system copies only the agreed study artifacts into a new draft pack owned by that user, leaving the original session untouched so later draft edits never mutate the source document.

**Why this priority**: Without a draft row and isolated snapshot, neither the graph editor nor publish/import can exist.

**Independent Test**: Given a DocumentSession fixture, createPackDraft returns a draft row whose snapshot matches the allowed subtrees and mutating the snapshot does not change the source session.

**Acceptance Scenarios**:

1. **Given** an authenticated owner and a DocumentSession with shared study artifacts, **When** createPackDraft runs, **Then** a `shared_packs` row exists with `status='draft'`, `code=NULL`, title from inferred doc title, and a deep-cloned snapshot of the allowed subtrees only.
2. **Given** a successful draft, **When** any field in the draft snapshot is mutated, **Then** the original DocumentSession shared data is unchanged.

---

### User Story 2 - Publish with source included (Priority: P1)

The owner finalizes a draft choosing to include the source document. The system publishes the snapshot as-is (no field stripping, no rewrite), marks it published, and leaves share-code assignment to the import feature.

**Why this priority**: Full-fidelity share path is the simpler publish branch and unblocks import of complete packs.

**Independent Test**: finalizePack(id, true) yields status published with snapshot deep-equal to the draft snapshot; code remains unset by this feature.

**Acceptance Scenarios**:

1. **Given** a draft pack, **When** finalizePack runs with includeSourceDocument true, **Then** status becomes `published`, `published_at` is set, `include_source_document` is true, and every snapshot field matches the draft.
2. **Given** that publish, **When** inspecting the row, **Then** `code` is still NULL (code assignment is out of scope).

---

### User Story 3 - Publish without source (copyright-safe) (Priority: P1)

The owner finalizes a draft choosing to exclude the source document. The system removes source-bearing subtrees and anchoring fields, rewrites remaining verbatim excerpts via the platform chat model so they cannot be searched back into the original text, then publishes. If rewrite fails, the pack stays draft and the caller gets an explicit error.

**Why this priority**: This is the copyright policy path that makes sharing legally safer; silent fallback would defeat the feature.

**Independent Test**: Fixture with simulated copyrighted text → finalizePack(..., false) strips required fields and rewrites recall excerpts with low Jaccard overlap vs originals; mocked LLM failure leaves status draft.

**Acceptance Scenarios**:

1. **Given** a draft whose snapshot includes raw markdown, cloze, images, slow slice, concept inventory anchors, and recall source_chunks, **When** finalizePack runs with includeSourceDocument false and rewrite succeeds, **Then** the published snapshot lacks rawMarkdown, slowSlice, modes.cloze, and images; every conceptInventory item lacks source_phrase and anchorRange; recall source_chunks are rewritten strings.
2. **Given** the same draft, **When** the rewrite call fails or returns empty, **Then** finalizePack rejects, the row remains `status='draft'`, and no published_at is set.
3. **Given** rewritten recall excerpts and their originals, **When** compared with the project's Jaccard overlap helper, **Then** overlap is below the implementation threshold (target &lt; 0.3).

---

### User Story 4 - Authenticated storage and lookup policy (Priority: P2)

Draft packs are private to their owner. Published packs are not listable by arbitrary clients; lookup by share code (RPC) is provided for the import feature, without opening a full-table SELECT of published packs.

**Why this priority**: Required for safe multi-user persistence; import depends on code lookup.

**Independent Test**: Migration + RLS policies: owner CRUD on own drafts; published readable only via code RPC for authenticated users.

**Acceptance Scenarios**:

1. **Given** user A’s draft, **When** user B attempts direct read/write, **Then** RLS denies access.
2. **Given** a published pack with a code, **When** an authenticated user calls the code lookup RPC, **Then** the published pack is returned; unrestricted SELECT of all published packs is not granted.

---

### Edge Cases

- DocumentSession missing optional subtrees (no recall, no cloze, empty inventory): draft still creates; publish-without-source skips absent paths.
- Empty or whitespace-only excerpt passed to rewrite: treat as failure (do not publish).
- Concurrent finalize on same draft: last write wins at DB level; no multi-writer UI in this feature.
- Owner not authenticated / missing owner_user_id: create/finalize must fail closed (no anonymous packs).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create a pack draft from a DocumentSession by deep-cloning only: docMeta, docHierarchy, conceptInventory, conceptGraph, modeRecommendation, modes.rsvp, modes.questions, modes.cloze, modes.recall, images, rawMarkdown, and slowSlice (full modes.slow clone stored under the snapshot key `slowSlice`).
- **FR-002**: Creating a draft MUST NOT mutate the source DocumentSession (no shared object references).
- **FR-003**: System MUST persist drafts in Supabase table `shared_packs` with columns: id, code (NULL while draft), owner_user_id, source_doc_id, title, status (`draft`|`published`), include_source_document (NULL while draft), snapshot (jsonb), created_at, published_at (NULL while draft).
- **FR-004**: RLS MUST allow owners to read/write their own rows; published packs MUST NOT be broadly SELECTable; authenticated lookup by `code` MUST be available via RPC for the import feature.
- **FR-005**: `finalizePack(packDraftId, includeSourceDocument=true)` MUST publish the snapshot unchanged and set status/published_at/include_source_document; MUST NOT assign `code`.
- **FR-006**: `finalizePack(..., false)` MUST remove rawMarkdown, slowSlice, modes.cloze, and images; MUST remove source_phrase and anchorRange from every conceptInventory entry; MUST replace each modes.recall.questions[].source_chunks entry with a rewritten string via rewritePackExcerpt; MUST fail closed if any rewrite fails or returns empty.
- **FR-007**: rewritePackExcerpt MUST use the platform quality chat model (DeepSeek via `llmChatCompletions`; Mistral is not available on the proxy), temperature 0.3, dynamic max_tokens from input length, and a prompt that requires technical fidelity while preventing searchable verbatim residual phrasing.
- **FR-008**: Pack export MUST NEVER read or write the creator’s real Knowledge Vault tables; only session-embedded derived text may be rewritten if present in the snapshot.
- **FR-009**: Scope is whole DocumentSession only — no partial block selection, no post-publish mutation propagation, no moderation/marketplace UI.
- **FR-010**: This feature MUST NOT include pack editor UI or import/share UI (separate specs).

### Key Entities

- **Pack draft**: Owner-private editable snapshot derived from one DocumentSession; status draft; code null.
- **Published pack**: Immutable snapshot after finalize; include_source_document fixed; code assigned later by import feature.
- **Pack snapshot**: JSON subtree of shared study artifacts plus slowSlice/rawMarkdown/images as defined in FR-001.
- **Rewrite job**: Per-excerpt platform chat call keyed by kind (`recall_excerpt`, and vault kinds only if session-embedded vault preview fields exist).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a copyrighted-text fixture, publish-without-source never retains raw source document, cloze mode payload, images, or inventory source anchors in the published snapshot.
- **SC-002**: Rewritten recall excerpts show Jaccard overlap below 0.3 versus their pre-rewrite text using the existing fidelity overlap helper.
- **SC-003**: Publish-with-source leaves the published snapshot identical to the draft snapshot for all keys.
- **SC-004**: On rewrite failure, finalize rejects and 100% of such attempts leave the row in draft with no published_at.
- **SC-005**: Mutating a draft snapshot never changes the source session’s shared objects (verified by deep equality of session before/after draft edits).

## Assumptions

- `shared.conceptGraph` is shaped `{ nodes: [...], edges: [...] }` (confirmed by existing session usage).
- `modes.recall.questions[].source_chunks` is an array of strings after normalization in recall-slice.
- Creator Knowledge Vault is a global store outside DocumentSession `shared`; vault candidate previews are not persisted inside the pack snapshot → vault rewrite kinds are no-ops unless research finds session-embedded vault text (plan will confirm; default: no-op).
- Deep clone via `structuredClone` (or JSON round-trip) is acceptable because snapshot content is JSON-serializable.
- Share `code` generation and assignment belong entirely to the import feature; this feature only provides the RPC lookup surface and nullable `code` column.
- Jaccard threshold for rewrite acceptance is 0.3 (exclusive): overlap ≥ 0.3 fails finalize (treat as rewrite quality failure).
- Title at draft creation copies `docMeta.titleInferred` (fallback empty string if missing).
- English-only prompts/heuristics per project constitution.
- Source engineering note preferred Mistral Medium/Large for one-shot rewrite quality; platform chat is DeepSeek-only (`llm.js` / `llm-proxy`). Quality is enforced by prompt + Jaccard gate instead of a second provider.
