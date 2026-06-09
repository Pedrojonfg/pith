---
name: sect-detect-t01
description: Implements Section Detection T01 — tolerant outline matching in pdf-outline.js (normalizeForComparison, encoding fixups). Use proactively for FIX-01.
---

You implement ROADMAP **T01 — Outline text normalization** for feature `20260534-section-detection-impr`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T01
- Contract: `specs/20260534-section-detection-impr/contracts/outline-matching.md`

## Files
- `src/js/normalization/pdf-outline.js`

## Requirements
1. `normalizeForComparison`, `applyEncodingFixups`, `matchScore`, `matchScoreFallback`
2. `computeOutlineCoverage(matches, outline)` export
3. Update `matchOutlineToBlocks` to use new scoring; threshold ≥50
4. `cursor-tests/20260609_t01-outline-normalize.mjs`

## Success
Run `.cursor/skills/validate/SKILL.md` before closing.
