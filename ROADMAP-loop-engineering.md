# ROADMAP — loop-engineering

**Feature:** specs/20260718-loop-engineering | **Spec:** specs/20260718-loop-engineering/spec.md | **Plan:** specs/20260718-loop-engineering/plan.md
**Created:** 2026-07-18

## Dependency diagram

```
T01 ─┬→ T02 → T03 ─┬→ T05 ─┐
     ├→ T04 ───────┘       ├→ T10 → T11
     ├→ T06 ───────────────┤
     ├→ T07 ───────────────┤
     └→ T08 → T09 ─────────┘
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02, T04, T06, T07, T08 | parallel |
| 3 | T03, T09 | parallel |
| 4 | T05 | sequential |
| 5 | T10 | sequential |
| 6 | T11 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Scaffold orchestrator package, config, gitignore, progress/ | — | sequential | [x] |
| T02 | inventory_parser.py + mini-inventory fixture tests | T01 | parallel | [x] |
| T03 | flow_grouper.py + flow_groups.json generation | T02 | parallel | [x] |
| T04 | state.py load/save/reconcile | T01 | parallel | [x] |
| T05 | scheduler.py lock + free-lane scheduling | T03, T04 | sequential | [x] |
| T06 | notify.py ntfy wrapper | T01 | parallel | [x] |
| T07 | agent_runner.py timeout, tree-kill, allowlist, model fallback | T01 | parallel | [x] |
| T08 | git_ops.py branch/commit/checkpoint/regress-merge/push | T01 | parallel | [x] |
| T09 | verification.py Tier 1–3 + grounding helper stub | T08 | parallel | [x] |
| T10 | main.py setup / build-manifest / run / dry-run loop | T05–T09 | sequential | [x] |
| T11 | Integration validate + quickstart smoke + ROADMAP QA | T10 | sequential | [x] |

## Wave quality gates

- Wave 1–6: `/code-review` — fixed HIGH: removed blanket `git clean -fd` from allowlist discard.
- `/ponytail-review` — removed unused imports; argv built directly (template kept as config docs).

## Prompt per task

See earlier revision; all closed with green `tests/orchestrator/test_*.py` / T11 suite.

## Temporary subagents

Cleanup: 2026-07-18 — none created (implemented in-parent).
