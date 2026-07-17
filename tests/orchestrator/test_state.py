"""T04 state reconcile tests."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from orchestrator.state import (
    empty_process_state,
    init_state_from_manifest,
    load_or_init,
    reconcile_state,
    atomic_write_json,
    load_state,
)

MANIFEST = {
    "groups": [
        {
            "group_id": "01-auth",
            "process_ids": ["a", "b"],
        }
    ]
}


def test_init_all_pending():
    st = init_state_from_manifest(MANIFEST)
    assert st["flow_groups"]["01-auth"]["processes"]["a"]["status"] == "pending"
    assert st["active_locks"] == []


def test_merged_without_sha_reverts(tmp_path: Path | None = None):
    from pathlib import Path as P
    st = init_state_from_manifest(MANIFEST)
    st["flow_groups"]["01-auth"]["processes"]["a"] = {
        "status": "merged",
        "attempts": 2,
        "block_reason": None,
        "branch": None,
        "merged_commit_sha": "deadbeef",
    }
    out = reconcile_state(st, merged_on_main=lambda pid, sha: False)
    assert out["flow_groups"]["01-auth"]["processes"]["a"]["status"] == "pending"
    assert out["active_locks"] == []


def test_fixing_resets_to_pending():
    st = init_state_from_manifest(MANIFEST)
    st["flow_groups"]["01-auth"]["processes"]["a"]["status"] = "fixing"
    st["flow_groups"]["01-auth"]["processes"]["a"]["attempts"] = 3
    st["active_locks"] = ["study.js"]
    out = reconcile_state(st, merged_on_main=lambda pid, sha: False)
    assert out["flow_groups"]["01-auth"]["processes"]["a"] == empty_process_state()
    assert out["active_locks"] == []


def test_atomic_write_roundtrip(tmp_path=None):
    path = (tmp_path or Path(".")) / "state.json"
    if tmp_path is None:
        import tempfile
        d = Path(tempfile.mkdtemp())
        path = d / "state.json"
    st = init_state_from_manifest(MANIFEST)
    atomic_write_json(path, st)
    loaded = load_state(path)
    assert loaded["flow_groups"]["01-auth"]["processes"]["b"]["status"] == "pending"


def test_load_or_init_creates(tmp_path=None):
    import tempfile
    d = Path(tempfile.mkdtemp()) if tmp_path is None else tmp_path
    path = Path(d) / "state.json"
    st = load_or_init(path, MANIFEST, merged_on_main=lambda p, s: False)
    assert path.is_file()
    assert "a" in st["flow_groups"]["01-auth"]["processes"]


if __name__ == "__main__":
    test_init_all_pending()
    test_merged_without_sha_reverts()
    test_fixing_resets_to_pending()
    test_atomic_write_roundtrip()
    test_load_or_init_creates()
    print("T04 OK")
