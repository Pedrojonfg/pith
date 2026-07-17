"""Per-process unit workflow (test-agent → fix-agent → verify → merge)."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Callable

from orchestrator.agent_runner import AgentRunner
from orchestrator.git_ops import GitOps
from orchestrator.verification import verify_process

# Ground-truth rubric library for normalization/DPP-T0-T1 processes (fixed repo path,
# independent of fixture_library_path which may point elsewhere).
RUBRIC_FIXTURES_DIRNAME = "fixtures-normalizacion"

# Inventory ids covered: section 2 (input-normalize-*) and DPP T0.x / T1.x phases.
_NORMALIZATION_ID_RE = re.compile(r"^(input-normalize|dpp-t[01]\.)")


def test_file_for(process_id: str, root: Path) -> Path:
    return root / "cursor-tests" / "loop-engineering" / f"{process_id}.mjs"


def is_normalization_dpp_process(process_id: str) -> bool:
    """True when the process is normalization / DPP-T0-T1 work per inventory id convention."""
    return bool(_NORMALIZATION_ID_RE.match(process_id))


def collect_rubric_context(process_id: str, fixtures_root: Path) -> str:
    """
    Ground-truth rubric context for the test-agent prompt.

    Returns the full contents of rubric.json (+ notes.md when present) for every case
    folder under fixtures_root that has a rubric.json — but only for normalization/
    DPP-T0-T1 processes. Empty string otherwise (process prompt stays unchanged).
    Prompt-context enrichment only: verification cascade tiers are not affected.
    """
    if not is_normalization_dpp_process(process_id) or not fixtures_root.is_dir():
        return ""
    sections: list[str] = []
    for case_dir in sorted(p for p in fixtures_root.iterdir() if p.is_dir()):
        rubric = case_dir / "rubric.json"
        if not rubric.is_file():
            continue
        block = [
            f"=== GROUND TRUTH CASE: {case_dir.name} ===",
            "--- rubric.json ---",
            rubric.read_text(encoding="utf-8"),
        ]
        notes = case_dir / "notes.md"
        if notes.is_file():
            block.append("--- notes.md ---")
            block.append(notes.read_text(encoding="utf-8"))
        sections.append("\n".join(block))
    if not sections:
        return ""
    header = (
        "AUTHORITATIVE EXPECTED-OUTPUT GROUND TRUTH (normalization fixture rubrics):\n"
        f"The rubric.json and notes.md contents below, from {RUBRIC_FIXTURES_DIRNAME}/<case>/, "
        "describe the verified expected structure of the fixture documents. Treat them as "
        "authoritative expected-output ground truth when writing Tier 1 structural assertions. "
        "Heed each rubric's confidence and needs_human_review fields; do not hard-assert "
        "low-confidence claims.\n"
    )
    return header + "\n\n".join(sections)


def build_test_prompt(row: dict[str, Any], risk: str, rubric_context: str = "") -> str:
    prompt = (
        "Write ONLY a Node test file for this process. Do not modify source.\n"
        f"Process row: {row}\n"
        f"static_risk_assessment: {risk}\n"
        "Use structural/exact fixtures for deterministic risk; property checks for fragile/LLM.\n"
        "English only."
    )
    if rubric_context:
        prompt += "\n" + rubric_context
    return prompt


def build_fix_prompt(row: dict[str, Any], test_contents: str, prior_failure: str) -> str:
    # FR-015: do not include verification thresholds
    prior = "\n".join((prior_failure or "").splitlines()[-200:])
    return (
        "Make the provided test pass by modifying source only. Never edit the test file.\n"
        f"Process row: {row}\n"
        f"TEST FILE:\n{test_contents}\n"
        f"PRIOR FAILURE (truncated):\n{prior}\n"
        "English only."
    )


def run_process_unit(
    *,
    process_id: str,
    row: dict[str, Any],
    files_involved: list[str],
    root: Path,
    runner: AgentRunner,
    git: GitOps,
    cfg: dict[str, Any],
    run_suite: Callable[[], bool],
    dry_run: bool = False,
) -> dict[str, Any]:
    """
    Returns process state fields to merge into state.json.
    dry_run: skip real agents/git mutations; mark merged with synthetic sha.
    """
    if dry_run:
        return {
            "status": "merged",
            "attempts": 1,
            "block_reason": None,
            "branch": None,
            "merged_commit_sha": f"dry-{process_id}",
        }

    branch = git.create_process_branch(process_id)
    test_path = test_file_for(process_id, root)
    rel_test = str(test_path.relative_to(root)).replace("\\", "/")

    # --- test agent ---
    rubric_context = collect_rubric_context(process_id, root / RUBRIC_FIXTURES_DIRNAME)
    tres = runner.run_with_fallback(
        models=list(cfg.get("test_agent_models") or ["composer-2.5"]),
        prompt=build_test_prompt(row, row.get("static_risk_assessment", ""), rubric_context),
        cwd=root,
        mode="test",
    )
    if tres.exhausted_models or not tres.ok:
        git.commit_all(f"wip({process_id}): blocked after test-agent failure, see progress/state.json")
        return {
            "status": "blocked",
            "attempts": 0,
            "block_reason": "test_agent_failed",
            "branch": branch,
            "merged_commit_sha": None,
        }
    git.commit_all(f"test({process_id}): add fixture/verification")

    # --- fix agent loop ---
    max_attempts = int(cfg.get("max_fix_attempts", 6))
    prior = ""
    attempts = 0
    for attempts in range(1, max_attempts + 1):
        test_contents = test_path.read_text(encoding="utf-8") if test_path.is_file() else ""
        fres = runner.run_with_fallback(
            models=list(cfg.get("fix_agent_models") or ["composer-2.5"]),
            prompt=build_fix_prompt(row, test_contents, prior),
            cwd=root,
            mode="fix",
            forbidden_test_path=rel_test,
        )
        if fres.exhausted_models:
            break
        if fres.allowlist_violation:
            prior = fres.stderr
            continue
        v = verify_process(
            process_id=process_id,
            files_involved=files_involved,
            test_path=test_path,
            tier3_ids=list(cfg.get("tier3_process_ids") or []),
            threshold=float(cfg.get("grounding_similarity_threshold", 0.75)),
            helper_path=root / "orchestrator" / "tools" / "grounding-check.mjs",
        )
        if v.passed:
            git.commit_all(f"fix({process_id}): pass verification")
            git.tag_checkpoint(process_id)
            ok, temp = git.throwaway_merge_ok(branch)
            if not ok:
                return {
                    "status": "blocked",
                    "attempts": attempts,
                    "block_reason": "merge_conflict",
                    "branch": branch,
                    "merged_commit_sha": None,
                }
            suite_ok = run_suite()
            git.cleanup_temp_branch(temp)
            if not suite_ok:
                return {
                    "status": "blocked",
                    "attempts": attempts,
                    "block_reason": "regression",
                    "branch": branch,
                    "merged_commit_sha": None,
                }
            sha = git.merge_to_main(branch)
            git.delete_branch(branch, remote=True)
            return {
                "status": "merged",
                "attempts": attempts,
                "block_reason": None,
                "branch": None,
                "merged_commit_sha": sha,
            }
        prior = v.detail

    git.commit_all(f"wip({process_id}): blocked after {attempts} attempts, see progress/state.json")
    return {
        "status": "blocked",
        "attempts": attempts,
        "block_reason": "exhausted",
        "branch": branch,
        "merged_commit_sha": None,
    }
