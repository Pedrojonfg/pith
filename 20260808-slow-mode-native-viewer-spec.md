# Spec: Slow Mode Native Viewer & Annotation System Redesign

**Status:** Draft
**Target folder:** `specs/20260808-slow-mode-native-viewer/spec.md`
**Date:** 2026-08-08
**Supersedes (partial):**
- `specs/20260528-slow-mode/` — Wave 1 viewport-measured pagination model in `src/js/slow/pagination.js` and `slow/reader.js` is replaced for Slow Mode only. Annotation type registry, hotkeys, tier system (`annotations.js:8-32`) are UNCHANGED and remain governed by that spec.
- `specs/20260533-slow-reader-desktop/` — pagination/offset sections of `data-model.md` are superseded. Full-bleed layout contract (`#screenSlowReader` outside `.container`, `body.slow-reader-active` chrome hiding) REMAINS IN FORCE, see §4.3.

**Explicitly NOT touched by this spec:**
- `specs/20260806-scope-gated-generation/` — the scope gate, `screenScopeSelection`, and how DPP hands scoped text/hierarchy to Slow Mode are unchanged. Slow Mode still receives `scopedMarkdown` + mini-hierarchy exactly as today.
- `specs/20260609-doc-hierarchy-index/` — hierarchy building is unchanged. Only how Slow Mode *consumes* hierarchy (for section boundaries) changes.
- `src/js/slow/pagination.js` as consumed by **paced-reader.js** (RSVP paced reading) — that consumer is out of scope, see NG1.

---

## 0. Decision required from Pedro before Cursor starts

**D-MIG.** Existing annotations use a global `charStart`/`charEnd` shape. Under the new anchor model (§5.2) that shape cannot be losslessly converted for PDF-viewer sessions (no page/rect data ever existed to recover). For scroll-viewer sessions (HTML/TXT/MD) a best-effort mechanical migration IS possible (§9). Pick one before implementation begins:

- **(a) Recommended.** Auto-migrate scroll-mode annotations per §9. Drop PDF-bound annotations with a one-time in-app notice ("we upgraded the reader; your PDF highlights on this document couldn't be carried over, sorry").
- **(b)** Drop all existing Slow annotations app-wide on first load post-deploy, one-time notice.
- **(c)** Freeze old sessions on the current reader/annotation code path permanently; new sessions only get the new viewer. Requires maintaining both systems indefinitely — not recommended given `study.js` is already a 9k-line monolith.

This spec is written assuming **(a)**. If Pedro picks otherwise, Cursor must halt at §9 and confirm before proceeding, since it changes what "done" means for that section.

---

## 1. Motivation — findings from repo audit, 2026-08-08

**FM-01 (pagination image bug).** `buildPaginationMeasureContent` (`src/js/slow/reader.js:145-158`) measures page-fit by calling `replacePithImageTokens(slice, images, {})` with an **empty `urlById` map**, so every image always measures as an "Image unavailable" text placeholder regardless of real dimensions. This systematically under-measures page height on any page containing a figure. Because `.slow-reader-page-wrap` has `overflow: hidden` and no vertical scroll, the real image then paints taller than its allotted slot and the bottom is clipped. This is the confirmed root cause of the image-layout complaints that motivated this spec.

**FM-02 (permanent layout loss).** Normalization (`extract-pdf-blocks.js`, `extract-html-blocks.js`, `emit-markdown.js`) permanently discards: multi-column layout (linearized to reading order only, no column markers survive), table cell merges (colspan duplicates text; rowspan is dropped with only a `console.warn`), figure-caption association (caption becomes an unlinked paragraph), footnotes (no extractor exists at all), and page orientation/aspect (`pageHeights[]` is computed transiently in `extract-pdf-blocks.js` and never reaches the public normalization result — there is no `pageWidths` and no landscape flag anywhere in the pipeline). None of this is recoverable by improving the markdown extraction pipeline. It requires rendering the original document.

**FM-03 (annotation fragility).** Annotations anchor on absolute character offsets into `normalizedTextFull` (`annotations.js:54-66`) with **no stored quote and no fallback**. Any text drift — re-normalization, the `html_min → markdown` migration path (`migrate-html-min.js:85-102`) — silently misplaces or orphans highlights with no detection, no warning, no repair.

This spec fixes FM-01 and FM-02 by rendering the original document (pdf.js canvas + text layer for PDF sources) instead of reflowed, re-paginated markdown, and fixes FM-03 by changing the annotation anchor model from a single global offset to a stable-unit reference plus a verbatim text snippet.

---

## 2. Decisions locked in prior conversation (do not re-litigate)

