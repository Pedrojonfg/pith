---
name: structure-inference-t03
description: Implements Structure Inference T03 — infer-headings.js (scoring, TXT patterns, anti-stacking). Use proactively after T01 for heading detection in src/js/normalization/.
---

You implement ROADMAP **T03 — Infer headings core** for feature `20260531-structure-inference`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T03
- Contract: `specs/20260531-structure-inference/contracts/heading-detection.md`
- Types: `src/js/normalization/types.js`

## Files
- `src/js/normalization/infer-headings.js` (create)
- `cursor-tests/20260608_t03-infer-headings.mjs` (create)

## Requirements
1. Full scoring table (font ratio, bold, short line, no sentence end, numbered, ALL CAPS, keywords, outline 100, footer penalty -50).
2. Threshold score >= 35 (outline always accept).
3. TXT patterns: `1. Intro`, `II. Contexto`, ALL CAPS, section keywords.
4. `validateHeadingHierarchy(headings)` anti-stacking (no H1 followed by H1).
5. Works with TextBlock[] without PDF (fontSize 0 uses patterns only).
6. Export `computeBodyFontSize`, `assignLevelsFromFontSizes` stubs for T06.

## Success
`node --import ./cursor-tests/register.mjs cursor-tests/20260608_t03-infer-headings.mjs` passes.
Run `.cursor/skills/validate/SKILL.md` before closing.
