# Contract: Slow annotation & viewerMode

**Feature**: `20260808-slow-mode-native-viewer`

## createSlowSession
- MUST set `slow.viewerMode` from `originalFormat === "pdf" ? "pdf" : "scroll"`.
- MUST initialize position fields for that mode only.
- MUST set `annotationSchemaVersion: 2` for new sessions (empty annotations).
- MUST NOT set `currentPageIndex` as reading position.

## Annotation CRUD
- `addAnnotation` accepts new anchor shape + snippet; rejects empty snippet.
- No call to `addAnnotationToShared`.
- `updateAnnotation` / `deleteAnnotation` operate on `session.slow.annotations` only.

## Migration `migrateSlowAnnotations(session)`
- Idempotent via `annotationSchemaVersion`.
- Scroll: legacy → `block-offset` + snippet; unresolvable → `orphaned: true`.
- PDF: clear legacy annotations; set notice flag once.

## Graph adapter
- `resolveEnrichedGraphInputs` MUST use `session.slow.annotations`.
- `mapSharedAnnotations` removed or unused.

## Viewer dispatch
- `viewerMode === "pdf"` → pdf-reader module (canvas + text layer).
- `viewerMode === "scroll"` → scroll-reader path (continuous markdown/plain).

## Proximity (unvalidated placeholders)
- Scroll steel-man / Phase3 / graph: block-index delta ≤ 3 (or scored by delta).
- PDF: same page, or adjacent if annotation in top/bottom 15% of page.

## Tests that must stay green unmodified
- `cursor-tests/20260610_paced-reader-pagination.mjs`
- Scope-gate contracts listed in spec §16.1 equivalents (`20260806_t08/t09/t10` as applicable)
- Full-bleed layout `20260533_t01` / `t03` behavioral intent
