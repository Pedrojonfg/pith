---
name: markdown-canonical-t02
description: Implements Markdown Canonical T02 — input-normalization.js facade + v3 contract. Use proactively after T01 completes.
---

You implement ROADMAP **T02 — Fachada input-normalization v3** for feature `20260532-markdown-canonical`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T02
- Contract: `specs/20260532-markdown-canonical/contracts/input-normalization-v3.md`
- Depends on T01 (pipeline already emits markdown for HTML)

## Files
- `src/js/input-normalization.js` — response always `normalizedFormat: "markdown"`; update JSDoc header

## Requirements
1. `normalizeStudyMaterial(html)` → `normalizedFormat: "markdown"`.
2. Remove fallback `format === "html" ? "html_min" : "markdown"` — always markdown.
3. Keep v2 compat fields: `structure`, `warnings`.
4. Update file header comment (no longer `html → html_min`).
5. `scopeTextForPhase0IA` and `htmlMinToPlainText` may remain for legacy session read path (T03).

## Success
- `normalizeStudyMaterial` with HTML file returns markdown format.
- Run `.cursor/skills/validate/SKILL.md` before closing.

## Constraints
- T01 must be done first; if pipeline still returns html_min, fix T01 first or coordinate.