- **D1.** PDF documents render via pdf.js with real PDF pages as the pagination unit. No custom viewport-height text-fitting for PDFs, no more `computePageBreakpoints` for this viewer mode.
- **D2.** HTML/TXT/MD documents render as continuous scroll. No fixed-height pages, no pdf.js, no PDF-conversion step (rejected — no headless-browser infra in Supabase Edge Functions; a client-side raster-only "PDF" would lose selectable text, defeating the point).
- **D3.** Checkpoints fire at natural unit boundaries: for PDF, on crossing from the last page of a section to the next page. For scroll documents, when a section's heading leaves the viewport (`IntersectionObserver`), not on a character-progress threshold. Worst case, a checkpoint lands between units rather than exactly mid-content — this is accepted as correct behavior, not a compromise.
- **D4.** Annotation anchor changes from a single absolute `charStart`/`charEnd` into full document text, to: `{unit reference} + {position local to that unit} + {verbatim text snippet as fallback}`. Unit = PDF page number for PDF; stable block id (paragraph/heading/list-item/table/figure) for HTML/TXT/MD.
- **D5.** `shared.annotations` dual-write mirror (`session-store.js:910-929`, called from `annotations.js:70-79`) is retired. `session.slow.annotations` becomes the single source of truth; the graph adapter is updated to read it directly instead of preferring the shared shadow copy.

---

## 3. Goals

- **G1.** Full page fidelity for PDF sources: no reflow, no clipped images or tables, original layout (columns, table merges, captions, page orientation) visible exactly as authored, because the original page is what renders.
- **G2.** Annotation highlights remain visually correct, and are repairable, even if the underlying scoped text is regenerated — via the stored snippet.
- **G3.** All 14 annotation types plus `ia-query` keep full functional parity: menu, hotkeys, tier visibility rules (primary/critical/secondary), steel-man nudge, graph links, flashcard conversion, Phase 3 eligibility.
- **G4.** Phase 0, Phase 3 Module A/B, checkpoints, graph enrichment, and flashcard→SM-2 all continue to function against the new anchor model with no behavior regression versus the existing `cursor-tests/` contracts listed in §16.
- **G5.** Reading-position restore on session resume works for both viewer modes (PDF page number; scroll block id + fractional offset).

## 4. Non-goals

- **NG1.** Not migrating `paced-reader.js` (RSVP paced reading), which is a separate consumer of `slow/pagination.js`. Its `cursor-tests/20260610_paced-reader-pagination.mjs` must keep passing unmodified — `pagination.js` itself is not deleted, only Slow Mode stops calling it.
- **NG2.** Not building any PDF-to-PDF or HTML-to-PDF conversion path (see D2 rationale).
- **NG3.** Not implementing Phase 3 Module B → Vault maturity wiring. Confirmed unimplemented in audit (Module B answers are DOM-only, no persistence, no AI comparison call exists). This stays a backlog item, tracked separately in `a_implementar`.
- **NG4.** Not changing the DPP scope-gating system in any way. Slow Mode continues to receive already-scoped `scopedMarkdown` and mini-hierarchy exactly as it does today; `screenScopeSelection` is untouched.
- **NG5.** Not improving table/column/footnote extraction fidelity in `normalization/*.js`. PDF layout fidelity is achieved by rendering the ORIGINAL PDF, not by improving markdown extraction — improving extraction further would be wasted effort once PDF sources bypass markdown rendering entirely for the visual page.
- **NG6.** Not touching `normalizedFormat: "html_min"` legacy handling beyond what's needed to keep it from crashing. Flagged as OQ-4 (§17) — treat as scroll viewerMode with plain-text (no markdown) rendering, same as today's fallback.

---

## 5. Architecture overview

Two parallel reader implementations behind a single dispatch on `session.slow.viewerMode`, decided once at session-create time and immutable for the session's lifetime — same one-shot-decision pattern already established for the DPP scope gate (no cache-invalidation problem by construction).

```
DPP / session create
  → viewerMode = uploadMeta.originalFormat === "pdf" ? "pdf" : "scroll"
  → stored on session.slow.viewerMode, never recomputed after

viewerMode "pdf"  → pdf.js canvas + text layer, page-indexed        (§6)
viewerMode "scroll" → existing scopedMarkdown, natural DOM flow      (§7)
```

Both viewer modes share: annotation data model (§5.2, viewer-specific `anchor.kind`), the annotation type registry and hotkeys (unchanged), Phase 0 (unchanged, §11), Phase 3 (position-math updated, §12), checkpoints (trigger mechanism changed per viewer mode, §10), graph enrichment (adapter updated, §13).

### 5.1 New `session.slow` fields

| Field | Type | Replaces | Notes |
|---|---|---|---|
| `viewerMode` | `"pdf" \| "scroll"` | — | Set once, never recomputed. Source: `uploadMeta.originalFormat`. |
| `annotations[]` | `Annotation[]` | same field, NEW entry shape | Breaking change, see §5.2 and migration §9. |
| `currentPdfPage` | `number` | `currentPageIndex` (pdf viewerMode only) | 1-indexed, pdf.js native numbering. |
| `pdfPageCount` | `number` | — (pdf viewerMode only) | Cached from pdf.js on first load, avoids re-querying. |
| `maxReadPdfPage` | `number` | `maxReadCharEnd` (pdf viewerMode only) | Same role as today's read-progress-for-IA-anti-spoiler guard, page-granular instead of char-granular. |
| `scrollAnchorBlockId` | `string \| null` | `currentPageIndex` (scroll viewerMode only) | Topmost visible block id on last render, for resume. |
| `scrollAnchorOffset` | `number` | — (scroll viewerMode only) | Fractional scroll offset within that block, 0-1, for fine resume position. |
| `maxReadCharEnd` | `number` | — (scroll viewerMode only, retained) | Unchanged semantics, still char-based, still meaningful for scroll documents. |

