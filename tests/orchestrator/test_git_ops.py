"""T08 git_ops tests in a temp repo."""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from orchestrator.git_ops import GitOps


def _init_repo(d: Path) -> GitOps:
    subprocess.run(["git", "init", "-b", "main"], cwd=d, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "t@test"], cwd=d, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "t"], cwd=d, check=True, capture_output=True)
    (d / "README").write_text("hi\n", encoding="utf-8")
    subprocess.run(["git", "add", "."], cwd=d, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=d, check=True, capture_output=True)
    return GitOps(repo=d, remote_push=False)


def test_branch_commit_merge_delete():
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        g = _init_repo(d)
        branch = g.create_process_branch("proc-a")
        assert branch == "loop-eng/proc-a"
        (d / "f.txt").write_text("x\n", encoding="utf-8")
        sha = g.commit_all("test(proc-a): add fixture/verification")
        assert len(sha) >= 7
        g.tag_checkpoint("proc-a")
        ok, temp = g.throwaway_merge_ok(branch)
        assert ok
        g.cleanup_temp_branch(temp)
        merged = g.merge_to_main(branch)
        assert g.process_merged_on_main("proc-a", merged)
        g.delete_branch(branch)
        # branch gone
        r = subprocess.run(["git", "branch"], cwd=d, capture_output=True, text=True)
        assert "loop-eng/proc-a" not in r.stdout


def test_keep_branch_semantics():
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        g = _init_repo(d)
        branch = g.create_process_branch("proc-b")
        (d / "wip.txt").write_text("wip\n", encoding="utf-8")
        g.commit_all("wip(proc-b): blocked after 6 attempts, see progress/state.json")
        # do not delete — simulate block
        r = subprocess.run(["git", "branch"], cwd=d, capture_output=True, text=True)
        assert "loop-eng/proc-b" in r.stdout


if __name__ == "__main__":
    test_branch_commit_merge_delete()
    test_keep_branch_semantics()
    print("T08 OK")
