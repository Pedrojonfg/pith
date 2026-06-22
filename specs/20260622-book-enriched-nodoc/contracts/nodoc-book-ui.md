# Contract: Nodoc book search UI

## Entry

`createSessionNoFileBtn` → `enterBookSearchScreen()` when `isBookLookupEnabled()`; else `enterInterviewCaptureScreen()`.

## Panels (single section `#bookSearchPanel` in interview flow area)

| Panel | Visible when | Actions |
|-------|--------------|---------|
| search | default | Buscar → `lookupBook`; Continue without search → interview (no bookMeta) |
| confirm | Level A or B | Este es el libro → save bookMeta + interview; Search again → search panel |
| levelC | Level C | Continue anyway → save Level C bookMeta + interview; Search again |

## Cover render rules

Render `<img>` only when `coverUrlVerified && coverFormatSupported && coverSizeOk`. `onerror` → hide img, set `coverLoadFailed`.

## Flag gate

When `BOOK_LOOKUP_ENABLED === false`, no book UI; no-file goes directly to interview.
