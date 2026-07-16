# Feature Specification: Pack Concept Graph Editor

**Feature Branch**: `20260716-pack-concept-graph-editor`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Pack concept graph editor — after createPackDraft, let the pack creator rename/add/delete concept nodes and add/delete typed edges on snapshot.conceptGraph + snapshot.conceptInventory only; publish via finalizePack. Never mutate the original DocumentSession."

**Source**: `20260716-pack-concept-graph-editor-spec.md`  
**Depends on**: `20260716-pack-export-backend` (`createPackDraft`, `finalizePack`, `shared_packs` drafts)  
**Blocks**: none directly; should land before publish flows expect real graph edits

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open draft graph read-only (Priority: P1)

After creating a pack draft from a study session, the owner opens an editor screen that shows the draft’s concept graph. They can inspect nodes and relationships without changing anything yet, confirming the draft snapshot loaded correctly.

**Why this priority**: Validates the draft→UI data path before any mutation risk; unblocks all edit stories.

**Independent Test**: Given a draft with a known conceptGraph, open the editor and verify rendered nodes/edges match the draft snapshot while the source DocumentSession is unchanged.

**Acceptance Scenarios**:

1. **Given** an authenticated owner and a draft pack with a non-empty concept graph, **When** they open the pack concept editor, **Then** the screen shows that draft’s nodes and edges.
2. **Given** the editor is open, **When** the owner only views the graph, **Then** the draft snapshot and the original DocumentSession remain unchanged.

---

### User Story 2 - Rename a concept (Priority: P1)

The owner selects a concept node and changes its display name. The new name appears on the graph and in the draft’s concept inventory entry for that concept.

**Why this priority**: Highest-value, lowest-structure-risk edit; teaches the mutation/persist path.

**Independent Test**: Rename one node; assert inventory title and graph label update in the persisted draft; source session titles unchanged.

**Acceptance Scenarios**:

1. **Given** a draft with a named concept, **When** the owner renames that node, **Then** the matching concept inventory title updates and the graph shows the new label.
2. **Given** that rename, **When** comparing the original DocumentSession, **Then** its concept inventory titles are unchanged.

---

### User Story 3 - Delete a concept with edge cleanup (Priority: P1)

The owner deletes a concept after confirmation. The concept disappears from inventory and graph, and every relationship that touched that concept is removed so the graph has no dangling edges.

**Why this priority**: Structural integrity of the draft graph; required before publish can ship edited graphs safely.

**Independent Test**: Delete a mid-degree node; assert no edge references missing node ids; inventory entry gone; source session untouched.

**Acceptance Scenarios**:

1. **Given** a draft node with incident edges, **When** the owner confirms delete, **Then** the inventory entry and node are removed and all edges that referenced that node are gone.
2. **Given** that delete, **When** inspecting the draft graph, **Then** no edge references a missing node id.

---

### User Story 4 - Add a concept (Priority: P2)

The owner adds a new concept by name. The system assigns a unique concept id, adds an inventory entry and a graph node, without inventing relationships.

**Why this priority**: Extends the pack beyond DPP-derived concepts; depends on stable id generation.

**Independent Test**: Add a concept with a unique name; assert inventory + node present with new id; no accidental edges; source session unchanged.

**Acceptance Scenarios**:

1. **Given** the editor, **When** the owner adds a concept with a non-empty name, **Then** a new inventory entry and graph node exist with a unique concept id.
2. **Given** an empty name submission, **When** the owner tries to add, **Then** no inventory/node is created and the user sees a clear validation message.

---

### User Story 5 - Add and remove relationships (Priority: P2)

The owner connects two concepts with a typed relationship from the allowed type set, or removes an existing relationship after confirmation.

**Why this priority**: Completes graph structure editing; more interaction complexity than node rename/delete.

**Independent Test**: Add one typed edge between two nodes, then delete it; assert edge list matches; invalid pair (same node twice) rejected.

**Acceptance Scenarios**:

1. **Given** two distinct nodes, **When** the owner picks an allowed relationship type, **Then** an edge of that type appears between them in the draft graph.
2. **Given** an existing edge, **When** the owner confirms removal, **Then** that edge is absent from the draft graph.
3. **Given** a self-pair or missing type, **When** the owner attempts to add a relationship, **Then** no edge is created and the user sees a clear validation message.

---

### User Story 6 - Publish from the editor (Priority: P1)

From the editor, the owner chooses whether to include the source document and publishes. Publishing uses the existing finalize path; after success the draft is no longer editable as a draft.

**Why this priority**: Closes the creator loop; without publish the editor has no shipping outcome.

**Independent Test**: Edit graph, toggle include-source, publish; assert finalizePack receives the edited snapshot and include flag; source DocumentSession still matches pre-draft state.

