# Fixture 11: md-github-readme

**Source:** chalk (npm terminal-styling library) README, fetched from `https://raw.githubusercontent.com/chalk/chalk/main/readme.md`, lightly trimmed.

**Inspection method:** Direct grep of the raw markdown for ATX heading lines (`^#`) and pipe-table lines (`^|`).

**Notable finding:** The document's very first "heading" is raw HTML, not markdown ATX syntax: `<h1 align="center">...<img src="media/logo.svg">...</h1>` — and it contains no text at all, just an embedded logo image. This is a genuine real-world edge case for title inference (what is "the title" when the visual H1 is image-only?).

**Table:** One clean GFM pipe table (`| Level | Description |` under "### chalk.level") with 4 data rows, center+left column alignment markers, and inline code spans inside cells. Verified directly by grep.

**Confidence:** High throughout — this is a clean, unambiguous markdown document. Included as the low-risk markdown baseline, paired with fixture 12 which adds an ASCII-art false-positive-table risk.
