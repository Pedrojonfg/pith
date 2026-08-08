# Data Model: Slow Mode Native Viewer

**Feature**: `20260808-slow-mode-native-viewer`  
**Date**: 2026-08-08

## session.slow (updated)

| Field | Type | Notes |
|-------|------|-------|
| `viewerMode` | `"pdf" \| "scroll"` | Set once at create; immutable |
| `annotationSchemaVersion` | `number` | e.g. `2` after migration; absent/`1` = legacy |
| `annotations` | `Annotation[]` | New shape (below) |
| `currentPdfPage` | `number` | pdf only; 1-indexed |
| `pdfPageCount` | `number` | pdf only |
| `maxReadPdfPage` | `number` | pdf only; anti-spoiler |
| `scrollAnchorBlockId` | `string \| null` | scroll only |
| `scrollAnchorOffset` | `number` | scroll only; 0–1 |
| `maxReadCharEnd` | `number` | scroll only (retained) |
| `pdfSource` | `object \| null` | pdf only; enough to reload PDF (see research R2b) |
| `pdfLegacyAnnotationsDroppedNotice` | `boolean?` | one-time notice gate |
| `typography` | object | scroll rendering (unchanged) |
| `fillableMapMode`, `checkpointsEnabled`, `criticalMode`, … | existing | unchanged semantics |
| `phase0.fillableBlanks[]` | updated blank shape | see below |

### Removed / must not reintroduce
`headingOverrides`, `structureWarnings`, `fallbackSections`, `scopeEditMode`, `scopeCollapsedParents`, `breakpoints`, `readingScope`, `currentPageIndex` (as position field).

## Annotation

```ts
type Annotation = {
  id: string;
  type: string; // 14-symbol registry + "ia-query"
  anchor:
    | {
        kind: "pdf-rect";
        page: number; // 1-indexed
        rects: Array<{ x: number; y: number; width: number; height: number }>; // 0–1
      }
    | {
        kind: "block-offset";
        blockId: string; // e.g. "b12"
        charStart: number; // local to block textContent
        charEnd: number;
      };
  snippet: string; // mandatory, non-empty on create
  userText: string;
  createdAt: number;
  aiReply: string | null;
  graphLinks: Array<{ termId: string; relation: string }>;
  isIAQuery?: true;
  orphaned?: boolean;
  skippedSteelMan?: boolean;
};
```

### Legacy Annotation (schema v1)
`{ id, type, charStart, charEnd, userText, createdAt, aiReply, graphLinks, … }` — migrated or dropped per D-MIG(a).

## FillableBlank (updated)

```ts
type FillableBlank = {
  nodeId: string;
  userText: string;
  annotationId?: string;
  /** @deprecated viewport page — stop writing; migrate away on read */
  pageIndex?: number | null;
  pdfPage?: number | null; // 1-indexed when viewerMode pdf
  blockId?: string | null; // when viewerMode scroll
};
```

## Checkpoint state
- `checkpointsDismissed: string[]` — unchanged (section ids)
- Trigger mechanism is viewer-specific; no new persisted fields required beyond optional cached `sectionPageRanges` for pdf (session-local or `readerState`, not necessarily persisted)

## shared.annotations
- **Deleted** as dual-write target. Graph reads `session.slow.annotations` only.
- Existing `shared.annotations` arrays may remain empty arrays for session-types validation until a follow-up strips the field; do not write new entries.

## Validation rules
1. New annotations: `snippet.trim().length > 0`
2. `anchor.kind` must match `viewerMode` (`pdf-rect` ↔ pdf, `block-offset` ↔ scroll)
3. PDF rects components in [0, 1]
4. Migration runs once when `annotationSchemaVersion < 2`