**Acceptance Scenarios**:

1. **Given** an edited draft, **When** the owner publishes with include-source on or off, **Then** finalizePack runs with that flag and the current draft snapshot.
2. **Given** a successful publish, **When** the owner returns to create flows, **Then** they are not left editing that pack as if it were still a draft.
3. **Given** a publish failure, **When** the error is shown, **Then** the draft remains editable and prior graph edits are still present.

---

### Edge Cases

- Draft with empty concept graph / empty inventory: editor opens; add-concept still works; publish still allowed.
- Concurrent tab: last successful save wins; no collaborative merge.
- Save/network failure mid-edit: user sees an error; in-memory edits remain until they retry save or leave.
- Deleting a concept that is still mentioned in RSVP/questions/recall content: graph/inventory update succeeds; dangling content references are an accepted known limitation (no cascade rewrite).
- Owner opens editor for a pack that is already published: editor refuses mutation and directs them to create a new draft.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Owners MUST be able to open a pack concept editor for a draft pack they own, showing that draft’s concept graph.
- **FR-002**: The editor MUST mutate only the draft pack snapshot’s concept graph and concept inventory; it MUST NOT read or write the creator’s original DocumentSession for edit persistence.
- **FR-003**: Owners MUST be able to rename a concept; the new title MUST update both the inventory entry and the graph label for that concept.
- **FR-004**: Owners MUST be able to add a concept with a non-empty name; the system MUST assign a unique concept id and create matching inventory and graph node entries.
- **FR-005**: Owners MUST be able to delete a concept after confirmation; the system MUST remove the inventory entry, the node, and all edges that reference that node.
- **FR-006**: Owners MUST be able to add a typed relationship between two distinct concepts using the project’s allowed edge-type vocabulary.
- **FR-007**: Owners MUST be able to delete a relationship after confirmation.
- **FR-008**: Draft snapshot changes MUST be persistable to the draft pack (debounced or on leave/publish) with visible failure feedback on save errors.
- **FR-009**: The editor flow MUST expose an include-source-document choice before publish and MUST invoke the existing finalize-pack behavior with the current draft and that choice.
- **FR-010**: The editor MUST NOT cascade-edit explanations, questions, definitions, or other non-graph snapshot fields when graph/inventory changes.
- **FR-011**: Existing read-only material graph screens (e.g. Slow graph) MUST remain read-only; edit interactions are confined to the pack concept editor.

### Key Entities

- **Pack draft**: Owner-scoped unpublished pack with an editable snapshot.
- **Concept inventory entry**: Concept identity + display title (and other existing fields left untouched by this feature except title on rename and full row on add/delete).
- **Concept graph**: Nodes and typed edges representing relationships among concepts in the draft.
- **Publish choice**: Boolean include-source-document decision made before finalize.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After any editor session, the original DocumentSession’s shared concept inventory and concept graph match a pre-edit baseline (zero unintended mutations).
- **SC-002**: After deleting a concept, 100% of remaining draft edges reference existing node ids only.
- **SC-003**: After renaming a concept, the persisted draft inventory title and on-screen graph label both show the new name within one save cycle.
- **SC-004**: An owner can complete view → edit (at least one mutation) → publish in a single continuous flow without leaving the pack-creation path.
- **SC-005**: Publish failure leaves the draft editable with prior graph edits intact in at least 100% of simulated finalize failures in automated tests.

## Assumptions

- **Entry point**: A “Create pack” / “Edit & publish” action lives on each document row in the project library (alongside the existing Markdown export control). Flow: create draft → open concept editor → publish.
- **Include-source toggle**: Shown on the concept editor screen itself, near Publish.
- **Persistence**: Keep edits in memory; persist draft snapshot to storage with a short debounce and also on screen leave / before publish. Use existing simple error UI; do not build a new retry-with-backoff wrapper in this feature.
- **Concept ids for new nodes**: Generate a unique `canonicalId` local to the draft (slug from title + disambiguator if needed), then derive graph node ids with the existing `concept:` id helper so they cannot collide with current inventory ids.
- **Edge type vocabulary**: Reuse the existing graph edge-type set (e.g. `requires`, `contradicts`, `exemplifies`, `constitutes`, `relates`) rather than introducing a parallel `PREREQUISITE`/`PART_OF` enum; map product language to those types in UI labels if needed.
- **Dangling content references**: Physical delete of inventory/nodes/edges is preferred over soft-hide. Hanging references inside RSVP/questions/recall after delete are an accepted v1 limitation, documented in code near the delete path.
- **Auth**: Only the draft owner can open/edit; relies on existing draft RLS from pack-export-backend.
- **No undo/redo, no realtime collab, no semantic graph validation** beyond orphan-edge cleanup on node delete.
