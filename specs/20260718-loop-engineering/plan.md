# Implementation Plan: Autonomous Loop Engineering Orchestrator

**Branch**: `20260718-loop-engineering` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260718-loop-engineering/spec.md`

**Design source**: `spec-looplearningorch.md` (architecture); Speckit artifacts own acceptance + implementation shape.

## Summary

Build a long-running Python orchestrator that parses the 194-process audit inventory, schedules flow-groups under hub-file locks, invokes Cursor CLI headlessly for test-then-fix agents per process, enforces allowlist diffs + a 3-tier verification cascade, auto-merges to `main` with a full accumulated regression gate, persists progress in `progress/state.json`, and notifies sparsely via ntfy.sh. Designed for multi-day unattended VPS/`tmux` operation with restart reconciliation and model-exhaustion backoff.

## Technical Context

**Language/Version**: Python 3.11+ (dev machine has 3.14; target VPS should use 3.11–3.12 LTS preferred)

**Primary Dependencies**: stdlib + PyYAML; `urllib`/`http.client` or `requests` for ntfy; subprocess for Cursor CLI + git. No web framework.

**Storage**: Local files — `orchestrator/config.yaml`, `progress/state.json`, `progress/run-log-*.md`, generated `flow_groups.json`

**Testing**: `pytest` for orchestrator unit/integration (parser, scheduler, state reconcile, allowlist, git_ops dry-run). Loop-generated product tests remain `cursor-tests/loop-engineering/*.mjs` run with Node.

**Target Platform**: Linux Oracle VPS (persistent `tmux`); developed/tested on Windows where agent CLI may be absent (stub runner).

**Project Type**: CLI / long-running process tooling (repo-root `orchestrator/`)

**Performance Goals**: Correctness > throughput; default concurrency ≤ 4 agent processes; agent timeout 600s.

**Constraints**: Never merge without regression gate; never resume mid-agent-attempt; kill full process trees on timeout; unguessable ntfy topic; English-only prompts/heuristics per `.cursorrules`.

**Scale/Scope**: 194 processes, ~20 flow-groups, 3 named locks, 2 agent roles, multi-day runs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Project constitution template is placeholder; gates derived from `.cursorrules` + feature non-goals:

| Gate | Status |
|------|--------|
| No LLM on mnemonic create/edit/delete/search | N/A (orchestrator tooling) |
| PWA SW version bump on `src/js/**` / `index.html` / `src/css/**` | N/A for orchestrator-only commits; **applies** when fix-agents modify those paths (fix-agent / merge path must bump per existing project rule — out of orchestrator scope to invent; fix prompts should mention existing SW bump convention when touching those files) |
| Structured JSON LLM `max_tokens` + truncation taxonomy | Applies to Tier 3 DeepSeek judge calls |
| Auto-merge without human review | Explicitly approved by spec |
| Do not commit from plan-feature without `/commit` | Observed |

**Post-design re-check**: Pass — design isolates product mutation to agent-driven git ops; orchestrator itself does not ship PWA assets.

## Project Structure

### Documentation (this feature)

```text
specs/20260718-loop-engineering/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── state-schema.md
│   ├── flow-groups-manifest.md
│   └── agent-prompts.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
orchestrator/
├── __init__.py
├── main.py                 # entrypoint; loop driver
├── inventory_parser.py
├── flow_grouper.py
├── scheduler.py
├── agent_runner.py
├── verification.py
├── git_ops.py
├── notify.py
├── state.py
├── config.yaml             # committed template; topic generated at setup
├── config.example.yaml
└── requirements.txt
progress/                   # gitignored runtime state (commit .gitkeep)
├── .gitkeep
├── state.json              # runtime
└── run-log-*.md
cursor-tests/
└── loop-engineering/       # generated process tests land here
    └── .gitkeep
tests/orchestrator/         # pytest for orchestrator modules
├── test_inventory_parser.py
├── test_flow_grouper.py
├── test_scheduler.py
├── test_state.py
├── test_allowlist.py
└── fixtures/
    └── mini-inventory.md
```

**Structure Decision**: Single repo-root `orchestrator/` package matching `spec-looplearningorch.md` §4. Product tests stay in `cursor-tests/` to match existing Node test convention. Orchestrator tests use pytest under `tests/orchestrator/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Multi-module orchestrator (~10 files) | Spec mandates lock scheduling, dual agents, verification cascade, git ops, notify, state reconcile | Single mega-script fails maintainability and unit-test isolation for a multi-day critical path |
| Tier 2+3 verification | Spec requires embedding grounding + subjective judge for LLM processes | Tier-1-only would greenlight ungrounded generative regressions |

## Implementation Phases (for roadmap synthesis)

1. **Foundation**: config + inventory parser + flow grouper + state schema/reconcile
2. **Scheduling**: lock scheduler + free-lane cap
3. **Agent I/O**: Cursor CLI runner (timeout, process-tree kill, model fallback, allowlist)
4. **Git ops**: branch/commit/checkpoint/throwaway-merge/regression/push/cleanup
5. **Verification**: Tier 1–3 cascade + ntfy
6. **Main loop + quickstart**: wire `main.py`, dry-run mode, setup topic generation, docs

## Gates / Risks

- Cursor CLI not installed on this Windows workstation → develop against injectable `AgentRunner` protocol; VPS setup verifies real binary (FR-014).
- Rate-limit error strings unknown until empirical capture → config list of matchers, initially seeded with common patterns, refined on VPS.
- Embedding Tier 2 from Python must call existing JS embeddings or a thin Node bridge — see research.md Decision: Node subprocess helper reusing `embeddings.js` math + Gemini path, or pure cosine against precomputed fixture embeddings for offline tests.
