---
name: structure-inference-t05
description: Implements Structure Inference T05 — pdf-outline.js (getOutline, dest resolution, block matching). Use proactively after T04 for PDF outline heading extraction.
---

You implement ROADMAP **T05 — PDF outline** for feature `20260531-structure-inference`.

## Files
- `src/js/normalization/pdf-outline.js`
- `cursor-tests/20260608_t05-pdf-outline.mjs`

## Requirements
- `extractPdfOutline(doc)` → `{ title, pageIndex, level, children }[]`
- Resolve named dest with `getDestination`
- `matchOutlineToBlocks(outline, blocks)` → `HeadingCandidate[]` with `source: "outline"`, score 100

Run `.cursor/skills/validate/SKILL.md` before closing.
