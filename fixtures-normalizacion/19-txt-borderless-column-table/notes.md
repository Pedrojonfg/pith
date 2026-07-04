# Fixture 19: txt-borderless-column-table

**Source:** IETF RFC 791, "INTERNET PROTOCOL" (September 1981), `https://www.rfc-editor.org/rfc/rfc791.txt`. This fixture is a **hand-assembled excerpt**, not a single contiguous download: I combined the title page, the Table of Contents, the Fragmentation/Gateways discussion (section 2.4), and the Internet Header Format section (3.1) including its two ASCII bit-field diagrams, from the real RFC text — with an explicit bracketed gap marker showing where content was skipped for length.

**Why this curation approach, disclosed honestly:** RFC 791 is long; rather than truncate arbitrarily or include the whole document, I selected the specific passages that best stress-test the table-detection weak spot, and marked the seam clearly: `[... document continues; excerpt resumes at section 2.3-3.1 below ...]`. This bracketed text was added by me during assembly — it is not part of the original RFC and must not be mistaken for real content or a genuine heading.

**Three concentrated false-positive risks:**
1. **Table of Contents** — classic dot-leader formatting (`1.1 Motivation .................................................... 1`), same risk pattern as fixture 16 but in plain text rather than a Word-exported PDF.
2. **Figure 3 (Gateway Protocols)** — a literal ASCII box-drawing diagram (`+-+-+-+` borders, `|` cell walls) depicting network topology. This is the closest match to the "architecture diagram" example named explicitly in the original task brief.
3. **Figure 4 (Internet Datagram Header)** and the smaller **Type-of-Service bit diagram** — the famous IP-header bit-layout diagrams: a row of bit-position numbers over boxed field-name cells (`|Version|IHL|Type of Service|...|`). These are extremely table-like in raw monospace text (regular separators, header-like numeric row, cell-like labels) while being semantically a bit-field diagram, not tabular data.

**Confidence:** High — all three false-positive candidates and the dot-leader ToC were directly present in the source text I combined (verified by re-reading the assembled file). `needs_human_review: true` per task instructions for anything touching table false-positive risk.
