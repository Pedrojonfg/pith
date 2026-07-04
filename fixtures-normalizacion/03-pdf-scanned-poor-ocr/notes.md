# Fixture 03: pdf-scanned-good-ocr ⚠️ NAME MISMATCH — SEE BELOW

**Source:** FBI Vault FOIA release "Threats Against Members of Congress- 2003 (Final)", downloaded directly from `https://vault.fbi.gov/threats-against-members-of-congress/Threats%20Against%20Members%20of%20Congress-%202003%20%28Final%29/at_download/file` (same-origin direct download, 1.7 MB, 58 pages).

**⚠️ Important honesty flag:** This fixture's folder name promises "good OCR" but direct inspection revealed the PDF has **no OCR text layer at all** — it is a pure image scan. I verified this three ways:
- `pdftotext input.pdf -` produces zero characters of output.
- `pdffonts input.pdf` lists zero fonts (no text objects exist in the file).
- `pdfimages -list input.pdf` shows one full-page CCITT Group 4 (fax-style) stencil image per page, 58 images total, produced by "TIFF2PDF Utility for HighView".

This is a legitimate and useful test case in its own right (many real-world scanned government PDFs genuinely have no OCR layer), but it does **not** fulfill the axis this fixture was meant to cover ("scanned PDF with good-quality OCR text"). I flagged `needs_human_review: true` and explained the mismatch directly in `rubric.json`'s `review_reason` field rather than quietly relabeling it to fit.

**Why I didn't just find a replacement:** I attempted one alternative source (a GovInfo.gov congressional hearing transcript) but the specific package ID I tried did not resolve, and further speculative URL-guessing against govinfo.gov's package-ID scheme was not a good use of remaining time. This is an honest gap — see the top-level README's gap table.

**Recommendation for a human:** Either (a) accept this fixture as testing "scanned PDF with zero OCR text layer" and rename the folder accordingly in a follow-up pass, or (b) replace it with an actual good-OCR scanned document (a good candidate class: modern GovInfo.gov congressional hearing PDFs, which typically do carry a real, fairly clean OCR/text layer — would need a valid package ID looked up via GovInfo's search UI rather than guessed).

**Confidence:** High on all technical findings (they were verified directly with `pdftotext`/`pdffonts`/`pdfimages`, not assumed). The mismatch itself is exactly the kind of thing flagged rather than rubber-stamped, per the task's instructions.
