# ROADMAP — supabase-write-retry

**Feature:** specs/20260706-supabase-write-retry | **Spec:** specs/20260706-supabase-write-retry/spec.md | **Plan:** specs/20260706-supabase-write-retry/plan.md  
**Created:** 2026-07-06

## Dependency diagram

```
T01 (withRetry module + unit tests)
  ├── T02 (call-site audit → research.md)
  └── T03 (wire upsertSessionInStore)
        ├── T04 (SM-2 path tests)
        └── T05 (wire vault/projects/registry)
              └── T06 (keyed supersession tests + confirm all wires)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02 | parallel |
| 2 | T03 | sequential |
| 3 | T04, T05 | parallel |
| 4 | T06 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | `withRetry` module + unit tests | — | parallel | [x] |
| T02 | Call-site audit in research.md | — | parallel | [x] |
| T03 | Wire `upsertSessionInStore` with keyed retry | T01 | sequential | [x] |
| T04 | SM-2 retry path regression test | T03 | parallel | [x] |
| T05 | Wire vault/projects/registry sync | T01 | parallel | [x] |
| T06 | Keyed supersession tests (R7) | T03, T05 | sequential | [x] |

## Prompt per task

### T01 — withRetry module
**Spec ref:** FR-001–003, FR-006 | **Plan ref:** Module design | **Files:** `src/js/net/retry.js`, `cursor-tests/20260706_t01-with-retry.mjs`  
**Success criterion:** Unit tests pass for happy path, exhaustion, non-retry statuses, jitter bounds.  
**On close:** `/validate` and mark `[x]`.

### T02 — Call-site audit
**Spec ref:** FR-006, R8 open questions | **Plan ref:** Phase 0 | **Files:** `specs/20260706-supabase-write-retry/research.md`  
**Success criterion:** All five R5 call sites documented with error handling and idempotency.  
**On close:** mark `[x]`.

### T03 — Wire session upsert
**Spec ref:** FR-005 session | **Plan ref:** Wiring table | **Files:** `src/js/session-store.js`  
**Success criterion:** `upsertSessionInStore` uses `withKeyedRetry` for network persist.  
**On close:** `/validate` and mark `[x]`.

### T04 — SM-2 path test
**Spec ref:** FR-005 upsertSmItem | **Plan ref:** T04 | **Files:** `cursor-tests/20260706_t04-sm2-retry-path.mjs`  
**Success criterion:** Test documents upsertSmItem routes through keyed session persist.  
**On close:** `/validate` and mark `[x]`.

### T05 — Wire user stores
**Spec ref:** FR-005 vault/projects/registry | **Plan ref:** Wiring table | **Files:** `src/js/user-store-sync.js`  
**Success criterion:** Three schedule*Sync paths use `withKeyedRetry`.  
**On close:** `/validate` and mark `[x]`.

### T06 — Keyed supersession
**Spec ref:** FR-007 | **Plan ref:** T06 | **Files:** `cursor-tests/20260706_t06-keyed-supersession.mjs`  
**Success criterion:** Rapid double-write test; newer payload wins.  
**On close:** `/validate`, SW bump, mark `[x]`.

## Temporary subagents

Cleanup: 2026-07-06 (none created)
