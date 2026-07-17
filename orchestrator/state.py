"""Durable progress/state.json with startup reconciliation."""
from __future__ import annotations

import json
import os
import tempfile
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def empty_process_state() -> dict[str, Any]:
    return {
        "status": "pending",
        "attempts": 0,
        "block_reason": None,
        "branch": None,
        "merged_commit_sha": None,
    }


def init_state_from_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    groups: dict[str, Any] = {}
    for g in manifest.get("groups", []):
        gid = g["group_id"]
        processes = {pid: empty_process_state() for pid in g.get("process_ids", [])}
        groups[gid] = {"status": "pending", "processes": processes}
    return {
        "run_started_at": _now(),
        "last_updated_at": _now(),
        "flow_groups": groups,
        "active_locks": [],
        "model_exhaustion": {"test_agent": None, "fix_agent": None},
    }


def atomic_write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = deepcopy(data)
    data["last_updated_at"] = _now()
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def load_state(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def reconcile_state(
    state: dict[str, Any],
    *,
    merged_on_main: Callable[[str, str | None], bool],
) -> dict[str, Any]:
    """
    merged_on_main(process_id, sha) -> True if that merge is present on main.
    If sha is None, treat as not merged.
    """
    out = deepcopy(state)
    out["active_locks"] = []  # no in-flight agents survive restart

    for _gid, group in out.get("flow_groups", {}).items():
        for pid, proc in group.get("processes", {}).items():
            status = proc.get("status")
            sha = proc.get("merged_commit_sha")
            if status == "merged":
                if not merged_on_main(pid, sha):
                    proc.update(empty_process_state())
                continue
            if status in ("verified", "fixing", "test_written"):
                if not merged_on_main(pid, sha):
                    proc.update(empty_process_state())
        # recompute group status
        procs = group.get("processes", {})
        if procs and all(p.get("status") in ("merged", "blocked") for p in procs.values()):
            group["status"] = "done"
        elif any(p.get("status") not in ("pending",) for p in procs.values()):
            # leave active/pending as-is except clear active after restart
            if group.get("status") == "active":
                group["status"] = "pending"
        else:
            group["status"] = "pending"
    out["last_updated_at"] = _now()
    return out


def load_or_init(path: Path, manifest: dict[str, Any], merged_on_main: Callable[[str, str | None], bool]) -> dict[str, Any]:
    existing = load_state(path)
    if existing is None:
        state = init_state_from_manifest(manifest)
    else:
        state = reconcile_state(existing, merged_on_main=merged_on_main)
    atomic_write_json(path, state)
    return state
