# Implementation Plan: UI Dead Weight Removal & Screen Integrity

**Branch**: `20260618-ui-dead-weight-removal` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

## Summary

Remove unreachable screens, ghost JS handlers, misleading Save buttons, and config pollution from study-flow screens. Consolidate global settings into `screenSettings`, complete contextual floating chrome rules, and apply per-screen deduplication per audit R1–R10.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: `index.html`, `ui.js` (`showScreen`, `syncFloatingChrome`), `study.js`, `main.js`, `dictionary.js`, `main.css`

**Storage**: Existing `localStorage` keys; add `default_llm_model` for settings model selector

**Testing**: `cursor-tests/20260618_ui-dead-weight-removal.mjs`

**Constraints**: English UI; DESIGN.md full-bleed screens; bump SW_VERSION on JS/CSS changes

## Constitution Check

| Principle | Status |
|-----------|--------|
| Simplicity | PASS — delete dead code, no feature flags |
| Testability | PASS — grep-based + cursor-tests checklist from spec §8 |
| Offline-capable | PASS — no new network deps |

## Task Graph

```text
T01 dead screen + ghosts ──→ T02 broken HTML ──→ T03 screenSettings
      ──→ T04 mode/placeholder cleanup ──→ T05 chrome visibility
      ──→ T06 complete/export ──→ T07 per-screen dedup
      ──→ T08 MCQ CSS + naming ──→ T09 tests + SW bump
```
