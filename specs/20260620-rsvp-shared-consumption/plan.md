# Implementation Plan: RSVP Shared Consumption Hardening

**Branch**: `20260620-rsvp-shared-consumption` | **Spec**: [spec.md](./spec.md)

## Summary

Add `rsvp-shared-consumption.js` resolver so Tier-1-prepared docs always supply inventory/block rec to RSVP create and Generate without re-inventory. Wire `study.js` recommend + submit paths; ensure assessment checkbox visible on bootstrap; integration tests + SW bump.

## Technical Context

**Language**: ES modules (browser PWA)  
**Files**: `src/js/rsvp-shared-consumption.js`, `session-types.js`, `study.js`, `index.html` (if needed), `sw-update.js`, `cursor-tests/20260620_rsvp-shared-consumption.mjs`  
**Testing**: cursor-tests `.mjs` with mocked LLM/inventory hooks

## Constitution Check

- Reuse shared artifacts per front-load contract — pass.
- No new LLM on mnemonic or unrelated paths — pass.
- SW_VERSION bump required — planned in T04.

## Task Graph

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 — shared inventory resolver module | sequential |
| 2 | T02 — block recommend instant path | T01 |
| 3 | T03 — generate submit no re-inventory | T02 |
| 4 | T04 — assessment UI + tests + SW bump | T03 |
