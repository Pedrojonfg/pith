# ROADMAP — scope-gated-generation

**Feature:** `specs/20260806-scope-gated-generation` | **Spec:** `specs/20260806-scope-gated-generation/spec.md` | **Plan:** `specs/20260806-scope-gated-generation/plan.md`  
**Created:** 2026-08-06  
**Source brief:** `20260806-scope-gated-generation.md`

## Dependency diagram

```text
T01 (stopAfterScopeGate)
  → T02 (disambiguate scopedMarkdown)
    → T03 (hard gate + fingerprint + migration)
      → T04 (buildScopedHierarchy)
        → T05 (wire mini-tree consumers)
        → T06 (flip hardcoded + T2.3 key)  [parallel with T05 if files disjoint; else after]
          → T07 (Cloze verify)
            → T08 (remove screenSlowScope/readingScope)
              → T09 (decideSlowReadingModifiers)
                → T10 (Slow nav index)
                → T11 (export label)  [parallel with T10]
                  → T12 (integration tests + SW bump + QA)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04 | sequential |
| 5 | T05 | sequential |
| 6 | T06 | sequential |
| 7 | T07 | sequential |
| 8 | T08 | sequential |
| 9 | T09 | sequential |
| 10 | T10, T11 | parallel |
| 11 | T12 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Forward `stopAfterScopeGate` in `startDocumentPreparation` | — | sequential | [x] |
| T02 | Disambiguate unresolved vs entire-document scoped text | T01 | sequential | [x] |
| T03 | Hard gate gated phases + fingerprint fix + legacy migration | T02 | sequential | [x] |
| T04 | `buildScopedHierarchy` module + unit tests | T03 | sequential | [x] |
| T05 | Wire mini-tree into inventory/phase0/assessment/sparsity | T04 | sequential | [x] |
| T06 | Flip Recall/assessment/anchoring/images + T2.3 scopeKey | T04 | sequential | [x] |
| T07 | Cloze T1.3 gate + shouldPreserveClozeSlice verification | T05,T06 | sequential | [x] |
| T08 | Remove screenSlowScope + readingScope + redirect legacy path | T07 | sequential | [x] |
| T09 | `decideSlowReadingModifiers` + remove toggles | T08 | sequential | [x] |
| T10 | Slow in-reader navigation index from mini-tree | T08 | parallel | [x] |
| T11 | Export scope label = section titles | T08 | parallel | [x] |
| T12 | Integration tests + SW bump + quickstart QA | T09,T10,T11 | sequential | [x] |

## Prompt per task

### T01 — Forward stopAfterScopeGate
**Spec ref:** FR-002, US1 | **Plan ref:** Summary Fix1 / research R2 | **Files:** `src/js/study.js`, `cursor-tests/20260806_t01-stop-after-scope-gate.mjs`  
**Success criterion:** `startDocumentPreparation` passes `stopAfterScopeGate` through to `runDocumentPreparationPipeline`; test proves option is forwarded.  
**On close:** `/validate` and mark `[x]`.

### T02 — Disambiguate scopedMarkdown
**Spec ref:** FR-003, FR-004 | **Plan ref:** research R3, contracts/scope-gate.md | **Files:** `src/js/session-types.js`, `src/js/session-store.js`, `src/js/mode-bootstrap.js`, `src/js/study.js` (confirm handlers if needed), `cursor-tests/20260806_t02-scoped-markdown-resolve.mjs`  
**Success criterion:** Unresolved → empty resolve; create/migration do not seed; full-doc confirm sets both `scopedMarkdown` and `scopeResolvedAt`; mode-bootstrap content path has no rawMarkdown fallback.  
**On close:** `/validate` and mark `[x]`.

### T03 — Hard gate + fingerprint + migration
**Spec ref:** FR-001, FR-012, FR-013 | **Plan ref:** research R4–R6, contracts/gated-phases.md | **Files:** `src/js/document-preparation.js`, `src/js/session-store.js`, `cursor-tests/20260806_t03-hard-gate-fingerprint.mjs`  
**Success criterion:** Gated phases excluded/blocked pre-resolve (incl. T1.3); `phaseSucceeded` not vacuous after fingerprint write; inventory migration no longer sets `scopeResolvedAt`; ensureTier1 early-return safe.  
**On close:** `/validate` and mark `[x]`.

### T04 — buildScopedHierarchy
**Spec ref:** FR-005 | **Plan ref:** research R7, contracts/scoped-hierarchy.md | **Files:** `src/js/normalization/scoped-hierarchy.js`, `cursor-tests/20260806_t04-scoped-hierarchy.mjs`  
**Success criterion:** Contiguous, non-contiguous, single-section cases produce correct offsets vs `buildScopedMarkdown` output (incl. delimiter).  
**On close:** `/validate` and mark `[x]`.

### T05 — Wire mini-tree consumers
**Spec ref:** FR-005 | **Plan ref:** plan touch list §6 table | **Files:** `src/js/api.js`, `src/js/document-preparation.js`, `src/js/slow/phase0.js`, `src/js/study.js`, `cursor-tests/20260806_t05-mini-tree-consumers.mjs`  
**Success criterion:** Inventory chunking, sparsity, Slow orientation boundaries, holistic assessment chunking use mini-tree × scoped text.  
**On close:** `/validate` and mark `[x]`.

### T06 — Flip hardcoded consumers + T2.3 key
**Spec ref:** FR-004, FR-014, FR-015 | **Plan ref:** research R8 | **Files:** `src/js/recall-study.js`, `src/js/recall-api.js` (or path as exists), `src/js/concept-anchoring.js`, `src/js/document-preparation.js`, `src/js/study.js`, `cursor-tests/20260806_t06-hardcoded-flip.mjs`  
**Success criterion:** Recall/assessment/T1.2b/T1.7 use scoped text/images; T2.3 scopeKey reflects resolved scope identity.  
**On close:** `/validate` and mark `[x]`.

### T07 — Cloze verification
**Spec ref:** FR-001 (T1.3), US2 | **Plan ref:** research R9 | **Files:** `src/js/cloze/pipeline.js`, `src/js/mode-bootstrap.js`, `cursor-tests/20260806_t07-cloze-scope.mjs`  
**Success criterion:** Documented confirmation that preserve-slice is session-local + gate-safe; T1.3 gated; minimal code change if already true.  
**On close:** `/validate` and mark `[x]`.

### T08 — Remove Slow scope screen / readingScope
**Spec ref:** FR-007, FR-008 | **Plan ref:** research R10, contracts/slow-removal.md | **Files:** `index.html`, `src/js/ui.js`, `src/js/study.js`, `src/js/slow/reader.js`, `src/js/slow/phase0.js`, `src/js/slow/checkpoints.js`, `src/js/slow/annotations.js`, `src/js/slow/ai-context.js`, `specs/20260528-slow-mode/data-model.md` (addendum note only), `cursor-tests/20260806_t08-slow-scope-removed.mjs`  
**Success criterion:** screenSlowScope unreachable; readingScope gone; legacy Slow path → universal scope; readers use scoped text / mini-tree.  
**On close:** `/validate` and mark `[x]`.

### T09 — decideSlowReadingModifiers
**Spec ref:** FR-010 | **Plan ref:** §10.3 | **Files:** new or existing slow helper module, `src/js/study.js`, `index.html`, `cursor-tests/20260806_t09-slow-modifiers.mjs`  
**Success criterion:** Pure function with named placeholder thresholds; toggles removed; applied at Slow create.  
**On close:** `/validate` and mark `[x]`.

### T10 — Slow nav index
**Spec ref:** FR-009 | **Plan ref:** §10.4 | **Files:** `src/js/slow/sidebar.js` and/or `reader.js`, `index.html`, `src/css/slow-mode.css`, `cursor-tests/20260806_t10-slow-nav.mjs`  
**Success criterion:** In-reader index lists mini-tree sections and jumps to offsets.  
**On close:** `/validate` and mark `[x]`.

### T11 — Export label
**Spec ref:** FR-011 | **Plan ref:** §10.5 | **Files:** `src/js/export.js`, `src/js/export-format.js`, `cursor-tests/20260806_t11-export-scope-label.mjs`  
**Success criterion:** Export shows joined section titles; no readingScope range.  
**On close:** `/validate` and mark `[x]`.

### T12 — QA closure
**Spec ref:** SC-001–SC-009 | **Plan ref:** quickstart.md | **Files:** `cursor-tests/20260806_scope-gated-generation.mjs`, `src/js/sw-update.js`, `sw.js`, `index.html`, `specs/20260806-scope-gated-generation/quickstart.md`, ROADMAP marks  
**Success criterion:** Integration suite green; SW versions aligned; checklist items covered by tests/notes.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-08-07 — none created (Task generalPurpose used; no `.cursor/agents/scope-gated-generation-*.md`).

