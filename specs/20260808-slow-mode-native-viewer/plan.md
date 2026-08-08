# Implementation Plan: Slow Mode Native Viewer

**Branch**: `20260808-slow-mode-native-viewer` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260808-slow-mode-native-viewer/spec.md`

## Summary

Replace Slow Mode’s viewport-measured markdown pagination with a dual native viewer: **pdf.js page viewer** for PDF uploads and **continuous scroll** for HTML/TXT/MD. Redesign annotation anchors to unit-local references (`pdf-rect` / `block-offset`) plus mandatory snippets; migrate scroll legacy annotations and drop PDF legacy ones; retire `shared.annotations` dual-write; update checkpoints, Phase 3 proximity, and graph adapter accordingly. Keep `pagination.js` for paced-reader only.

## Technical Context

**Language/Version**: JavaScript (ES modules), browser PWA  
**Primary Dependencies**: pdfjs-dist@4.4.168 via existing `pdf-loader.js`; existing Slow/session/graph modules  
**Storage**: Session persistence (localStorage / existing session-store); PDF source bytes per research R2b  
**Testing**: `cursor-tests/*.mjs` (Node)  
**Target Platform**: Modern desktop/mobile browsers (PWA)  
**Project Type**: Single-page learning app (`src/js`, `index.html`, `src/css`)  
**Performance Goals**: Interactive PDF page render; scroll sessions without pagination recompute jank  
**Constraints**: No LLM prompt changes; no paced-reader breakage; no scope-gate changes; SW versioning on asset changes; DESIGN.md for UI  
**Scale/Scope**: Slow Mode reader + annotations + checkpoints + Phase 3 position math + graph adapter; ~10–15 core files + tests

## Constitution Check

*GATE: Constitution template is placeholder — apply project `.cursorrules` instead.*

- [x] English for heuristics/prompts/UI internals  
- [x] PWA SW bump when touching `src/js/**`, `index.html`, `src/css/**`  
- [x] No localStorage/API key clears in update flows  
- [x] LLM JSON max_tokens rules — N/A (no new large JSON LLM calls)  
- [x] UI: full-bleed Slow reader preserved; no new chrome unless blocking  
- [x] Mnemonic devices — untouched  

Post-design: same gates hold. Complexity justified in table below (dual viewer unavoidable given FM-02).

## Project Structure

### Documentation (this feature)

```text
specs/20260808-slow-mode-native-viewer/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/viewer-annotations.md
├── checklists/requirements.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/slow/
├── annotations.js          # new shape, migration helpers, proximity
├── reader.js               # dispatch / scroll path refactor
├── pdf-reader.js           # NEW — canvas + text layer
├── scroll-reader.js        # NEW or extract from reader.js
├── checkpoints.js          # viewer-mode triggers
├── pagination.js           # UNCHANGED (paced-reader)
├── phase0.js               # fillable blank keys
├── phase3.js               # proximity / labels / context slice
├── migrate-annotations.js  # NEW — one-shot migration
src/js/graph/
├── adapters.js             # drop shared preference
├── proximity.js            # page/block distance
src/js/session-store.js     # remove addAnnotationToShared
src/js/study.js             # createSlowSession + notice + dispatch
src/js/session-types.js     # validate new fields
src/css/slow-mode.css       # pdf overlay / scroll overflow
index.html                  # SW ?v= bump if needed
cursor-tests/               # migration, pdf/scroll, updates
```

**Structure Decision**: Extend existing Slow Mode modules; add `pdf-reader.js` + migration module; avoid new top-level packages.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Two reader implementations | PDF fidelity requires original pages; scroll needs reflow | Single markdown viewer cannot recover FM-02 layout |
| New annotation schema + migration | Global offsets fragile (FM-03) | Keep offsets — silent corruption continues |

## Implementation phases (risk order)

1. **Data model + types + createSlowSession fields** (viewerMode, schema version, position fields)
2. **Migration module** (§9 / D-MIG a) + tests
3. **Scroll viewer** — continuous render, block ids, position restore; stop Slow pagination calls
4. **Scroll annotations** — create/render/repair/orphan + steel-man/IA read-head
5. **PDF viewer** — pdf.js canvas + text layer + nav + pdfSource
6. **PDF annotations** — rect capture/render/margin marks
7. **Checkpoints** both modes
8. **Phase 3 + Ask-AI context + fillable blank keys**
9. **Graph adapter** + delete shared dual-write
10. **Cleanup** dead pagination call sites in Slow path, CSS verify, SW bump, quickstart QA

## Artifacts

- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/viewer-annotations.md](./contracts/viewer-annotations.md)
- [quickstart.md](./quickstart.md)
