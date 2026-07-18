# Contract: Agent prompts & allowlists

## Invocation

```
{agent_bin} -p --force --model {model}   # prompt body on stdin, not argv
```

- **Prompt delivery**: write the full prompt to the process **stdin** (no prompt positional argv). Cursor CLI `agent` reads the initial prompt from stdin when no prompt argument is given. Do **not** pass the prompt as an argv element — that hits Linux ~128KB `MAX_ARG_STRLEN` as rubric/fixture context grows.
- Applies to both test-agent and fix-agent invocations.
- cwd = repo root
- branch = `loop-eng/<process_id>` already checked out
- timeout = `config.agent_timeout_seconds` (default 600)
- On timeout: kill process **tree**, count failed attempt

## Test-agent constraints

**May create/modify only**: `cursor-tests/loop-engineering/<process_id>.mjs` (and directory create).

**Must not**: any `src/**`, `index.html`, `sw.js`, orchestrator code, inventory, progress.

**Enforcement**: after run, `git diff --name-only` / `git status --porcelain`; if any path outside allowlist → `git checkout -- .` + `git clean -fd` (scoped carefully) → failed attempt.

**Prompt must include**: inventory row verbatim, bugs-found entry if any, enrichment-log entry if any, risk assessment, instruction for Tier-1 vs property tests, English only.

**Ground-truth rubric context (normalization/DPP-T0-T1 only)**: when the process is normalization or DPP-T0/T1 work (inventory id matching `input-normalize-*` or `dpp-t0.*`/`dpp-t1.*`) AND a matching `rubric.json` exists under `fixtures-normalizacion/<case>/`, the test-agent prompt MUST additionally include the full contents of that case's `rubric.json` and `notes.md` as authoritative expected-output ground truth for writing Tier 1 structural assertions. Every case folder with a `rubric.json` is included; the prompt instructs the agent to heed each rubric's `confidence` / `needs_human_review` fields and not hard-assert low-confidence claims. This is prompt-context enrichment only — it does not alter the verification cascade tiers below. Processes without a matching rubric get no rubric context and behave exactly as previously specified.

**Commit**: `test(<process_id>): add fixture/verification`

## Fix-agent constraints

**May modify**: source paths needed to pass the test.

**Must not**: the process test file; must not relax assertions; thresholds must not appear in prompt.

**Enforcement**: if diff includes test path → discard → failed attempt.

**Prompt must include**: inventory row, full test file contents, truncated prior failure (last ≤200 lines), English only.

**Headless / unattended (mandatory, prominent in prompt)**: This is a fully unattended headless run — no human will respond to any question. The agent must never ask for confirmation before applying or committing changes. The orchestrator re-runs the process test independently via subprocess after each attempt; the agent's self-reported belief that the test passed does not count. The task is incomplete until that independent re-run exits 0.

**Commit on success**: `fix(<process_id>): <one-line>`

**Commit on block**: `wip(<process_id>): blocked after N attempts, see progress/state.json`

## Model fallback

Ordered lists `test_agent_models` / `fix_agent_models`. On exhaustion matcher hit → next model for that attempt. List exhausted → backoff state + one ntfy; retry first model after wait.

## Verification cascade (orchestrator, not agent)

| Tier | When | Pass criteria |
|------|------|---------------|
| 1 | Always | Process Node test exits 0 |
| 2 | LLM-generative (api.js / llm.js / `llm-c-*` id) | grounding helper cosine ≥ threshold |
| 3 | `process_id ∈ tier3_process_ids` after Tier 2 fail or as required | DeepSeek JSON rubric all `true`; declare named `max_tokens` |

Failing Tier 2 without Tier 3 membership → return to fix retry with grounding failure appended.
