# Feature Specification: Scope-Gated Generation

**Feature Branch**: `20260725-scope-gated-generation`

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: `20260806-scope-gated-generation.md` — block all Tier-1+/Tier-2 study-content generation until scope is resolved; run generation exclusively over scoped text; remove Slow-only scope screen/`readingScope`; add Slow in-reader navigation over resolved scope.

**Supersedes (partially)**: `specs/20260705-document-scope-selection` (FR-011 / Slow scope removal incomplete). Where behavior conflicts, this spec wins. Does not rewrite that spec.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Early scope question after upload (Priority: P1)

A learner uploads a multi-section document to start a new study session. Within seconds of structure being ready, they are asked which sections to study — before expensive generation runs. After they confirm (partial sections or entire document), generation proceeds only on that choice.

**Why this priority**: Without the early gate, users wait through full-document generation and then cannot restrict what was already produced. This is the core product contract.

**Independent Test**: Upload a multi-section document on the create-session path; confirm the scope screen appears before concept inventory / mode-content generation; confirm no Tier-1.2+ study-content generation artifacts appear until after confirm.

**Acceptance Scenarios**:

1. **Given** a new upload on the create-session path, **When** document structure (hierarchy) becomes ready, **Then** the universal scope selection step is shown before concept inventory and later generation phases run.
2. **Given** the user has not yet confirmed scope, **When** any study-content generation phase would otherwise run, **Then** that phase does not execute.
3. **Given** the user confirms "entire document", **When** generation proceeds, **Then** scoped study text equals the full document and is explicitly marked as a resolved choice (not an unresolved default).

---

### User Story 2 - Generation uses only chosen sections (Priority: P1)

After scope is confirmed, all study-content generation (inventory, anchoring, Cloze, Recall, Slow orientation, shared assessment, and related phases) operates exclusively on the chosen sections' text. Non-contiguous section choices still produce coherent, non-empty study materials.

**Why this priority**: Scope that is asked but not honored wastes the user's decision and produces wrong materials.

**Independent Test**: Choose two non-contiguous sections; run generation for Cloze, Recall, and Slow orientation; verify items/questions/orientation content only reflect those sections.

**Acceptance Scenarios**:

1. **Given** a resolved partial scope, **When** study-content generation runs, **Then** every gated phase consumes only the scoped study text (never silent full-document fallback).
2. **Given** non-contiguous chosen sections, **When** generation uses section structure for chunking or boundaries, **Then** it uses a scope-relative hierarchy whose offsets match the concatenated scoped text.
3. **Given** resolved scope, **When** image/vision analysis runs as part of gated preparation, **Then** only images whose tokens fall within the scoped text are analyzed.

---

### User Story 3 - Guide keeps full-document context (Priority: P2)

While studying a partial scope, the learner can still ask the guide / Socratic chatbot questions that need background from outside the chosen sections. The guide retains full-document context; generative study content does not.

**Why this priority**: Existing dual-context product promise; must not regress while fixing scoped generation.

**Independent Test**: Resolve a partial scope; ask the guide about content outside the chosen sections; confirm the guide still has access to full-document context (out-of-scope disclosure behavior preserved as today).

**Acceptance Scenarios**:

1. **Given** a resolved partial scope, **When** the learner uses the guide/Socratic chatbot, **Then** the chatbot still receives full-document background context in addition to scoped study context.
2. **Given** the same session, **When** Cloze/Recall/Slow/assessment generation runs, **Then** those paths do not fall back to full-document text.

---

### User Story 4 - One Slow path, in-reader navigation (Priority: P2)

Slow mode no longer has a separate scope screen or a second "reading scope" concept. Slow uses the same universal scope decision as every other mode. Inside the Slow reader, the learner can jump between sections that are already inside the resolved scope via a navigation index.

**Why this priority**: Removes duplicate UX and dead/legacy paths; keeps useful navigation without a second scope model.

