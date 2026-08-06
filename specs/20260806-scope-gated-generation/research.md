# Research: Scope-Gated Generation

**Feature**: `specs/20260806-scope-gated-generation`  
**Date**: 2026-08-06

## R1 — Field names and gate helpers

**Decision**: Use existing `session-types.js` helpers as-is: `isScopeGateResolved` (`shared.scopeResolvedAt` finite > 0), `isScopeStructureReady` (`docHierarchy.tree` non-empty), `resolveScopedMarkdown`, `resolveChatScopeFields`. Do not rename.

**Rationale**: Already wired across `study.js` / `document-preparation.js`; audits match code.

**Alternatives**: New helper names — rejected (churn, no benefit).

## R2 — Timing bug (`stopAfterScopeGate`)

**Decision**: Forward `options.stopAfterScopeGate` from `startDocumentPreparation` → `runDocumentPreparationPipeline` (same pattern as `ensureScopeStructurePreparation`).

**Rationale**: Confirmed bug — `study.js` ~L564–574 omits the option while `processCreateSessionStagedUpload` passes `stopAfterScopeGate: true`.

**Alternatives**: New option name — rejected; reuse existing.

## R3 — Unresolved vs entire-document

**Decision**:
- Stop seeding `scopedMarkdown = rawMarkdown` at create/migration.
- `resolveScopedMarkdown` returns `""` unless `isScopeGateResolved`; when resolved, return `scopedMarkdown` (or `rawMarkdown` only if explicitly set at resolve time for full-doc).
- On full-document confirm: set `scopedMarkdown = rawMarkdown` AND `scopeResolvedAt`.
- Remove mode-bootstrap fallback `resolveScopedMarkdown(doc) || doc.shared?.rawMarkdown` for content bootstrap (chat keeps `resolveChatScopeFields`).

**Rationale**: Today non-empty seeded `scopedMarkdown` makes unresolved indistinguishable from full-doc.

## R4 — Hard gate mechanism

**Decision**: Prefer phase-list exclusion (option a): extend stop/resume so post-scope phases are not in the runnable set until `isScopeGateResolved`. Keep `SCOPE_PRE_PHASE_IDS = ["T0.1","T0.2","T1.1"]`. After resolve, resume with normal tier options. Add `isScopeGateResolved` to `ensureTier1Preparation` early-return (already blocks when structure ready + unresolved; also require resolved before `isTier1PreparationComplete` skip). Include **T1.3** in gated set (deps for Cloze T2.1; currently deferred but must not run pre-scope).

**Rationale**: Matches existing `stopAfterScopeGate` truncation; cleaner than per-runner no-ops.

**Alternatives**: Per-phase no-op in `executePhase` — rejected as secondary; may add defensive check in `executePhase` for gated IDs as belt-and-suspenders.

## R5 — Fingerprint overwrite bug

**Decision**: Do not overwrite `prep.fingerprint` before `phaseSucceeded` comparisons. Compare prior phase rows against the fingerprint stored when those phases completed (e.g. keep `priorFingerprint = prep.fingerprint` before assign, or store per-phase fingerprint / only update prep.fingerprint after success accounting). Minimal fix: capture `const priorFp = prep.fingerprint` before overwrite; `phaseSucceeded` compares `row` against the fingerprint that was current for that row — simplest approach: compare `prep.phaseResults[id]` using `priorFp` for skip decisions, then set `prep.fingerprint = fingerprint` for the new run.

**Rationale**: Confirmed — L1017 overwrites then L1082 `phaseSucceeded(prep, id, fingerprint)` is vacuously true when fingerprints match the just-written value (always).

## R6 — Legacy `scopeResolvedAt` from inventory

**Decision**: Remove migration shortcut at `session-store.js` ~L355–357. Missing `scopeResolvedAt` → `null` always (re-prompt).

**Rationale**: Spec R5 + Audit B pre-launch data discard; grandfathering violates FR-012.

## R7 — Mini-tree + concatenation order

**Decision**:
- New module `src/js/normalization/scoped-hierarchy.js` exporting `buildScopedHierarchy(fullHierarchy, chosenSectionIds, scopedMarkdown)`.
- Layout nodes in **document order** (same sort as `buildScopedMarkdown`: by original `startOffset`), not raw picker `sectionIds` order. Account for `SCOPE_SECTION_DELIMITER` between parts when recomputing offsets.
- Optionally normalize `scopeSelection.sectionIds` to document order on confirm (nice-to-have; mini-tree must not depend on picker order).
- Preserve parent/child among selected subset when possible; else flatten selected nodes as siblings under a synthetic root. Copy `pedagogical_meta` from full hierarchy (document-level) as-is; node-level pedagogy fields copy if present.

**Rationale**: `buildScopedMarkdown` already sorts by `startOffset` before join — invariant is document-order concat, not `sectionIds` array order. `pedagogical_meta` lives at hierarchy doc level in T1.1 output, not per-node position.

**Alternatives**: Reorder concat to match picker order — rejected (would change existing scoped text semantics).

## R8 — Hardcoded consumers

**Decision**: Flip Recall (`recall-study.js`, `recall-api.js`), shared assessment (`study.js`), T1.2b (`concept-anchoring.js`), T1.7 images via existing `countScopedImages` / filter pattern in `onboarding-recommender.js`, T2.3 `scopeKey` to ordered section IDs (or `"full_document"` only when `scopeSelection == null` after resolve).

## R9 — Cloze preserve slice

**Decision**: No change to `shouldPreserveClozeSlice` beyond gate: slices are per-`DocumentSession` / `docId`; with immutable scope (R5) and T1.3 gated, reuse is safe. Verify in tests; document in code comment.

## R10 — Slow removal + modifiers + nav

**Decision**: Delete `#screenSlowScope` + ui registry; redirect legacy Slow create path to universal scope gate; remove `readingScope` read/write sites; implement `decideSlowReadingModifiers` pure function with named placeholder thresholds; add reader nav index from mini-tree in existing Slow sidebar/reader chrome; export label = joined section titles.

**Rationale**: Matches Audit B + spec §10; navigation is not a second scope.

## R11 — T1.5 / PHASE_DEPS

**Decision**: Do not touch `PHASE_DEPS` for T1.5 (explicit non-goal).

## R12 — SW versioning

**Decision**: Final QA task bumps `SW_VERSION`, `index.html ?v=`, `CACHE_NAME` together per `.cursorrules`.
