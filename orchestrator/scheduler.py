"""Lock-based scheduler for flow-groups."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Scheduler:
    free_lane_cap: int = 2
    active_locks: dict[str, str] = field(default_factory=dict)  # lock -> group_id
    free_lane_active: list[str] = field(default_factory=list)
    running: set[str] = field(default_factory=set)

    def sort_groups(self, groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return sorted(groups, key=lambda g: tuple(g.get("priority_score", [1, 3])))

    def _deps_conflict(self, group: dict[str, Any], active_groups: list[dict[str, Any]], process_deps: dict[str, set[str]]) -> bool:
        """True if any active group's processes are depends_on targets of this group or vice versa."""
        my_ids = set(group.get("process_ids", []))
        my_deps: set[str] = set()
        for pid in my_ids:
            my_deps |= process_deps.get(pid, set())
        for ag in active_groups:
            other = set(ag.get("process_ids", []))
            other_deps: set[str] = set()
            for pid in other:
                other_deps |= process_deps.get(pid, set())
            if my_deps & other or other_deps & my_ids:
                return True
        return False

    def pick_next(
        self,
        groups: list[dict[str, Any]],
        *,
        is_done: Callable[[str], bool],
        is_running: Callable[[str], bool] | None = None,
        process_deps: dict[str, set[str]] | None = None,
    ) -> dict[str, Any] | None:
        process_deps = process_deps or {}
        running_fn = is_running or (lambda gid: gid in self.running)
        active_groups = [g for g in groups if running_fn(g["group_id"])]

        for group in self.sort_groups(groups):
            gid = group["group_id"]
            if is_done(gid) or running_fn(gid):
                continue
            if self._deps_conflict(group, active_groups, process_deps):
                continue
            if group.get("free_lane"):
                if len(self.free_lane_active) < self.free_lane_cap:
                    return group
                continue
            required = list(group.get("hub_files") or [])
            if all(lock not in self.active_locks for lock in required):
                return group
        return None

    def acquire(self, group: dict[str, Any]) -> None:
        gid = group["group_id"]
        self.running.add(gid)
        if group.get("free_lane"):
            self.free_lane_active.append(gid)
        else:
            for lock in group.get("hub_files") or []:
                self.active_locks[lock] = gid

    def release(self, group: dict[str, Any]) -> None:
        gid = group["group_id"]
        self.running.discard(gid)
        if gid in self.free_lane_active:
            self.free_lane_active = [x for x in self.free_lane_active if x != gid]
        for lock, holder in list(self.active_locks.items()):
            if holder == gid:
                del self.active_locks[lock]


def next_process_in_group(group: dict[str, Any], process_status: dict[str, str]) -> str | None:
    """Strictly sequential: first process not merged/blocked."""
    for pid in group.get("process_ids", []):
        st = process_status.get(pid, "pending")
        if st not in ("merged", "blocked"):
            return pid
    return None
