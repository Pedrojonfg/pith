# Implementation Plan: Tech Debt Cleanup

**Date:** 2026-06-28 | **Spec:** [spec.md](./spec.md)

## Summary

Five independent cleanup rules: PWA version alignment, legacy assessment removal, source fidelity toggle restore, deprecated export audit, legacy session write retirement.

## Technical Context

**Stack:** Vanilla JS PWA (`index.html`, `ui.js`, `study.js`, `session.js`, `session-migration.js`, `flags.js`, `sw.js`)

**Testing:** `cursor-tests/20260606_validate-sw-update-flow.mjs` + per-task cursor-tests

## Task Graph

```text
T01 R3 versions (parallel-safe)
T02 R2 legacy assessment
T03 R1 fidelity toggle
T04 R5 deprecated exports
T05 R4 session writes (last — highest blast radius)
```

## Constitution Check

| Principle | Status |
|-----------|--------|
| Minimize scope | PASS — gap closure only |
| PWA versioning | PASS — T01 bumps all markers |
| English UI | PASS |
