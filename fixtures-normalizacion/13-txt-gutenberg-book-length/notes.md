# Fixture 13: txt-gutenberg-book-length

**Source:** Project Gutenberg eBook #84, *Frankenstein; or, the Modern Prometheus* by Mary Wollstonecraft Shelley (public domain, author died 1851).

**⚠️ Honest disclosure — this fixture is intentionally incomplete:** During research, this text was fetched through a tool with a hard truncation limit, and the saved excerpt cuts off mid-sentence ("...I saw the lightning playing on the summit of Mont Blanc in") partway through Chapter 7 — confirmed directly via `tail`. The book's own CONTENTS block (present in the file, lines 9-40) lists Letters 1-4 and Chapters 1-24, but only Letters 1-4 and Chapters 1-7 actually exist in this file (confirmed via grep for `^Letter`/`^Chapter` — exactly 11 heading lines found, matching Letters 1-4 + Chapters 1-7).

**Why I'm keeping it instead of re-fetching:** This is documented as the intended "book-length" fixture and the truncation was disclosed rather than hidden. It also incidentally creates a legitimate, useful test: a document whose own table-of-contents promises more sections than the body actually contains. Pith should reflect the actual body content (11 headings) rather than trusting the ToC's count of 28.

**Inspection method:** Direct `wc`, `grep`, `head`, and `tail` on the file.

**Confidence:** High — both the truncation point and the ToC/body mismatch were directly verified, not assumed. Not one of the two named weak-spot categories, so `needs_human_review` is false, but the truncation should be understood by anyone using this fixture.
