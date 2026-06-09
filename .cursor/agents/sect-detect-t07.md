---
name: sect-detect-t07
description: Implements Section Detection T07 — dehyphenation in emit-markdown.js. Use proactively for FIX-07.
---

You implement ROADMAP **T07 — Dehyphenation** for feature `20260534-section-detection-impr`.

## Files
- `src/js/normalization/emit-markdown.js` — `dehyphenate(text)`
- `src/js/normalization/index.js` — apply before persist

## Success
`intrinseca-\nmente` → `intrinsecamente`; `Korsgaard-\nMueller` intact. Run validate skill.
