# Research: Slow Mode Native Viewer

**Feature**: `20260808-slow-mode-native-viewer`  
**Date**: 2026-08-08

## Decisions

### R1. Dual immutable viewerMode
- **Decision**: Set `session.slow.viewerMode` once at `createSlowSession` from `materialMeta.originalFormat` / `uploadMeta.originalFormat` (`pdf` → `"pdf"`, else `"scroll"`). Never recompute.
- **Rationale**: Same one-shot pattern as `fillableMapMode` / `checkpointsEnabled`. Avoids cache invalidation between pagination models.
- **Alternatives**: Recompute from format on load (fragile); freeze old sessions on legacy reader (D-MIG c — rejected).

### R2. PDF via existing pdf.js loader + text layer
- **Decision**: Reuse `loadPdfJs` from `normalization/pdf-loader.js` (pdfjs-dist 4.4.168, CDN in browser). New `slow/pdf-reader.js` renders canvas + `renderTextLayer` for selection. Store original PDF bytes/URL reference needed at session create (see R2b).
- **Rationale**: Already vendored; Hypothesis-style overlay is standard.
- **Alternatives**: Convert HTML→PDF (rejected, NG2); improve markdown extraction (rejected, FM-02 irreversible).

### R2b. PDF source bytes availability
- **Decision**: Persist enough to re-open the PDF in Slow Mode — prefer `session.slow.pdfSource` as `{ kind: "arrayBuffer-base64" | "objectUrl-ref", ... }` OR re-fetch from IndexedDB/upload cache if the app already stores originals. During implementation, inspect upload pipeline for existing blob retention; if none, store base64/ArrayBuffer on session at create (ponytail: smallest change that works). Mark as implementation detail in data-model.
- **Rationale**: Reader cannot render without the original file; markdown alone is insufficient for pdf viewerMode.
- **Alternatives**: Re-upload prompt on resume (worse UX).

### R3. Scroll = continuous markdown, keep pagination.js for paced-reader
- **Decision**: Strip Slow calls to `computePageBreakpoints` / cache invalidation from reader path. Do not delete `pagination.js`.
- **Rationale**: NG1; paced-reader tests must stay green unmodified.

### R4. Annotation anchor model
- **Decision**: `{ kind: "pdf-rect", page, rects[] }` | `{ kind: "block-offset", blockId, charStart, charEnd }` + mandatory `snippet`.
- **Rationale**: Fixes FM-03; unit-local blast radius.
- **Alternatives**: Keep global offsets (rejected).

### R5. Migration D-MIG(a)
- **Decision**: One-shot `annotationSchemaVersion` gate. Scroll: map global offsets → block-offset + snippet. PDF: drop + one-time notice. Delete shared dual-write (not migrated).
- **Rationale**: PDF has no recoverable page/rect data.

### R6. Fillable blanks (OQ-2 resolved)
- **Decision**: Replace viewport `pageIndex` semantics:
  - When filled via annotation: derive display position from annotation anchor (`pdf` → `pdfPage` 1-indexed; `scroll` → `blockId`).
  - Persist on blank: keep `annotationId` as primary; add optional `pdfPage` / `blockId` filled at `fillBlankFromAnnotation`; stop writing viewport `currentPageIndex` into `pageIndex`.
  - UI labels: pdf → `p. N` (real PDF page); scroll → section title or block label (no fabricated page).
- **Rationale**: Current `pageIndex` is Slow viewport page — wrong unit under both new viewers.
- **Alternatives**: Keep `pageIndex` as opaque int (misleading).

### R7. Proximity placeholders (OQ-3)
- **Decision**: Steel-man scroll N=3 blocks; PDF same page or adjacent if within top/bottom 15%; graph page/block delta primary + offset tiebreaker. Mark `// unvalidated placeholder` in code.
- **Rationale**: Matches existing project convention for thresholds.

### R8. No PDF zoom UI (OQ-1)
- **Decision**: Out of scope v1. Store rects normalized 0–1 so zoom can be added later without migration.
- **Rationale**: Spec FR-023.

### R9. Module A scroll labels (OQ-5)
- **Decision**: Section title (or omit if unknown) — never fabricate page numbers.
- **Rationale**: Spec FR-024.

### R10. html_min (OQ-4)
- **Decision**: `viewerMode: "scroll"` + existing plain-text render path when `normalizedFormat === "html_min"`.
- **Rationale**: Preserve non-crash legacy behavior.

### R11. Checkpoint triggers
- **Decision**: PDF: on leaving last page overlapping section (need page↔section map from pdf.js text content once). Scroll: IntersectionObserver on section headings.
- **Rationale**: D3 locked.

### R12. Shared annotations retirement
- **Decision**: Delete `addAnnotationToShared` call + function; `resolveEnrichedGraphInputs` reads `session.slow.annotations` only; update/remove `mapSharedAnnotations`.
- **Rationale**: Lossy create-only dual-write; FR-013.

## Open items closed by research
| Item | Resolution |
|------|------------|
| OQ-1 | No zoom v1 |
| OQ-2 | annotationId + pdfPage/blockId on blanks |
| OQ-3 | Placeholders as above |
| OQ-4 | scroll + plain text |
| OQ-5 | section title |
| PDF bytes | inspect upload cache; else persist on session |

## Risks
- `study.js` monolith touch surface for createSlowSession + fillable UI + reader dispatch.
- PDF bytes size in localStorage/session persistence — may need IndexedDB; inspect existing persistence layer first.
- Large test rewrite surface (annotations, phase3, pagination Slow-specific).
