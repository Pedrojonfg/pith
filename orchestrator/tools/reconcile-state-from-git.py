#!/usr/bin/env python3
"""One-off recovery: rebuild progress/state.json from git main + blocked evidence.

Does NOT touch main, loop-eng/* branches, or run the orchestrator.
Safe to re-run; always backs up state.json before overwrite.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "orchestrator" / "generated" / "flow_groups.json"
STATE_PATH = ROOT / "progress" / "state.json"
PROGRESS_DIR = ROOT / "progress"

# Branches pushed as the original blocked set (from operator history).
# Three of these were later merged; five remain unmerged and must stay blocked.
ORIGINAL_BLOCKED_IDS = [
    "registry-ingest-study",
    "sm2-ingest-recall",
    "sm2-comprehension-confirm",
    "persist-blocks-externalize",
    "persist-blocks-write-through",
    "concept-anchoring-unwired",
    "cloze-pipeline-p3-distractors",
    "cloze-pipeline-orchestrator",
]

# Primary pattern from git_ops.merge_to_main; also accept Git's default subject.
MERGE_SUBJECT_RE = re.compile(
    r"(?i)^(?:merge\s+loop-eng/|merge\s+branch\s+'loop-eng/)([^'\s(]+)"
)


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def empty_process_state() -> dict:
    return {
        "status": "pending",
        "attempts": 0,
        "block_reason": None,
        "block_detail": None,
        "branch": None,
        "merged_commit_sha": None,
    }


def git_log_main_subjects() -> list[tuple[str, str]]:
    out = subprocess.check_output(
        ["git", "log", "main", "--format=%H%x09%s"],
        cwd=ROOT,
        text=True,
    )
    rows: list[tuple[str, str]] = []
    for line in out.splitlines():
        if "\t" not in line:
            continue
        sha, subject = line.split("\t", 1)
        rows.append((sha, subject))
    return rows


def index_merge_commits(rows: list[tuple[str, str]]) -> dict[str, str]:
    """process_id -> most recent merge commit SHA on main."""
    found: dict[str, str] = {}
    for sha, subject in rows:
        m = MERGE_SUBJECT_RE.match(subject.strip())
        if not m:
            continue
        pid = m.group(1)
        if pid not in found:
            found[pid] = sha
    return found


def branch_exists(process_id: str) -> bool:
    r = subprocess.run(
        ["git", "rev-parse", "--verify", f"loop-eng/{process_id}"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    return r.returncode == 0


def branch_tip_subject(process_id: str) -> str | None:
    if not branch_exists(process_id):
        return None
    return subprocess.check_output(
        ["git", "log", "-1", "--format=%s", f"loop-eng/{process_id}"],
        cwd=ROOT,
        text=True,
    ).strip()


def run_log_mentions_failure(process_id: str) -> bool:
    path = PROGRESS_DIR / f"run-log-{process_id}.md"
    if not path.is_file():
        return False
    text = path.read_text(encoding="utf-8", errors="replace").lower()
    # Presence of a run-log alone is weak; look for blocked/failure signals.
    needles = (
        "blocked",
        "test-agent failure",
        "canonical test file not written",
        "allowlist violation",
        "exhausted",
        "regression",
    )
    return any(n in text for n in needles)


def infer_blocked(process_id: str) -> dict | None:
    """Return blocked process fields if evidence says still blocked; else None."""
    tip = branch_tip_subject(process_id)
    branch = f"loop-eng/{process_id}" if tip is not None else None

    if tip and tip.startswith(f"wip({process_id}): blocked"):
        reason = "test_agent_failed"
        if "after test-agent failure" in tip:
            reason = "test_agent_failed"
        elif "attempts" in tip:
            reason = "exhausted"
        detail = tip
        if (PROGRESS_DIR / f"run-log-{process_id}.md").is_file():
            detail = (
                f"{tip}; see progress/run-log-{process_id}.md "
                "(canonical test path / test-agent failure)"
            )
        return {
            "status": "blocked",
            "attempts": 6,
            "block_reason": reason,
            "block_detail": detail[:500],
            "branch": branch,
            "merged_commit_sha": None,
        }

    # Original blocked set: still unmerged, branch kept with test/fix work
    # (regression / merge_conflict paths do not write a WIP commit).
    if process_id in ORIGINAL_BLOCKED_IDS and tip is not None:
        reason = "regression"
        detail = (
            f"Originally blocked; still unmerged on main; branch tip: {tip}"
        )
        if tip.startswith(f"fix({process_id}):") or tip.startswith(f"test({process_id}):"):
            reason = "regression"
            detail = (
                f"test+fix present on {branch} but no merge loop-eng/{process_id} "
                f"on main (likely regression/suite gate). tip: {tip}"
            )
        elif run_log_mentions_failure(process_id):
            reason = "test_agent_failed"
        return {
            "status": "blocked",
            "attempts": 6,
            "block_reason": reason,
            "block_detail": detail[:500],
            "branch": branch,
            "merged_commit_sha": None,
        }

    if process_id in ORIGINAL_BLOCKED_IDS:
        # Listed as originally blocked, no merge, no local branch tip evidence —
        # still treat as blocked so the orchestrator does not silently retry without review.
        return {
            "status": "blocked",
            "attempts": 6,
            "block_reason": "test_agent_failed",
            "block_detail": (
                f"Originally blocked process {process_id}; no merge on main; "
                "preserving blocked status"
            )[:500],
            "branch": branch,
            "merged_commit_sha": None,
        }

    return None


def group_status(processes: dict) -> str:
    if processes and all(p.get("status") in ("merged", "blocked") for p in processes.values()):
        return "done"
    if any(p.get("status") not in ("pending",) for p in processes.values()):
        return "active"
    return "pending"


def main() -> int:
    if not MANIFEST_PATH.is_file():
        print(f"ERROR: missing manifest {MANIFEST_PATH}", file=sys.stderr)
        return 1
    if not STATE_PATH.is_file():
        print(f"ERROR: missing state {STATE_PATH}", file=sys.stderr)
        return 1

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    old_state = json.loads(STATE_PATH.read_text(encoding="utf-8"))

    rows = git_log_main_subjects()
    merges = index_merge_commits(rows)
    print(f"Indexed {len(merges)} unique merge loop-eng/<id> commits on main")
    print(f"Original blocked set ({len(ORIGINAL_BLOCKED_IDS)}): {', '.join(ORIGINAL_BLOCKED_IDS)}")

    # Prefer original run_started_at if somehow older than today's regen; else keep existing.
    run_started = old_state.get("run_started_at") or _now()

    flow_groups: dict = {}
    status_counts: Counter = Counter()
    details: list[str] = []

    for g in manifest.get("groups", []):
        gid = g["group_id"]
        processes: dict = {}
        for pid in g.get("process_ids", []):
            if pid in merges:
                proc = {
                    "status": "merged",
                    "attempts": 1,
                    "block_reason": None,
                    "block_detail": None,
                    "branch": None,
                    "merged_commit_sha": merges[pid],
                }
                # Preserve attempts from current state if already recorded higher.
                old = (
                    old_state.get("flow_groups", {})
                    .get(gid, {})
                    .get("processes", {})
                    .get(pid, {})
                )
                if isinstance(old, dict) and int(old.get("attempts") or 0) > 1:
                    proc["attempts"] = int(old["attempts"])
            else:
                blocked = infer_blocked(pid)
                if blocked:
                    proc = blocked
                else:
                    proc = empty_process_state()
            processes[pid] = proc
            status_counts[proc["status"]] += 1
            if proc["status"] != "merged":
                details.append(f"  {proc['status']:8} {pid}  reason={proc.get('block_reason')}  branch={proc.get('branch')}")

        flow_groups[gid] = {
            "status": group_status(processes),
            "processes": processes,
        }

    new_state = {
        "run_started_at": run_started,
        "last_updated_at": _now(),
        "flow_groups": flow_groups,
        "active_locks": [],
        "model_exhaustion": old_state.get("model_exhaustion")
        or {"test_agent": None, "fix_agent": None},
    }

    total = sum(status_counts.values())
    merged_n = status_counts.get("merged", 0)
    blocked_n = status_counts.get("blocked", 0)
    pending_n = status_counts.get("pending", 0)

    if total != 194:
        print(f"ERROR: expected 194 processes, got {total}", file=sys.stderr)
        return 1

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = STATE_PATH.with_name(f"state.json.bak-{ts}")
    shutil.copy2(STATE_PATH, backup)
    print(f"Backed up {STATE_PATH} -> {backup}")

    STATE_PATH.write_text(json.dumps(new_state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote reconciled {STATE_PATH}")

    print()
    print("=== Reconciliation summary ===")
    print(f"  merged:  {merged_n}")
    print(f"  blocked: {blocked_n}")
    print(f"  pending: {pending_n}")
    print(f"  total:   {total}  (merged+blocked+pending={merged_n + blocked_n + pending_n})")
    print()
    print("Non-merged processes:")
    for line in details:
        print(line)

    # Sanity: originally-blocked that are now merged
    still_blocked = [pid for pid in ORIGINAL_BLOCKED_IDS if pid not in merges]
    later_merged = [pid for pid in ORIGINAL_BLOCKED_IDS if pid in merges]
    print()
    print(f"Original-8 later merged ({len(later_merged)}): {', '.join(later_merged) or '(none)'}")
    print(f"Original-8 still blocked ({len(still_blocked)}): {', '.join(still_blocked) or '(none)'}")

    if merged_n + blocked_n + pending_n != 194:
        print("ERROR: counts do not sum to 194", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
