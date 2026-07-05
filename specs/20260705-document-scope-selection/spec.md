# Feature Specification: Universal Document Scope Selection

**Feature**: `specs/20260705-document-scope-selection`  
**Created**: 2026-07-05  
**Status**: Approved for implementation  
**Supersedes**: Slow-mode-exclusive scope picker (`screenSlowScope`)

## Problem

Chapter/section scope selection exists only inside Slow mode. Every other mode forces full-document processing. DPP T1.2–T2.3 run against the full document before the user can restrict scope in Slow mode.

## Goal

Move scope selection to a universal, mode-agnostic step after T1.1 (document structure) and before T1.2 (concept inventory). T1.2 onward operate on `scopedMarkdown`.

## Non-goals

- NG1: No retroactive re-scoping after Tier 1 has run.
- NG2: No mid-session scope editing.
- NG3: No cross-chapter concept resolution for out-of-scope references.
- NG4: No change to Review cross-document SM-2 mechanics.
- NG5: Out-of-scope disclosure only for guide-chat and Socratic tutor contracts.

## Requirements

### Data model (R1–R4)

- **FR-001**: `docHierarchy` MUST be computed against full `rawMarkdown` (T1.1).
- **FR-002**: `scopedMarkdown` MUST concatenate selected hierarchy node spans in document order with delimiter `\n\n---\n\n`.
- **FR-003**: DPP phases T1.2–T2.3 MUST read `scopedMarkdown`, not `rawMarkdown`.
- **FR-004**: schemaVersion v4 with migration: absent `scopeSelection` → `null`, `scopedMarkdown` → resolved `rawMarkdown`.

### Pipeline (R5–R7)

- **FR-005**: Scope gate runs after T1.1; user confirms before T1.2.
- **FR-006**: `scopeContext` generated via one LLM call when partial scope selected; skipped for full document.
- **FR-007**: `generateScopeContext` max_tokens capped low (≤150 output tokens).

### UI (R8–R11)

- **FR-008**: `screenScopeSelection` shown for every mode after structure is ready.
- **FR-009**: Multi-select non-contiguous `docHierarchy` nodes supported.
- **FR-010**: "Select entire document" default sets `scopeSelection = null`, no `scopeContext` LLM call.
- **FR-011**: `screenSlowScope` removed; Slow-only toggles relocated to `screenSlowPhase0`.

### Chat (R12–R15)

- **FR-012**: Guide-chat and Socratic tutor receive scoped + full markdown when partial scope.
- **FR-013**: Model MUST flag out-of-scope answers with prefix `[OUT_OF_SCOPE]`.
- **FR-014**: Generative DPP contracts remain scoped-only.
- **FR-015**: R12/R13 no-op when `scopeSelection === null`.

## Assumptions

- Scope gate orchestration follows assessment-gate pattern in `study.js` (outside DPP runners).
- `scopedMarkdown` persisted inline or via same Supabase externalization as `rawMarkdown`.
- Legacy sessions with existing inventory auto-resolve scope gate on migration.
- Hierarchy node IDs use `slugify(title) || hier-{startOffset}` matching existing picker.

## Success Criteria

- v3 sessions load without re-computation; scope defaults preserve prior behavior.
- Full-document path produces zero extra LLM calls and identical DPP output.
- Partial scope reduces inventory input to selected sections only.
- Chat contracts disclose out-of-scope content when required.
