# Research: Study Projects

**Feature**: `20260623-study-projects` | **Date**: 2026-06-14

## R1 — Where to store `projectId` on DocumentSession

**Decision**: Root-level field on `DocumentSession` (sibling to `docId`), not inside `shared`.

**Rationale**: Organization metadata is orthogonal to pedagogical content (`shared`). Matches existing pattern for `docId`. Avoids polluting assessment/inventory consumers that iterate `shared`.

**Alternatives considered**:
- Inside `shared` — rejected; conflates user org with LLM-derived study data.
- Separate docId→projectId map — rejected; risks orphan mappings if sessions deleted inconsistently.

## R2 — Project persistence separate from sessions

**Decision**: Dedicated `ProjectStore` in its own localStorage key (`mylearning_projects`), schema version 1.

**Rationale**: Projects are global organizational entities; many sessions reference one project. CRUD on tree without rewriting all sessions.

**Alternatives considered**:
- Embed projects inside session store — rejected; duplication and merge conflicts on rename/move.

## R3 — GKV priority without exclusion

**Decision**: Score vault entries by minimum ancestor-chain depth (0 = same project, 1 = parent, …, Infinity = unrelated); sort ascending; group into three prompt bands; truncate general → related → never same-subject.

**Rationale**: Preserves A+ principle that all vault knowledge remains available; project only affects order and prompt labeling. Tree has single parent — no MRO needed.

**Alternatives considered**:
- Filter vault to same project only — rejected; loses cross-subject prerequisite awareness.
- Full MRO linearization — rejected; unnecessary for tree (no multiple inheritance).

## R4 — Review scope join model

**Decision**: Filter `smItems` by joining `item.docId → session.projectId` against scope project IDs (with optional descendants). No `projectId` on vault entries or smItems.

**Rationale**: Vault entries can span documents in multiple projects; join-at-query-time is correct. Reuses existing SM-2 item shape.

**Alternatives considered**:
- Denormalize project onto smItems — rejected; stale on document move unless full reindex.

## R5 — Delete vs cascade reassign

**Decision**: Block delete when project has child projects or assigned sessions; user must move content first.

**Rationale**: Personal scale; avoids surprise mass reassignment. Explicitly chosen in source spec.

**Alternatives considered**:
- Cascade to Misc — rejected for v1 (surprise UX).

## R6 — `misc` special project

**Decision**: Fixed id `misc`, created on boot, non-deletable, non-reparentable, renamable.

**Rationale**: Guarantees every document has a valid project; safe default for migration and uploads.

## R7 — UI v1 interaction model

**Decision**: Tree browser + flat indented selectors + action menus; no drag-and-drop.

**Rationale**: Matches v1 scope in source spec; sufficient for personal hierarchy depth (~2 levels).

## R8 — Optional P2 normalization expansion

**Decision**: Defer `getExistingEntriesForNormalization` ancestor expansion to post-v1 unless duplicates observed in QA.

**Rationale**: Topic matching already works per A+; low-cost follow-up task if needed.

## R9 — Mode select hub behavior

**Decision**: General mode select shows Continue / Library / Review; library drill-in to document keeps existing 5-mode hub with breadcrumb.

**Rationale**: Aligns with exposure/retrieval hub architecture without replacing per-document mode entry.

## R10 — Migration idempotency

**Decision**: `migrateProjects()` runs at boot: ensure ProjectStore + MISC; backfill `session.projectId = 'misc'` when missing; no schemaVersion bump on DocumentSession.

**Rationale**: Same pattern as `docTopics` backfill; safe to re-run.
