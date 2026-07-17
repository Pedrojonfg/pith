"""Git branch/commit/checkpoint/regression-merge helpers."""
from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass
class GitOps:
    repo: Path
    remote_push: bool = False  # tests leave False
    # Paths under this prefix are force-added on commit so a broader .gitignore
    # rule (e.g. "cursor-tests/") cannot silently drop verification test files.
    test_allowlist_prefix: str | None = None

    def _run(self, args: list[str], check: bool = True) -> subprocess.CompletedProcess:
        return subprocess.run(
            args,
            cwd=str(self.repo),
            capture_output=True,
            text=True,
            check=check,
        )

    def current_branch(self) -> str:
        return self._run(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip()

    def create_process_branch(self, process_id: str, from_ref: str = "main") -> str:
        branch = f"loop-eng/{process_id}"
        self._run(["git", "checkout", from_ref], check=False)
        # ensure main exists
        self._run(["git", "checkout", "-B", branch, from_ref])
        return branch

    def commit_all(self, message: str) -> str:
        self._run(["git", "add", "-A"])
        if self.test_allowlist_prefix and (self.repo / self.test_allowlist_prefix).exists():
            self._run(["git", "add", "-f", "--", self.test_allowlist_prefix])
        # allow empty? no — only when there are changes
        status = self._run(["git", "status", "--porcelain"], check=False)
        if not status.stdout.strip():
            return self._run(["git", "rev-parse", "HEAD"]).stdout.strip()
        self._run(["git", "commit", "-m", message])
        return self._run(["git", "rev-parse", "HEAD"]).stdout.strip()

    def tag_checkpoint(self, process_id: str, ref: str = "main") -> str:
        tag = f"checkpoint-before-{process_id}"
        self._run(["git", "tag", "-f", tag, ref])
        return tag

    def throwaway_merge_ok(self, process_branch: str, base: str = "main") -> tuple[bool, str]:
        """Merge process_branch into a temp branch from base; return (ok, temp_branch). Caller runs tests."""
        temp = f"loop-eng/_regress-{process_branch.replace('/', '-')}"
        self._run(["git", "checkout", "-B", temp, base])
        merge = self._run(["git", "merge", "--no-edit", process_branch], check=False)
        if merge.returncode != 0:
            self._run(["git", "merge", "--abort"], check=False)
            self._run(["git", "checkout", base], check=False)
            self._run(["git", "branch", "-D", temp], check=False)
            return False, temp
        return True, temp

    def cleanup_temp_branch(self, temp: str, back_to: str = "main") -> None:
        self._run(["git", "checkout", back_to], check=False)
        self._run(["git", "branch", "-D", temp], check=False)

    def merge_to_main(self, process_branch: str, main: str = "main") -> str:
        self._run(["git", "checkout", main])
        self._run(["git", "merge", "--no-ff", "-m", f"merge {process_branch}", process_branch])
        sha = self._run(["git", "rev-parse", "HEAD"]).stdout.strip()
        if self.remote_push:
            self._run(["git", "push", "origin", main])
        return sha

    def delete_branch(self, branch: str, remote: bool = False) -> None:
        self._run(["git", "branch", "-D", branch], check=False)
        if remote and self.remote_push:
            self._run(["git", "push", "origin", "--delete", branch], check=False)

    def sha_on_main(self, sha: str, main: str = "main") -> bool:
        if not sha:
            return False
        r = self._run(["git", "merge-base", "--is-ancestor", sha, main], check=False)
        return r.returncode == 0

    def process_merged_on_main(self, process_id: str, sha: str | None, main: str = "main") -> bool:
        if not sha:
            return False
        return self.sha_on_main(sha, main=main)
