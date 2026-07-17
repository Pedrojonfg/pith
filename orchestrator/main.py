"""CLI entrypoint for the loop-engineering orchestrator."""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Any

import yaml

from orchestrator.agent_runner import AgentRunner
from orchestrator.flow_grouper import build_manifest_from_inventory
from orchestrator.git_ops import GitOps
from orchestrator.notify import (
    generate_topic,
    notify_blocked,
    notify_flow_group_done,
    notify_run_complete,
    notify_start,
    notify_unhandled,
)
from orchestrator.process_workflow import run_process_unit
from orchestrator.scheduler import Scheduler, next_process_in_group
from orchestrator.state import atomic_write_json, load_or_init
from orchestrator.inventory_parser import parse_inventory

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "orchestrator" / "config.yaml"
EXAMPLE_CONFIG = ROOT / "orchestrator" / "config.example.yaml"
STATE_PATH = ROOT / "progress" / "state.json"
MANIFEST_PATH = ROOT / "orchestrator" / "generated" / "flow_groups.json"


def load_config(path: Path) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def cmd_setup(args: argparse.Namespace) -> int:
    dest = Path(args.config) if args.config else DEFAULT_CONFIG
    if not dest.is_file():
        shutil.copy(EXAMPLE_CONFIG, dest)
    cfg = load_config(dest)
    if not cfg.get("ntfy_topic") or "REPLACE" in str(cfg.get("ntfy_topic")):
        cfg["ntfy_topic"] = generate_topic()
        dest.write_text(yaml.safe_dump(cfg, sort_keys=False), encoding="utf-8")
    topic = cfg["ntfy_topic"]
    print(f"Subscribe at https://ntfy.sh/{topic}")
    print(f"Config written: {dest}")
    return 0


def cmd_build_manifest(args: argparse.Namespace) -> int:
    cfg = load_config(Path(args.config) if args.config else (DEFAULT_CONFIG if DEFAULT_CONFIG.is_file() else EXAMPLE_CONFIG))
    inv = ROOT / cfg.get("inventory_path", "audit/process-inventory-20260717.md")
    out = Path(args.out) if args.out else MANIFEST_PATH
    m = build_manifest_from_inventory(inv, out)
    print(f"Wrote {out} with {len(m['groups'])} groups, {sum(len(g['process_ids']) for g in m['groups'])} processes")
    return 0


def _process_status_map(state: dict[str, Any], group_id: str) -> dict[str, str]:
    g = state["flow_groups"].get(group_id, {})
    return {pid: p.get("status", "pending") for pid, p in g.get("processes", {}).items()}


def _all_terminal(state: dict[str, Any]) -> bool:
    for g in state["flow_groups"].values():
        for p in g["processes"].values():
            if p.get("status") not in ("merged", "blocked"):
                return False
    return True


def _remaining(state: dict[str, Any]) -> int:
    n = 0
    for g in state["flow_groups"].values():
        for p in g["processes"].values():
            if p.get("status") not in ("merged", "blocked"):
                n += 1
    return n