**Independent Test**: Enter Slow after universal scope confirm; confirm no Slow-only scope screen is reachable; confirm reader shows a working section jump index over the resolved scope only.

**Acceptance Scenarios**:

1. **Given** any UI path that previously opened the Slow-only scope screen (including legacy create-form Slow entry), **When** the user proceeds toward Slow, **Then** they use the universal scope selection flow instead; the Slow-only scope screen is unreachable.
2. **Given** a Slow session with resolved multi-section scope, **When** the learner opens the reader navigation index, **Then** they can jump to any chosen section within scoped text.
3. **Given** a Slow session, **When** fillable-map / checkpoints / critical-mode behavior is decided, **Then** the system decides from document metrics/pedagogy signals — no user toggles for those modifiers remain.

---

### User Story 5 - Immutable scope for the session (Priority: P3)

Once the learner confirms scope for a study session, that choice does not change for the lifetime of that session. There is no re-scope or mid-session invalidation flow.

**Why this priority**: Simplifies correctness (no scope-keyed cache invalidation) and matches prior product non-goals.

**Independent Test**: After confirm, verify no UI or API path changes `scopeResolvedAt` / chosen sections for that session; generation remains stable.

**Acceptance Scenarios**:

1. **Given** `scope` has been resolved for a session, **When** the learner continues studying in any mode, **Then** scope identity remains unchanged for that session.
2. **Given** a legacy session without a real user scope choice, **When** it is loaded, **Then** the user is re-prompted for scope rather than silently treated as already resolved.

---

### Edge Cases

- User chooses entire document: must be an explicit resolved state, distinguishable from "not yet asked."
- User chooses a single section: mini-hierarchy and generation still work.
- User chooses non-contiguous sections across unrelated branches: hierarchy for generation is reconstructed coherently (subset subtree preserved where possible; otherwise siblings).
- Legacy sessions with inventory but no real scope choice: re-prompt, do not grandfather.
- Export of a scoped session: still produces a readable scope label (section titles), without requiring a full export redesign.
- Multi-file source picker and manual heading edit / auto-split on the old Slow scope screen are removed without replacement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST present universal scope selection after document structure is ready and MUST NOT run study-content generation phases (inventory and later gated phases through shared/holistic assessment, including concept-graph construction used by Cloze) until scope is resolved for that session.
- **FR-002**: System MUST forward the existing early-stop-after-scope-structure option on the create-session preparation path so the scope question appears before full preparation continues.
- **FR-003**: System MUST treat unresolved scope and "user chose entire document" as distinct states; scoped study text MUST NOT be seeded as full-document text before a real scope decision.
- **FR-004**: After scope resolution, every gated study-content generation phase MUST consume scoped study text exclusively (no silent fallback to full-document text), except the guide/Socratic chatbot which MUST retain full-document background context.
- **FR-005**: When chosen sections are non-contiguous (or otherwise not the full document), system MUST provide a scope-relative hierarchy whose offsets are relative to concatenated scoped text, and MUST use that hierarchy for chunking/boundary consumers.
- **FR-006**: Scope resolution MUST be immutable for the lifetime of that study session (no re-scope flow in this feature).
- **FR-007**: System MUST remove the Slow-only scope screen and the Slow `readingScope` field/concept; Slow MUST consume the same resolved scoped text as other modes.
- **FR-008**: Legacy create/entry paths that previously routed Slow to the Slow-only scope screen MUST redirect into the universal scope selection flow.
- **FR-009**: Slow reader MUST offer an in-reader navigation index over the resolved-scope hierarchy (jump to section within scoped text), not a second scope-selection step.
- **FR-010**: System MUST decide Slow reading modifiers (fillable map, checkpoints, critical mode) automatically from existing text/pedagogy signals; user-facing toggles for those modifiers MUST be removed from create/Slow scope/Phase 0 UI.
- **FR-011**: Export MUST continue to show a readable scope label based on chosen section titles (character-range label from `readingScope` removed); full export redesign is out of scope.
- **FR-012**: Legacy migration MUST NOT mark sessions as scope-resolved solely because inventory artifacts exist; unresolved legacy sessions MUST be re-prompted.
- **FR-013**: Preparation early-return paths that skip work based on existing artifacts MUST NOT skip gated phases for sessions that never resolved scope.
- **FR-014**: Vision/image analysis in gated preparation MUST only process images whose tokens fall within scoped study text.
- **FR-015**: Slow orientation and related Slow preparation MUST key off the resolved scope identity (not a hardcoded "full document" key) once scope is resolved.

