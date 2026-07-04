# Fixture 18: pdf-table-split-across-pages

**Source:** U.S. Bureau of Labor Statistics news release, "County Employment and Wages – Fourth Quarter 2025" (USDL-26-0782), fetched directly from `https://www.bls.gov/news.release/pdf/cewqtr.pdf` (567 KB, 16 pages).

**Inspection method:** `pdftotext -layout` + `pdfinfo` run directly; verified the table's continuation pattern via grep for its caption text across the whole document.

**Structure confirmed:** Table 1 ("Covered establishments, employment, and wages in the 373 largest counties, fourth quarter 2025") spans the majority of the document. Its caption plus a full two-level column header (top level: "Employment" / "Average weekly wage ²" grouping several sub-columns each) repeats verbatim — with "- Continued" appended — at the top of 7 additional pages beyond its original appearance (8 total occurrences of the "Table 1." caption), confirmed directly via grep. Body rows use dot-leader fill characters between each county name and its first numeric column, a legitimate in-table alignment device (contrast with fixture 16, where dot-leaders appear in a Table of Contents that is *not* a table).

**Correction from independent verification:** an earlier draft of this fixture's rubric claimed "11+ repetitions," which turned out to conflate Table 1's own caption repeats with separate "- Continued" occurrences belonging to Table 2 and Table 3 later in the same document. A verification pass caught this and the rubric has been corrected to the precise, re-verified count of 8 (1 original + 7 continuations) for Table 1 specifically. This correction is recorded here for transparency rather than silently fixed.

**Why this matters:** This is the canonical test of whether a normalizer correctly merges a table's repeated-caption-and-header continuations across pages into one logical 373-row table, rather than treating each page as a fresh, separate small table.

**File-handling note:** this PDF's local file briefly got locked open in Adobe Acrobat during the file-organizing phase of this session (an accidental rename attempt opened it instead of renaming it); it was recovered by copying the file, renaming the copy to `input.pdf`, then closing Acrobat and removing the original locked file. The final `input.pdf` was re-verified via `pdfinfo`/`pdftotext` after recovery and its content is unaffected.

**Confidence:** High — the continuation pattern was directly verified via repeated grep matches, not assumed from the caption text alone.
