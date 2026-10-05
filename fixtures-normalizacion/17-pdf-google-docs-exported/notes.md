# Fixture 17: pdf-google-docs-exported

**Source:** Synthetic stand-in for a Google Docs syllabus exported via `/export?format=pdf`. School, teacher, email, phone, and address are fictional (Northwillow Middle School; Ms. A. Calder; `a.calder@northwillow.example`; `(555) 010-0142`). 1 page, under 5 KB. PDF title metadata is `Syllabus Template`. The file is not a live Google Docs download.

**Inspection method:** `pdftotext -layout` run directly on the PDF.

**Content note:** Despite the title "Syllabus Template," the body is a specific fictional 7th-grade math class syllabus, not empty placeholder headings. That keeps the fixture in the same shape as a real Google-Docs-exported syllabus without real contact information.

**The interesting structural finding:** every organizational label in this document (BASIC TEXT, COURSE CONTENT, REQUIRED MATERIALS, EVALUATION PROCEDURES, CLASSROOM RULES, HOMEWORK LATE POLICY, PROJECT LATE POLICY, COMMENTS, HOMEWORK, EXTRA HELP) is a **run-in label** — it appears at the start of a paragraph immediately followed by body text on the same line (e.g., "BASIC TEXT: Illustrative Math, Course 2. This is a soft cover math book...") rather than occupying its own heading line. I verified this directly by reading the extracted text. This is a distinct and realistic heading-detection failure mode: any heuristic that requires a heading to be the sole content of its line or block will find zero headings anywhere in this document's body, even though a human reader clearly recognizes these ALL-CAPS colon-terminated labels as informal section markers.

**Secondary finding:** a small grade-cutoff scale and category-weighting list appear side-by-side near the end, spaced like a tab-separated Google Doc layout — an ambiguous case for whether this should be extracted as a table at all.

**Confidence:** High on the structural observations (directly read from extracted text). `needs_human_review: true` because the run-in-label heading pattern is a genuinely open design question, not a clear-cut pass/fail.
