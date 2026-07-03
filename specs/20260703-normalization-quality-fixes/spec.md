# Spec — Document Preparation Pipeline: Normalization Quality Fixes

**Status:** Ready for implementation  
**Supersedes:** None. Additive fixes to existing DPP normalization phases (T0.1–T1.1) and the diagnostic instrumentation added in the recent test round.

## Context

A structured diagnostic pass (diagnostic instrumentation + manual test matrix across 5 documents: scanned PDF, native-text PDF, pdf2htmlEX-generated pseudo-HTML, genuine semantic HTML from Wikipedia, and a re-test of the native PDF for math notation) surfaced four confirmed defects in the normalization pipeline. This spec addresses all four. Root causes were isolated via source inspection and console diagnostics, not inferred — see Evidence subsections per rule.

## Non-goals

- Do NOT integrate any third-party document-conversion library or service (e.g., Marker/Datalab, LlamaParse). All fixes are internal logic corrections.
- Do NOT change the LLM providers, models, or DPP phase structure.
- Do NOT attempt OCR of scanned PDFs via a dedicated OCR engine — use existing Gemini vision (`gemini-2.0-flash`) as the fallback path, consistent with existing `document-images` infrastructure.
- Do NOT build a general-purpose HTML→Markdown converter replacement. Fix the existing extraction path's handling of heading tags specifically.
- Do NOT resolve the math-notation question definitively in this spec (see R5 — flagged as open, lower confidence in root cause).
- Do NOT remove the consolidated end-of-pipeline summary logs that become load-bearing for quality signals (see R6).

## R1 — Table detection is non-functional across all tested inputs (P0)

**Evidence:**
- Native-text PDF (Attention is All You Need, 3 real tables in source): `tablesDetected: 0`.
- Genuine semantic HTML (Wikipedia, 2 real `<table>` elements confirmed via source inspection): `tablesDetected: 57`, `tablesEmittedOk: 0`.
- Zero successful table emissions across every test in the matrix, regardless of format or detection count.

**Diagnosis required before fix:** The 57-vs-2 discrepancy indicates the current table-detection logic is not actually parsing `<table>` boundaries — it is likely triggering on a proxy signal (pipe characters, repeated whitespace/column-like patterns, or citation/reference formatting) that superficially resembles tabular structure. This must be found and diagnosed by reading the current implementation before writing a fix; do not patch symptomatically.

**Rules:**
- **R1.1** — For HTML sources: table detection MUST anchor on actual `<table>` DOM elements (or their markdown-equivalent post-conversion, if conversion happens before this stage — see R1.3), not on text-pattern heuristics.
- **R1.2** — For PDF sources: table detection MUST use a real signal (column alignment via `pdf.js` positional data — x-coordinates of text runs forming consistent column boundaries across multiple lines) rather than character-density or pattern heuristics, if not already doing so. Confirm current PDF table-detection approach against source before changing it.
- **R1.3** — Once a table is detected, it MUST be emitted as valid markdown table syntax (`| col | col |` with header separator row) in the normalized output. `tablesEmittedOk` must reflect actual successful markdown table emission, not detection alone.
- **R1.4** — Add a hard sanity check: if `tablesDetected` exceeds a configurable ceiling relative to document length (placeholder: 1 table per 2,000 characters — calibrate post-launch), log a `console.warn` flagging likely false-positive detection instead of silently proceeding.
- **R1.5** — `tablesEmittedOk === 0` while `tablesDetected > 0` must never pass silently through the pipeline as `confidence: 'high'` (ties into R4).

## R2 — HTML heading tags are lost during HTML→Markdown conversion, causing heading inference to fail on well-structured input (P0)

**Evidence:**
- Wikipedia source HTML confirmed (via direct file inspection) to contain 18 real semantic headings (`<h1>`, `<h2>`, `<h3>` with proper `id` attributes).
- Pipeline output: `"No headings inferred"` → `"Equal-length section fallback"` → deterministic hierarchy fallback, with `hasMarkdownHeadings: false`.
- Root cause is upstream: the HTML→canonical markdown conversion is not translating `<h1>`–`<h6>` tags into markdown heading syntax (`#`, `##`, etc.) before `infer-headings.js` runs.

**Rules:**
- **R2.1** — Locate the HTML→markdown conversion step in the extraction path and confirm whether `<h1>`–`<h6>` tags are currently mapped to markdown `#` syntax at all. Report findings before implementing — this may be a missing mapping rule entirely.
- **R2.2** — Implement direct mapping: `<h1>` → `# `, `<h2>` → `## `, `<h3>` → `### `, etc., preserving heading text content, applied during HTML extraction/normalization before the markdown reaches `infer-headings.js`.
- **R2.3** — After this fix, `infer-headings.js` should detect these via its existing markdown-pattern method; no changes to `infer-headings.js` should be needed if R2.2 is correctly scoped.
- **R2.4** — Regression check: confirm this fix does not affect the native-PDF path, where headings are already detected via `font-size`/pattern methods. PDF path is out of scope for this rule.

