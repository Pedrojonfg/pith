# Fixture 10: html-irregular-heading-nesting

**Source:** Same Smashing Magazine article as fixture 07, but extracted as just the `<article>` subtree (no surrounding nav/cookie-banner/footer chrome) to isolate the heading-nesting phenomenon from noise.

**Inspection method:** Direct grep of the raw HTML for all heading tags in document order.

**Verified exact heading sequence:** H1 → H4 → H4 → H2 → H2 → H2 → H2 → H3 → H3 → H2 → H3. This is a genuine, non-synthetic example of non-monotonic heading nesting: the page jumps from H1 straight to H4 (twice, for an author-bio box and a newsletter signup box), drops back to H2 for the real article sections, goes to H3 for two promotional sub-boxes, jumps back UP to H2 for the comments section header, then down to H3 for the comment form.

**Why this matters:** Any structure-inference logic that assumes heading depth increases monotonically (i.e., builds a tree assuming each heading nests under the most recent shallower one) will misinfer this document's outline — for instance, incorrectly treating the H4 author-bio and newsletter boxes as deeply-nested sub-sections of the H1 title, rather than recognizing them as same-level sibling UI elements that merely use a smaller heading tag for styling reasons.

**Confidence:** High — the heading sequence was directly grepped from the raw markup, not inferred or estimated. Not one of the two explicitly named weak-spot categories (heading semantics / table false-positives), so `needs_human_review` is false, though this is very much a "structure inference" stress test per the original task brief.
