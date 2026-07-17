"""Group inventory processes into flow-groups with hub locks and priority."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from orchestrator.inventory_parser import HUB_BASENAMES, ProcessRecord, hub_files_for, parse_inventory

RISK_RANK = {
    "likely-broken": 0,
    "unknown": 1,
    "likely-fragile": 2,
    "likely-fine": 3,
}

COLLAPSED_PROCESS_ID = "llm-c-misc-enrichment"


def _slug(section_name: str, section_index: int) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", section_name.lower()).strip("-")
    return f"{section_index:02d}-{base}"[:80]


def _priority(records: list[ProcessRecord]) -> list[int]:
    critical = 0 if any(r.is_critical_path_for_demo == "yes" for r in records) else 1
    risk = min((RISK_RANK.get(r.static_risk_assessment, 3) for r in records), default=3)
    return [critical, risk]


def build_flow_groups(records: list[ProcessRecord]) -> dict[str, Any]:
    by_section: dict[tuple[int, str], list[ProcessRecord]] = {}
    for r in records:
        key = (r.section_index, r.section_name)
        by_section.setdefault(key, []).append(r)

    groups = []
    for (section_index, section_name), procs in sorted(by_section.items(), key=lambda x: x[0][0]):
        # Keep llm-c-misc-enrichment in its section but flag collapsed
        process_ids = [p.id for p in procs]
        all_files: list[str] = []
        for p in procs:
            all_files.extend(p.files_involved)
        hubs = hub_files_for(all_files)
        non_hub = []
        for f in all_files:
            base = Path(f.replace("\\", "/")).name
            if base not in HUB_BASENAMES and f not in non_hub:
                non_hub.append(f)
        collapsed = COLLAPSED_PROCESS_ID in process_ids
        needs_recon = any(p.static_risk_assessment == "unknown" for p in procs)
        groups.append(
            {
                "group_id": _slug(section_name, section_index),
                "section_name": section_name,
                "process_ids": process_ids,
                "hub_files": hubs,
                "non_hub_files": non_hub,
                "priority_score": _priority(procs),
                "free_lane": len(hubs) == 0,
                "collapsed": collapsed,
                "needs_recon": needs_recon,
            }
        )

    return {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "inventory_path": "",
        "groups": groups,
    }


def write_manifest(records: list[ProcessRecord], out_path: Path, inventory_path: str) -> dict[str, Any]:
    manifest = build_flow_groups(records)
    manifest["inventory_path"] = inventory_path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


def build_manifest_from_inventory(inventory_path: str | Path, out_path: Path | None = None) -> dict[str, Any]:
    path = Path(inventory_path)
    records = parse_inventory(path)
    dest = out_path or (Path("orchestrator") / "generated" / "flow_groups.json")
    return write_manifest(records, dest, str(path).replace("\\", "/"))
