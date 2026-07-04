# Fixture 08: html-wikitable-bordered-mergedcells

**Source:** English Wikipedia "List of Nobel laureates in Physics", header row plus first 40 data rows, captured live via in-browser DOM extraction.

**Inspection method:** Direct grep of the raw HTML for `<table>` class, `rowspan`/`colspan` attribute counts, and header cell structure.

**Structure confirmed:** A single genuine `class="wikitable"` (bordered) table with a real two-level merged header (rowspan=2 on Year/Country/Citation/Reference(s); colspan=2 on "Laureate" splitting into Image/Name sub-columns) plus in-body rowspans for years with multiple co-laureates. 19 rowspan + 18 colspan attributes confirmed across 41 total `<tr>` rows.

**Why this fixture matters:** It's the positive control for table detection — a real, complex, legitimately-tabular dataset that should be correctly detected and reconstructed, in contrast to fixtures 04/05/06 which test false-positive rejection. Pith should report exactly one table here with the correct row/column footprint.

**Confidence:** High — structure was directly verified via grep, not assumed from the Wikipedia article's general reputation for using wikitables.
