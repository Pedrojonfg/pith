# Fixture 14: txt-gutenberg-short-doc

**Source:** Project Gutenberg eBook #1, *The Declaration of Independence*. Gutenberg's license/boilerplate header and footer were deliberately trimmed since they are packaging metadata, not part of the document itself — a curation choice disclosed here rather than done silently.

**Inspection method:** Direct `wc`, `head`, and grep on the file.

**Structure:** Deliberately minimal — exactly one heading (the title), then continuous prose. The middle section is a ~26-paragraph anaphoric list of grievances, nearly all beginning with "He has ..." or "For ...", verified directly via grep. This repetitive sentence-initial pattern is a mild structural-inference stress test: it should read as ordinary prose (or an unordered list at most), not be mistaken for a table or a run of headings just because of the repeated leading tokens.

**A note on process, for full transparency:** During drafting I initially wrote a placeholder ellipsis ("[...the document continues with a list of grievances...]") into this file by mistake, even though I already had the complete real text. I caught this myself and replaced it with the full verbatim text before finalizing. The current `input.txt` is complete and verbatim, not a placeholder.

**A second finding, caught by verification and then resolved:** an independent verification pass noticed this file ends right after "...our sacred Honor" with no signatories block (no John Hancock, no list of the ~56 other signers), and flagged this as an undisclosed omission. I re-fetched the live Gutenberg source directly to check whether this was a mistake on my part. It was not: Gutenberg eBook #1's own transcriber's note (part of the source, trimmed here along with the rest of the boilerplate) explains that the transcriber found inconsistent signer names/placement across historical facsimiles and deliberately chose to leave the signatures out of this specific edition ("which names I have left out"). So `input.txt` is a complete, faithful reproduction of this Gutenberg edition's operative text — nothing is missing that should be there.

**Confidence:** High. Not a named weak-spot category, so `needs_human_review` is false (the earlier true-positive catch by verification was checked against the live source and resolved as correct-as-is, not a defect).
