# Implementation Plan: Read Mode

**Branch**: `20260705-read-mode` | **Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)

## Summary

Add Read mode: `modes.read` slice, static textbook renderer on `screenTest`, `visualNeed` on block JSON, lazy image/diagram resolution via prefetch, Mermaid CDN + dark theme.

## Technical Context

- **Stack**: Vanilla JS ES modules, existing RSVP block pipeline
- **Key modules**: `read-mode.js`, `read-visuals.js`, `api.js` (`generateBlockDiagram`), `study.js`, `session.js`
- **Testing**: `cursor-tests/20260705_read-mode.mjs`

## Research decisions

See [research.md](./research.md).

## Constitution Check

| Principle | Status |
|-----------|--------|
| English UI/prompts | PASS |
| PWA versioning | PASS (SW bump in T07) |
| max_tokens on diagram LLM | PASS (`MAX_TOKENS_DIAGRAM_GENERATION = 500`) |

## Phase outputs

- [data-model.md](./data-model.md)
- [research.md](./research.md)
- [quickstart.md](./quickstart.md)
- [contracts/](./contracts/)
