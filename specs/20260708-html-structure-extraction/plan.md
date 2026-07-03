# Implementation Plan: HTML Structure Extraction Hardening

**Branch**: `20260708-html-structure-extraction` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

## Summary

Harden HTML normalization for browser-exported pages (Wikipedia-class): diagnostic heading inference logging, MediaWiki wrapper pattern detection, GFM table emission with safe degradation, DPP fallback telemetry, and regression fixtures.

## Technical Context

**Language**: JavaScript (ES modules), browser PWA + Node cursor-tests (JSDOM)  
**Dependencies**: DOMParser (browser/JSDOM), existing `normalization/*` pipeline  
**Testing**: `cursor-tests/*.mjs` with JSDOM for DOMParser  
**Target**: `src/js/normalization/` + `src/js/document-images/extract-html.js`  
**Constraints**: Surgical changes only; ponytail ladder; bump SW_VERSION on `src/js/**` change

## Constitution Check

- TDD: failing tests before behavior changes for new features.
- No third-party converters.
- English-only heuristics/logs.
- SW version bump mandatory.

*Gate: PASS*

## Project Structure

```text
src/js/normalization/
├── extract-html-blocks.js   # heading wrappers, table extraction
├── infer-headings.js        # diagnostics, heuristic sources
├── table-markdown.js        # shared htmlTableToMarkdown
├── emit-markdown.js         # tablesEmittedOk accounting
└── index.js                 # fallback telemetry (existing)

src/js/document-images/extract-html.js  # reuse table-markdown

cursor-tests/
├── fixtures/wikipedia-export-synthetic.html
└── 20260708_html-structure-extraction.mjs
```

## Implementation Phases

### Phase A — R2 diagnostics (T01)

Add `headingInferenceDiagnostics` to `inferHeadings`: track candidates scored, accepted, rejected with reason codes. Log on zero-heading path; write to `__dppNormalizationDebug`.

### Phase B — R1 heading patterns (T02)

Extend `inferLevelFromElement` and `extractHtmlBlocks` walk:
- `span.mw-headline` with parent `h1`–`h6` → semantic level
- standalone `span.mw-headline` or `div.mw-heading` → heuristic level 2, source `html-heuristic`
- preserve existing semantic `h*` path

### Phase C — R3 table conversion (T03)

Consolidate `htmlTableToMarkdown` in `table-markdown.js`:
- header via `<th>` or first row
- colspan duplication, rowspan warning + empty fill
- nested table → labeled fallback block
- wire into `extract-html-blocks.js` and `document-images/extract-html.js`

### Phase D — R4 telemetry (T04)

Verify `headingsFallbackUsed` flows to `input-normalization` → `document-preparation` quality signal. Add `headingInferenceDiagnostics` to DPP summary log.

### Phase E — R5 fixtures (T05)

Synthetic Wikipedia HTML fixture + integration test covering headings, tables, no fallback, diagnostics shape.

## Test Plan

- `cursor-tests/20260708_html-structure-extraction.mjs` (new)
- Re-run `20260608_t03-infer-headings.mjs`, `20260608_t07-extract-html-blocks.mjs`, `20260609_t06-regression-integration.mjs`

## Rollout / Risk

Sequence: T01 → T02 ∥ T03 → T04 + T05. Low risk; HTML-only paths.
