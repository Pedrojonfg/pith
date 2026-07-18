"""Process workflow: test-agent retries, run logs, block_detail."""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from orchestrator.agent_runner import AgentResult, AgentRunner
from orchestrator.git_ops import GitOps
from orchestrator.process_workflow import (
    append_run_log,
    run_log_path,
    run_process_unit,
    truncate_block_detail,
)


def _init_repo(d: Path) -> GitOps:
    subprocess.run(["git", "init", "-b", "main"], cwd=d, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "t@test"], cwd=d, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "t"], cwd=d, check=True, capture_output=True)
    (d / "README").write_text("hi\n", encoding="utf-8")
    subprocess.run(["git", "add", "."], cwd=d, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=d, check=True, capture_output=True)
    return GitOps(repo=d, remote_push=False, test_allowlist_prefix="cursor-tests/loop-engineering")


def test_truncate_block_detail():
    assert truncate_block_detail("short") == "short"
    long = "x" * 600
    out = truncate_block_detail(long, 500)
    assert len(out) == 500
    assert out.endswith("...")


def test_append_run_log_per_process():
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        res = AgentResult(ok=False, model_used="m", stdout="OUT", stderr="ERR")
        append_run_log(root, "proc-a", agent="test-agent", attempt=1, result=res)
        append_run_log(root, "proc-a", agent="test-agent", attempt=2, result=res)
        append_run_log(root, "proc-b", agent="fix-agent", attempt=1, result=res)
        a = run_log_path(root, "proc-a").read_text(encoding="utf-8")
        b = run_log_path(root, "proc-b").read_text(encoding="utf-8")
        assert "test-agent attempt 1" in a
        assert "test-agent attempt 2" in a
        assert "fix-agent attempt 1" in b
        assert "OUT" in a and "ERR" in a
        assert run_log_path(root, "proc-a") != run_log_path(root, "proc-b")


def test_test_agent_retries_then_blocks_with_detail_and_wip():
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        git = _init_repo(d)
        calls = {"n": 0}

        def fail_test(**kwargs):
            calls["n"] += 1
            return AgentResult(
                ok=False,
                model_used="m1",
                stdout=f"stdout-attempt-{calls['n']}",
                stderr=f"boom on attempt {calls['n']}",
            )

        runner = AgentRunner(
            agent_bin="agent",
            command_template="x",
            timeout_seconds=1,
            exhaustion_matchers=[],
            allowlist_prefix="cursor-tests/loop-engineering/",
            dry_run=False,
            run_fn=fail_test,
        )
        # Leave a partial file so WIP has something to commit
        (d / "partial.txt").write_text("partial work\n", encoding="utf-8")

        result = run_process_unit(
            process_id="proc-retry",
            row={"id": "proc-retry", "static_risk_assessment": "likely-fine"},
            files_involved=["src/js/x.js"],
            root=d,
            runner=runner,
            git=git,
            cfg={
                "max_fix_attempts": 3,
                "test_agent_models": ["m1"],
                "fix_agent_models": ["m1"],
                "tier3_process_ids": [],
            },
            run_suite=lambda: True,
        )
        assert result["status"] == "blocked"
        assert result["block_reason"] == "test_agent_failed"
        assert result["attempts"] == 3
        assert calls["n"] == 3
        assert "boom on attempt 3" in (result["block_detail"] or "")
        assert result["branch"] == "loop-eng/proc-retry"

        log = run_log_path(d, "proc-retry").read_text(encoding="utf-8")
        assert "test-agent attempt 1" in log
        assert "test-agent attempt 2" in log
        assert "test-agent attempt 3" in log
        assert "stdout-attempt-2" in log

        # WIP commit on process branch
        r = subprocess.run(
            ["git", "log", "-1", "--pretty=%s"],
            cwd=d,
            capture_output=True,
            text=True,
            check=True,
        )
        assert "wip(proc-retry):" in r.stdout
        assert "partial work" in (d / "partial.txt").read_text(encoding="utf-8")


def test_fix_agent_failures_append_run_log():
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        git = _init_repo(d)
        calls = {"n": 0}

        def mixed(**kwargs):
            calls["n"] += 1
            mode = kwargs.get("mode")
            if mode == "test":
                # Write a dummy test file so verify has something to fail on
                test_dir = d / "cursor-tests" / "loop-engineering"
                test_dir.mkdir(parents=True, exist_ok=True)
                (test_dir / "proc-fix.mjs").write_text(
                    "process.exit(1);\n",
                    encoding="utf-8",
                )
                return AgentResult(ok=True, model_used="m1", stdout="test ok")
            return AgentResult(
                ok=True,
                model_used="m1",
                stdout=f"fix-out-{calls['n']}",
                stderr=f"fix-err-{calls['n']}",
            )

        runner = AgentRunner(
            agent_bin="agent",
            command_template="x",
            timeout_seconds=1,
            exhaustion_matchers=[],
            allowlist_prefix="cursor-tests/loop-engineering/",
            dry_run=False,
            run_fn=mixed,
        )
        result = run_process_unit(
            process_id="proc-fix",
            row={"id": "proc-fix", "static_risk_assessment": "likely-fine"},
            files_involved=["src/js/x.js"],
            root=d,
            runner=runner,
            git=git,
            cfg={
                "max_fix_attempts": 2,
                "test_agent_models": ["m1"],
                "fix_agent_models": ["m1"],
                "tier3_process_ids": [],
            },
            run_suite=lambda: True,
        )
        assert result["status"] == "blocked"
        assert result["block_reason"] == "exhausted"
        assert result["attempts"] == 2
        assert result.get("block_detail")
        log = run_log_path(d, "proc-fix").read_text(encoding="utf-8")
        assert "fix-agent attempt 1" in log
        assert "fix-agent attempt 2" in log
        assert "fix-out-" in log


if __name__ == "__main__":
    test_truncate_block_detail()
    test_append_run_log_per_process()
    test_test_agent_retries_then_blocks_with_detail_and_wip()
    test_fix_agent_failures_append_run_log()
    print("process_workflow OK")
