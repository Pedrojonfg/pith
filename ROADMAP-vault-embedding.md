# ROADMAP — vault-embedding

**Feature:** specs/20260629-vault-embedding | **Spec:** specs/20260629-vault-embedding/spec.md | **Plan:** specs/20260629-vault-embedding/plan.md
**Created:** 2026-06-21 | **Cleanup:** 2026-06-21

## Dependency diagram

```
T01 ─┬→ T03 → T04 ─┐
T02 ─┘       ├→ T05 → T06 → T07
             └→ T08 ─────────┘
T04,T05,T07,T08 → T09
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02 | parallel |
| 2 | T03 | sequential |
| 3 | T04, T05, T08 | parallel |
| 4 | T06 | sequential |
| 5 | T07 | sequential |
| 6 | T09 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Config flags + embedding-thresholds.js | — | parallel | [x] |
| T02 | Supabase SQL migration + table contracts | — | parallel | [x] |
| T03 | embeddings.js + embedding-persist.js (R0) | T01,T02 | sequential | [x] |
| T04 | R1 novelty DPP T1.8 + create-session UI badge | T03 | parallel | [x] |
| T05 | R2 dedup-gates.js + logging | T03 | parallel | [x] |
| T06 | R4 contradiction-check + CONTRADICTS edge | T05 | sequential | [x] |
| T07 | R3 cascade-merge + vault overlay proposals | T06 | sequential | [x] |
| T08 | R5 doc similarity T1.9 + library badges | T03 | parallel | [x] |
| T09 | cursor-tests + graceful degradation + SW bump | T04,T05,T07,T08 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-06-21 (none registered — sequential implementation)

## Pending (manual)

- Apply `supabase/migrations/20260629_vault_embedding.sql` in Supabase dashboard (MCP unavailable).
- Remaining spec §13 tests: cascade-merge atomicity/idempotent, contradiction-veto integration (deferred — need browser/Supabase).
