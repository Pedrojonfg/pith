"""T07 agent_runner tests."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from orchestrator.agent_runner import (
    AgentBinaryMissing,
    AgentRunner,
    check_diff_allowlist,
    matches_exhaustion,
    path_allowed,
)


def test_path_allowed():
    assert path_allowed("cursor-tests/loop-engineering/foo.mjs", "cursor-tests/loop-engineering/")
    assert not path_allowed("src/js/study.js", "cursor-tests/loop-engineering/")


def test_test_mode_allowlist():
    bad = check_diff_allowlist(
        ["cursor-tests/loop-engineering/a.mjs", "src/js/x.js"],
        mode="test",
        allowlist_prefix="cursor-tests/loop-engineering/",
    )
    assert bad == ["src/js/x.js"]


def test_fix_mode_forbids_test_file():
    bad = check_diff_allowlist(
        ["src/js/x.js", "cursor-tests/loop-engineering/a.mjs"],
        mode="fix",
        allowlist_prefix="cursor-tests/loop-engineering/",
        forbidden_test_path="cursor-tests/loop-engineering/a.mjs",
    )
    assert bad == ["cursor-tests/loop-engineering/a.mjs"]


def test_exhaustion_matchers():
    assert matches_exhaustion("Error: rate limit exceeded", ["rate limit", "quota"])
    assert not matches_exhaustion("syntax error", ["rate limit"])


def test_missing_binary_loud():
    r = AgentRunner(
        agent_bin="definitely-not-a-real-agent-bin-xyz",
        command_template="x",
        timeout_seconds=1,
        exhaustion_matchers=[],
        allowlist_prefix="cursor-tests/loop-engineering/",
        dry_run=False,
    )
    try:
        r.ensure_binary()
        assert False, "expected AgentBinaryMissing"
    except AgentBinaryMissing:
        pass


def test_dry_run_stub():
    r = AgentRunner(
        agent_bin="agent",
        command_template="x",
        timeout_seconds=1,
        exhaustion_matchers=[],
        allowlist_prefix="cursor-tests/loop-engineering/",
        dry_run=True,
    )
    res = r.run_with_fallback(
        models=["m1"],
        prompt="hi",
        cwd=ROOT,
        mode="test",
    )
    assert res.ok


def test_invoke_passes_prompt_via_stdin_not_argv():
    """Large prompts must not be argv (MAX_ARG_STRLEN); CLI reads stdin when omitted."""
    huge = "x" * (200 * 1024)
    r = AgentRunner(
        agent_bin="agent",
        command_template="x",
        timeout_seconds=5,
        exhaustion_matchers=[],
        allowlist_prefix="cursor-tests/loop-engineering/",
        dry_run=False,
    )
    mock_proc = MagicMock()
    mock_proc.communicate.return_value = ("ok", "")
    mock_proc.returncode = 0
    with patch("orchestrator.agent_runner.subprocess.Popen", return_value=mock_proc) as popen:
        with patch.object(r, "ensure_binary"):
            with patch("orchestrator.agent_runner.git_changed_paths", return_value=[]):
                with patch("orchestrator.agent_runner.check_diff_allowlist", return_value=[]):
                    res = r.run_with_fallback(
                        models=["m1"],
                        prompt=huge,
                        cwd=ROOT,
                        mode="test",
                    )
    assert res.ok
    cmd = popen.call_args.args[0]
    assert cmd == ["agent", "-p", "--force", "--model", "m1"]
    assert huge not in cmd
    assert popen.call_args.kwargs.get("stdin") is subprocess.PIPE
    passed = mock_proc.communicate.call_args
    assert (passed.kwargs.get("input") if passed.kwargs else None) == huge or (
        passed.args and passed.args[0] == huge
    )


if __name__ == "__main__":
    test_path_allowed()
    test_test_mode_allowlist()
    test_fix_mode_forbids_test_file()
    test_exhaustion_matchers()
    test_missing_binary_loud()
    test_dry_run_stub()
    test_invoke_passes_prompt_via_stdin_not_argv()
    print("T07 OK")