**R5.1.1.** The following fields are dead per audit (A1: write-only, never read, or already-confirmed-removed) and MUST NOT be carried into the new session shape: `headingOverrides`, `structureWarnings`, `fallbackSections`, `scopeEditMode`, `scopeCollapsedParents`, `breakpoints` (was already dead on the slice — real breakpoints lived in `reader.js` module-local state, not the session). `readingScope` is already fully removed from runtime code; do not reintroduce it under any name.

**R5.1.2.** `currentPageIndex` and `typography` fields keep their current meaning for scroll viewerMode where relevant (typography still applies to scroll rendering); `currentPageIndex` itself is retired app-wide in favor of the two viewer-specific position fields above — do not keep a third redundant position field.

### 5.2 New annotation entry shape

```js
{
  id: string,
  type: string,                          // UNCHANGED — same 14-symbol registry (annotations.js:8-23) + "ia-query"
  anchor: {
    kind: "pdf-rect" | "block-offset",

    // kind === "pdf-rect" (viewerMode "pdf"):
    page: number,                        // 1-indexed pdf.js page number. Hard value, never shifts on re-render.
    rects: [{ x: number, y: number, width: number, height: number }],
                                          // normalized 0–1 page-space, one rect per selected line,
                                          // from pdf.js text-layer getClientRects() mapped through the page viewport transform

    // kind === "block-offset" (viewerMode "scroll"):
    blockId: string,                     // stable id assigned at render time, see §7.2
    charStart: number,                   // offset LOCAL to that block's own textContent
    charEnd: number,
  },
  snippet: string,                       // verbatim selected text — ALWAYS captured now, never discarded
  userText: string,
  createdAt: number,
  aiReply: string | null,
  graphLinks: [{ termId: string, relation: string }],
  isIAQuery?: true,
}
```

**R5.2.1.** `snippet` is mandatory and non-empty for every newly created annotation. This reverses current behavior — audit confirmed `selectedText` is captured transiently on `readerState.pendingSelection` (`reader.js`) and discarded at commit time, never persisted. Persisting it is what makes future re-anchor repair possible at all; do not skip this to save a field.

**R5.2.2.** `shared.annotations` dual-write is removed entirely. Delete the `addAnnotationToShared` call sites in `annotations.js:70-79` and the function itself (`session-store.js:910-929`) once §13 (graph adapter) no longer depends on it. Do not leave a partially-dead write path — either it's called or it's deleted, not both across a transition period.

**R5.2.3.** `updateAnnotation` / `deleteAnnotation` (`annotations.js:97-113`) never had shared-sync in the first place (confirmed in audit); no behavior change needed there beyond operating on the new shape.

---

## 6. PDF viewer implementation

**R-PDF-1.** Use `pdf.js` (already a project dependency via `normalization/pdf-loader.js` for upload-time extraction) with its built-in text layer (`renderTextLayer`) rendered transparently over the canvas, exactly the way Hypothesis/Adobe/pdf.js's own viewer do it. This gives native text selection for free — no custom selection-to-offset mapping code is needed for PDF (contrast with the current `selectionToScopeOffsetsFromRendered` machinery in `reader.js:298-319`, which becomes scroll-viewer-only, see §7.2).

