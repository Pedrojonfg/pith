# Feature Specification: Hierarchical Scope Selection UX

**Feature Branch**: `20260807-scope-hierarchy-ux`  
**Created**: 2026-08-07  
**Status**: Draft  
**Input**: Audit of `screenScopeSelection` — flat list, no nesting/expand-collapse, no parent→child cascade, no tri-state; restore hierarchical picker intent from the removed Slow `scope-picker-ux` contract while keeping the universal gate.

## Problem

The universal scope gate (`screenScopeSelection`) lists hierarchy nodes as a flat checkbox list. Users cannot see parent/child structure, expand or collapse sections, or use familiar parent-select / partial-select patterns. Selecting a parent and a child can also produce overlapping text slices in the scoped study material.

## Goal

Upgrade the scope picker so section hierarchy is visible and actionable: nested display with expand/collapse, parent selection that covers children, and a clear partial-selection state — without changing the gate timing, persistence shape (`sectionIds` + full-document null), or mode-agnostic role of the screen.

## Non-goals

- NG1: No mid-session re-scoping after the user has confirmed and Tier 1+ has advanced.
- NG2: No return of Slow-only `screenSlowScope` or section edit/rename/split/merge overrides.
- NG3: No change to DPP phase ordering or which phases consume `scopedMarkdown`.
- NG4: No change to guide-chat / Socratic out-of-scope disclosure contracts.
- NG5: No multi-document or cross-project scope picker.
- NG6: No deeper nesting UI beyond the levels already offered as selectable (currently L1–L2).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See hierarchy while choosing scope (Priority: P1)

A learner opens the scope gate after document structure is ready. They see sections nested under their parents (indent and/or grouping), not a flat equal-weight list. Parents with children can be expanded or collapsed. Character counts remain visible per row.

**Why this priority**: Without structure, multi-select scope is hard to reason about on book-length documents.

**Independent Test**: With a document that has at least two L1 parents each with L2 children, open the scope screen and verify nesting, collapse defaults, and expand reveals children.

**Acceptance Scenarios**:

1. **Given** a hierarchy with L1 and L2 nodes, **When** the scope screen renders, **Then** L2 rows appear nested under their L1 parent (visual indent or equivalent grouping).
2. **Given** L1 parents with children, **When** the screen first opens, **Then** child rows under each parent are collapsed by default and an expand control reveals them.
3. **Given** an expanded parent, **When** the user collapses it, **Then** its children hide while the parent's checkbox and char count remain visible.

---

### User Story 2 - Parent select covers children (Priority: P1)

The learner checks a parent section to study that whole chapter. Children are treated as included; the confirm path produces scoped text that covers the parent range without duplicated overlapping slices.

**Why this priority**: Matches user expectation and avoids broken scoped markdown from parent+child overlap.

**Independent Test**: Check only an L1 parent; confirm; verify scoped material matches the parent span once; child checkboxes reflect inclusion without requiring individual checks.

**Acceptance Scenarios**:

1. **Given** a parent with children, **When** the user checks the parent, **Then** all listed descendants show as selected (checked) and the selection covers the parent's full range.
2. **Given** a fully checked parent, **When** the user unchecks the parent, **Then** all descendants become unchecked.
3. **Given** a parent is checked (full coverage), **When** the user confirms, **Then** persisted selection and scoped text do not concatenate overlapping parent and child spans.

---

### User Story 3 - Partial child selection shows mixed parent state (Priority: P2)

The learner expands a chapter and checks only some subsections. The parent shows a mixed/partial state (not fully checked, not empty). Confirming uses only the selected subsections' ranges.

**Why this priority**: Enables fine-grained scope without forcing all-or-nothing per chapter.

**Independent Test**: Check one of two L2 children under an L1; parent shows mixed; confirm stores only the selected child id(s) and scoped text matches those spans.

**Acceptance Scenarios**:

1. **Given** a parent with two or more selectable children, **When** only some children are checked, **Then** the parent control shows a mixed/partial state (not fully checked).
2. **Given** a mixed parent, **When** the user checks the remaining children (all selected), **Then** the parent becomes fully checked.
3. **Given** a mixed parent, **When** the user checks the parent itself, **Then** all descendants become fully selected.
4. **Given** only some children selected, **When** the user confirms, **Then** scoped material includes those child ranges and does not include sibling sections that were left unchecked.

---

### User Story 4 - Entire document and existing confirm path still work (Priority: P1)

"Entire document" remains the default path: no partial `scopeSelection`, full markdown used downstream. Confirm and char-count summary still work with hierarchical selection.

**Why this priority**: Must not regress the universal gate shipped in document-scope-selection.

**Independent Test**: Open gate on a new doc → entire document selected → confirm → `scopeSelection` null and full text used; alternatively select a subset → confirm → partial selection persisted.

