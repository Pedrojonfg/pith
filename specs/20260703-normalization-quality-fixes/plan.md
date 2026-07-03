# Plan — Normalization Quality Fixes

## Goal

Fix four confirmed normalization defects in the Document Preparation Pipeline (DPP):

- **R2**: Preserve semantic HTML headings in HTML→Markdown conversion.
- **R1**: Make table detection/emission real (HTML anchored to `<table>`, PDF anchored to pdf.js positional signals) and stop false-positive storms.
- **R3**: Add per-page vision fallback for PDFs with near-zero text extraction.
- **R4**: Compute and persist a discrete document quality tier and surface a non-blocking warning on `poor`.

## Constraints

- No new third-party converters/OCR engines; reuse existing internal logic and existing vision infrastructure.
- Do not change LLM providers/models or the pipeline phase structure.
- Scope is surgical: only files required to implement R1–R4 (+ R6 log cleanup).

## Design / Approach

### Heading preservation (R2)

- Find the HTML normalization path that produces canonical markdown (or markdown-like) text.
- Ensure `<h1>`–`<h6>` become markdown headings (`#` … `######`) before `infer-headings.js`.
- Keep PDF handling untouched; validate no regressions.

### Table detection & emission (R1)

- **Diagnose first**: locate the current “table detection” trigger(s) producing 57 detections on a 2-table HTML doc.
- For HTML: only detect tables from actual DOM `<table>` elements (or a faithful representation), and emit markdown tables reliably.
- Add a ceiling-based warn if detections are implausibly high relative to document size.
- Ensure `tablesEmittedOk` reflects successful emission, not just detection.

### Vision fallback for low-extraction pages (R3)

- During PDF extraction, compute per-page extracted char counts.
- For pages under a low-extraction threshold, render the page to an image and run the existing vision extraction.
- Merge vision text into output in page order, recording per-page `extractionPath` (e.g. `text-native` vs `vision-fallback`).
- Ensure fallback triggers only for flagged pages.

### Quality signal tiers & warning (R4)

- At end of preparation (post T1.1), compute a discrete tier: `good | degraded | poor`.
- Inputs:
  - extraction confidence already produced by normalization
  - share of low-extraction pages (after R3)
  - tables detected but not emitted
  - headings fell back to equal-length sectioning
- Persist to shared/session structure (exact schema location determined by existing `session-types.js`).
- If `poor`: show a non-blocking warning at create→study transition. If `degraded`: persist/log only.

### Log cleanup (R6)

- Remove/downgrade per-page noisy warnings; keep consolidated info logs required for the quality signal.

## Test plan

- Use existing `cursor-tests/` harness.
- Add or update tests to cover:
  - HTML heading conversion produces markdown `#` lines.
  - Table detection in HTML is anchored to real `<table>` elements; PDF table detection signal does not produce storms.
  - Low-extraction page triggers vision fallback and merges in correct order.
  - Quality tier persisted and `poor` surfaces warning (UI-level test).
- Run full relevant test suite and ensure no regressions.

## Rollout / Risk

- Implement in the risk-ordered sequence: **R2 → R1 → R3 → R4 → R6**.
- Keep thresholds as named constants and log “calibration needed” warnings where placeholders are used.

