# Fixture 15: txt-gutenberg-heavy-footnotes ⚠️ NAME MISMATCH — SEE BELOW

**Source:** English Wikipedia "Rosalind Franklin" article — lead section + References section (first 35 of 340 total citations), captured live via in-browser DOM extraction.

**⚠️ Folder name mismatch, disclosed honestly:** This folder is named for an earlier plan (a Project Gutenberg book with heavy footnotes). During the research phase, two independent attempts to locate accessible footnote text within a suitable Gutenberg book both came back empty-handed — both attempts correctly reported "footnote text not found/accessible" rather than inventing content, and I accepted those honest failure reports rather than pushing for a fabricated answer. The approach was pivoted to Wikipedia's citation-heavy "Rosalind Franklin" article instead, which exercises the same underlying axis (a document dominated by heavy footnote/citation apparatus) even though it's HTML, not a Gutenberg `.txt`. I'm flagging this directly rather than quietly renaming the folder or hiding the discrepancy.

**A second disclosure — synthetic content I added myself:** While extracting this excerpt via a JavaScript snippet, I inserted my own marker heading, `<h2>References (truncated: showing 35 of 340 total)</h2>`, into the saved HTML purely so a human inspecting the fixture would know it's a partial excerpt. This is NOT real Wikipedia content — it's fixture-authoring metadata that happens to be literally present in `input.html`. I've flagged it explicitly in `rubric.json` so it isn't mistaken for either genuine article content or an unexplained Pith artifact.

**Structure:** 1 title (H1), then References (H2) with Citations and Sources (H3) subsections. 35 citation list items (out of 340 on the live article) inside a `<ol class="mw-references references">` — not a table.

**Confidence:** High on all directly-verified structural facts. Not a named weak-spot category, so `needs_human_review` is false, but the two disclosures above are important context for anyone using this fixture.
