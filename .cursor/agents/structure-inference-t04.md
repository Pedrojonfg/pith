---
name: structure-inference-t04
description: Implements Structure Inference T04 — extract-pdf-blocks.js (pdf.js lines, font height, Y clustering). Use proactively after T01 for PDF block extraction.
---

You implement ROADMAP **T04 — Extract PDF blocks** for feature `20260531-structure-inference`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T04
- Research R4: `specs/20260531-structure-inference/research.md`
- Types: `src/js/normalization/types.js`

## Files
- `src/js/normalization/extract-pdf-blocks.js` (create)
- Minimal refactor: export `loadPdfJs` from `input-normalization.js` for reuse
- `cursor-tests/20260608_t04-extract-pdf-blocks.mjs` (create)

## Requirements
1. `clusterTextItemsToBlocks(items, pageIndex)` — pure function testable with mock TextItem[].
2. `extractPdfBlocks(buffer)` — uses pdf.js getTextContent per page.
3. Y clustering tolerance ~2pt on transform[5].
4. `fontHeight = Math.hypot(c, d)` from transform matrix [a,b,c,d,e,f].
5. Return TextBlock[] sorted reading order with fontSize > 0.

## Success
`node --import ./cursor-tests/register.mjs cursor-tests/20260608_t04-extract-pdf-blocks.mjs` passes.
Run `.cursor/skills/validate/SKILL.md` before closing.
