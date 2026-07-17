"""T02 inventory parser tests."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from orchestrator.inventory_parser import hub_files_for, parse_inventory

FIXTURE = Path(__file__).parent / "fixtures" / "mini-inventory.md"
REAL = ROOT / "audit" / "process-inventory-20260717.md"


def test_mini_parse_count_and_ids():
    records = parse_inventory(FIXTURE)
    ids = [r.id for r in records]
    assert ids == [
        "auth-google-oauth",
        "boot-storage-migrate",
        "input-normalize-study-material",
        "llm-c-misc-enrichment",
    ]


def test_depends_on_extracts_inventory_ids():
    records = {r.id: r for r in parse_inventory(FIXTURE)}
    assert "auth-google-oauth" in records["input-normalize-study-material"].depends_on_ids
    assert records["auth-google-oauth"].depends_on_ids == []


def test_risk_and_critical():
    records = {r.id: r for r in parse_inventory(FIXTURE)}
    assert records["boot-storage-migrate"].static_risk_assessment == "unknown"
    assert records["auth-google-oauth"].is_critical_path_for_demo == "yes"
    assert records["auth-google-oauth"].static_risk_assessment == "likely-fragile"


def test_hub_files():
    assert hub_files_for(["study.js", "auth.js"]) == ["study.js"]
    assert hub_files_for(["foo/api.js"]) == ["api.js"]


def test_real_inventory_count():
    if not REAL.is_file():
        return
    records = parse_inventory(REAL)
    assert len(records) == 194
    unknowns = [r for r in records if r.static_risk_assessment == "unknown"]
    assert len(unknowns) == 9


if __name__ == "__main__":
    test_mini_parse_count_and_ids()
    test_depends_on_extracts_inventory_ids()
    test_risk_and_critical()
    test_hub_files()
    test_real_inventory_count()
    print("T02 OK")
