# ROADMAP — html-structure-extraction

**Feature:** specs/20260708-html-structure-extraction | **Spec:** specs/20260708-html-structure-extraction/spec.md | **Plan:** specs/20260708-html-structure-extraction/plan.md  
**Created:** 2026-07-08

## Dependency diagram

```
T01 (diagnostics)
 ├── T02 (heading patterns)
 └── T03 (table conversion)
      ├── T04 (telemetry)
      └── T05 (fixtures + tests)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02, T03 | parallel |
| 3 | T04, T05 | parallel |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Heading inference diagnostic payload (R2) | — | sequential | [x] |
| T02 | MediaWiki heading patterns (R1) | T01 | parallel | [x] |
| T03 | GFM table conversion hardening (R3) | T01 | parallel | [x] |
| T04 | DPP fallback telemetry wiring (R4) | T02 | parallel | [x] |
| T05 | Wikipedia fixture + integration tests (R5) | T02,T03 | parallel | [x] |

## Prompt per task

### T01 — Heading inference diagnostics
**Spec ref:** FR-002, User Story 3 | **Plan ref:** Phase A | **Files:** `src/js/normalization/infer-headings.js`  
**Success criterion:** Zero-heading warn includes `candidateCount` and `rejectionReasons`; debug bag gets `headingInferenceDiagnostics`.  
**On close:** `/validate` and mark `[x]`.

### T02 — MediaWiki heading patterns
**Spec ref:** FR-001, User Story 1 | **Plan ref:** Phase B | **Files:** `src/js/normalization/extract-html-blocks.js`, `src/js/document-images/extract-html.js`  
**Success criterion:** `span.mw-headline` and wrapper patterns produce heading blocks; heuristic source distinct from semantic.  
**On close:** `/validate` and mark `[x]`.

### T03 — GFM table conversion
**Spec ref:** FR-003, FR-004, User Story 2 | **Plan ref:** Phase C | **Files:** `src/js/normalization/table-markdown.js`, `src/js/normalization/extract-html-blocks.js`, `src/js/document-images/extract-html.js`  
**Success criterion:** Infobox tables emit GFM; nested tables get labeled fallback.  
**On close:** `/validate` and mark `[x]`.

### T04 — DPP telemetry
**Spec ref:** FR-005, User Story 4 | **Plan ref:** Phase D | **Files:** `src/js/document-preparation.js`, `src/js/input-normalization.js`  
**Success criterion:** DPP summary includes `headingInferenceDiagnostics`; fallback in quality signal.  
**On close:** `/validate` and mark `[x]`.

### T05 — Wikipedia fixture + tests
**Spec ref:** FR-006, SC-001–SC-004 | **Plan ref:** Phase E | **Files:** `cursor-tests/fixtures/wikipedia-export-synthetic.html`, `cursor-tests/20260708_html-structure-extraction.mjs`  
**Success criterion:** New test file green; regressions green.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-07-08 (none created)
