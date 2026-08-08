# Implementation Plan: Native Viewer Post-Ship Fixes 01

**Branch**: `20260809-native-viewer-fixes-01` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260809-native-viewer-fixes-01/spec.md`

## Summary

Close five post-ship gaps in the Slow Mode native viewer: (1) stash `shared.pdfSource` at every PDF upload path so Slow’s PDF reader works outside the legacy generate path; (2) branch IA context on `viewerMode` using `maxReadPdfPage` for PDF (fixes empty Ask AI context); (3) persist `annotationSchemaVersion` with migrated annotations in one save; (4) show one-time PDF drop notice; (5) skip orphans only in position-sensitive consumers.

## Technical Context

**Language/Version**: JavaScript (ES modules) in browser PWA  
**Primary Dependencies**: Existing pdf.js loader (`slow/pdf-reader.js`), session-store, document upload/normalization pipeline  
**Storage**: Session JSON via `saveDocumentSession` / `storeActiveSession` (inline base64 `shared.pdfSource` — same as legacy; no new IndexedDB)  
**Testing**: Node `cursor-tests/*.mjs` (assert patterns used by `20260808_t0X`)  
**Target Platform**: Browser PWA (Chrome/Edge/Firefox)  
**Project Type**: Single-page web application (`src/js`, `index.html`, `src/css`)  
**Performance Goals**: No new LLM calls; IA context extraction for PDF pages must stay within existing ask latency envelope  
**Constraints**: Surgical patches only; bump `SW_VERSION` + `index.html` `?v=` + `CACHE_NAME` when shipping JS/HTML/CSS; English UI; ponytail — reuse `encodePdfSourceBase64` / existing banners  
**Scale/Scope**: ~8–12 files touched; 5 regression tests + re-run parent `20260808_t0X` suite

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Constitution file is a placeholder template — project rules from `.cursorrules` / DESIGN apply instead.
- **Simplicity**: Reuse legacy base64 stash shape; no new storage subsystem. PASS.
- **Test-first**: New behaviour gets failing cursor-tests first. PASS.
- **PWA versioning**: Any `src/js/**` / `index.html` / `src/css/**` change bumps SW trio. PASS (scheduled in QA task).
- **No speculative abstractions**: Shared helper for “stash pdf from File if PDF” only if ≥2 call sites need identical logic. PASS.

Post-design re-check: unchanged — PASS.

## Project Structure

### Documentation (this feature)

```text
specs/20260809-native-viewer-fixes-01/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── pdf-source-availability.md
│   ├── ia-context-viewer-mode.md
│   └── orphan-annotation-consumers.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/js/
├── study.js                    # upload-time pdfSource stash on create/recommend/other PDF paths
├── mode-bootstrap.js           # already copies shared.pdfSource → Slow (verify)
├── session-store.js            # persist migration in same save after normalizeLoadedSession
├── slow/
│   ├── pdf-reader.js           # encode/decode helpers; page text extract for IA
│   ├── ai-context.js           # viewerMode branch
│   ├── migrate-annotations.js  # idempotency; notice flag (existing)
│   ├── reader.js               # drop notice UI; navigate orphan guard
│   ├── phase3.js               # Module A / context slice orphan skips
│   └── annotations.js          # only if navigate helper lives here
├── graph/
│   ├── adapters.js / proximity.js  # skip orphans for position linking
└── ui.js                       # banner helper reuse if needed

cursor-tests/
├── 20260809_t01-pdf-source-entry-paths.mjs
├── 20260809_t02-ia-context-pdf-page.mjs
├── 20260809_t03-migration-persist-idempotent.mjs
├── 20260809_t04-pdf-drop-notice.mjs
└── 20260809_t05-orphan-consumers.mjs
```

**Structure Decision**: Patch existing Slow / study / session-store modules; no new top-level package.

## Complexity Tracking

> No constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Implementation Phases (for roadmap)

| Phase | Focus |
|-------|--------|
| A | Upload-time `shared.pdfSource` on all PDF entry paths + regression |
| B | `ai-context.js` PDF page-bounded context + regression |
| C | Migration persist same-write + idempotency test |
| D | Orphan consumer patches (position-sensitive only) + test |
| E | Drop notice UI + test |
| F | SW bump, re-run `20260808_t0X`, quickstart QA |
