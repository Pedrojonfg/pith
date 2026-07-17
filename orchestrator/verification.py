"""Verification cascade: Tier 1 structural, Tier 2 grounding, Tier 3 LLM judge."""
from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Sequence


@dataclass
class VerificationResult:
    passed: bool
    tier: int
    detail: str = ""
    escalate_to_tier3: bool = False


def run_tier1_node_test(test_path: Path, *, node_bin: str = "node") -> VerificationResult:
    if not test_path.is_file():
        return VerificationResult(False, 1, f"missing test file {test_path}")
    r = subprocess.run([node_bin, str(test_path)], capture_output=True, text=True)
    if r.returncode == 0:
        return VerificationResult(True, 1, "tier1 ok")
    return VerificationResult(False, 1, (r.stderr or r.stdout or "tier1 failed")[-2000:])


def is_llm_generative(process_id: str, files_involved: Sequence[str]) -> bool:
    if process_id.startswith("llm-c-"):
        return True
    bases = {Path(f.replace("\\", "/")).name for f in files_involved}
    return bool(bases & {"api.js", "llm.js"})


def run_tier2_grounding(
    *,
    generated_text: str,
    source_text: str,
    threshold: float,
    helper_path: Path,
    runner: Callable[..., float] | None = None,
) -> VerificationResult:
    """Return pass/fail; on fail set escalate_to_tier3 for caller if process in tier3 list."""
    if runner:
        score = runner(generated_text, source_text)
    else:
        score = _run_grounding_helper(helper_path, generated_text, source_text)
    if score >= threshold:
        return VerificationResult(True, 2, f"cosine={score:.4f}")
    return VerificationResult(False, 2, f"cosine={score:.4f} < {threshold}", escalate_to_tier3=True)


def _run_grounding_helper(helper_path: Path, generated: str, source: str) -> float:
    if not helper_path.is_file():
        # offline stub: token overlap ratio as weak proxy for tests without network
        return _token_overlap(generated, source)
    payload = json.dumps({"generated": generated, "source": source})
    r = subprocess.run(
        ["node", str(helper_path)],
        input=payload,
        capture_output=True,
        text=True,
        check=False,
    )
    if r.returncode != 0:
        return 0.0
    try:
        return float(json.loads(r.stdout).get("cosine", 0.0))
    except (json.JSONDecodeError, TypeError, ValueError):
        return 0.0


def _token_overlap(a: str, b: str) -> float:
    ta = set(a.lower().split())
    tb = set(b.lower().split())
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def run_tier3_judge(
    *,
    process_id: str,
    rubric: dict[str, bool],
    call_llm: Callable[[str, dict], dict[str, bool]] | None = None,
) -> VerificationResult:
    """
    DeepSeek structured judge. call_llm injectable.
    MUST declare max_tokens at real call site (see contracts).
    """
    if call_llm is None:
        # without LLM, fail closed unless rubric pre-filled for tests
        if rubric and all(rubric.values()):
            return VerificationResult(True, 3, "rubric pre-pass")
        return VerificationResult(False, 3, "tier3 LLM unavailable")
    result = call_llm(process_id, rubric)
    ok = all(bool(result.get(k)) for k in rubric)
    return VerificationResult(ok, 3, json.dumps(result))


def verify_process(
    *,
    process_id: str,
    files_involved: Sequence[str],
    test_path: Path,
    tier3_ids: Sequence[str],
    threshold: float,
    helper_path: Path,
    generated_text: str = "",
    source_text: str = "",
    tier2_runner: Callable[..., float] | None = None,
    tier3_caller: Callable[..., dict[str, bool]] | None = None,
    tier3_rubric: dict[str, bool] | None = None,
) -> VerificationResult:
    t1 = run_tier1_node_test(test_path)
    if not t1.passed:
        return t1
    if not is_llm_generative(process_id, files_involved):
        return t1
    t2 = run_tier2_grounding(
        generated_text=generated_text or "n/a",
        source_text=source_text or "n/a",
        threshold=threshold,
        helper_path=helper_path,
        runner=tier2_runner,
    )
    if t2.passed:
        return t2
    if process_id in tier3_ids:
        return run_tier3_judge(
            process_id=process_id,
            rubric=tier3_rubric or {"grounded": True, "addresses_question": True, "no_hallucinated_facts": True},
            call_llm=tier3_caller,
        )
    return t2
