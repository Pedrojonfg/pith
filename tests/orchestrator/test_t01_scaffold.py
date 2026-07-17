# T01 validate: orchestrator scaffold exists
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

def test_package_importable():
    import importlib
    mod = importlib.import_module("orchestrator")
    assert mod.__file__ and "orchestrator" in mod.__file__.replace("\\", "/")
    assert mod.__file__.endswith(os.path.join("orchestrator", "__init__.py")) or mod.__file__.endswith(
        "orchestrator/__init__.py"
    )

def test_example_config_exists():
    p = ROOT / "orchestrator" / "config.example.yaml"
    assert p.is_file(), f"missing {p}"
    text = p.read_text(encoding="utf-8")
    assert "test_agent_models" in text
    assert "ntfy_topic" in text
    assert "free_lane_cap" in text

def test_requirements_exists():
    assert (ROOT / "orchestrator" / "requirements.txt").is_file()

def test_progress_gitkeep():
    assert (ROOT / "progress" / ".gitkeep").is_file()

def test_loop_engineering_testdir():
    assert (ROOT / "cursor-tests" / "loop-engineering" / ".gitkeep").is_file()

def test_progress_runtime_gitignored():
    gi = (ROOT / ".gitignore").read_text(encoding="utf-8")
    assert "progress/state.json" in gi
    assert "progress/run-log-" in gi

if __name__ == "__main__":
    test_package_importable()
    test_example_config_exists()
    test_requirements_exists()
    test_progress_gitkeep()
    test_loop_engineering_testdir()
    test_progress_runtime_gitignored()
    print("T01 OK")
