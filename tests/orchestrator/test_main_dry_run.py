"""T10 main dry-run tests."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from orchestrator.main import main

STATE = ROOT / "progress" / "state.json"
MANIFEST = ROOT / "orchestrator" / "generated" / "flow_groups.json"


def test_build_manifest():
    assert main(["build-manifest", "--config", str(ROOT / "orchestrator" / "config.example.yaml")]) == 0
    assert MANIFEST.is_file()
    m = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert sum(len(g["process_ids"]) for g in m["groups"]) == 194


def test_dry_run_max_processes():
    if STATE.is_file():
        STATE.unlink()
    rc = main(
        [
            "run",
            "--dry-run",
            "--max-processes",
            "3",
            "--config",
            str(ROOT / "orchestrator" / "config.example.yaml"),
        ]
    )
    assert rc == 0
    st = json.loads(STATE.read_text(encoding="utf-8"))
    merged = 0
    for g in st["flow_groups"].values():
        for p in g["processes"].values():
            if p.get("status") == "merged":
                merged += 1
    assert merged == 3


def test_setup_prints_topic(capsys=None):
    # setup writes config.yaml (gitignored) — use a temp copy via --config
    import tempfile
    from pathlib import Path as P
    import shutil

    d = P(tempfile.mkdtemp())
    cfg = d / "config.yaml"
    shutil.copy(ROOT / "orchestrator" / "config.example.yaml", cfg)
    assert main(["setup", "--config", str(cfg)]) == 0
    text = cfg.read_text(encoding="utf-8")
    assert "REPLACE" not in text
    assert "pith-loop-" in text


if __name__ == "__main__":
    test_build_manifest()
    test_setup_prints_topic()
    test_dry_run_max_processes()
    print("T10 OK")
