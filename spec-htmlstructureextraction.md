# HTML Structure Extraction Hardening (Headings + Tables)

## Context

Log evidence from processing a browser-exported Wikipedia HTML document (`docId: aa8a24c8e454`):

- `infer-headings.inferHeadings` → "No headings inferred", despite the source being a Wikipedia article with clear, human-visible section structure.
- `normalization.normalizeDocumentStructure` → falls back to "Equal-length section fallback" as a direct consequence — the document is chopped into arbitrary equal-size chunks instead of split along real topic boundaries.
- `emit-markdown.emitMarkdown` → "Tables detected but none emitted as markdown tables" — the Wikipedia infobox (birth date, awards, institutional affiliations, etc.) is present in the source but not converted; the structured data is lost or dumped as unstructured text.
- Downstream: concept inventory produced 37 concepts vs. an estimated target of 46 (`estimatedConceptTarget: 46`). This is correlational, not proven causal, but consistent with degraded structural signal reaching the LLM.

This is a document-processing **quality** issue, distinct from the DPP race condition in the companion spec `20260703-fix-dpp-status-race`. It is document-agnostic in principle but was surfaced by a specific input class: HTML pages saved directly from a browser, which commonly wrap heading text in non-semantic markup (e.g. Wikipedia's `<span class="mw-headline">` inside heading tags — behavior of which may also be altered by the browser's "Save As HTML" step) and encode tabular data via `<table>` structures the current extractor doesn't map to markdown tables.

## Non-goals

- Not building a general-purpose HTML-to-Markdown library from scratch — extend `normalization/extract-html-blocks.js` and related modules in place, not a rewrite.
- Not addressing PDF heading/table extraction in this spec — separate extractor, separate failure modes; follow-up spec if analogous issues are confirmed there.
- Not preserving full visual/CSS-driven table layouts (merged cells, nested tables) beyond basic row/column semantics — best-effort conversion is acceptable, not pixel-perfect fidelity.

## Rules

**R1 — Heading inference must recognize common non-semantic heading patterns, not just bare `<h1>`–`<h6>` tags.**
Extend `infer-headings.js` to detect heading structure via, in priority order: (a) actual semantic heading tags — confirm first why these didn't fire on this document, since Wikipedia's native markup does use `<h2>`/`<h3>`; (b) common CMS/export wrapper patterns, specifically MediaWiki's `<span class="mw-headline">` inside heading tags; (c) as a lower-confidence secondary heuristic only when (a) and (b) both yield nothing — heading-like formatting via inline style or class naming convention (large/bold text). Heuristic-based detections must be logged as lower-confidence, distinct from semantic detections.

**R2 — Diagnostic logging must state *why* zero headings were found.**
Current log only states "No headings inferred" with no visibility into what was tried or why candidates were rejected. Add a diagnostic payload: candidate count found before filtering, and filter/rejection reasons. This must be sufficient to debug a future failure of this kind without re-instrumenting the code.

**R3 — Table detection must convert to markdown tables, not just detect and drop.**
Extend `emit-markdown.js` to emit GFM-style markdown tables (`| col | col |` with header separator row) for detected `<table>` elements. Handle: header row detection (`<th>`, or first `<tr>` as fallback), basic rowspan/colspan via cell duplication or omission with a logged warning, and empty-cell handling. If a table is too structurally complex to convert safely (e.g. deeply nested tables), fall back to a labeled plain-text block (`[Table: could not convert — N rows, M cols]`) instead of silently dropping content, so the presence of lost data is at least visible downstream.

**R4 — Equal-length section fallback must be a visible, logged degradation, not a silent one.**
When `normalizeDocumentStructure` falls back to equal-length sections, surface this signal up to DPP telemetry (not just a console log), so fallback frequency is eventually visible in a debug/admin context. No UI required now — just ensure the signal survives past the console.

**R5 — Add Wikipedia-style HTML as a first-class test fixture.**
Add the browser-exported Wikipedia HTML pattern (or a synthetic equivalent covering `.mw-headline` headings + an infobox table) to the `normalization/*` test fixture set, so this exact regression is caught automatically going forward.

## Implementation sequence (risk-ordered)

1. R2 (diagnostic logging) — no behavior change; needed to verify R1 actually fixes the root cause rather than guessing at it.
2. R1 (heading detection patterns) — core fix; addresses the equal-length fallback at its source.
3. R3 (table → markdown conversion) — independent of R1, can be built/tested in parallel.
4. R4 (fallback visibility) — cheap, low risk; do after R1 lands so real fallback frequency can be measured.
5. R5 (test fixture) — should land alongside R1/R3, not after, to prevent regression during their implementation.

## Testing checklist

- [ ] Re-run the exact Wikipedia HTML file from this bug report through the pipeline; confirm `inferHeadings` finds a non-zero, sensible heading set matching the article's real sections.
- [ ] Confirm the equal-length section fallback no longer triggers for this document.
- [ ] Confirm the infobox table is emitted as a markdown table in `shared.rawMarkdown`, with key/value pairs recognizable (e.g. birth date, field, institutions).
- [ ] Confirm concept inventory count for this document increases and more plausibly approaches the estimated target once structure is preserved (informational signal, not a hard pass/fail — LLM output count isn't deterministic).
- [ ] Run the existing normalization test suite to confirm no regression on previously-working PDF / plain-HTML / MD inputs.
- [ ] Confirm a deliberately malformed/complex table (nested or with colspan) degrades to the labeled fallback block rather than crashing or silently vanishing.

## Open questions for Cursor

- Does the current HTML extractor already strip `<span class="mw-headline">` wrappers before heading inference runs, which could explain why semantic `<h2>` tags weren't picked up even though Wikipedia's native markup should include them? (Worth confirming what the actual uploaded file's raw HTML structure looks like, since browser "Save As HTML" can alter this.)
- What table-parsing utility, if any, already exists in the codebase that could be extended, vs. needing new code in `emit-markdown.js`?
- Should the equal-length fallback threshold/behavior itself become tunable, or is "avoid triggering it via better heading detection" sufficient for now?
