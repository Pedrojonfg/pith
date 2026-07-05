# ROADMAP — cross-device-persistence-completion

**Feature:** specs/20260705-cross-device-persistence-completion | **Spec:** spec.md | **Plan:** plan.md  
**Created:** 2026-07-05 | **Cleanup:** 2026-07-05

## Dependency diagram

```
T01 (schema) → T02 (persist helpers) → T03 (projects) → T04 (vault) → T05 (registry)
                                      → T06 (active doc + blocks) ────────────────┐
                                      → T07 (migration + hydrate) ← T03-T06 ──────┘
                                      → T08 (tests + SW)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04 | sequential |
| 5 | T05 | sequential |
| 6 | T06 | sequential |
| 7 | T07 | sequential |
| 8 | T08 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Postgres tables, RLS, storage buckets | — | sequential | [x] |
| T02 | user-data-persist-supabase.js + user-store-sync.js | T01 | sequential | [x] |
| T03 | Projects write-through + hydrate | T02 | sequential | [x] |
| T04 | Vault write-through + hydrate | T03 | sequential | [x] |
| T05 | Concept registry write-through + hydrate | T04 | sequential | [x] |
| T06 | Active doc pointer + block Storage sync | T02 | sequential | [x] |
| T07 | auth.js migration + main.js hydrate | T03-T06 | sequential | [x] |
| T08 | Integration tests + SW bump | T07 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-07-05 (none created)
