# Fixture 04: pdf-scanned-poor-ocr

**Source:** FBI Vault FOIA release "Klaus Fuchs Part 36" (Rosenberg case files, atomic espionage investigation, 1949-1976), downloaded directly from `https://vault.fbi.gov/rosenberg-case/klaus-fuchs/Klaus%20Fuchs%20Part%2036/at_download/file` (same-origin direct download, 6.6 MB, 100 pages).

**Inspection method:** `pdftotext`, `pdffonts`, and grep run directly on the extracted text (not through Pith).

**What makes this "poor OCR":** Unlike fixture 03, this document genuinely has an embedded OCR text layer (Helvetica/Helvetica-Bold Type 1 fonts present), but the OCR quality is bad: words are frequently merged with no spaces ("toyouor thesubjectof yourrequest"), character order is scrambled in places, and there are long runs of stray punctuation and dash-like noise characters scattered throughout.

**Why this is the primary false-positive-table stress test:** A grep across the extracted text found 279 lines containing dash-runs or pipe-like characters (e.g. `-1-.`, `._.`, `,_ _.`) that superficially resemble table borders or column-separator sequences. None of these are real tables — the underlying source document is continuous free-running investigative memo prose with no tabular structure at all. If Pith's column-alignment heuristic (the named weak spot) fires on any of this noise and reports a table, that is a confirmed false positive, not a judgment call. I flagged `expected_no_table_zones` accordingly and marked `needs_human_review: true` at the fixture level per the task's instruction to never rubber-stamp entries related to this specific weak spot.

**Other noise:** at least 3 instances of the standard FBI "FOIPA Deleted Page Information Sheet" redaction boilerplate recur through the document (same template seen in fixture 03).

**Confidence:** Medium overall (OCR noise makes some claims inherently fuzzy — I could not manually verify every one of the 100 pages), but high confidence specifically on the "no real tables exist" claim, since the source is verifiably continuous prose/correspondence with no structural tables in the underlying document type (FBI investigative memos of this era do not contain tables).
