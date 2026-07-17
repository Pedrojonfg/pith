"""T05 scheduler tests."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from orchestrator.scheduler import Scheduler, next_process_in_group


def _g(gid, hubs=None, free=False, score=None, pids=None):
    return {
        "group_id": gid,
        "hub_files": hubs or [],
        "free_lane": free,
        "priority_score": score or [1, 3],
        "process_ids": pids or [f"{gid}-p1", f"{gid}-p2"],
    }


def test_hub_lock_exclusivity():
    s = Scheduler(free_lane_cap=2)
    a = _g("a", hubs=["study.js"], score=[0, 0])
    b = _g("b", hubs=["study.js"], score=[0, 1])
    done = set()
    pick = s.pick_next([a, b], is_done=lambda g: g in done)
    assert pick["group_id"] == "a"
    s.acquire(pick)
    pick2 = s.pick_next([a, b], is_done=lambda g: g in done)
    assert pick2 is None
    s.release(a)
    pick3 = s.pick_next([a, b], is_done=lambda g: g in done or g == "a")
    # a not done but still in running? released — if a not done, a would be picked again
    done.add("a")
    pick3 = s.pick_next([a, b], is_done=lambda g: g in done)
    assert pick3["group_id"] == "b"


def test_free_lane_cap():
    s = Scheduler(free_lane_cap=2)
    groups = [_g(f"f{i}", free=True, score=[1, i]) for i in range(3)]
    done = set()
    for _ in range(2):
        p = s.pick_next(groups, is_done=lambda g: g in done)
        assert p is not None
        s.acquire(p)
    assert s.pick_next(groups, is_done=lambda g: g in done) is None


def test_intra_group_sequential():
    g = _g("g", pids=["p1", "p2", "p3"])
    assert next_process_in_group(g, {}) == "p1"
    assert next_process_in_group(g, {"p1": "merged"}) == "p2"
    assert next_process_in_group(g, {"p1": "merged", "p2": "blocked"}) == "p3"
    assert next_process_in_group(g, {"p1": "merged", "p2": "blocked", "p3": "merged"}) is None


def test_parallel_different_locks():
    s = Scheduler()
    a = _g("a", hubs=["study.js"], score=[0, 0])
    b = _g("b", hubs=["api.js"], score=[0, 1])
    done = set()
    p1 = s.pick_next([a, b], is_done=lambda g: g in done)
    s.acquire(p1)
    p2 = s.pick_next([a, b], is_done=lambda g: g in done)
    assert p2 is not None
    assert {p1["group_id"], p2["group_id"]} == {"a", "b"}


if __name__ == "__main__":
    test_hub_lock_exclusivity()
    test_free_lane_cap()
    test_intra_group_sequential()
    test_parallel_different_locks()
    print("T05 OK")
