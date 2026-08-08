# Data Model: Native Viewer Post-Ship Fixes 01

## shared.pdfSource

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `"base64"` \| `"arrayBuffer"` | Durable form is `"base64"` |
| `data` | string \| ArrayBuffer | base64 string when persisted |

**Owner:** `session.shared.pdfSource`  
**Copy on Slow enter:** `session.slow.pdfSource` (via `createSlowSession` / mode-bootstrap)  
**Invariant:** If `uploadMeta.originalFormat === "pdf"` on a **new** upload after this fix, `shared.pdfSource` SHOULD be set unless encode failed (then re-upload message is allowed).

## slow.annotationSchemaVersion

| Field | Type | Notes |
|-------|------|-------|
| `annotationSchemaVersion` | number | Target `2`; default treat missing as `1` |

**Invariant:** After successful migration on load, version `2` and migrated `annotations` are persisted in the **same** save.

## slow.pdfLegacyAnnotationsDroppedNotice

| Field | Type | Notes |
|-------|------|-------|
| `pdfLegacyAnnotationsDroppedNotice` | boolean | Set when PDF legacy anns dropped |
| `pdfLegacyAnnotationsDroppedNoticeShown` | boolean (optional) | Set after one-time UI shown; or clear the gate flag after show — pick one pattern and keep it single-write with session persist |

## Annotation.orphaned

Unchanged shape from parent feature. Consumers MUST consult this flag when using position fields (`anchor`, block ids, PDF rects, char ranges).

## Validation rules

1. Do not invent a second pdfSource shape.
2. Migration must not duplicate annotations when re-run.
3. Orphan skip lists are allowlists of position-sensitive call sites, not a global filter on `annotations[]`.
