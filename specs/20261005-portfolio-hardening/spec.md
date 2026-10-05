# Spec: Portfolio hardening

## Goal

Pith is no longer an active product. The public repo exists only to demonstrate engineering skill. A reviewer who spends five minutes on it should come away with: what was built, how it was built (spec-driven, agent-orchestrated), and evidence that it is tested and secure.

## Non-goals

- No refactor of `study.js`, `api.js` or `session.js`.
- No new features, no behaviour changes in study modes.
- No unification of `localStorage` and Supabase state.
- No UI changes.

## Decisions (resolved)

| # | Decision | Choice |
|---|---|---|
| D1 | Git history | (a) `git filter-repo` strip junk paths, keep commits |
| D2 | Which tests to publish | (a) Curated subset under `tests/js/` |
| D3 | Shared cache writes | (b) Edge Function `shared-cache-upsert` + service role (already shipped) |
| D4 | Empty allowlist | (a) Fail closed; `LLM_PROXY_ALLOW_ALL=true` escape |
| D5 | Orchestrator | (a) Keep in repo; feature in README |

## Tasks

See conversation / implementation. Order: T1 → T2 → T3 → T4 → T5 (manual) → T6 (history rewrite, agent stops before push).
