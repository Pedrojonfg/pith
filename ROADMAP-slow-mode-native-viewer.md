# ROADMAP — slow-mode-native-viewer

**Feature:** specs/20260808-slow-mode-native-viewer | **Spec:** specs/20260808-slow-mode-native-viewer/spec.md | **Plan:** specs/20260808-slow-mode-native-viewer/plan.md  
**Created:** 2026-08-08

## Dependency diagram

```text
T01 data-model
 └─ T02 migration
     └─ T03 scroll-viewer
         └─ T04 scroll-annotations
             ├─ T05 pdf-viewer ────────┐
             │    └─ T06 pdf-annotations┤
             └──────────── T07 checkpoints ← T05/T06
                              └─ T08 phase3-fillable
                                   └─ T09 graph-shared-retire
                                        └─ T10 cleanup-qa-sw
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
| 10 | T10 | sequential |

(All sequential due to shared `reader.js` / `annotations.js` / `study.js` — parallel would conflict.)

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Session fields + types + createSlowSession viewerMode | — | sequential | [x] |
| T02 | Annotation migration D-MIG(a) + tests | T01 | sequential | [x] |
| T03 | Scroll continuous viewer + block ids + position restore | T02 | sequential | [x] |
| T04 | Scroll annotation create/render/repair | T03 | sequential | [x] |
| T05 | PDF pdf.js viewer + pdfSource + page nav | T04 | sequential | [x] |
| T06 | PDF annotation rects create/render | T05 | sequential | [x] |
| T07 | Checkpoints both modes | T06 | sequential | [x] |
| T08 | Phase 3 proximity + fillable keys + Ask-AI slice | T07 | sequential | [x] |
| T09 | Graph adapter + remove shared dual-write | T08 | sequential | [x] |
| T10 | Cleanup pagination call sites, CSS, SW bump, QA | T09 | sequential | [x] |

## Prompt per task

### T01 — data-model session fields
**Spec ref:** FR-001, FR-020, §5.1 | **Plan ref:** phase 1 | **Files:** `src/js/study.js` (createSlowSession), `src/js/session-types.js`, optionally `src/js/session-store.js` normalize helpers  
**Success criterion:** New sessions set `viewerMode`, schema v2, mode-specific position fields; no `currentPageIndex` as position; dead fields not written. Failing test first asserting createSlowSession shape.  
**On close:** `/validate` and mark `[x]`.

### T02 — migration
**Spec ref:** FR-012, §9 | **Plan ref:** phase 2 | **Files:** `src/js/slow/migrate-annotations.js` (new), wire load path in `session-store.js` or `study.js`, `cursor-tests/` migration test  
**Success criterion:** Scroll fixtures migrate to block-offset+snippet; PDF fixtures drop + notice flag; idempotent via schema version.  
**On close:** `/validate` and mark `[x]`.

### T03 — scroll viewer
**Spec ref:** FR-003, FR-004, FR-007, FR-019 | **Plan ref:** phase 3 | **Files:** `src/js/slow/reader.js` and/or `scroll-reader.js`, `src/css/slow-mode.css`, stop Slow calls to pagination fit APIs  
**Success criterion:** Continuous scroll render with `data-block-id`; no overflow:hidden page-fit for scroll; position restore via scrollAnchor*; paced-reader pagination test still green.  
**On close:** `/validate` and mark `[x]`.

### T04 — scroll annotations
**Spec ref:** FR-005–011, FR-025 | **Plan ref:** phase 4 | **Files:** `src/js/slow/annotations.js`, reader selection path, sidebar orphan UX, update annotation tests  
**Success criterion:** Create/render block-offset annotations with snippet; repair/orphan path; tiers/hotkeys unchanged.  
**On close:** `/validate` and mark `[x]`.

### T05 — pdf viewer
**Spec ref:** FR-002, FR-019 | **Plan ref:** phase 5 | **Files:** `src/js/slow/pdf-reader.js` (new), study/reader dispatch, pdfSource persistence, css  
**Success criterion:** PDF sessions render canvas+text layer; page nav persists `currentPdfPage`; tall-image fixture not clipped (FM-01 guard test).  
**On close:** `/validate` and mark `[x]`.

### T06 — pdf annotations
**Spec ref:** FR-008, FR-009 | **Plan ref:** phase 6 | **Files:** pdf-reader + annotations highlight overlays  
**Success criterion:** Selection → pdf-rect+snippet; reload restores rects; margin marks use rect y.  
**On close:** `/validate` and mark `[x]`.

### T07 — checkpoints
**Spec ref:** FR-014 | **Plan ref:** phase 7 | **Files:** `src/js/slow/checkpoints.js`, reader wiring, checkpoint tests  
**Success criterion:** PDF page-boundary + scroll IntersectionObserver triggers; dismiss set unchanged.  
**On close:** `/validate` and mark `[x]`.

### T08 — phase3 fillable Ask-AI
**Spec ref:** FR-015–018, FR-024 | **Plan ref:** phase 8 | **Files:** `phase3.js`, `phase0.js` fillable, Ask-AI context in reader/ai-context, phase3 tests  
**Success criterion:** Viewer-mode proximity/context; fillable uses pdfPage/blockId; scroll Module A label = section title.  
**On close:** `/validate` and mark `[x]`.

### T09 — graph shared retire
**Spec ref:** FR-013 | **Plan ref:** phase 9 | **Files:** `graph/adapters.js`, `graph/proximity.js`, `session-store.js`, `annotations.js`, unified-session shared test  
**Success criterion:** No dual-write; graph reads slow.annotations; proximity page/block scoring.  
**On close:** `/validate` and mark `[x]`.

### T10 — cleanup QA SW
**Spec ref:** SC-*, quickstart | **Plan ref:** phase 10 | **Files:** dead Slow pagination call sites, css verify, `sw-update.js`, `index.html`, `sw.js`, quickstart checklist  
**Success criterion:** paced-reader test green; SW versions aligned; quickstart items checked in ROADMAP notes.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents
Cleanup: 2026-08-08 — none registered (Task generalPurpose only; no `.cursor/agents/slow-mode-native-viewer-*.md` created).

## Notes
- Hands-off defaults: D-MIG(a), no zoom, scroll Module A = section title, fillable keys per research R6.
- Wave quality: `/code-review` + `/ponytail-review` after each wave.
- **QA (T10):** T01–T09 + paced-reader pagination + SW update flow green. `SW_VERSION=20260808_01`, `CACHE_NAME=pith-v172`.
- **Known follow-ups:** large PDF base64 in session may hit storage limits; Slow-after-RSVP may not stash `pdfSource` (only Slow upload path today); PDF zoom deferred (OQ-1).
- **T10 QA (2026-08-08):** Dead Slow page-fit path removed from `reader.js` / sidebar; `pagination.js` kept for paced-reader. Paced CSS untouched (`main.css` + `design-enforcement.css`). SW `20260808_01` / `pith-v172`. Automated: `20260606_validate-sw-update-flow` + all `20260808_t*.mjs` + `20260610_paced-reader-pagination` green. Manual smoke still per `specs/.../quickstart.md` (PDF tall image, scroll restore, migration notice, checkpoints, Phase 3 / graph).
