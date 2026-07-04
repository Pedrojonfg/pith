# Fixture 16: pdf-word-exported-report

**Source:** HUD (U.S. Department of Housing and Urban Development) "PD&R Style Guide: Preparing a Report for Publication" (November 2023), fetched directly from `https://www.huduser.gov/portal/About/style-guide-for-reports.pdf` (640 KB, 46 pages). PDF metadata confirms `Creator: Acrobat PDFMaker 23 for Word` / `Producer: Adobe PDF Library 23.6.136` — a genuine Word-to-PDF export, not a native LaTeX or scanned document.

**Inspection method:** `pdftotext -layout` + `pdfinfo` run directly; heading structure and Table of Contents verified via grep for Roman-numeral section markers and dot-leader patterns.

**Structure confirmed:** 6 top-level Roman-numeral sections (I. Where and How to Begin, through VI. Citations and References for PD&R Reports), each with nested sub-headings (front matter elements, style rules, etc.) — verified directly.

**False-positive risk identified:** The Table of Contents (pages ii-iii) uses classic Word dot-leader formatting — "Heading text .......................... N" — with the page numbers right-aligned at a consistent column position across dozens of lines. This is a plausible trigger for a column-alignment table heuristic, so I flagged it explicitly in `expected_no_table_zones`.

**Honest gap:** I did not exhaustively page through all 46 pages to locate and verify every example table/exhibit the style guide itself illustrates (it's a guide about formatting reports, so it plausibly contains its own example tables). I confirmed a "List of Exhibits" front-matter entry exists but flagged the actual table content as `confidence: low` rather than guessing at specifics.

**Confidence:** High on heading structure and the ToC false-positive risk (both directly verified); low on the exact count/location of any illustrative example tables within the body. `needs_human_review: true` because of the table false-positive risk, per task instructions.
