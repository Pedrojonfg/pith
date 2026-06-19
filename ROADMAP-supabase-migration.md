# ROADMAP — supabase-migration

**Feature:** specs/20260617-supabase-migration | **Spec:** specs/20260617-supabase-migration/spec.md | **Plan:** specs/20260617-supabase-migration/plan.md
**Created:** 2026-06-19

## Dependency diagram

```
T01 (infra) ──┬──> T03 (session-store) ──┬──> T04 (auth UI)
T02 (deps)  ──┘                          └──> T05 (async callers)
                                         └──> T06 (sign-out + docs + validate)
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
| T01 | Supabase infra: table, RLS, storage bucket | — | parallel | [x] |
| T02 | npm + config/supabase.js + supabase-client | — | parallel | [x] |
| T03 | Rewrite session-store.js + session-persist-supabase | T01,T02 | sequential | [x] |
| T04 | Auth screen, main.js gate, migration | T03 | parallel | [x] |
| T05 | Async propagation all callers | T03 | parallel | [x] |
| T06 | Sign-out, GOOGLE_OAUTH_SETUP, tests, SW bump | T04,T05 | sequential | [x] |

## Prompt per task

### T01 — Supabase infra
**Spec ref:** §3, §4 | **Plan ref:** Technical Context | **Files:** Supabase MCP migration
**Success criterion:** `document_sessions` table with RLS; `markdown_files` bucket.
**On close:** `/validate` and mark `[x]`.

### T02 — Dependencies and config
**Spec ref:** §10, §11 | **Files:** package.json, src/js/config/supabase.js, src/js/supabase-client.js
**Success criterion:** Config committed with project URL + anon key.
**On close:** `/validate` and mark `[x]`.

### T03 — session-store rewrite
**Spec ref:** §5 | **Files:** src/js/session-store.js, src/js/session-persist-supabase.js
**Success criterion:** Async API; Supabase read/write; markdown in Storage.
**On close:** `/validate` and mark `[x]`.

### T04 — Auth gate
**Spec ref:** §6, §7, §8 | **Files:** index.html, ui.js, main.js, auth.js
**Success criterion:** Unauthenticated → auth screen; migration on first boot.
**On close:** `/validate` and mark `[x]`.

### T05 — Async callers
**Spec ref:** §9 | **Files:** 30 importer modules
**Success criterion:** All session-store calls awaited.
**On close:** `/validate` and mark `[x]`.

### T06 — Closure
**Spec ref:** §12 | **Files:** GOOGLE_OAUTH_SETUP.md, sw-update.js, sw.js, cursor-tests
**Success criterion:** Tests green; SW versions aligned.
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-06-19 — none created (async propagation used inline subagent, not registered).
