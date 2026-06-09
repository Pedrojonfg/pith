---
name: structure-inference-t08-t12
description: Implements Structure Inference T08–T12 — emitters, integration, headings.js h1–h6, integration tests, QA closure. Use proactively after T05–T07 complete.
---

You implement ROADMAP **T08–T12** for feature `20260531-structure-inference`.

## T08
- `emit-markdown.js`, `emit-html-min.js` with charStart/charEnd

## T09
- Full pipeline in `normalization/index.js`
- `input-normalization.js` delegates; warnings + structure v2

## T10
- `slow/headings.js` → `#{1,6}` and `<h([1-6])>`

## T11
- `cursor-tests/20260608_t01-structure-inference.mjs`
- Regression `20260527_t18-input-normalization.mjs`

## T12
- Verify quickstart scenarios; mark ROADMAP [x]

Run `.cursor/skills/validate/SKILL.md` before closing.