**Acceptance Scenarios**:

1. **Given** the scope screen opens for a new document, **When** the user leaves "entire document" (or selects all), **Then** confirm persists full-document semantics (`scopeSelection` absent/null).
2. **Given** a partial hierarchical selection, **When** the user confirms, **Then** char count reflects the deduplicated scoped text and confirm is enabled only when the selection is non-empty.
3. **Given** entire-document mode, **When** the user unchecks one row, **Then** the picker leaves full-document mode and keeps the remaining sections selected.

---

### Edge Cases

- Document with only L1 nodes (no children): no expand controls; checkboxes behave as today (binary).
- Empty or missing hierarchy: existing empty/fallback behavior of the gate is preserved (user can still take entire document).
- Duplicate hierarchy titles / colliding ids: existing id scheme remains; selection remains by id.
- Selecting every listed node promotes to entire-document semantics (unchanged).
- Collapsing a parent does not change its selection state or children's selection membership.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Scope selection UI MUST present selectable hierarchy nodes with visible parent/child nesting (indent or equivalent), not a flat equal-weight list.
- **FR-002**: Parents that have selectable children MUST support expand and collapse; children MUST start collapsed when the screen opens.
- **FR-003**: Checking a parent MUST select that parent and all of its selectable descendants; unchecking a parent MUST clear those descendants.
- **FR-004**: When some but not all of a parent's selectable descendants are selected, the parent control MUST show a mixed/partial state distinct from checked and unchecked.
- **FR-005**: Checking all of a parent's selectable descendants MUST transition the parent from mixed to fully checked; checking the parent from mixed MUST select all descendants.
- **FR-006**: Confirmed partial scope MUST persist as `sectionIds` (string ids) with contiguous/charCount metadata unchanged in shape; entire document MUST continue to persist as null `scopeSelection`.
- **FR-007**: When building scoped study text, overlapping parent/child ranges MUST NOT be concatenated more than once (dedupe so parent coverage is not double-counted with selected children).
- **FR-008**: Canonical persisted ids for a fully selected parent SHOULD prefer the parent id alone (not also every child id), so reload restores a fully checked parent rather than an ambiguous all-children set that looks identical but differs in storage.
- **FR-009**: Char count summary and Confirm enablement MUST use the same deduplicated scoped text as persistence.
- **FR-010**: "Select entire document" and promote-when-all-selected behavior MUST remain available and default for new documents.
- **FR-011**: Selectable depth remains the existing picker depth (L1–L2); deeper levels are out of scope for this feature.
- **FR-012**: Screen remains a primary full-bleed gate screen; hierarchy is expressed inside the existing list, not as a nested card layout.

### Key Entities

- **Hierarchy node (selectable)**: Section with title, level, offsets, optional children; identified by stable section id.
- **Scope selection**: Persisted choice — null (entire document) or `{ sectionIds, contiguous, selectedAt, charCount }`.
- **Picker UI state**: Ephemeral expand/collapse set, selected ids, full-document flag, and derived mixed parent states (not persisted as expand state).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a document with ≥2 L1 parents and ≥1 L2 child each, a first-time user can identify parent/child relationships on the scope screen without reading raw offsets (nesting visible within 3 seconds of screen open).
- **SC-002**: Selecting only a parent and confirming yields scoped text length equal to that parent's span (± delimiter/trim), never approximately 2× from overlap.
- **SC-003**: Partial child selection shows a mixed parent state in 100% of cases with ≥2 children and a proper subset selected.
- **SC-004**: Entire-document confirm path still results in null scope selection and no regression of the post-T1.1 gate.
- **SC-005**: Expand/collapse and cascade selection remain usable on a phone-width viewport (list scrolls; primary Confirm/Entire actions remain reachable).

## Assumptions

- Restore hierarchical UX intent from the historical Slow `scope-picker-ux` contract (L1 expand/collapse, L2 under parent, parent range covers children) without bringing back edit-mode overrides or Slow-only routing.
- Mixed/partial parent state uses the platform's standard indeterminate checkbox affordance (or an equivalent clearly labeled mixed state if indeterminate is unavailable).
- Expand/collapse state is session-UI only and resets each time the scope screen is rendered.
- Existing `hierarchyNodeId` / `listSelectableHierarchyNodes` maxLevel=2 contract stays the source of selectable nodes; this feature changes presentation and selection semantics, not hierarchy construction.
- Deduplication merges overlapping selected ranges (or drops child ranges fully covered by a selected ancestor) before join/delimiter.
- Hands-off defaults applied for clarify: cascade on parent check/uncheck; store parent-only when fully selected; children-only when partial; no NEEDS CLARIFICATION blockers.
- DESIGN.md full-bleed primary screen rules apply; list items may use indent, not card chrome.
)
