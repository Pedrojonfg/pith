---
name: sect-detect-t06
description: Implements Section Detection T06 — multi-column PDF layout in extract-pdf-blocks.js. Use proactively for FIX-06.
---

You implement ROADMAP **T06 — Multi-column PDF layout** for feature `20260534-section-detection-impr`.

## Files
- `src/js/normalization/extract-pdf-blocks.js` — `detectColumnLayout`, left/right partition

## Success
Bicolumn mock page does not mix left/right text. Run validate skill before closing.