## R3 — No fallback to vision-based extraction when a page yields near-zero text (P0)

**Evidence:**
- Scanned PDF test: 17 of 18 pages logged `charCount: 0`, yet `extractionPath: 'text-native'` was used — no alternate path triggered.
- Total document yield: 4,130 characters from an 18-page document — near-total extraction failure.
- Pipeline still completed with `status: 'ready'`, generating concepts/hierarchy with no user-facing indication.

**Rules:**
- **R3.1** — When a PDF page's extracted character count falls below the low-extraction threshold (calibrate; current placeholder ~50 chars), the page MUST be flagged for vision-based extraction, not merely logged and passed through.
- **R3.2** — Route flagged pages through the existing Gemini vision pipeline (`gemini-2.0-flash`), rendering the page to an image (via `pdf.js` canvas rendering, consistent with existing image handling) and requesting text extraction in place of failed text-layer extraction.
- **R3.3** — Vision-extracted text MUST be merged into the document's markdown output in correct page order and be distinguishable in internal metadata per page (e.g., `extractionPath: 'vision-fallback'`).
- **R3.4** — If vision fallback also fails or returns insufficient content for a majority of pages (placeholder threshold: >50% still under the low-extraction floor after fallback), the DPP MUST NOT proceed to `status: 'ready'` silently (see R4.3).
- **R3.5** — Vision fallback should only trigger for flagged pages, not the full document, to avoid unnecessary Gemini calls.

## R4 — No document-quality confidence signal reaches the user; broken extractions are indistinguishable from clean ones (P0)

**Evidence:**
- All test documents completed with `status: 'ready'`, regardless of extraction quality.
- Normalization output already carries an extraction `confidence` field, but it’s not surfaced or used to gate or warn.

**Rules:**
- **R4.1** — Define a composite document-quality signal computed at the end of T1.1, combining: extraction confidence, proportion of low-extraction pages (even after R3), whether `tablesDetected > 0` but `tablesEmittedOk === 0`, and whether heading detection fell back to equal-length sectioning.
- **R4.2** — Persist this as `shared.preparation.qualitySignal` (or best schema location per `session-types.js`) with a simple tier: `good` / `degraded` / `poor`. No numeric score.
- **R4.3** — When the tier is `poor`, the DPP MUST NOT silently complete as `status: 'ready'`. Surface a non-blocking warning at the create→study transition (enough: “This document may not have processed correctly — review before studying”).
- **R4.4** — When the tier is `degraded`, no warning required, but it must be logged and persisted for future UI surfacing.

## R5 — Math notation extraction: inconclusive, tracked for follow-up (P2)

**Rules:**
- **R5.1** — No code change is authorized under this spec for math handling. Tracking only.

## R6 — Disposition of diagnostic instrumentation

**Rules:**
- **R6.1** — Per-page verbose `console.warn` calls added during diagnostics MUST be removed or downgraded (e.g., `console.debug`).
- **R6.2** — Consolidated end-of-pipeline summary logs SHOULD be retained permanently as structured `console.info` logs; they become load-bearing for R4.
- **R6.3** — Remove any “diagnostic tag” comment markers from logging retained permanently (it’s now product logging).

## Implementation sequence (risk-ordered)

1. **R2** — heading preservation.
2. **R1** — table detection (diagnose first).
3. **R3** — vision fallback for scanned pages.
4. **R4** — quality signal + user warning.
5. **R6** — log cleanup.
6. **R5** — no implementation.

## Testing checklist

- [ ] Re-run the full 5-document test matrix (scanned PDF, native PDF, pdf2htmlEX pseudo-HTML, Wikipedia HTML, plus one new HTML/table-bearing document).
- [ ] Confirm R1: Wikipedia tables: detection drops from ~57 false positives to ~2 real tables, and render as valid markdown tables.
- [ ] Confirm R1: Attention PDF detects and emits 3 real tables.
- [ ] Confirm R2: Wikipedia headings are detected via markdown-pattern method (no deterministic fallback).
- [ ] Confirm R3: scanned PDF shows `extractionPath: 'vision-fallback'` on previously-empty pages and yields substantially more text.
- [ ] Confirm R4: `poor` tier surfaces a non-blocking warning; `good` tier shows no warning.
- [ ] Confirm no regression: native PDF heading detection remains healthy.

