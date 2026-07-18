"""T11 integration — full orchestrator unit suite."""
from __future__ import annotations

import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TESTS = ROOT / "tests" / "orchestrator"

FILES = [
    "test_t01_scaffold.py",
    "test_inventory_parser.py",
    "test_flow_grouper.py",
    "test_state.py",
    "test_scheduler.py",
    "test_notify.py",
    "test_agent_runner.py",
    "test_git_ops.py",
    "test_verification.py",
    "test_process_workflow.py",
    "test_main_dry_run.py",
]


def main() -> None:
    sys.path.insert(0, str(ROOT))
    for name in FILES:
        path = TESTS / name
        print(f"== {name}")
        runpy.run_path(str(path), run_name="__main__")
    print("T11 ALL OK")


if __name__ == "__main__":
    main()
