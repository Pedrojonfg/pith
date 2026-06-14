# Feature Specification: Study Projects

**Feature Branch**: `20260623-study-projects`

**Created**: 2026-06-14

**Status**: Draft

**Input**: User description: "Introduce Project — a user-defined hierarchical entity that groups study documents. Every document belongs to exactly one project (default: Misc). Projects enable temporal grouping, scoped spaced review, and prioritized cross-document knowledge context when generating study material. Orthogonal to existing topic tags from automated concept analysis."

**Prerequisites**: Unified document session model (`20260609-unified-session`); Knowledge Vault A+ cross-document mastery (`20260618-knowledge-vault-a-plus`); mode continuity and shared learning record (`20260612-mode-continuity`).

**Out of scope (v1)**: Multiple project membership per document; drag-and-drop reordering; automatic project suggestions from topic tags; cascade reassignment on project delete; changes to vault mastery model or topic-tag generation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Organize documents into subjects (Priority: P1)

As a learner studying several subjects over months, I want to group my documents into named subjects and sub-subjects so I can find related material together instead of scrolling a flat list.

**Why this priority**: Without project grouping, the library stays a flat chronological list and the core organizational problem remains unsolved.

**Independent Test**: Create a root project "Algebra II", add a subproject "Unit 3", assign two documents to it, and navigate the library to see subprojects and documents nested under the correct parent.

**Acceptance Scenarios**:

1. **Given** the library home, **When** the user creates a new root project with a name, **Then** it appears alongside the default "Misc" project at the top level.
2. **Given** an existing project, **When** the user creates a subproject inside it, **Then** the subproject appears when opening that parent in the library.
3. **Given** a document in the library, **When** the user chooses "Move to project…" and picks a destination, **Then** the document appears under that project on the next library view.
4. **Given** a new document upload, **When** the upload form is shown, **Then** a project selector is pre-filled (Misc from the general entry point, or the current project when uploading from within a project) and never blocks upload.

---

### User Story 2 — Review only one subject (Priority: P1)

As a learner preparing for an exam in one subject, I want spaced review limited to documents in that subject (optionally including sub-subjects) so I am not distracted by unrelated due items.

**Why this priority**: Scoped review is a primary motivation for projects; without it, review remains all-or-nothing.

**Independent Test**: Assign documents to two different projects with due review items each; start review scoped to one project; confirm only items from documents in that scope appear.

**Acceptance Scenarios**:

1. **Given** review configuration, **When** the user selects "All subjects", **Then** the review pool matches today's global cross-document behavior.
2. **Given** review configuration, **When** the user selects a project with "Include subprojects" checked, **Then** review items come only from documents assigned to that project or any descendant project.
3. **Given** review configuration, **When** the user selects a project with "Include subprojects" unchecked, **Then** review items come only from documents directly assigned to that exact project.
4. **Given** a knowledge entry linked to documents in different projects, **When** review is scoped to one project, **Then** the item appears only if at least one of its source documents belongs to the selected scope.

---

### User Story 3 — Smarter study context for the current subject (Priority: P2)

As a learner generating RSVP blocks for a document in "Algebra II", I want prior mastery from the same subject surfaced first in study guidance so the system calibrates depth on what matters now without hiding knowledge from other subjects.

**Why this priority**: Improves generation quality once organization exists; does not block library or review value.

**Independent Test**: Build vault entries from documents in project A and project B; open a document in project A for block generation; confirm same-subject mastery appears before related-parent and general mastery in the injected context, with nothing excluded.

**Acceptance Scenarios**:

1. **Given** vault entries from multiple projects, **When** study material is generated for a document in project P, **Then** entries whose sources belong to P are labeled and ordered as highest-priority same-subject mastery.
2. **Given** vault entries from a parent project of P, **When** context is built, **Then** those entries appear in a lower-priority related-subject band.
3. **Given** vault entries from unrelated projects, **When** context is built, **Then** they still appear in a general band (awareness only), never omitted solely because of project mismatch.
4. **Given** token budget limits, **When** context must be truncated, **Then** general entries are dropped first, then related-subject entries; same-subject entries are never truncated.

---

### User Story 4 — Navigate with clear location context (Priority: P2)

As a learner deep in a subproject studying a document, I want breadcrumbs showing Project › Subproject › Document › Mode so I always know where I am and can jump back.

**Why this priority**: Hierarchy depth is only usable with persistent wayfinding; supports unlimited nesting without confusion.

**Independent Test**: Navigate Library › Parent › Child › Document › Mode select; breadcrumb segments are clickable back to each level.

**Acceptance Scenarios**:

1. **Given** the project library at any depth, **When** displayed, **Then** a breadcrumb shows the path from Library through each ancestor project.
2. **Given** mode select or an active study mode entered from a document, **When** displayed, **Then** the breadcrumb includes the document's project path and document name.
3. **Given** review configuration with a project scope, **When** displayed, **Then** the breadcrumb or scope label shows "Review › [scope]".

---

### User Story 5 — Home hub with three clear entry points (Priority: P2)

