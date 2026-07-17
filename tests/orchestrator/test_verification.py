"""T09 verification tests."""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from orchestrator.verification import (
    is_llm_generative,
    run_tier1_node_test,
    run_tier3_judge,
    verify_process,
)

HELPER = ROOT / "orchestrator" / "tools" / "grounding-check.mjs"


def test_is_llm_generative():
    assert is_llm_generative("llm-c-foo", [])
    assert is_llm_generative("x", ["api.js"])
    assert not is_llm_generative("auth-google-oauth", ["auth.js"])


def test_tier1_pass_fail():
    with tempfile.TemporaryDirectory() as td:
        ok = Path(td) / "ok.mjs"
        ok.write_text("console.log('ok');\n", encoding="utf-8")
        assert run_tier1_node_test(ok).passed
        bad = Path(td) / "bad.mjs"
        bad.write_text("process.exit(1);\n", encoding="utf-8")
        assert not run_tier1_node_test(bad).passed


def test_deterministic_skips_tier2():
    with tempfile.TemporaryDirectory() as td:
        t = Path(td) / "t.mjs"
        t.write_text("\n", encoding="utf-8")
        r = verify_process(
            process_id="auth-google-oauth",
            files_involved=["auth.js"],
            test_path=t,
            tier3_ids=[],
            threshold=0.75,
            helper_path=HELPER,
        )
        assert r.passed and r.tier == 1


def test_tier2_fail_no_tier3_returns_fail():
    with tempfile.TemporaryDirectory() as td:
        t = Path(td) / "t.mjs"
        t.write_text("\n", encoding="utf-8")
        r = verify_process(
            process_id="llm-c-socratic-tutor",
            files_involved=["api.js"],
            test_path=t,
            tier3_ids=[],
            threshold=0.99,
            helper_path=HELPER,
            generated_text="alpha",
            source_text="zzz unrelated",
            tier2_runner=lambda g, s: 0.1,
        )
        assert not r.passed and r.tier == 2


def test_tier3_only_for_configured():
    with tempfile.TemporaryDirectory() as td:
        t = Path(td) / "t.mjs"
        t.write_text("\n", encoding="utf-8")
        r = verify_process(
            process_id="llm-c-socratic-tutor",
            files_involved=["api.js"],
            test_path=t,
            tier3_ids=["llm-c-socratic-tutor"],
            threshold=0.99,
            helper_path=HELPER,
            tier2_runner=lambda g, s: 0.1,
            tier3_caller=lambda pid, rubric: {k: True for k in rubric},
            tier3_rubric={"grounded": False, "addresses_question": False, "no_hallucinated_facts": False},
        )
        assert r.passed and r.tier == 3


def test_thresholds_not_in_module_fix_prompt_contract():
    # FR-015: verification module must not export threshold into prompt builders
    import orchestrator.verification as v
    assert not hasattr(v, "build_fix_agent_prompt")


if __name__ == "__main__":
    test_is_llm_generative()
    test_tier1_pass_fail()
    test_deterministic_skips_tier2()
    test_tier2_fail_no_tier3_returns_fail()
    test_tier3_only_for_configured()
    test_thresholds_not_in_module_fix_prompt_contract()
    print("T09 OK")