**R-PDF-2.** Page navigation is native pdf.js page indexing. `currentPdfPage` persists on every page-change event (mirror of today's `storeActiveSession` calls in `renderSlowReaderPage`, but keyed to page-change rather than pagination-recompute).

**R-PDF-3.** Images, tables, columns, captions, footnotes render exactly as the PDF author laid them out — because the canvas paints the real page. **This makes FM-01 and FM-02 structurally impossible to reintroduce**: there is no page-fit measurement step to get wrong, and no markdown-flattening step to lose structure through, for the visual page. `document-images/*` extraction and `pith-image` tokens remain necessary for OTHER consumers of the markdown (RSVP block packing, Cloze, vault embeddings, Recall context) — they are simply no longer used for the Slow Mode *visual* page.

**R-PDF-4.** Annotation creation on a PDF page: user selects text via the native text layer → on `selectionchange`/`mouseup`, resolve `page` (from the layer's page context), `rects` (via `range.getClientRects()` mapped to page-normalized coordinates using the current viewport scale, so rects remain valid across zoom levels), and `snippet` (`range.toString()`). Same annotation-type menu UI (`#slowAnnotationMenu`) and hotkeys as today — only the anchor-resolution step changes, not the UI.

**R-PDF-5.** Highlight rendering: draw `rects` as absolutely-positioned overlay `<div>`s (or an SVG overlay layer) on top of the canvas for the current page, colored per `annotationMarkClass` (unchanged type→color mapping from `annotations.js:169-172`). Only the current page's annotations need to be in the DOM at a time — no global highlight-segment computation across the whole document (contrast with today's `buildAnnotationHighlightSegments` which operates against a single page slice; the PDF version is naturally page-scoped already since `page` is a hard field).

**R-PDF-6.** Margin marks: position vertically using the `rects[0].y` of each annotation on the current page directly (normalized page coordinate × rendered page height), replacing today's `measureMarkY` DOM-Range measurement (`reader.js:671-696`) — this is simpler under the new model, not harder, since geometry is already known from the stored rect rather than needing to be re-measured from a live Range.

**R-PDF-7.** Zoom/scale: pdf.js exposes a scale factor; rects stored normalized (0–1 relative to page dimensions) so they remain correct at any zoom without recomputation. This also gives Slow Mode a real zoom control for the first time — flagged as a nice-to-have, not required for parity, see OQ-1.

**R-PDF-8.** Fillable-map mode (`fillableMapMode`, currently keyed to `currentPageIndex` in several places) needs its blank-tracking keyed to `(page, rect)` instead. Cursor should inspect `study.js:4730+`, `reader.js:1010,1324`, `phase0.js:884` for exact call sites before implementing — flagged OQ-2.

---

## 7. Scroll viewer implementation

**R-SCR-1.** Reuse the EXISTING markdown→HTML rendering pipeline unchanged (`markdownToHtml`, `renderSlowMarkdownWithImages`, `document-images/replace-tokens.js`) — this part already works correctly per audit (image tokens render fine; the only defect was in the now-deleted pagination measurement step). Render the full `normalizedTextFull` (or full scoped content) into `.slow-reader-content` with natural document flow — `overflow: visible`, real scroll, no `overflow: hidden` page-slicing.

**R-SCR-2.** Delete `computePageBreakpoints`, `findMaxCharsForPage`, `snapPageEndToSection`, the pagination cache (`pagination.js:5,17-24,100-101`), and all render-time calls to them from `slow/reader.js` (`recomputeBreakpoints`, the `resize`/typography-triggered `invalidatePaginationCache` calls at `reader.js:1565-1571` and `:231-237`). **Do not delete `pagination.js` itself** — `paced-reader.js` (RSVP) still depends on it per NG1.

**R-SCR-3.** Reading-position restore: on every meaningful scroll-settle (debounced, similar cadence to today's 200ms resize debounce), record the topmost block currently intersecting the viewport top edge as `scrollAnchorBlockId`, plus its fractional visible offset as `scrollAnchorOffset`. On session resume, scroll that block into view at that offset instead of jumping to a stored page.

### 7.2 Stable block ids

**R-SCR-4.** At markdown→HTML render time, every block-level element (`p`, `li`, `h1`-`h6`, `blockquote`, `table`, the image/figure wrapper) MUST receive a `data-block-id` attribute, assigned deterministically as a running index over the rendered block sequence (e.g. `b0`, `b1`, `b2`...) — **not** a content hash. Content hashing breaks the moment upstream text shifts by even one re-generation of the same logical document; a positional index is stable as long as block ORDER doesn't change, which is the only guarantee this system actually needs.

**R-SCR-5.** `charStart`/`charEnd` in a `block-offset` anchor are relative to that block's own `.textContent`, never to the document. This bounds the blast radius of drift to within a single block — a change to block N cannot invalidate an annotation anchored to block N−1, unlike today's global-offset model where any earlier edit shifts everything after it.

**R-SCR-6.** Annotation creation: selection handling reuses today's `selectionToScopeOffsetsFromRendered` logic (`reader.js:298-319`, `1135-1158`) but resolves against the containing block's `data-block-id` and LOCAL text position, not the document-global position. `snippet = range.toString()`, captured and persisted per R5.2.1.

**R-SCR-7.** If a stored `blockId` no longer exists at render time (the block was removed by re-normalization), this is the exact silent-failure mode audited under FM-03. Implement the repair path from §9.3 instead of failing silently: attempt to locate `snippet` via substring search in nearby blocks (±3 block positions from the original index as a starting search window, expanding if not found), and if found, re-anchor to the new block/position; if not found, mark the annotation `orphaned: true` (new optional field) and surface it distinctly in the sidebar (e.g. "this highlight's original text couldn't be located") rather than silently mispositioning it. This is new behavior with no current equivalent — today there is no orphan detection at all.

### 7.3 Checkpoints trigger (scroll)

See §10.2.

---

## 8. Annotation system — type-by-type behavior

All 14 types plus `ia-query` keep their existing symbol, hotkey, tier, and color mapping (`annotations.js:8-23`, unchanged, do not renumber or re-key). What changes per type is ONLY how special behaviors resolve position — never the type semantics themselves.

| Type | Tier | Special behavior | What changes under this spec |
|---|---|---|---|
| `≈` approx | primary | none | anchor kind only |
| `?` question | primary | none | anchor kind only |
| `→` explain | primary | flashcard-convertible | anchor kind only |
| `⟷` link | primary | graph-linkable | proximity math for graph edges, see §13 |
| `⚑` flag (Ask AI) | primary | triggers `aiReply` generation | context slice for the LLM call now comes from block/page text instead of global char-radius slice, see §14 |
| `⊘` reject | critical | steel-man nudge trigger, flashcard-convertible, Module B eligible | steel-man proximity redefined per viewer mode, see below |
| `↯` tension | critical | steel-man nudge trigger, flashcard-convertible, Module B eligible | same |
| `⚠` weak | critical | steel-man nudge trigger, Module B eligible | same |
| `★` strong | critical | Module B eligible | anchor kind only |
| `⇑` steel man | critical | Module B eligible | anchor kind only |
| `📌` pin | secondary | none | anchor kind only |
| `⚡` insight | secondary | none | anchor kind only |
| `↩` return | secondary | none | anchor kind only |
| `🔗` graph | secondary | graph-linkable | proximity math, see §13 |
| `ia-query` | n/a | anchored at "read-head" for sidebar Q&A | read-head definition per viewer mode, see below |

**R-ANN-1.** Tier visibility rules (primary always, critical only if `session.slow.criticalMode`, secondary only if `showSecondary`) are unchanged — `visibleAnnotationTypes` logic (`annotations.js:25-32`) needs no modification, it operates on `type`, not on anchor shape.

**R-ANN-2 (steel-man nudge proximity).** Today: on confirming `⊘`/`↯`/`⚠`, check for a nearby `⇑`/`≈` with text within ±500 chars (`STEELMAN_NUDGE_TYPES`, `shouldShowSteelManNudge`, `annotations.js:237-238,261-264`). Redefine per viewer mode:
  - **pdf:** "nearby" = same page, or adjacent page if the new annotation is within the top/bottom ~15% of its page (mirrors reading proximity better than a hard page-only cutoff). Exact threshold is a placeholder, mark as unvalidated per project convention.
  - **scroll:** "nearby" = within N blocks of the new annotation's `blockId` (suggest N=3 as an unvalidated placeholder, tune after real usage).

**R-ANN-3 (IA query read-head).** Today, IA query annotations anchor at the current read position (`addIAQueryAnnotation`, `reader.js:937-949`) and the anti-spoiler guard limits context to `maxReadCharEnd`. Redefine:
  - **pdf:** read-head = `currentPdfPage`. Anti-spoiler context limit = `maxReadPdfPage`.
  - **scroll:** read-head = `scrollAnchorBlockId`. Anti-spoiler context limit = `maxReadCharEnd` (retained, still meaningful for scroll).

**R-ANN-4.** Overlap policy (newest `createdAt` wins for primary interaction, nested spans for visual layering — `annotations.js:174-178,186-197`) is scroll-viewer-only going forward, since PDF highlights are independent absolutely-positioned rects that can visually stack without a z-order policy needed beyond standard DOM paint order.

---

## 9. Migration of existing annotations (assumes decision D-MIG option (a))

**R-MIG-1.** Run once, at first load of a session after this feature ships, gated on a session-level flag (e.g. `annotationSchemaVersion`) so it never re-runs.

**R-MIG-2.** For `viewerMode === "scroll"` sessions: for each existing annotation, use its old global `charStart`/`charEnd` against the OLD `normalizedTextFull` (still available at migration time, before any re-render) to (a) determine which rendered block it falls within, by comparing against the same block-splitting logic used for R-SCR-4 applied to the old text, (b) compute the new local `charStart`/`charEnd` relative to that block, (c) backfill `snippet` via `oldText.slice(charStart, charEnd)` — this is the LAST possible moment this slice is meaningful, since after migration the global offsets are discarded. If a block boundary can't be determined confidently (e.g. the annotation spans a block boundary, which shouldn't happen given how selection worked but must be defended against), fall back to `orphaned: true` per R-SCR-7 rather than guessing.

**R-MIG-3.** For `viewerMode === "pdf"` sessions: no recoverable position data exists (old shape never stored page or rect). Drop these annotations. Surface a one-time non-blocking notice per D-MIG(a). Do not attempt any heuristic page-guessing from char offsets — there is no reliable mapping from "offset into flattened markdown" to "PDF page number" given how much structure normalization discards (this is precisely FM-02).

**R-MIG-4.** `shared.annotations` is not migrated — it's deleted per R5.2.2, and was already a lossy, partially-stale shadow copy per audit, not worth preserving.

---

## 10. Checkpoints

**R-CP-1.** Section boundaries continue to come from `buildSectionBoundaries` / hierarchy parsing exactly as today — this part is anchor-model-independent and unchanged.

**R-CP-2 (pdf trigger).** On `currentPdfPage` advancing, check whether the PAGE JUST LEFT was the last page overlapping a not-yet-dismissed section (mapping section char range → page range requires a one-time lookup per document: which PDF page each section's `charEnd` falls on, computed from the pdf.js text layer's page-to-text mapping at document load, cached on the session similar to today's `readerState.breakpoints` but keyed to pages, not char offsets). If so, show the checkpoint chip on the new page rather than mid-page. This directly implements D3.

**R-CP-3 (scroll trigger).** Attach an `IntersectionObserver` to each section's heading element (or the block matching its `charStart`) with a small negative root margin so it fires when the heading scrolls just past the top of the viewport (i.e., the user has finished reading into the next section). On fire, run the same not-yet-dismissed-section check and show the chip. This replaces `isLastPageOfSection` (`checkpoints.js`) for scroll viewerMode.

**R-CP-4.** The 10-second pre-show delay and the dismissed-set persistence (`checkpointsDismissed: string[]`, keyed by section id) are unchanged in both modes — these are UI-timing and data-shape decisions independent of the trigger mechanism.

**R-CP-5.** LLM question generation (`generateCheckpointQuestion`, template fallback) is UNCHANGED — it operates on section text/title, not on page or block position, per audit confirmation that Phase-0-adjacent LLM calls don't carry positional contracts.

---

## 11. Phase 0 — compatibility (no functional change required, verify only)

**R-P0-1.** Confirmed by audit: Phase 0 generation (`generatePhase0ForScope`, `slow/phase0.js`, DPP T2.3) consumes `scopedMarkdown` + hierarchy tree summary and produces a purely semantic payload (`textGenre`, `thesis`, `argumentMap[]`, `conceptsToFind[]`, `guideQuestion`, optional `prequestions`/`fillableBlanks`/`criticalExaminePoints`) with **no char offsets, no page numbers, no quotes tied to render layout**. This spec makes NO changes to `document-preparation.js` T2.3 or `api.js` Phase 0 prompts/schema.

**R-P0-2.** Verify only: `fillableBlanks` currently carry a `pageIndex` field used at runtime (not LLM-generated) for fillable-map mode. Under the new model this needs to resolve against `(page, rect)` for PDF or `(blockId, offset)` for scroll instead — this is the same concern as R-PDF-8, tracked together as OQ-2.

**R-P0-3.** `scopeTextForPhase0IA` (currently a no-op for `normalizedFormat: "markdown"`, only active for legacy `html_min`) is unaffected — Phase 0 generation input doesn't change regardless of which viewer will later display the scope.

---

## 12. Phase 3 — Module A & Module B

**R-P3-1 (Module A, position math).** `comparePhase0ToAnnotations` (`phase3.js:122-166`) currently resolves an argument-map node's anchor via `resolveArgumentMapNodeAnchor` (char-based) and checks for a covering annotation within `PROXIMITY` (200 chars, `graph/proximity.js`). Redefine proximity per viewer mode:
  - **pdf:** argument-map nodes need a page anchor. Since Phase 0 doesn't generate one (R-P0-1), derive it the same way annotation-graph proximity will (§13): match `node.text` against page text content via `indexOf`-style search over each page's extracted text (pdf.js `getTextContent`), take the first confident match. Cache this per-session once computed. "Covering" = annotation on the same page, or the immediately adjacent page.
  - **scroll:** same `indexOf`-style match, but against block text instead of the full flattened string, giving a `(blockId, offset)` anchor directly. "Covering" = annotation within N blocks (reuse the R-ANN-2 constant for consistency).

**R-P3-2 (Module A, page labels).** `pageLabelForRow` (`phase3.js:229-238`) currently shows "p. N" using `charOffsetToPage`. For pdf viewerMode this becomes the real PDF page number directly (simpler than today, no lookup needed once R-P3-1's page anchor exists). For scroll viewerMode, drop the page label entirely or replace with a section title — there is no page concept to show; do not fabricate one. Flagged OQ-5 for Cursor to confirm with Pedro's preference on the label text for scroll mode.

**R-P3-3 (Module B, unchanged mechanics).** `buildRetrievalQuestionShells`, `eligibleRetrievalAnnotations`, `RELEVANT_ANNOTATION_TYPES`, `generateDevilsAdvocateQuestions`, the flashcard-convert UI and its cap/eligibility rules are all UNCHANGED in their selection logic — they operate on `type` and `userText`, not on the anchor shape.

**R-P3-4 (Module B, context slicing).** `annotationContextSlice(normalizedTextFull, ann, radius=400)` (`phase3.js:375-381`), used to give the LLM surrounding context for devil's-advocate question generation, currently slices by global char offset. Redefine:
  - **scroll:** slice the annotation's own block text plus N neighboring blocks (suggest ±1 block as an unvalidated placeholder) instead of a fixed char radius.
  - **pdf:** slice the page's extracted text content (via pdf.js `getTextContent` for that page), or the page plus adjacent page if the annotation sits near a page boundary.

**R-P3-5 (flashcard → SM-2, unchanged).** `wirePhase3FlashcardConvert`, `annotationsToFlashcardPayload`, `registerOrUpdateSmItem` (sourceType `slow_flashcard`) require NO changes — confirmed by audit that this path only ever consumed `type` and `userText`, never position. This is the lowest-risk integration point in the entire migration; do not touch it beyond making sure it compiles against the new `Annotation` type.

---

## 13. Graph adapter (`graph/build.js`, `graph/adapters.js`, `graph/proximity.js`)

**R-GR-1.** `mapSharedAnnotations` is deleted (per R5.2.2). `resolveEnrichedGraphInputs` reads `session.slow.annotations` directly — this also fixes the audited defect where the shared shadow copy reconstructed a fake `charEnd = offset + text.length`, which was wrong for annotations where `userText` didn't match the selected span length.

**R-GR-2.** `findNearestArgumentMapNode` (`graph/proximity.js`) currently computes distance in global char space between an annotation's midpoint and each argument-map node's anchor. Rework per viewer mode using the same node-anchoring approach established in R-P3-1:
  - **pdf:** distance = page delta (primary sort key) + normalized vertical position within page (tiebreaker).
  - **scroll:** distance = block-index delta (primary sort key) + local char offset (tiebreaker).

**R-GR-3.** `buildSlowPhase0GraphFromInputs` (`build.js` ~405-466, consumes only `phase0`, no annotations) is UNCHANGED — confirmed position-independent by audit.

**R-GR-4.** Exact distance-scoring constants (how much a page/block delta should dominate over the tiebreaker) are explicitly a placeholder per project convention — mark as unvalidated, to be tuned once real usage data exists, consistent with how `PROXIMITY = 200 chars` was itself an unvalidated placeholder in the current system.

---

## 14. LLM-assisted features — consolidated impact summary

| Feature | Current position dependency | Change required |
|---|---|---|
| Phase 0 orientation generation | None (confirmed, R-P0-1) | **None** |
| Checkpoint question generation | None (operates on section text) | **None** |
| `⚑` "Ask AI" reply | Context = char-radius slice around annotation | Redefine slice source per viewer mode, same pattern as R-P3-4 |
| IA query sidebar chat | Anti-spoiler limited by `maxReadCharEnd` | Redefine read-head per viewer mode, R-ANN-3 |
| Steel-man nudge | ±500 char proximity check | Redefine proximity per viewer mode, R-ANN-2 |
| Phase 3 Module A coverage check | 200-char proximity | Redefine per viewer mode, R-P3-1 |
| Phase 3 Module B question generation | 400-char context radius | Redefine per viewer mode, R-P3-4 |
| Graph enrichment (argument-map linking) | Global char midpoint distance | Redefine per viewer mode, R-GR-2 |
| Flashcard → SM-2 | None (confirmed) | **None** |

Every LLM call that generates NEW content (Phase 0, checkpoint questions, Ask-AI replies, IA query answers, devil's-advocate questions) keeps its prompts and output schemas exactly as they are today — nothing here changes what the LLM is asked to produce. What changes is only how Slow Mode computes WHICH text to hand the LLM as context, and WHERE on screen to anchor the result. This is a deliberate scope boundary: do not touch `api.js` prompt templates as part of this spec.

---

## 15. Implementation sequence (ordered by risk, per project convention: risk-ordered, one commit per unit of work)

1. **Data model.** New `session.slow` fields (§5.1), new `Annotation` shape (§5.2), migration flag scaffolding. No UI changes yet. Everything else depends on this.
2. **Migration (§9).** Runs against the new shape from step 1 but doesn't require either viewer to exist yet — can be built and tested against fixture sessions independently.
3. **Scroll viewer (§7).** Lower risk than PDF viewer — reuses the existing, already-correct markdown rendering pipeline, only removes pagination and adds block ids + IntersectionObserver-based checkpoints. Ship this first to validate the anchor model end-to-end before tackling pdf.js integration.
4. **Annotation creation/rendering for scroll viewerMode (§7.2, §8).** Depends on step 3.
5. **PDF viewer (§6).** Higher risk — new pdf.js integration surface, new coordinate system (page-normalized rects). Build against a small set of fixture PDFs covering: text-only, embedded images, landscape/wide pages, multi-column, tables.
6. **Annotation creation/rendering for pdf viewerMode (§6, §8).** Depends on step 5.
7. **Checkpoints, both modes (§10).**
8. **Phase 3 Module A/B position math (§12).**
9. **Graph adapter (§13).**
10. **Cleanup.** Delete dead pagination call sites from `slow/reader.js` (NOT `pagination.js` itself, per NG1), delete `mapSharedAnnotations` and `addAnnotationToShared`, delete now-orphaned `.slow-scope-*` and old pagination-related CSS if any is found to be pagination-specific (most orphan CSS found in audit was already scope-related, not pagination-related — verify before deleting anything pagination-adjacent in CSS since that's shared with paced-reader styling in some cases).

---

## 16. Test requirements

### 16.1 Existing `cursor-tests/` that MUST keep passing unmodified (not touched by this migration)
- `20260610_paced-reader-pagination.mjs` — paced-reader's independent use of `pagination.js` (NG1).
- `20260533_t01`/`t03` — full-bleed reader layout, sidebar default state (§4.3 layout contract unchanged).
- `20260806_t08/t09/t10` — scope-gate removal contracts (untouched by this spec, D-locked NG4).

### 16.2 Existing tests that WILL need updates (behavior intentionally changes)
- `20260528_t05-pagination.mjs`, `20260609_doc-hierarchy-pagination.mjs`, `20260528_t20-sidebar-jump.mjs` — these test the viewport-measured pagination model directly; Slow Mode no longer uses it. Either retire (if they test Slow-specific pagination only) or confirm they still pass unmodified if they happen to test `pagination.js` in isolation (shared with paced-reader).
- `20260528_t08-annotations.mjs`, `20260609_slow-inline-highlights.mjs`, `20260533_t02-selection-offsets.mjs` — annotation shape changed; rewrite fixtures against the new `Annotation` type, keep the same BEHAVIORAL assertions (add/delete by anchor, critical-mode visibility expansion, per-type highlight classes) just against new data.
- `20260528_t15-slow-qa.mjs` — audit flagged this still constructs `readingScope` in fixtures despite it being removed from runtime; take this opportunity to fix that fixture debt while touching this test anyway.
- `20260606_t08-phase3.mjs`, `20260528_t21-phase3-diff.mjs` — proximity/anchor assertions need updating per §12, keep behavioral intent (hits/misses, critical-type handling, `⚑` ignored, whitespace ignored) identical.
- `20260721_phase3-module-b-regen-guard.mjs` — verify still passes; Module B DOM-regeneration guard logic is untouched by this spec (NG3).

### 16.3 New tests required
- Migration correctness (§9): fixture session with old-shape annotations → run migration → assert new shape, correct block resolution, correct snippet backfill, correct `orphaned` flagging for unresolvable cases.
- PDF annotation round-trip: create annotation on a page → reload session → highlight renders at the same page/rect.
- Scroll annotation repair (R-SCR-7): annotation on a block that gets removed → verify snippet-search repair finds it in a nearby block, or correctly flags `orphaned`.
- Checkpoint trigger, both modes: PDF page-boundary trigger, scroll IntersectionObserver trigger, both against fixture documents with known section boundaries.
- FM-01 regression guard: a fixture PDF with a tall image should render without any content clipping — this is the test that proves the original bug is actually gone, not just moved.

---

## 17. Open questions for Cursor (resolve via repo inspection; do not decide unilaterally without flagging back to Pedro)

- **OQ-1.** PDF zoom control (R-PDF-7) — nice-to-have, not required for parity. Confirm with Pedro before adding scope.
- **OQ-2.** Fillable-map mode's blank-tracking (R-PDF-8, R-P0-2) needs exact call-site inspection of `study.js:4730+`, `reader.js:1010,1324`, `phase0.js:884` before its `(page, rect)` / `(blockId, offset)` keying can be finalized. Report findings before implementing rather than guessing the shape.
- **OQ-3.** Exact proximity/distance-scoring constants (R-ANN-2, R-GR-4) — implement with clearly-marked placeholder values, do not spend time tuning without real usage data, consistent with existing project convention for numeric thresholds.
- **OQ-4.** `normalizedFormat: "html_min"` legacy handling (NG6) — confirm current behavior is preserved as scroll-viewer-mode plain text, not silently dropped.
- **OQ-5.** Module A page-label replacement text for scroll viewerMode (R-P3-2) — needs a product decision from Pedro (section title? nothing? something else?), flag rather than guess.

---

## 18. File touch list (non-exhaustive, for planning)

**New/heavily modified:** `slow/pdf-reader.js` (new), `slow/scroll-reader.js` (likely a rename/refactor of much of current `slow/reader.js`), `slow/annotations.js` (anchor shape + resolution logic), `slow/checkpoints.js` (trigger mechanism), `slow/pagination.js` (unchanged, kept for paced-reader only — verify no Slow-only code lingers here after cleanup).

**Modified:** `study.js` (`createSlowSession` field set), `session-types.js` (if a formal type gets added — audit noted none currently exists, this spec is a good opportunity to add one), `graph/adapters.js`, `graph/proximity.js`, `graph/build.js` (verify no changes needed beyond adapter per R-GR-3), `slow/phase3.js`, `session-store.js` (remove `addAnnotationToShared`).

**Unmodified (verify only):** `document-preparation.js` T2.3, `api.js` Phase 0 prompts, `slow/phase0.js` generation logic, `slow/gamification.js` flashcard payload builder, `review.js` SM-2 ingest.
