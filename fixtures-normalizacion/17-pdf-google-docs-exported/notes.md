# Fixture 17: pdf-google-docs-exported

**Source:** A publicly-viewable Google Doc titled "Syllabus Template", exported directly via Google Docs' `/export?format=pdf` endpoint (which sets `Content-Disposition: attachment`, so it downloads automatically without any special handling needed). 2 pages, 109 KB. PDF metadata confirms `Producer: Skia/PDF m151 Google Docs Renderer`.

**Inspection method:** `pdftotext -layout` run directly on the PDF.

**Surprise finding from direct inspection:** Despite the source title "Syllabus Template," the actual exported content is a specific, real 7th-grade math class syllabus for Robert K. Shafer Middle School in Bensalem, PA (teacher name, room number, and email included) — not generic placeholder template text. This doesn't change the fixture's validity (it's still a genuine Google-Docs-PDF-export sample), but it's worth knowing the content isn't abstract boilerplate.

**The interesting structural finding:** every organizational label in this document (BASIC TEXT, COURSE CONTENT, REQUIRED MATERIALS, EVALUATION PROCEDURES, CLASSROOM RULES, HOMEWORK LATE POLICY, PROJECT LATE POLICY, COMMENTS, HOMEWORK, EXTRA HELP) is a **run-in label** — it appears at the start of a paragraph immediately followed by body text on the same line (e.g., "BASIC TEXT: Illustrative Math, Course 2. This is a soft cover math book...") rather than occupying its own heading line. I verified this directly by reading the extracted text. This is a distinct and realistic heading-detection failure mode: any heuristic that requires a heading to be the sole content of its line or block will find zero headings anywhere in this document's body, even though a human reader clearly recognizes these ALL-CAPS colon-terminated labels as informal section markers.

**Secondary finding:** a small grade-cutoff scale and category-weighting list appear side-by-side near the end, likely tab-separated in the original Google Doc — an ambiguous case for whether this should be extracted as a table at all.

**Confidence:** High on the structural observations (directly read from extracted text). `needs_human_review: true` because the run-in-label heading pattern is a genuinely open design question, not a clear-cut pass/fail.