As a returning learner, I want the document home screen to offer Continue, Library, and Review so I can resume, browse subjects, or start scoped review without hunting through menus.

**Why this priority**: Connects projects to daily workflows from the existing mode-select entry point.

**Independent Test**: From document mode select (general entry), tap Library → project browser opens; tap Review → review config opens with scope picker.

**Acceptance Scenarios**:

1. **Given** the general document home (not entered from library with a specific document), **When** shown, **Then** three actions are visible: Continue (active document), Library, Review.
2. **Given** entry from library with a specific document selected, **When** mode select opens, **Then** it behaves as today (mode hub for that document) with breadcrumb showing project context.

---

### Edge Cases

- What happens when the user tries to delete the default "Misc" project? — Deletion is blocked; rename is allowed.
- What happens when the user tries to move a project inside its own descendant? — Move is rejected with a clear error: "Cannot move a project into its own subproject".
- What happens when the user tries to delete a project that still has documents or subprojects? — Deletion is blocked with guidance to move content out first.
- What happens to existing documents before this feature? — On first launch after update, all documents without a project assignment receive the default "Misc" project; a "Misc" project is created if missing.
- What happens when topic tags and project disagree (e.g., document in "Algebra" with topic tags mentioning "Economics")? — Both signals remain independent; topic tags still drive vault search breadth; project drives organization, review scope, and context priority only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create, rename, and reparent projects in a tree (each project has at most one parent; unlimited depth).
- **FR-002**: System MUST provide a default root project named "Misc" that cannot be deleted or reparented but can be renamed.
- **FR-003**: Every study document MUST belong to exactly one project at all times; default assignment is "Misc".
- **FR-004**: Users MUST be able to assign or reassign a document's project at upload time and from the library via "Move to project…".
- **FR-005**: Library MUST display a project browser: root projects, drill-down into subprojects, and documents assigned to the current level.
- **FR-006**: System MUST prevent deletion of a project that has assigned documents or child projects until content is moved elsewhere.
- **FR-007**: System MUST prevent reparenting that would create a cycle in the project tree.
- **FR-008**: Review configuration MUST offer scope "All subjects" (current global behavior) or a selected project with optional "Include subprojects" (default: included).
- **FR-009**: Scoped review MUST include an item when any source document for that item falls within the selected project scope.
- **FR-010**: When generating study material with cross-document knowledge context, system MUST prioritize vault entries by project relationship: same project first, then ancestor projects, then unrelated — without excluding unrelated entries.
- **FR-011**: When context length must be reduced, system MUST preserve same-subject entries and trim general entries first, then related-subject entries.
- **FR-012**: Existing automated topic tags on documents MUST remain unchanged and continue to serve vault normalization search independently of project assignment.
- **FR-013**: Document home (mode select) MUST expose Continue, Library, and Review entry points when opened as a general hub; document-specific entry from library retains the existing per-mode hub.
- **FR-014**: Breadcrumbs MUST appear on library, mode select, study modes, and review screens showing project path and current context.
- **FR-015**: Migration on upgrade MUST be idempotent: create default project store if missing, backfill missing document project assignments to "Misc".

### Key Entities

- **Project**: User-defined organizational node with name, optional color, single parent reference, and timestamps. Forms a tree rooted at top-level projects including "Misc".
- **Project collection**: Persisted set of all projects with schema version; independent from individual document sessions.
- **Document (study session)**: Existing per-document learning container; gains a required project assignment as organizational metadata (not pedagogical content).
- **Review scope**: Transient user choice — all subjects, or one project with optional descendant inclusion — applied when building the review queue.
- **Knowledge context band**: Logical grouping (same-subject, related-subject, general) applied when ordering cross-document mastery for generation prompts; not stored on vault entries.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a two-level project hierarchy and assign a document in under 2 minutes without documentation.
- **SC-002**: 100% of pre-existing documents receive a valid project assignment after upgrade with no user action required.
- **SC-003**: Scoped review for a single project shows zero items from documents outside that scope in manual verification across at least 3 test documents in 2 projects.
- **SC-004**: Cross-document generation context for a document in project P lists same-project mastery entries before unrelated-project entries in 100% of test cases where both exist.
- **SC-005**: Users can navigate from a nested subproject to a document's mode hub and back to library root using breadcrumbs alone in under 4 taps/clicks.
- **SC-006**: Blocked destructive actions (delete Misc, delete non-empty project, cyclic reparent) always show the specified English error message without partial data loss.

## Assumptions

- Personal use with a modest number of projects (typically 1–3 levels, fewer than 50 projects total).
- Single-device local storage remains the persistence model; no sync or multi-user project sharing in v1.
- English UI strings as specified in the source design reference.
- Unified session, Knowledge Vault A+, and SM-2 review infrastructure are already deployed.
- Topic tags (`docTopics`) continue to be LLM-generated fuzzy tags; projects are entirely user-controlled and never auto-assigned in v1.
- One document maps to one project permanently until the user explicitly moves it.
