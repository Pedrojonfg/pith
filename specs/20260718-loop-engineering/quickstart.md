# Quickstart: Loop Engineering Orchestrator

## Prerequisites

- GitHub auth on the machine (`gh` / git push to `origin` works)
- Cursor CLI installed and authenticated (`agent --version` succeeds)
- Python 3.11+
- Node.js (for `cursor-tests` + grounding helper)
- Repo clone at the path you will run from

## Setup (once)

```bash
cd /path/to/mylearning
python -m venv .venv-orchestrator
source .venv-orchestrator/bin/activate   # Windows: .venv-orchestrator\Scripts\activate
pip install -r orchestrator/requirements.txt

# Generate ntfy topic + write config
python -m orchestrator.main setup
# → prints: Subscribe at https://ntfy.sh/<topic>  (copy once)

# Verify inventory parse + flow groups
python -m orchestrator.main build-manifest
# → writes orchestrator/generated/flow_groups.json
```

Subscribe to the printed ntfy topic on your phone.

## Dry-run (no agents, no merges)

```bash
python -m orchestrator.main --dry-run --max-processes 3
```

Uses stub agent runner; advances synthetic/minimal path and writes `progress/state.json`.

## Production (VPS + tmux)

```bash
tmux new -s loop-eng
cd /path/to/mylearning
source .venv-orchestrator/bin/activate
python -m orchestrator.main run
# Detach: Ctrl-b d
```

Resume after reboot:

```bash
tmux attach -t loop-eng
# or start again — main always reconciles state.json vs git log main
python -m orchestrator.main run
```

## Operator checks

| Check | Command / place |
|-------|-----------------|
| Progress | `progress/state.json` |
| Human log | `progress/run-log-*.md` |
| Blocked branches | `git branch -a \| grep loop-eng/` |
| Merged evidence | `git log main --oneline \| head` |

## Safety reminders

- Do not manually relax a failing loop test to unblock a process.
- Do not delete `blocked` branches until inspected.
- Do not change `grounding_similarity_threshold` mid-run without noting it in the run log.
