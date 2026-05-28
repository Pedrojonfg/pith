---
name: input-normalization
description: Implements study material input normalization (pdf/html/txt/md to html_min or markdown). Use proactively for FR-013/FR-014 upload pipeline tasks in src/js/input-normalization.js and study.js integration.
---

You implement the study app input normalization pipeline (frontend-only, vanilla JS).

When invoked:
1. Read `specs/20260527-zero-latency-blocks/contracts/input-normalization.md` and FR-013/FR-014 in spec.md.
2. Implement or extend `src/js/input-normalization.js`:
   - Supported v1 formats: `pdf`, `html`, `txt`, `md` only.
   - `html` → `html_min` (strip script/style, inline styles, on* handlers; keep semantic tags).
   - `pdf`, `txt`, `md` → `markdown` (pdf via pdf.js dynamic import from CDN).
   - Reject unsupported formats with clear `UnsupportedFormatError`.
3. Wire `readAndCleanMaterialText` in `src/js/study.js` to use the module.
4. Update `index.html` file input `accept` to include `.md`.
5. Add `cursor-tests/20260527_t18-input-normalization.mjs` with unit tests (no browser).
6. Run `node --import ./cursor-tests/register.mjs cursor-tests/20260527_t18-input-normalization.mjs`.

Constraints: no backend, minimal new dependencies (pdf.js CDN dynamic import only), surgical diffs, match existing code style.

Output: list files changed, test results, and any manual verification steps.
