---
name: structure-inference-t07
description: Implements Structure Inference T07 — extract-html-blocks.js (infer headings before style strip). Use proactively after T01 for HTML block extraction.
---

You implement ROADMAP **T07 — Extract HTML blocks** for feature `20260531-structure-inference`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T07
- Research R8: `specs/20260531-structure-inference/research.md`
- Types: `src/js/normalization/types.js`

## Files
- `src/js/normalization/extract-html-blocks.js` (create)
- `cursor-tests/20260608_t07-extract-html-blocks.mjs` (create)

## Requirements
1. Parse DOM **before** stripping styles.
2. Detect: h1–h6, [role=heading][aria-level], classes Heading1/title/chapter.
3. Inline style font-size, font-weight inference.
4. Promote blocks to `kind: "heading"` with inferred level.
5. Word export fixture: `<p class="Heading1">Capítulo 1</p>` → heading block.

## Success
`node --import ./cursor-tests/register.mjs cursor-tests/20260608_t07-extract-html-blocks.mjs` passes.
Run `.cursor/skills/validate/SKILL.md` before closing.
