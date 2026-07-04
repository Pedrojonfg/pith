# Pith Normalization TDD Fixtures

This directory contains 20 real, freely-licensed or public-domain documents assembled to test Pith's document-normalization pipeline (heading detection, table detection, structure inference), with emphasis on three known weak spots:

1. **Heading detection on non-semantic HTML** — e.g. MediaWiki's `.mw-headline` span wrappers, which can contaminate or hide real heading text.
2. **Table detection false positives** — the column-alignment heuristic misfiring on things that merely *look* tabular (ASCII diagrams, navigation chrome, OCR noise, Tables of Contents).
3. **Unvalidated math/notation detection** — LaTeX equations, chemical formulas expressed as HTML `<sub>`/`<sup>`, and other non-obvious notation representations.

Every fixture was inspected directly (reading the raw file, running `pdftotext`/`pdfinfo`/`pdffonts`/grep, or reading the live DOM) — **not** by running Pith's own normalizer first. Each `fixtures/NN-description/` folder contains:

- `input.*` — the real source document (`.pdf`, `.html`, `.md`, or `.txt`)
- `rubric.json` — a structured checklist of verifiable claims about the document's expected structure (not a full expected-output diff)
- `notes.md` — inspection method, findings, and honest caveats

Do not treat any `rubric.json` as ground truth without reading its `confidence` and `needs_human_review` fields first — several fixtures surfaced real surprises during direct inspection (documented below and in each fixture's own notes.md).

## Fixture index

| # | Folder | Axis covered | Format |
|---|--------|---------------|--------|
| 01 | `01-pdf-native-arxiv-attention` | Native LaTeX PDF baseline, bordered tables, heavy math | PDF |
| 02 | `02-pdf-native-arxiv-math` | Native LaTeX PDF, math-heavy (equations embedded in headings) | PDF |
| 03 | `03-pdf-scanned-good-ocr` | Scanned PDF — **turned out to have NO OCR layer at all** (see gaps below) | PDF |
| 04 | `04-pdf-scanned-poor-ocr` | Scanned PDF, genuinely poor OCR quality, table false-positive risk from OCR noise | PDF |
| 05 | `05-html-mediawiki-nonsemantic-headings` | MediaWiki `mw-headline`/`mw-editsection` heading contamination + navbox table false positives | HTML |
| 06 | `06-html-mediawiki-nonlatin-russian` | Non-Latin script (Cyrillic) + MediaWiki heading wrapper (with an extra legacy-anchor-span wrinkle) | HTML |
| 07 | `07-html-blog-noise-realworld` | Real-world nav/cookie-banner/footer noise on a live blog page | HTML |
| 08 | `08-html-wikitable-bordered-mergedcells` | Legitimate complex table: bordered, two-level merged header, in-body rowspans | HTML |
| 09 | `09-html-chemistry-notation` | Chemistry notation via HTML `<sub>`/`<sup>` (no LaTeX/MathML at all) | HTML |
| 10 | `10-html-irregular-heading-nesting` | Non-monotonic heading level sequence (H1→H4→H4→H2→H2→H2→H2→H3→H3→H2→H3) | HTML |
| 11 | `11-md-github-readme` | Clean markdown baseline, GFM pipe table, image-only H1 | Markdown |
| 12 | `12-md-github-readme-ascii-diagram` | ASCII box-drawing diagram inside a code fence — table false-positive risk | Markdown |
| 13 | `13-txt-gutenberg-book-length` | Book-length document (intentionally truncated mid-sentence, disclosed) | TXT |
| 14 | `14-txt-gutenberg-short-doc` | Very short document (<1 page), repetitive anaphoric list | TXT |
| 15 | `15-txt-gutenberg-heavy-footnotes` | Heavy citation/footnote apparatus (folder name is a legacy mismatch, disclosed) | HTML |
| 16 | `16-pdf-word-exported-report` | Word-exported PDF, Roman-numeral headings, dot-leader ToC table false-positive risk | PDF |
| 17 | `17-pdf-google-docs-exported` | Google-Docs-exported PDF; all section labels are run-in (same-line), not isolated heading lines | PDF |
| 18 | `18-pdf-table-split-across-pages` | Real table with repeated caption+header across 11+ pages — must be merged, not fragmented | PDF |
| 19 | `19-txt-borderless-column-table` | Hand-assembled RFC excerpt: ToC dot-leaders + ASCII network diagram + bit-field diagrams (3 concentrated false-positive risks) | TXT |
| 20 | `20-html-clean-baseline-no-math-no-table` | Intended clean baseline — **turned out to be Wikipedia's "article not found" system page** (see gaps below) | HTML |

## Review-status table

Per the task's instructions, entries related to false-positive table risk and non-semantic headings must never be rubber-stamped. The table below flags every fixture with `needs_human_review: true` and/or any `confidence: low`/`medium` items in its rubric.

| # | Fixture | Rubric confidence | needs_human_review | Why |
|---|---------|--------------------|---------------------|-----|
| 03 | pdf-scanned-good-ocr | high | **true** | Folder name promises "good OCR" but the PDF has zero OCR text layer (pure image scan) — a real mismatch, not a judgment call. |
| 04 | pdf-scanned-poor-ocr | medium | **true** | Genuine poor OCR; 279 lines of OCR noise resemble table borders — primary false-positive-table stress test. |
| 05 | html-mediawiki-nonsemantic-headings | high | **true** | Primary weak-spot #1 test (mw-editsection contamination) + incidental navbox table false positives. |
| 06 | html-mediawiki-nonlatin-russian | high | **true** | Same as #05 plus an extra legacy-anchor-span layer unique to non-Latin titles. |
| 09 | html-chemistry-notation | high | **true** | Math-detection may miss `<sub>`/`<sup>`-based chemical notation entirely; table-worthiness of the infobox is a genuine judgment call. |
| 12 | md-github-readme-ascii-diagram | high | **true** | ASCII box-drawing diagram inside a code fence is a close analogue of the "architecture diagram" false-positive risk named in the task brief. |
| 16 | pdf-word-exported-report | medium | **true** | Dot-leader Table of Contents is a plausible false-positive-table trigger; example-table content in the body was not exhaustively verified (flagged low-confidence). |
| 17 | pdf-google-docs-exported | high | **true** | All section labels are run-in (same-line as body text), not isolated heading lines — an open design question, not a pass/fail. |
| 19 | txt-borderless-column-table | high | **true** | Concentrates three separate ASCII-diagram / bit-field / dot-leader false-positive risks by design. |
| 20 | html-clean-baseline-no-math-no-table | high | **true** | Turned out to be Wikipedia's "article not found" system page, not real encyclopedia prose — still zero-table/zero-math, but a materially different kind of content than planned. |

Fixtures not listed above (01, 02, 07, 08, 10, 11, 13, 14, 15, 18) had no `needs_human_review` flags and no sub-`high` confidence items, though every rubric.json is still worth spot-checking before being treated as an automated test oracle.

## Known gaps and honest limitations

- **Fixture 03** does not actually fulfill its "good OCR" axis — see the review-status table above. A replacement source (e.g. a modern GovInfo.gov scanned congressional hearing transcript with a genuine OCR layer) would need a valid package ID looked up through GovInfo's own search UI; one speculative URL guess did not resolve and further guessing wasn't a good use of time.
- **Fixture 20** does not contain real encyclopedia article prose — see the review-status table above. Two replacement candidates were tried (`Ballantinia`: has 3 tables; `Ultracrepidarianism`/`Ne supra crepidam`: has 9 headings) and neither was a strictly better fit for "zero tables, minimal headings" than the page already captured.
- **Fixture 15**'s folder name (`...gutenberg-heavy-footnotes`) is a legacy artifact from an abandoned plan to use a Project Gutenberg book; two independent research attempts honestly reported they could not locate accessible footnote text in a suitable Gutenberg book, so the fixture was pivoted to a citation-heavy Wikipedia article instead. The actual content (`input.html`) correctly reflects this pivot; only the folder name is stale.
- **Fixture 13** is intentionally truncated mid-sentence (a tool-imposed cache limit during research), well before the end of the source book. This is disclosed in the fixture's own notes.md and is not meant to be "fixed" — Pith is only expected to normalize the text actually present.
- No fixture in this set is a genuinely novel/synthetic document — all 20 are real, unmodified (or explicitly disclosed as trimmed/combined) excerpts from real, freely-licensed or public-domain sources, per the original task requirement to avoid synthesized approximations.

## Licenses represented

Public domain (U.S. government works: fixtures 03, 04, 14, 16, 18, 19; pre-1928 literary works: fixture 13), CC BY-SA 4.0 (Wikipedia excerpts: fixtures 05, 06, 08, 09, 15, 20), MIT-licensed open-source project READMEs (fixtures 11, 12), arXiv's perpetual non-exclusive license (fixtures 01, 02), and copyrighted live-web content captured strictly for software-testing purposes under fair-use-style technical evaluation (fixture 07; publicly-shared Google Doc for fixture 17).
