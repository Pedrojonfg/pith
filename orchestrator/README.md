# Loop-engineering orchestrator

Development automation for working through the audit process inventory ([`specs/20260718-loop-engineering/spec.md`](../specs/20260718-loop-engineering/spec.md)). It is **not** part of the PWA runtime.

## Purpose

- Parse the process inventory markdown (`inventory_path` in [`config.example.yaml`](config.example.yaml), default `audit/process-inventory-20260717.md`) into flow groups.
- For each inventory process: generate a Node regression test, optionally patch product code, verify, and merge via git helpers.
- Schedule flow groups with **hub-file locks** so only one active group holds locks on shared hubs (`study.js`, `api.js`, `session-store.js`, etc.).
- Persist resume state under `progress/` (`state.json` / run logs are gitignored; directory created at runtime).

## How a run works

1. **`setup`** — Copy [`config.example.yaml`](config.example.yaml) → `config.yaml` (gitignored), generate ntfy topic if needed.
2. **`build-manifest`** — Read inventory → write [`generated/flow_groups.json`](generated/flow_groups.json) (groups, `hub_files`, priorities).
3. **`run`** — Load manifest and state; loop until all processes are `merged` or `blocked`:
   - **Scheduler** picks the next eligible flow group (free lanes vs hub locks; see [`scheduler.py`](scheduler.py)).
   - For each process in the group, **`run_process_unit`** ([`process_workflow.py`](process_workflow.py)):
     - **test-agent** — Cursor CLI writes `cursor-tests/loop-engineering/<process_id>.mjs` (must not edit product source).
     - **fix-agent** — May edit product files (not the test) when Tier 1 fails.
     - **Verification** — Tier 1 Node test, optional grounding / judge tiers ([`verification.py`](verification.py)).
     - **Merge** — Accumulated loop-engineering suite must pass before integrating to `main` (skipped in dry-run).

## Execute a dry run

No real `agent` binary, no git push; stub SHAs and ntfy payloads are captured instead of sent.

```bash
cd /path/to/pith
python3 -m venv .venv-orchestrator
source .venv-orchestrator/bin/activate
pip install -r orchestrator/requirements.txt

python -m orchestrator.main setup
# optional: point inventory at tests/orchestrator/fixtures/mini-inventory.md in config.yaml

python -m orchestrator.main build-manifest
python -m orchestrator.main run --dry-run --max-processes 3 --config orchestrator/config.example.yaml
```

Flags on **`run`** (see [`main.py`](main.py)): `--config`, `--dry-run`, `--max-processes N`.

Tests: [`tests/orchestrator/`](../tests/orchestrator/) (e.g. [`test_main_dry_run.py`](../tests/orchestrator/test_main_dry_run.py)).
