"""T03 flow_grouper tests."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from orchestrator.flow_grouper import build_flow_groups, build_manifest_from_inventory
from orchestrator.inventory_parser import parse_inventory

FIXTURE = Path(__file__).parent / "fixtures" / "mini-inventory.md"


def test_one_group_per_section():
    records = parse_inventory(FIXTURE)
    manifest = build_flow_groups(records)
    assert len(manifest["groups"]) == 2
    g1, g2 = manifest["groups"]
    assert g1["process_ids"] == ["auth-google-oauth", "boot-storage-migrate"]
    assert g2["process_ids"] == ["input-normalize-study-material", "llm-c-misc-enrichment"]


def test_hub_and_free_lane():
    records = parse_inventory(FIXTURE)
    manifest = build_flow_groups(records)
    g2 = manifest["groups"][1]
    assert "study.js" in g2["hub_files"] or "api.js" in g2["hub_files"]
    assert g2["free_lane"] is False


def test_needs_recon_from_unknown_not_hardcoded():
    records = parse_inventory(FIXTURE)
    manifest = build_flow_groups(records)
    g1 = manifest["groups"][0]
    assert g1["needs_recon"] is True  # boot-storage-migrate unknown


def test_collapsed_misc():
    records = parse_inventory(FIXTURE)
    manifest = build_flow_groups(records)
    g2 = manifest["groups"][1]
    assert g2["collapsed"] is True


def test_priority_critical_first():
    records = parse_inventory(FIXTURE)
    manifest = build_flow_groups(records)
    # both groups have a critical process → priority[0]==0
    assert manifest["groups"][0]["priority_score"][0] == 0


def test_write_real_manifest(tmp_path=None):
    import tempfile
    d = Path(tempfile.mkdtemp()) if tmp_path is None else Path(tmp_path)
    out = d / "flow_groups.json"
    real = ROOT / "audit" / "process-inventory-20260717.md"
    if not real.is_file():
        return
    m = build_manifest_from_inventory(real, out)
    assert out.is_file()
    assert len(m["groups"]) >= 15
    assert sum(len(g["process_ids"]) for g in m["groups"]) == 194


if __name__ == "__main__":
    test_one_group_per_section()
    test_hub_and_free_lane()
    test_needs_recon_from_unknown_not_hardcoded()
    test_collapsed_misc()
    test_priority_critical_first()
    test_write_real_manifest()
    print("T03 OK")
