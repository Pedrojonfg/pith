# ROADMAP — rsvp-shared-consumption

**Feature:** specs/20260620-rsvp-shared-consumption | **Created:** 2026-06-20

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04 | sequential |

## Tasks

| ID | Description | Dep | Status |
|----|-------------|-----|--------|
| T01 | Shared inventory resolver module | — | [x] |
| T02 | Instant block recommend wiring | T01 | [x] |
| T03 | Generate submit no re-inventory | T02 | [x] |
| T04 | Assessment UI + tests + SW bump | T03 | [x] |

## Temporary subagents

Cleanup: 2026-06-20 (none created)

## Prompt per task

### T01 — Shared inventory resolver
**Files:** `src/js/rsvp-shared-consumption.js`
**Success:** `resolvePreparedRsvpInventory`, `resolveRsvpInventoryForPack`, `seedBlockSplitCacheFromShared`

### T02 — Block recommend
**Files:** `src/js/study.js`
**Success:** Prepared docs never call inventory LLM in recommend path

### T03 — Generate submit
**Files:** `src/js/study.js`
**Success:** Bootstrap generate uses shared inventory; legacy fallback preserved

### T04 — QA closure
**Files:** `cursor-tests/20260620_rsvp-shared-consumption.mjs`, `sw-update.js`, `index.html`, `sw.js`
**Success:** Tests green, SW_VERSION bumped
