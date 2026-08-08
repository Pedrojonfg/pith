# Contract: IA context viewerMode

## buildIAContext / askSlowReaderIA

| viewerMode | Boundary | Context body |
|------------|----------|--------------|
| `"scroll"` (default) | `maxReadCharEnd` | `normalizedTextFull.slice(0, max)` |
| `"pdf"` | `maxReadPdfPage` | Concatenated text of PDF pages `1..maxReadPdfPage` (inclusive), then existing `.slice(-120000)` cap |

## Invariants

- PDF + unset `maxReadCharEnd` MUST NOT yield empty context solely for that reason when `maxReadPdfPage >= 1` and pages have text.
- Context MUST NOT include page `maxReadPdfPage + 1` or higher.
- Scroll behavior unchanged.
