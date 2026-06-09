---
name: markdown-canonical-t05
description: Implements Markdown Canonical T05 — update cursor-tests t18, structure-inference, new canonical test. Use proactively after T02 completes.
---

You implement ROADMAP **T05 — Tests y regresión** for feature `20260532-markdown-canonical`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T05
- Depends on T01 + T02

## Files
- `cursor-tests/20260608_t01-markdown-canonical.mjs` (create or consolidate)
- `cursor-tests/20260527_t18-input-normalization.mjs` — update HTML expectations → markdown
- `cursor-tests/20260608_t01-structure-inference.mjs` — update HTML expectations

## Requirements
1. HTML upload tests expect `normalizedFormat: "markdown"` not `html_min`.
2. Assert no HTML tags in normalized content for HTML inputs.
3. All listed tests pass with `node --import ./cursor-tests/register.mjs`.

## Success
Run full set:
```
node --import ./cursor-tests/register.mjs cursor-tests/20260608_t01-markdown-canonical.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260527_t18-input-normalization.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260608_t01-structure-inference.mjs
```
Run `.cursor/skills/validate/SKILL.md` before closing.
