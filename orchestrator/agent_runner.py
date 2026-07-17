"""Cursor CLI agent invocation with allowlist + model fallback."""
from __future__ import annotations

import os
import shutil
import signal
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Sequence


class AgentBinaryMissing(RuntimeError):
    pass


@dataclass
class AgentResult:
    ok: bool
    model_used: str | None
    stdout: str = ""
    stderr: str = ""
    timed_out: bool = False
    allowlist_violation: bool = False
    exhausted_models: bool = False


def path_allowed(rel_path: str, allowlist_prefix: str) -> bool:
    p = rel_path.replace("\\", "/").lstrip("./")
    prefix = allowlist_prefix.replace("\\", "/").rstrip("/") + "/"
    return p.startswith(prefix) or p == prefix.rstrip("/")


def check_diff_allowlist(
    changed_paths: Sequence[str],
    *,
    mode: str,
    allowlist_prefix: str,
    forbidden_test_path: str | None = None,
) -> list[str]:
    """Return list of violating paths. mode=test|fix."""
    bad = []
    for raw in changed_paths:
        p = raw.replace("\\", "/").lstrip("./")
        if mode == "test":
            if not path_allowed(p, allowlist_prefix):
                bad.append(p)
        elif mode == "fix":
            if forbidden_test_path and p == forbidden_test_path.replace("\\", "/"):
                bad.append(p)
        else:
            raise ValueError(mode)
    return bad


def matches_exhaustion(text: str, matchers: Sequence[str]) -> bool:
    lower = (text or "").lower()
    return any(m.lower() in lower for m in matchers if m)


def kill_process_tree(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            capture_output=True,
            check=False,
        )
    else:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError, AttributeError):
            proc.kill()


def discard_worktree_changes(cwd: Path, *, only_paths: Sequence[str] | None = None) -> None:
    """Discard uncommitted changes. Prefer scoped paths; never blanket git clean -fd on repo root."""
    if only_paths:
        for p in only_paths:
            subprocess.run(["git", "checkout", "--", p], cwd=str(cwd), capture_output=True)
            # remove untracked file if present
            fp = Path(cwd) / p
            if fp.is_file() and not _is_tracked(cwd, p):
                try:
                    fp.unlink()
                except OSError:
                    pass
        return
    subprocess.run(["git", "checkout", "--", "."], cwd=str(cwd), capture_output=True)
    # ponytail: avoid `git clean -fd` at repo root (too destructive); only drop untracked under allowlist dirs if needed


def _is_tracked(cwd: Path, rel: str) -> bool:
    r = subprocess.run(
        ["git", "ls-files", "--error-unmatch", rel],
        cwd=str(cwd),
        capture_output=True,
    )
    return r.returncode == 0


def git_changed_paths(cwd: Path) -> list[str]:
    r = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=str(cwd),
        capture_output=True,
        text=True,
        check=False,
    )
    paths = []
    for line in (r.stdout or "").splitlines():
        if len(line) < 4:
            continue
        # handle renames "R  a -> b"
        rest = line[3:].strip()
        if " -> " in rest:
            rest = rest.split(" -> ", 1)[1]
        paths.append(rest)
    return paths


@dataclass
class AgentRunner:
    agent_bin: str
    command_template: str
    timeout_seconds: int
    exhaustion_matchers: list[str]
    allowlist_prefix: str
    dry_run: bool = False
    # injectable for tests
    run_fn: Callable[..., AgentResult] | None = None

    def ensure_binary(self) -> None:
        if self.dry_run:
            return
        if shutil.which(self.agent_bin) is None:
            raise AgentBinaryMissing(
                f"Cursor CLI '{self.agent_bin}' not found on PATH — install/auth before run"
            )

    def run_with_fallback(
        self,
        *,
        models: list[str],
        prompt: str,
        cwd: Path,
        mode: str,
        forbidden_test_path: str | None = None,
    ) -> AgentResult:
        self.ensure_binary()
        if self.dry_run or self.run_fn:
            fn = self.run_fn or self._stub
            return fn(models=models, prompt=prompt, cwd=cwd, mode=mode)

        last = AgentResult(ok=False, model_used=None, exhausted_models=False)
        for model in models:
            last = self._invoke(model=model, prompt=prompt, cwd=cwd)
            if matches_exhaustion(last.stdout + last.stderr, self.exhaustion_matchers):
                continue
            # allowlist check
            changed = git_changed_paths(cwd)
            bad = check_diff_allowlist(
                changed,
                mode=mode,
                allowlist_prefix=self.allowlist_prefix,
                forbidden_test_path=forbidden_test_path,
            )
            if bad:
                # discard entire attempt working tree changes (tracked), plus untracked violators
                discard_worktree_changes(cwd, only_paths=bad)
                discard_worktree_changes(cwd)
                last.ok = False
                last.allowlist_violation = True
                last.stderr += f"\nallowlist violation: {bad}"
                return last
            return last
        last.exhausted_models = True
        return last

    def _stub(self, **kwargs) -> AgentResult:
        return AgentResult(ok=True, model_used=(kwargs.get("models") or ["stub"])[0], stdout="dry-run stub")

    def _invoke(self, *, model: str, prompt: str, cwd: Path) -> AgentResult:
        # command_template uses {model}; prompt passed as final arg
        # ponytail: build argv simply — template is documentation; we construct argv
        cmd = [self.agent_bin, "-p", "--force", "--model", model, prompt]
        preexec = None
        if os.name != "nt":
            preexec = os.setsid  # type: ignore[attr-defined]
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=str(cwd),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                preexec_fn=preexec,
            )
        except FileNotFoundError as e:
            raise AgentBinaryMissing(str(e)) from e

        try:
            out, err = proc.communicate(timeout=self.timeout_seconds)
            return AgentResult(
                ok=proc.returncode == 0,
                model_used=model,
                stdout=out or "",
                stderr=err or "",
            )
        except subprocess.TimeoutExpired:
            kill_process_tree(proc)
            try:
                out, err = proc.communicate(timeout=5)
            except Exception:
                out, err = "", ""
            return AgentResult(
                ok=False,
                model_used=model,
                stdout=out or "",
                stderr=err or "",
                timed_out=True,
            )
