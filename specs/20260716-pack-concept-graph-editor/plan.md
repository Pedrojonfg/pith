# Implementation Plan: Pack Concept Graph Editor

**Branch**: `20260716-pack-concept-graph-editor` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260716-pack-concept-graph-editor/spec.md`

## Summary

UI + pure mutators so a pack owner can edit `snapshot.conceptGraph` and `snapshot.conceptInventory` on a `shared_packs` draft, then publish via existing `finalizePack`. Reuses `graph/canvas.js` / `mountMaterialGraphScreen` with an edit-mode option; never mutates the source DocumentSession. Adds `updatePackDraftSnapshot` so edits persist before finalize (finalize reads snapshot from DB).

## Technical Context

**Language/Version**: JavaScript ES modules (browser PWA)  
**Primary Dependencies**: `pack-export.js`, `graph/view.js`, `graph/canvas.js`, `graph/build.js` (`EDGE_TYPES`), `graph/ids.js` (`conceptNodeId`, `graphTermSlug`), `project-library.js`, `ui.js`, `study.js`, `supabase-client.js`  
**Storage**: Supabase `shared_packs.snapshot` (draft rows only); no schema change  
**Testing**: `cursor-tests/20260716_pack-concept-graph-editor.mjs`  
**Target Platform**: Existing Pith PWA  
**Project Type**: Web PWA (UI + data mutators)  
**Performance Goals**: Debounced draft snapshot writes (~400–800ms); graph remount after each local mutation  
**Constraints**: Edit mode only on pack editor screen; Slow/vault graphs stay read-only; no cascade to mode content; English UI; SW bump on JS/HTML/CSS  
**Scale/Scope**: One new full-bleed screen; library row action; five graph mutations + publish

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Library-first / minimal surface: pure editor module + thin UI wiring — **pass**
- Test-first: cursor-tests before `[x]` — **pass**
- Simplicity / YAGNI: no undo, no soft-hide, no new retry wrapper — **pass**
- DESIGN.md: full-bleed screen, no card-wrapping primary surface — **pass**
- English app/LLM strings — **pass** (no new LLM calls)

Post-design re-check: **pass**.

## Project Structure

### Documentation (this feature)

```text
specs/20260716-pack-concept-graph-editor/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/pack-concept-editor.md
└── checklists/requirements.md
```

### Source Code

```text
src/js/pack-concept-editor.js          # pure snapshot mutators + id helpers + debounce save helper
src/js/pack-export.js                  # add updatePackDraftSnapshot
src/js/graph/view.js                   # optional editMode / callbacks pass-through (minimal)
src/js/graph/canvas.js                 # optional onEdgeClick if missing (minimal)
src/js/project-library.js              # Create pack button on doc row
src/js/study.js                        # enter editor, wire publish / mutations
src/js/ui.js                           # screen refs
index.html                             # screenPackConceptEditor markup
src/css/main.css                       # editor chrome (toolbar, modals) — DESIGN tokens
src/js/sw-update.js / index.html / sw.js
cursor-tests/20260716_pack-concept-graph-editor.mjs
```

**Structure Decision**: Pure mutators in `pack-concept-editor.js` (testable without DOM); orchestration in `study.js` / library; reuse existing graph canvas rather than a second renderer.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Slight dual-field title/label sync | Inventory uses both `title` and `label` in the wild | Updating only `title` would leave graph adapters reading `label` stale |

## Implementation sequence

1. Pure mutators + tests (rename / delete+edge cleanup / add node / add+remove edge; session isolation fixture)  
2. `updatePackDraftSnapshot` in pack-export + draft load helper  
3. Read-only mount of draft graph on `screenPackConceptEditor`  
4. Edit interactions + debounce persist  
5. Library “Create pack” entry → draft → editor; Publish + include-source toggle → `finalizePack`  
6. SW bump + quickstart QA  

Artifacts: [research.md](./research.md), [data-model.md](./data-model.md), [contracts/pack-concept-editor.md](./contracts/pack-concept-editor.md), [quickstart.md](./quickstart.md)
