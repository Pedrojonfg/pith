# Tasks — Normalization Quality Fixes

## T01 — Implement HTML heading tag → Markdown heading mapping (R2)

- **Spec ref**: R2
- **Plan ref**: Heading preservation (R2)
- **Files**:
  - `src/js/normalization/**` (HTML extraction / conversion path)
  - `cursor-tests/**` (new/updated regression)
- **Success**:
  - HTML inputs with `<h1>`–`<h6>` produce markdown `#` headings.
  - Heading inference uses markdown-pattern detection (no deterministic fallback) for well-structured HTML.

## T02 — Diagnose and fix table detection/emission (R1)

- **Spec ref**: R1
- **Plan ref**: Table detection & emission (R1)
- **Files**:
  - `src/js/normalization/**` (HTML & PDF extraction)
  - `src/js/document-preparation.js` / relevant orchestrators
  - `cursor-tests/**`
- **Success**:
  - HTML table detection anchored to real `<table>` elements.
  - `tablesDetected` is plausible; `tablesEmittedOk > 0` when tables exist.
  - False-positive storms log a warning and cannot yield `confidence: 'high'`.

## T03 — Add per-page vision fallback for low-extraction PDF pages (R3)

- **Spec ref**: R3
- **Plan ref**: Vision fallback (R3)
- **Files**:
  - `src/js/normalization/extract-pdf-blocks.js` (or equivalent PDF extraction)
  - existing vision pipeline modules
  - `cursor-tests/**`
- **Success**:
  - Pages below the threshold route through vision and merge output in order.
  - Metadata marks `extractionPath: 'vision-fallback'` per affected page.

## T04 — Compute and persist quality tier + surface `poor` warning (R4)

- **Spec ref**: R4
- **Plan ref**: Quality signal tiers & warning (R4)
- **Files**:
  - `src/js/**` (session types/store + UI transition code)
  - `index.html` if UI element required
  - `cursor-tests/**`
- **Success**:
  - Tier `good | degraded | poor` persisted in the appropriate shared/session location.
  - `poor` shows non-blocking warning at create→study transition; `degraded` does not warn.

## T05 — Log cleanup (R6)

- **Spec ref**: R6
- **Plan ref**: Log cleanup (R6)
- **Files**:
  - any files touched by T01–T04 where noisy per-page logs exist
- **Success**:
  - Per-page noisy warnings removed/downgraded; consolidated summary logs remain and are structured.

