# Research: Loop Engineering Orchestrator

**Feature**: `20260718-loop-engineering` | **Date**: 2026-07-18

## R1 — Fixture library path

- **Decision**: `fixtures/` at repo root (also `fixtures-normalizacion/`, `cursor-tests/fixtures/` for narrower cases).
- **Rationale**: Spec §3 open question; inspection found ~47 files including PDF/HTML Wikipedia dumps, NIPS paper PDF, `session-samples/`.
- **Alternatives**: Hardcoding a VPS-only path — rejected; use `config.fixture_library_path: fixtures`.

## R2 — Test runner convention

- **Decision**: Product/loop tests = `cursor-tests/loop-engineering/<process_id>.mjs` (or `.test.mjs`), executed with `node <file>` like existing `cursor-tests/2026*.mjs`. Orchestrator self-tests = `pytest` under `tests/orchestrator/`.
- **Rationale**: No `package.json` test script; entire project uses dated `cursor-tests/*.mjs` files.
- **Alternatives**: Invent `test/` + `node --test` — rejected to avoid parallel conventions.

## R3 — Cursor CLI availability & flags

- **Decision**: Config key `agent_command_template` defaulting to `agent -p --force --model {model}`; verified on VPS at setup. Local/dev uses `--dry-run` / stub runner when binary missing.
- **Rationale**: `agent` not on PATH on current Windows workstation; VPS is the production host. Spec §13 requires empirical `--help` on target.
- **Alternatives**: Assume `cursor-agent` — deferred until VPS check; store both candidates in config comments.

## R4 — Rate-limit / exhaustion signatures

- **Decision**: `config.exhaustion_matchers: []` list of case-insensitive substrings; seed with placeholders (`rate limit`, `quota`, `insufficient`, `credit`, `usage limit`) and require VPS capture to finalize.
- **Rationale**: Spec forbids guessing exact Cursor CLI strings; matchers are data not code.
- **Alternatives**: Hardcoded single string — rejected.

## R5 — Throwaway merge for regression gate

- **Decision**: Temp branch approach: `git checkout -B loop-eng/_regress-<id> main` → merge process branch → run suite → reset/delete temp branch. Prefer over worktree unless VPS already uses worktrees.
- **Rationale**: No existing project worktree tooling found; temp branch is simpler and sufficient.
- **Alternatives**: `git worktree` — optional later optimization.

## R6 — Tier 2 embedding grounding from Python

- **Decision**: Verification Tier 2 shells out to a small Node helper (`orchestrator/tools/grounding-check.mjs`) that imports embedding cosine helpers / calls Gemini embedding path consistent with `src/js/vault/embeddings.js` + `embedding-math.js`. Threshold from config (placeholder 0.75).
- **Rationale**: Embeddings stack is JS + browser crypto / Gemini client; reimplementing in Python duplicates auth and model wiring.
- **Alternatives**: Pure Python Gemini client — more code, drift risk.

## R7 — Inventory markdown parsing

- **Decision**: Section headers `## N. Title`; process tables with pipe rows; parse columns by header name. `depends_on`: extract backtick-quoted tokens that match known process ids; remainder = external.
- **Rationale**: Inventory format is consistent tables under numbered sections (verified sample).
- **Alternatives**: LLM parse — rejected (deterministic required).

## R8 — Concurrency model

- **Decision**: Single-threaded asyncio or threading with `subprocess` wait; scheduler releases on completion callback; no multi-process orchestrator self-replication (tmux owns persistence).
- **Rationale**: Spec §4 — one long-running process.
- **Alternatives**: Celery/RQ — YAGNI.

## R9 — Progress path gitignore

- **Decision**: Ignore `progress/state.json` and `progress/run-log-*.md`; keep `progress/.gitkeep`. Optionally commit `flow_groups.json` as generated artifact under `orchestrator/generated/` for inspectability.
- **Rationale**: Runtime state must not fight merges; manifest is useful for humans.

## R10 — tier3_process_ids seed

- **Decision**: Populate from inventory once ids confirmed; seed candidates: `llm-c-socratic-tutor`, recall tutor, review socratic/batch ids matching inventory. Empty list disables Tier 3 safely.
- **Rationale**: Spec forbids algorithmic inference from risk alone.