def cmd_run(args: argparse.Namespace) -> int:
    config_path = Path(args.config) if args.config else (DEFAULT_CONFIG if DEFAULT_CONFIG.is_file() else EXAMPLE_CONFIG)
    cfg = load_config(config_path)
    dry = bool(args.dry_run)
    max_processes = int(args.max_processes) if args.max_processes else None

    posts: list[str] = []

    def poster(url, data, headers):
        posts.append(data.decode("utf-8"))

    notify_kw = {"poster": poster} if dry else {}

    if not MANIFEST_PATH.is_file():
        cmd_build_manifest(argparse.Namespace(config=str(config_path), out=str(MANIFEST_PATH)))
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    def merged_on_main(pid: str, sha: str | None) -> bool:
        if dry:
            # in dry-run, trust sha presence as merged
            return bool(sha and str(sha).startswith("dry"))
        if not sha:
            return False
        try:
            return GitOps(ROOT).process_merged_on_main(pid, sha)
        except Exception:
            return False

    state = load_or_init(STATE_PATH, manifest, merged_on_main=merged_on_main)

    # Build process row lookup from inventory
    inv_path = ROOT / cfg.get("inventory_path", "audit/process-inventory-20260717.md")
    records = {r.id: r for r in parse_inventory(inv_path)} if inv_path.is_file() else {}

    topic = cfg.get("ntfy_topic") or "pith-loop-dry"
    if dry and "REPLACE" in str(topic):
        topic = generate_topic()

    try:
        notify_start(topic, _remaining(state), "starting", **notify_kw)
    except ValueError:
        topic = generate_topic()
        notify_start(topic, _remaining(state), "starting", **notify_kw)

    runner = AgentRunner(
        agent_bin=cfg.get("agent_bin", "agent"),
        command_template=cfg.get("agent_command_template", "agent -p --force --model {model}"),
        timeout_seconds=int(cfg.get("agent_timeout_seconds", 600)),
        exhaustion_matchers=list(cfg.get("exhaustion_matchers") or []),
        allowlist_prefix=cfg.get("test_allowlist_prefix", "cursor-tests/loop-engineering/"),
        dry_run=dry,
    )
    if not dry:
        runner.ensure_binary()

    sched = Scheduler(free_lane_cap=int(cfg.get("free_lane_cap", 2)))
    git = GitOps(
        ROOT,
        remote_push=not dry and not args.dry_run,
        test_allowlist_prefix=cfg.get("test_allowlist_prefix", "cursor-tests/loop-engineering/"),
    )
    processed = 0

    def run_suite() -> bool:
        # Accumulated loop-engineering suite: run all *.mjs under cursor-tests/loop-engineering/
        suite_dir = ROOT / "cursor-tests" / "loop-engineering"
        if not suite_dir.is_dir():
            return True
        import subprocess

        for f in sorted(suite_dir.glob("*.mjs")):
            r = subprocess.run(["node", str(f)], capture_output=True, text=True)
            if r.returncode != 0:
                return False
        return True

    while not _all_terminal(state):
        if max_processes is not None and processed >= max_processes:
            break

        def is_done(gid: str) -> bool:
            g = state["flow_groups"].get(gid, {})
            procs = g.get("processes", {})
            return bool(procs) and all(p.get("status") in ("merged", "blocked") for p in procs.values())

        group = sched.pick_next(manifest["groups"], is_done=is_done)
        if group is None:
            break

        gid = group["group_id"]
        state["flow_groups"][gid]["status"] = "active"
        sched.acquire(group)
        atomic_write_json(STATE_PATH, state)

        while True:
            status_map = _process_status_map(state, gid)
            pid = next_process_in_group(group, status_map)
            if pid is None:
                break
            if max_processes is not None and processed >= max_processes:
                break

            rec = records.get(pid)
            row = {
                "id": pid,
                "name": getattr(rec, "name", ""),
                "files_involved": getattr(rec, "files_involved", []),
                "static_risk_assessment": getattr(rec, "static_risk_assessment", "unknown"),
                "depends_on": getattr(rec, "depends_on_raw", ""),
            }
            result = run_process_unit(
                process_id=pid,
                row=row,
                files_involved=list(row["files_involved"]),
                root=ROOT,
                runner=runner,
                git=git,
                cfg=cfg,
                run_suite=run_suite,
                dry_run=dry,
            )
            state["flow_groups"][gid]["processes"][pid].update(result)
            if result.get("status") == "blocked":
                notify_blocked(topic, pid, str(result.get("block_reason")), **notify_kw)
            processed += 1
            atomic_write_json(STATE_PATH, state)

        sched.release(group)
        if is_done(gid):
            state["flow_groups"][gid]["status"] = "done"
            summary = ", ".join(
                f"{p}={state['flow_groups'][gid]['processes'][p]['status']}" for p in group["process_ids"]
            )
            notify_flow_group_done(topic, gid, summary, **notify_kw)
        atomic_write_json(STATE_PATH, state)

        if max_processes is not None and processed >= max_processes:
            break

    if _all_terminal(state):
        notify_run_complete(topic, **notify_kw)
    atomic_write_json(STATE_PATH, state)
    print(f"done processed={processed} remaining={_remaining(state)} dry_run={dry}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="orchestrator")
    sub = parser.add_subparsers(dest="cmd")

    p_setup = sub.add_parser("setup", help="Generate ntfy topic + config.yaml")
    p_setup.add_argument("--config", default=None)

    p_man = sub.add_parser("build-manifest", help="Parse inventory → flow_groups.json")
    p_man.add_argument("--config", default=None)
    p_man.add_argument("--out", default=None)

    p_run = sub.add_parser("run", help="Run / resume orchestrator loop")
    p_run.add_argument("--config", default=None)
    p_run.add_argument("--dry-run", action="store_true")
    p_run.add_argument("--max-processes", type=int, default=None)

    args = parser.parse_args(argv)
    try:
        if args.cmd == "setup":
            return cmd_setup(args)
        if args.cmd == "build-manifest":
            return cmd_build_manifest(args)
        if args.cmd == "run":
            return cmd_run(args)
        parser.print_help()
        return 2
    except Exception as e:
        # best-effort notify
        try:
            cfg_path = DEFAULT_CONFIG if DEFAULT_CONFIG.is_file() else EXAMPLE_CONFIG
            topic = load_config(cfg_path).get("ntfy_topic")
            if topic and "REPLACE" not in str(topic):
                notify_unhandled(topic, str(e))
        except Exception:
            pass
        print(f"UNHANDLED: {e}", file=sys.stderr)
        raise


if __name__ == "__main__":
    raise SystemExit(main())
