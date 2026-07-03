# Feature Specification: HTML Structure Extraction Hardening

**Feature Branch**: `20260708-html-structure-extraction`  
**Created**: 2026-07-08  
**Status**: Ready for implementation  
**Input**: Harden browser-exported HTML normalization — heading inference for CMS wrapper patterns, diagnostic logging, GFM table emission, equal-length fallback telemetry, Wikipedia regression fixture.

## User Scenarios & Testing

### User Story 1 — Wikipedia-style HTML preserves section structure (Priority: P1)

As a learner uploading a browser-saved Wikipedia article, I want the document split along real section headings so study modes receive coherent topical chunks instead of arbitrary equal-length slices.

**Why this priority**: Root cause of degraded concept inventory and hierarchy for a common input class.

**Independent Test**: Process synthetic Wikipedia-export HTML; `inferHeadings` returns a non-zero heading set matching visible sections; equal-length fallback does not trigger.

**Acceptance Scenarios**:

1. **Given** HTML with `<h2><span class="mw-headline">Early life</span></h2>`, **When** normalized, **Then** markdown contains `## Early life` and heading inference finds it.
2. **Given** HTML with `div` + `span.mw-headline` (no semantic heading tag), **When** normalized, **Then** section title is detected as a lower-confidence heuristic heading.
3. **Given** a long Wikipedia article HTML fixture, **When** normalized, **Then** equal-length section fallback does not run.

---

### User Story 2 — Infobox tables survive as markdown tables (Priority: P1)

As a learner, structured infobox data (birth date, field, affiliations) must appear as readable markdown tables in `shared.rawMarkdown`, not vanish as unstructured text.

**Independent Test**: HTML with infobox `<table>` emits GFM `| col |` syntax; `tablesEmittedOk` matches emitted count.

**Acceptance Scenarios**:

1. **Given** a simple two-column infobox table, **When** normalized, **Then** output contains a valid GFM table with key/value pairs.
2. **Given** a table with `colspan`, **When** converted, **Then** cells are duplicated or omitted with a logged warning; output remains valid markdown.
3. **Given** a nested or deeply complex table, **When** conversion is unsafe, **Then** a labeled fallback block `[Table: could not convert — N rows, M cols]` appears instead of silent content loss.

---

### User Story 3 — Operators can debug zero-heading failures (Priority: P2)

As a developer debugging normalization, when heading inference returns zero results I need a diagnostic payload explaining what was tried and why candidates were rejected.

**Acceptance Scenarios**:

1. **Given** a document where inference yields zero headings, **When** logs are inspected, **Then** candidate count and rejection reasons (below threshold, artifact, no pattern match) are present.

---

### User Story 4 — Equal-length fallback is visible in DPP telemetry (Priority: P2)

As an operator reviewing document preparation quality, equal-length section fallback must survive past console into persisted preparation metadata.

**Acceptance Scenarios**:

1. **Given** equal-length fallback triggers, **When** DPP completes T1.1, **Then** `headingsFallbackUsed` is true in normalization debug summary and quality signal reasons include `heading_fallback`.

---

### Edge Cases

- Browser "Save As HTML" may strip semantic `<h*>` tags — heuristic path must still find `mw-headline` spans.
- Empty table cells → preserved as empty markdown cells.
- PDF inputs → out of scope; no regression on PDF heading/table paths.
- DOMParser unavailable (Node tests use JSDOM) → fallback path unchanged.

## Requirements

### Functional Requirements

- **FR-001**: Heading inference MUST recognize, in priority order: (a) semantic `<h1>`–`<h6>`; (b) MediaWiki `span.mw-headline` inside or without heading parents; (c) lower-confidence heading-like inline style/class heuristics when (a) and (b) yield nothing. Heuristic detections MUST be logged as lower-confidence, distinct from semantic detections.
- **FR-002**: When zero headings are inferred, diagnostic logging MUST include candidate count before filtering and filter/rejection reasons sufficient to debug without re-instrumentation.
- **FR-003**: Detected HTML `<table>` elements MUST emit GFM markdown tables with header row detection (`<th>` or first `<tr>` fallback), basic `colspan`/`rowspan` handling, and empty-cell handling.
- **FR-004**: Structurally unsafe tables MUST degrade to a labeled plain-text block, not silent drop.
- **FR-005**: Equal-length section fallback MUST set `headingsFallbackUsed` on the normalization debug bag and flow into DPP quality signal telemetry.
- **FR-006**: A Wikipedia-style synthetic HTML fixture MUST be added to the normalization test suite covering `.mw-headline` headings and an infobox table.

### Key Entities

- **HeadingCandidate**: label, level, score, source (`html-tag` | `html-heuristic` | `font-size` | `pattern` | `outline`), blockId.
- **NormalizationDebugBag**: `headingsInferred`, `headingsBySource`, `headingsFallbackUsed`, `headingInferenceDiagnostics`, `tablesDetected`, `tablesEmittedOk`.
- **StructureReport**: `headingCount`, `confidence`, `warnings` (includes `low_heading_confidence` when fallback runs).

## Success Criteria

- **SC-001**: Wikipedia fixture produces ≥3 inferred headings and zero equal-length fallback for documents >5000 chars.
- **SC-002**: Infobox fixture emits ≥1 valid GFM table; `tablesEmittedOk ≥ 1` when `tablesDetected ≥ 1`.
- **SC-003**: Zero-heading diagnostic payload includes `candidateCount` and `rejectionReasons` object.
- **SC-004**: Existing structure-inference cursor-tests remain green (no regression on PDF/txt/md).

## Assumptions

- Extending `extract-html-blocks.js`, `infer-headings.js`, `table-markdown.js`, and `emit-markdown.js` in place — no third-party HTML→Markdown library.
- PDF heading/table extraction is out of scope.
- Equal-length fallback threshold/behavior tuning is out of scope; better heading detection is sufficient for v1.
- Overlaps with `20260703-normalization-quality-fixes` are complementary; this feature focuses on CMS wrapper patterns, diagnostics, and table conversion hardening.

## Non-goals

- General-purpose HTML→Markdown library rewrite.
- PDF heading/table fixes.
- Pixel-perfect table layout fidelity (merged cells beyond basic duplication).
- UI for quality signals (telemetry only).
