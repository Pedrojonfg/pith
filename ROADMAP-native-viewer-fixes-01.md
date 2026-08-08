# ROADMAP — native-viewer-fixes-01

**Feature:** specs/20260809-native-viewer-fixes-01 | **Spec:** specs/20260809-native-viewer-fixes-01/spec.md | **Plan:** specs/20260809-native-viewer-fixes-01/plan.md
**Created:** 2026-08-08

## Dependency diagram

```text
T01 (pdfSource stash)
T02 (ai-context PDF)          } Wave 1 sequential (shared risk on slow/*)
T03 (migration persist)
        ↓
T04 (orphan consumers)
        ↓
T05 (drop notice UI)
        ↓
T06 (SW + parent suite QA)
```

Note: All tasks marked `sequential` because the working tree already carries uncommitted parent native-viewer edits on overlapping files (`study.js`, `reader.js`, `pdf-reader.js`); parallel subagents would thrash the same buffers.

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02, T03 | sequential |
| 2 | T04 | sequential |
| 3 | T05 | sequential |
| 4 | T06 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Upload-time `shared.pdfSource` on all PDF entry paths | — | sequential | [x] |
| T02 | `ai-context` branch on `viewerMode` / `maxReadPdfPage` | — | sequential | [x] |
| T03 | Persist `annotationSchemaVersion` + migrated anns in one save; idempotency test | — | sequential | [x] |
| T04 | Skip orphans in position-sensitive consumers only | T01–T03 optional | sequential | [x] |
| T05 | Wire one-time PDF drop notice UI | T03 | sequential | [x] |
| T06 | SW bump + re-run `20260808_t0X` + new tests | T01–T05 | sequential | [x] |

## Prompt per task

### T01 — pdfSource upload-time stash
**Spec ref:** US1, FR-001..003, SC-001 | **Plan ref:** Phase A, research R1 | **Files:** `src/js/study.js`, optionally small helper export in `src/js/slow/pdf-reader.js`, `cursor-tests/20260809_t01-pdf-source-entry-paths.mjs`
**Success criterion:** Create + recommend (+ any other live-File PDF path) stash `shared.pdfSource`; fixture proves Slow bootstrap gets source without legacy generate path; missing bytes still graceful.
**On close:** `/validate` and mark `[x]`.

### T02 — IA context viewerMode
**Spec ref:** US2, FR-004..005, SC-002 | **Plan ref:** Phase B, research R2 | **Files:** `src/js/slow/ai-context.js`, `src/js/slow/pdf-reader.js` (page text extract), `cursor-tests/20260809_t02-ia-context-pdf-page.mjs`
**Success criterion:** PDF + `maxReadPdfPage=N` → context excludes pages > N and is non-empty when pages have text; scroll unchanged.
**On close:** `/validate` and mark `[x]`.

### T03 — Migration persist + idempotency
**Spec ref:** US3, FR-006..007, SC-003 | **Plan ref:** Phase C, research R3 | **Files:** `src/js/session-store.js`, `src/js/slow/migrate-annotations.js` (if needed), `cursor-tests/20260809_t03-migration-persist-idempotent.mjs`
**Success criterion:** After load migration, version+annotations persisted same write; double-load identical.
**On close:** `/validate` and mark `[x]`.

### T04 — Orphan consumers
**Spec ref:** US5, FR-009..010, SC-005 | **Plan ref:** Phase D, contract orphan-annotation-consumers | **Files:** `src/js/slow/phase3.js`, `src/js/slow/reader.js` (navigate), `src/js/graph/proximity.js` and/or `adapters.js`, `cursor-tests/20260809_t05-orphan-consumers.mjs`
**Success criterion:** Module A / context slice / graph proximity / navigate skip orphans; flashcards still include orphan text.
**On close:** `/validate` and mark `[x]`.

### T05 — PDF drop notice
**Spec ref:** US4, FR-008, SC-004 | **Plan ref:** Phase E, research R4 | **Files:** `src/js/slow/reader.js` (or study init), `src/js/ui.js` if banner helper, `cursor-tests/20260809_t04-pdf-drop-notice.mjs`
**Success criterion:** Flag → one-time notice → persist shown → second open silent.
**On close:** `/validate` and mark `[x]`.

### T06 — QA closure
**Spec ref:** SC-006 | **Plan ref:** Phase F, quickstart.md | **Files:** `src/js/sw-update.js`, `index.html`, `sw.js`, ROADMAP marks
**Success criterion:** SW trio bumped; all new + `20260808_t0X` + SW validate green.
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-08-08 — none created (sequential parent-chat execution).

## Closeout

- All tasks `[x]`. SW `20260809_01` / `CACHE_NAME=pith-v173`.
- New tests: `cursor-tests/20260809_t01`…`t05` green; parent `20260808_t0X` + SW validate green.
- Wave 1 review: fixed CRITICAL pdf cache key collision + HIGH shared→slow pdfSource sync on stash/resume.


## Investigation footnotes (from draft R1.4 / R2.2 / R5)

- **R1.4:** Original PDF bytes NOT retained after extraction → upload-time stash required (not DPP-only).
- **R2.2:** Severity = broken empty IA context (not spoiler leak).
- **R5:** Position-sensitive consumers listed in `contracts/orphan-annotation-consumers.md`; text-only paths left alone.
