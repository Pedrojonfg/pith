# ROADMAP — pack-concept-graph-editor

**Feature:** `specs/20260716-pack-concept-graph-editor` | **Spec:** `specs/20260716-pack-concept-graph-editor/spec.md` | **Plan:** `specs/20260716-pack-concept-graph-editor/plan.md`
**Created:** 2026-07-16

## Dependency diagram

```text
T01 (mutators) ──┐
                 ├──► T03 (read-only screen) ──► T04 (edit UI) ──┐
T02 (persist) ───┘                                              ├──► T05 (library+publish) ──► T06 (SW+QA)
                                                                │
T02 ────────────────────────────────────────────────────────────┘
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02 | parallel |
| 2 | T03 | sequential |
| 3 | T04 | sequential |
| 4 | T05 | sequential |
| 5 | T06 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Pure snapshot mutators + unit tests | — | parallel | [x] |
| T02 | `updatePackDraftSnapshot` + tests | — | parallel | [x] |
| T03 | `screenPackConceptEditor` read-only mount | T01 | sequential | [x] |
| T04 | Edit interactions (rename/add/delete/edges) + debounce save | T03,T02 | sequential | [x] |
| T05 | Library Create pack + Publish → finalizePack | T04 | sequential | [x] |
| T06 | SW bump + integration tests + quickstart QA | T05 | sequential | [x] |

## Prompt per task

### T01 — Pure mutators
**Spec ref:** FR-002–007, SC-001–003 | **Plan ref:** Implementation sequence §1 | **Files:** `src/js/pack-concept-editor.js`, `cursor-tests/20260716_pack-concept-graph-editor.mjs`
**Success criterion:** rename/add/delete/edge helpers pass; delete leaves no dangling edges; clone baseline proves DocumentSession untouched when only snapshot mutated.
**On close:** `/validate` and mark `[x]`.

### T02 — Draft snapshot persist
**Spec ref:** FR-008 | **Plan ref:** research persist decision | **Files:** `src/js/pack-export.js`, `cursor-tests/20260716_pack-export-backend.mjs` (extend) or shared section in editor test
**Success criterion:** `updatePackDraftSnapshot` updates snapshot on draft; rejects non-draft.
**On close:** `/validate` and mark `[x]`.

### T03 — Read-only editor screen
**Spec ref:** US1, FR-001, FR-011 | **Plan ref:** sequence §3 | **Files:** `index.html`, `src/js/ui.js`, `src/js/study.js`, `src/css/main.css`, `src/js/pack-concept-editor.js` (`toCanvasGraph`)
**Success criterion:** `showScreen('packConceptEditor')` mounts draft graph via existing canvas; Slow graph unchanged.
**On close:** `/validate` and mark `[x]`.

### T04 — Edit mode UI
**Spec ref:** US2–5, FR-003–007 | **Plan ref:** sequence §4 | **Files:** `src/js/study.js`, `src/js/graph/view.js`, `src/js/graph/canvas.js`, `index.html`, `src/css/main.css`, `src/js/pack-concept-editor.js`
**Success criterion:** all five edit actions work; debounce calls `updatePackDraftSnapshot`; dangling-content limitation commented at delete.
**On close:** `/validate` and mark `[x]`.

### T05 — Entry + publish
**Spec ref:** US6, FR-009 | **Plan ref:** sequence §5 | **Files:** `src/js/project-library.js`, `src/js/study.js`, `index.html`
**Success criterion:** Create pack → editor; include-source toggle + Publish → `finalizePack`; failure keeps editor.
**On close:** `/validate` and mark `[x]`.

### T06 — SW + QA closure
**Spec ref:** SC-001–005 | **Plan ref:** sequence §6, quickstart | **Files:** `src/js/sw-update.js`, `index.html`, `sw.js`, `cursor-tests/20260716_pack-concept-graph-editor.mjs`, `ROADMAP-pack-concept-graph-editor.md`
**Success criterion:** SW versions aligned; full test file green; quickstart checklist marked in roadmap notes.
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-07-16 (none created — sequential execution in parent chat)

## Wave notes

- Wave 1–5 complete. Validate: `20260716_pack-concept-graph-editor.mjs` 52 passed; pack-export backend 63; SW flow 36.
- HIGH fix: `persistPackConceptSnapshot` rethrows so Publish `flush()` cannot finalize a stale draft after save failure.
- SW_VERSION `20260716_05`, CACHE_NAME `pith-v148`.
- Restored accidentally emptied `src/css/main.css` from HEAD before appending editor styles.