### Key Entities

- **Document session**: Study session for one document upload; owns raw text, hierarchy, scope decision, scoped text, and preparation artifacts.
- **Scope selection**: One-time user choice of hierarchy sections (or entire document); becomes immutable once resolved.
- **Scoped study text**: Concatenation of chosen section spans used by all gated generation after resolution.
- **Scope-relative hierarchy (mini-tree)**: Hierarchy containing only chosen section nodes with offsets recomputed against scoped study text.
- **Gated generation phases**: Study-content preparation phases that must wait for scope resolution and must consume scoped text / mini-tree.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On create-session upload of a multi-section document, the scope question appears after structure readiness and before concept-inventory generation (user is not forced to wait for full Tier-1+/Tier-2 generation first).
- **SC-002**: 100% of gated study-content generation phases refuse to run (or are excluded) until scope is resolved, on both create-session and hub-bootstrap entry paths.
- **SC-003**: For a document with non-contiguous chosen sections, Cloze, Recall, and Slow orientation each produce non-empty, scope-appropriate output in a manual spot-check.
- **SC-004**: Guide/Socratic chatbot still answers with full-document background after partial scope (dual-context behavior preserved).
- **SC-005**: Choosing "entire document" completes end-to-end generation successfully and is distinguishable from an unresolved session.
- **SC-006**: The Slow-only scope screen is unreachable from every UI path, including the former Slow create-form path.
- **SC-007**: Slow reader navigation index jumps correctly to each resolved-scope section.
- **SC-008**: No user-facing toggles remain for fillable map / checkpoints / critical mode; automatic decisions are applied at Slow session creation.
- **SC-009**: Exported materials include a readable scope label listing chosen section titles.

## Assumptions

- Existing universal `screenScopeSelection` / scope-gate orchestration remains the user-facing scope step; this feature fixes timing, gating, consumers, and Slow cleanup rather than redesigning that screen.
- Minimum scope unit remains a whole hierarchy section (no arbitrary character-range sub-scoping).
- Concatenation order of scoped text matches chosen section ID order (or will be fixed if not); mini-tree reconstruction depends on that invariant.
- Guide dual-context (`resolveChatScopeFields` or equivalent) is the sole intentional full-document exception and must not be narrowed.
- Pre-launch / friend-test legacy data may be discarded or re-prompted; silent grandfathering of "resolved" from inventory presence is unacceptable.
- Multi-file picker, manual heading edit, and auto-split on the old Slow scope screen are accepted capability losses (non-goals).
- `T1.5` mode-recommendation ordering relative to inventory is intentional and out of scope.
- Export redesign beyond a title-list label is a follow-up.
- Automatic Slow modifier thresholds are unvalidated placeholders to calibrate post-launch (project convention).
- Source brief: `20260806-scope-gated-generation.md` (implementation detail deferred to plan).

## Out of Scope

- Multi-file source picker replacement
- Manual heading edit / auto-split
- Arbitrary sub-section character-range scoping
- Export format redesign beyond scope label
- Cross-scope caching / scope-change / invalidation flows
- Changing `PHASE_DEPS` for mode recommendation (`T1.5`)
- `#recommendationPanel` on mode select (tracked separately)
