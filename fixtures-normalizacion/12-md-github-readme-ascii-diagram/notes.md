# Fixture 12: md-github-readme-ascii-diagram

**Source:** FastAPI (Python web framework) README, fetched from `https://raw.githubusercontent.com/tiangolo/fastapi/master/README.md`, lightly trimmed.

**Inspection method:** Direct grep of the raw markdown for heading lines, code-fence boundaries, and pipe-character lines.

**The false-positive risk, precisely characterized:** Inside a ` ```console ` fenced code block (lines 90-111), the README includes a genuine ASCII box-drawing mockup of the `fastapi dev` CLI startup banner. I checked the actual Unicode codepoint used for the vertical bars: it's U+2502 (BOX DRAWINGS LIGHT VERTICAL), not the ASCII pipe U+007C that real markdown tables use — so a character-exact check would correctly ignore it. However, a column-alignment-style heuristic (looking for characters that visually line up in columns across consecutive lines, which is what the task brief specifically names as the risky approach) would still see 8 consecutive lines with a vertical character aligned at the same column position — structurally identical to what such a heuristic looks for in a real table.

**Why this is a strong test case:** It's a close, real-world analogue to the "architecture diagrams" example given explicitly in the original task brief, but in a markdown/plain-text context rather than an image. It also tests whether Pith respects fenced-code-block boundaries before running structural inference — if code-fence content is treated as opaque, this false positive can't happen at all; if structure inference runs on raw text first, it's much more exposed to this risk.

**Confidence:** High — the exact codepoint and code-fence boundaries were directly verified, not assumed. `needs_human_review: true` per the task's explicit instruction for anything touching false-positive table risk.
