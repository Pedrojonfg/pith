# Contract — HTML extraction hardening

## extractHtmlBlocks(html) → TextBlock[]

- `<h1>`–`<h6>` → `kind: "heading"`, text prefixed with `#` repeats.
- `span.mw-headline` inside `hN` → same as semantic heading, source logged as `html-tag`.
- `span.mw-headline` without `hN` parent → `kind: "heading"`, source `html-heuristic`, default level 2.
- `<table>` → paragraph block with GFM markdown table text, or labeled fallback string.

## inferHeadings(blocks, opts) → { headings, bodyFontSize, diagnostics? }

- When `headings.length === 0`, warn payload MUST include `candidateCount` and `rejectionReasons`.
- Sets `globalThis.__dppNormalizationDebug.headingInferenceDiagnostics` when bag exists.

## htmlTableToMarkdown(tableEl) → string | null

- Returns GFM table markdown or labeled fallback for nested/unsafe tables.
- Logs `console.warn` on rowspan/colspan simplification.
