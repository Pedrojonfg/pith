# Implementation Plan: Fix DPP Prep UI Status

**Feature**: `specs/20260629-fix-dpp-prep-ui`  
**Date**: 2026-06-29

## Summary

Add `resolveCreateSessionPrepStatus(doc)` helper; use pipeline return + `getActiveSession` in upload flow.

## Files

- `study.js` — status resolver + `.then` handler
- `cursor-tests/20260629_dpp-prep-ui.mjs`

## Implementation

1. Pure helper: maps prep status + inventory → user-facing string.
2. Wire `startDocumentPreparation` `.then((result) => ...)` to use `result.status` and reloaded doc.
3. Tests for ready/partial/failed/running cases.
