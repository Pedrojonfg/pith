# Contract: PDF source availability

## Stash helper

```js
// Pseudocode contract
async function stashSharedPdfSourceFromFile(doc, file, originalFormat) → doc
// When originalFormat is pdf and file.arrayBuffer exists:
//   doc.shared.pdfSource = encodePdfSourceBase64(await file.arrayBuffer())
//   persist via saveDocumentSession (caller may batch)
// On failure: warn; leave pdfSource unset
```

## Entry paths (must call stash before File is discarded)

1. Primary create staged upload (`processCreateSessionStagedUpload`)
2. Recommend-upload (`recommendFlowFromUploadedFile`)
3. Any other path that normalizes a live PDF File into a document session (including legacy Slow generate — keep existing or redirect to helper)

## Bootstrap

`createSlowSession({ pdfSource: doc.shared?.pdfSource })` / mode-bootstrap copy remains required.

## Failure UX

Missing `slow.pdfSource` at PDF viewer open → existing string: PDF source unavailable / re-upload. No crash.
