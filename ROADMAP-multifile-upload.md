# ROADMAP — multifile-upload

**Feature:** specs/20260702-multifile-upload | **Spec:** specs/20260702-multifile-upload/spec.md | **Plan:** specs/20260702-multifile-upload/plan.md  
**Created:** 2026-06-28

## Dependency diagram

```
T01 (source-provenance) ─┬→ T03 (normalizeMultipleFiles) → T04 (create flow) → T05 (packing)
                         ├→ T06 (recall/cloze provenance)
T02 (staging UI) ────────┘→ T04
T05 + T01 ───────────────→ T07 (slow selector)
T05 ─────────────────────→ T08 (tests)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02 | parallel |
| 2 | T03 | sequential |
| 3 | T04 | sequential |
| 4 | T05 | sequential |
| 5 | T06 | sequential |
| 6 | T07 | sequential |
| 7 | T08 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | source-provenance.js pure module | — | parallel | [x] |
| T02 | Staging UI markup + CSS + state | — | parallel | [x] |
| T03 | normalizeMultipleFiles | T01 | sequential | [x] |
| T04 | Wire Continue + uploadMeta.files | T02,T03 | sequential | [x] |
| T05 | Packing boundaries + sourceFileIds | T04 | sequential | [x] |
| T06 | Recall + Cloze sourceFileId | T01,T04 | sequential | [x] |
| T07 | Slow scope file selector | T05 | sequential | [x] |
| T08 | cursor-tests + SW bump | T07 | sequential | [x] |

## Prompt per task

### T01 — source-provenance
**Spec ref:** FR-005–FR-008, data model  
**Plan ref:** wave 1  
**Files:** `src/js/source-provenance.js`  
**Success criterion:** Exports sentinel parse, region slice, block annotation helpers; unit-testable.  
**On close:** `/validate` and mark `[x]`.

### T02 — staging UI
**Spec ref:** US1, FR-001–FR-003  
**Plan ref:** wave 1  
**Files:** `index.html`, `src/css/main.css`, `src/js/ui.js`, `src/js/study.js` (staging only)  
**Success criterion:** List add/remove, max 5, Continue gated on name + files.  
**On close:** `/validate` and mark `[x]`.

### T03 — normalizeMultipleFiles
**Spec ref:** FR-005  
**Plan ref:** contracts/normalize-multiple.md  
**Files:** `src/js/input-normalization.js`  
**Success criterion:** Concatenates with sentinels; single-file equivalent.  
**On close:** `/validate` and mark `[x]`.

### T04 — create flow
**Spec ref:** US1, FR-004  
**Plan ref:** wave 3  
**Files:** `src/js/study.js`, `src/js/session-store.js`  
**Success criterion:** Continue normalizes all staged files, persists files[], starts DPP.  
**On close:** `/validate` and mark `[x]`.

### T05 — packing provenance
**Spec ref:** FR-006–FR-007  
**Plan ref:** research Q1  
**Files:** `src/js/chunk-alignment.js`, `src/js/session.js`  
**Success criterion:** Blocks respect sentinels; sourceFileIds set when known.  
**On close:** `/validate` and mark `[x]`.

### T06 — recall/cloze
**Spec ref:** FR-008  
**Plan ref:** wave 5  
**Files:** `src/js/recall-api.js`, `src/js/cloze/pipeline.js`, `src/js/cloze/normalize.js`  
**Success criterion:** sourceFileId on questions/items when excerpt matches region.  
**On close:** `/validate` and mark `[x]`.

### T07 — slow selector
**Spec ref:** US3, FR-009  
**Plan ref:** research Q4  
**Files:** `index.html`, `src/js/ui.js`, `src/js/study.js`  
**Success criterion:** Selector visible only multi-file; filters scope sections.  
**On close:** `/validate` and mark `[x]`.

### T08 — tests + SW
**Spec ref:** Success criteria  
**Plan ref:** quickstart.md  
**Files:** `cursor-tests/20260702_multifile-upload.mjs`, `src/js/sw-update.js`, `index.html`, `sw.js`  
**Success criterion:** Tests green; SW_VERSION bumped.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-06-28 (none created)
