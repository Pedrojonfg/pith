# Research — HTML Structure Extraction Hardening

## R1 — Why Wikipedia headings failed despite semantic markup

**Decision**: Support both semantic `<h*>` and MediaWiki wrapper patterns; browser "Save As HTML" often emits `span.mw-headline` inside or without heading parents.

**Rationale**: `extract-html-blocks.js` already maps `<h2>` to heading blocks with `#` prefix. Failures occur when save-as strips tags or nests content in `div` wrappers only. `infer-headings.js` accepts `kind === "heading"` blocks — upstream extraction must emit them.

**Alternatives considered**: Changing only `infer-headings.js` — rejected; heading text never reaches inference if extraction skips wrappers.

## R2 — Table emission path

**Decision**: Convert `<table>` during HTML block extraction to markdown table text in block payload; `emit-markdown.js` passes through and counts via `countMarkdownTables`.

**Rationale**: Tables are not separate block kind today; markdown table text in paragraph blocks is the minimal path. PDF uses separate table detection in `extract-pdf-blocks.js` (out of scope).

**Alternatives considered**: New `kind: "table"` block type — rejected as over-engineering for v1.

## R3 — Colspan/rowspan/nested tables

**Decision**: Best-effort colspan via cell duplication; rowspan logs warning and leaves empty cells; nested tables emit `[Table: could not convert — N rows, M cols]`.

**Rationale**: Matches spec non-goals for pixel-perfect fidelity while preserving visibility of lost structure.

## R4 — DPP telemetry

**Decision**: Reuse existing `__dppNormalizationDebug.headingsFallbackUsed` → `computeDocumentQualitySignal` → `shared.preparation.qualitySignal`. Add `headingInferenceDiagnostics` to debug bag for operator visibility.

**Rationale**: R4 infrastructure exists from normalization-quality-fixes; extend rather than duplicate.

## R5 — Equal-length fallback tuning

**Decision**: Out of scope — fix heading detection instead of changing 5000-char threshold.
