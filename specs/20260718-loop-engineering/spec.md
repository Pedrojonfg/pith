# Feature Specification: Autonomous Loop Engineering Orchestrator

**Feature Branch**: `20260718-loop-engineering`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Autonomous multi-day loop that works through the 194-process audit inventory, writes a test per process, iterates a fix-agent until pass or retry exhaustion, auto-merges to main with regression protection. Runs unattended on VPS via Python orchestrator + Cursor CLI. Source of truth: `spec-looplearningorch.md`."

**Source design doc**: `spec-looplearningorch.md` (architecture detail; this Speckit spec owns acceptance criteria)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unattended coverage loop over the audit inventory (Priority: P1)

An operator starts the orchestrator once on a dedicated VPS. It reads the 194-process inventory, groups work into flow-groups, and for each process: creates a test, attempts fixes until the test passes (or budget is exhausted), verifies, and merges successful work to `main` — without further human interaction on the happy path.

**Why this priority**: This is the entire product value — unattended progress through the audit inventory with durable merges.

**Independent Test**: With a stubbed agent runner and a tiny synthetic inventory (2–3 processes), the orchestrator advances each process through terminal states (`merged` or `blocked`) and updates durable progress state.

**Acceptance Scenarios**:

1. **Given** a fresh progress state and a valid inventory, **When** the orchestrator runs, **Then** every process eventually reaches a terminal status (`merged` or `blocked`).
2. **Given** a process whose fix-agent test passes and whose regression suite passes, **When** merge is authorized, **Then** the change is on `main`, pushed, and the process branch is deleted.
3. **Given** fix attempts are exhausted without a passing test, **When** the process is marked blocked, **Then** a WIP commit remains on a kept branch, `main` is unchanged for that process, and a notification is sent.

---

### User Story 2 - Safe concurrent scheduling via hub-file locks (Priority: P1)

Multiple flow-groups may run concurrently only when their hub-file locks (`study.js`, `api.js`, `session-store.js`) do not conflict, with a capped number of free-lane (no-hub) groups. Within a flow-group, processes run strictly one at a time.

**Why this priority**: Without lock discipline, concurrent agents corrupt the same hub files and defeat the "one change at a time" safety model.

**Independent Test**: Feed a scheduler with conflicting and non-conflicting groups; assert lock acquisition, free-lane cap, and intra-group sequentiality.

**Acceptance Scenarios**:

1. **Given** two groups both requiring `study.js`, **When** one is active, **Then** the other waits until the lock is released.
2. **Given** a free-lane group and `free_lane_cap` already reached, **When** another free-lane group is eligible, **Then** it waits.
3. **Given** an active flow-group with multiple processes, **When** scheduling within that group, **Then** only one process runs at a time.

---

### User Story 3 - Survive restarts and model exhaustion (Priority: P1)

After a VPS restart, orchestrator crash, or Cursor model rate-limit/credit exhaustion, the system resumes safely from durable state and git history — never requiring a human to edit config or manually unblock the happy path.

**Why this priority**: Multi-day unattended runs are useless if idle periods or restarts leave the loop stuck.

**Independent Test**: Simulate crash mid-process and model-exhaustion; confirm reconciliation from `state.json` + `main` git log, backoff-then-retry, and a single exhaustion notification.

**Acceptance Scenarios**:

1. **Given** progress marked `merged` but the commit is missing from `main`, **When** the orchestrator starts, **Then** that process is reverted to `pending` and restarted cleanly.
2. **Given** a process left in `fixing`/`verified` without a merge on `main`, **When** the orchestrator starts, **Then** it restarts that process from the beginning (no mid-attempt resume).
3. **Given** all models in a role's fallback list are exhausted, **When** the orchestrator continues, **Then** it enters backoff (with cap), retries the first model later, and notifies once per exhaustion event.

---

### User Story 4 - Agent role boxing and regression gate (Priority: P1)

The test-agent may only create/modify test files; the fix-agent may only modify source (never the test). Before any merge, the full accumulated loop-engineering suite must pass on a throwaway merge of the process branch.

**Why this priority**: Without boxing and regression gates, agents can cheat tests or land breaking changes on `main`.

**Independent Test**: Inject an out-of-allowlist diff and a regression failure; confirm discard/failed-attempt and no merge.

**Acceptance Scenarios**:

1. **Given** the test-agent touches a non-test path, **When** the allowlist check runs, **Then** changes are discarded and the attempt counts as failed.
2. **Given** the fix-agent modifies the test file, **When** the allowlist check runs, **Then** changes are discarded and the attempt counts as failed.
3. **Given** the process test passes but the accumulated suite fails on the throwaway merge, **When** the regression gate runs, **Then** the process is `blocked` with reason `regression`, the branch is kept, and `main` is not updated.

---

### User Story 5 - Operator visibility via sparse notifications (Priority: P2)

The operator receives push notifications for start/resume, flow-group completion, blocked processes, model exhaustion, full-run completion, and unhandled orchestrator exceptions — not for every successful process.

**Why this priority**: Needed for unattended ops, but secondary to correct scheduling and merge safety.

**Independent Test**: Drive each notification event once; assert topic POST fires and successful process merges do not notify individually.

**Acceptance Scenarios**:

1. **Given** a flow-group finishes (all processes merged or blocked), **When** the group completes, **Then** one notification is sent summarizing the group.
2. **Given** a process merges successfully, **When** merge completes, **Then** no per-process success notification is sent.
3. **Given** an unhandled orchestrator exception, **When** it is caught, **Then** a notification is sent before auto-recovery is attempted.

---

### Edge Cases

- Inventory row `depends_on` text does not name another inventory id → treat as external dependency (no scheduling edge).
- `llm-c-misc-enrichment` must remain one collapsed unit (never split into sub-fixes).
- Processes with `static_risk_assessment == unknown` are tagged for recon; behavior fix is out of scope — only reachability precursor applies.
- Cursor CLI missing or unauthenticated at startup → fail loudly; do not silently degrade.
- Agent invocation times out → kill full process tree; count as one failed attempt.
- Crash between local merge and remote push → startup reconciliation detects missing SHA on `main` and reverts status.
- ntfy topic must be random/unguessable at setup (topics are public-by-default).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST parse `audit/process-inventory-20260717.md` into structured process records (`id`, `files_involved`, `depends_on`, `static_risk_assessment`, `is_critical_path_for_demo`, section membership).
- **FR-002**: System MUST derive flow-groups from inventory `##` sections, compute hub files ∩ `{study.js, api.js, session-store.js}`, priority scores, `collapsed` for `llm-c-misc-enrichment`, and `needs_recon` for all `unknown`-risk processes (derived at parse time, not hardcoded).
- **FR-003**: System MUST schedule with named locks for hub files, `free_lane_cap` (default 2), and strictly sequential process execution within a flow-group.
- **FR-004**: For each process, system MUST invoke a test-agent that may only write test files under the repo's established test convention, then commit `test(<process_id>): add fixture/verification` on branch `loop-eng/<process_id>`.
- **FR-005**: System MUST invoke a fix-agent (source-only edits) up to `max_fix_attempts` (default 6), running the process test after each attempt; on exhaustion mark `blocked`, keep WIP branch, do not merge.
- **FR-006**: System MUST enforce test/source allowlists via `git diff --name-only` after each agent invocation; out-of-policy diffs are discarded and count as failed attempts.
- **FR-007**: System MUST apply a verification cascade after the process test passes: Tier 1 structural always; Tier 2 embedding grounding for LLM-generative processes; Tier 3 DeepSeek structured judge only for configured `tier3_process_ids`.
- **FR-008**: Before merge, system MUST tag `checkpoint-before-<process_id>` on `main`, run the full accumulated loop-engineering suite on a throwaway merge of the process branch, then merge+push only on pass; on failure mark `blocked`/`regression` and keep the branch.
- **FR-009**: On successful merge, system MUST push immediately to `origin main` and delete the process branch locally and remotely.
- **FR-010**: System MUST persist authoritative scheduling state in `progress/state.json` and reconcile against `main` git log (commit-message convention) on every startup.
- **FR-011**: System MUST support ordered model fallback lists per agent role, exhaustion backoff with cap, and never require manual config edits to resume after model unavailability.
- **FR-012**: System MUST notify via ntfy.sh for: start/resume, flow-group complete, process blocked, model exhaustion (once per event), full run complete, and unhandled exceptions (before recovery). MUST NOT notify per successful process merge.
- **FR-013**: System MUST generate an unguessable ntfy topic at setup, persist it in config, and print it once for the operator to subscribe.
- **FR-014**: System MUST verify Cursor CLI presence/auth at startup (`agent --version` or equivalent after local verification) and abort loudly if missing.
- **FR-015**: System MUST NOT auto-fix a blocked process by relaxing its test; MUST NOT put verification-cascade thresholds into fix-agent prompts; MUST NOT split `llm-c-misc-enrichment` into multiple merge units.

### Key Entities

- **Process**: One inventory row; the atomic commit/merge unit.
- **Flow-group**: Scheduling unit derived from an inventory section (plus special collapsed units); holds locks and runs processes sequentially.
- **Hub lock**: Exclusive right to modify one of `study.js` / `api.js` / `session-store.js`.
- **Progress state**: Durable record of per-process status, attempts, branches, and active locks.
- **Verification tier**: Structural, embedding-grounding, or LLM-judge gate applied before merge authorization.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a clean start against the full inventory, every one of the 194 processes reaches a terminal state (`merged` or `blocked`) without requiring human input on the happy path.
- **SC-002**: No two concurrently active flow-groups ever hold the same hub lock; free-lane concurrency never exceeds the configured cap.
- **SC-003**: After simulated VPS restart mid-run, the orchestrator resumes and does not double-merge or leave processes stuck in non-terminal non-runnable states.
- **SC-004**: A process whose own test passes but breaks a previously merged loop-engineering test is never merged to `main`.
- **SC-005**: Test-agent cannot land source edits and fix-agent cannot land test edits (enforced, not advisory).
- **SC-006**: Operator receives ≤1 notification per flow-group completion and is notified within one event cycle of any blocked process or unhandled orchestrator failure.
- **SC-007**: Model exhaustion causes temporary backoff and automatic retry — the run does not stop permanently solely due to transient model unavailability.

## Assumptions

- Fixture library path is `fixtures/` (repo root; ~47 files including PDF/HTML and `session-samples/`).
- Existing test convention is `cursor-tests/*.mjs` executed with Node (no `package.json` test script); loop-generated tests live under `cursor-tests/loop-engineering/<process_id>.test.mjs` (or `.mjs` matching sibling patterns) and are run the same way.
- Embedding grounding reuses `src/js/vault/embeddings.js` (gemini-embedding-001 pipeline already in repo).
- Throwaway regression merge uses a temp branch + discard approach by default (no existing project worktree convention found); `git worktree` may be used if simpler on the VPS.
- Cursor CLI binary name and flags (`agent -p`, `--force`, `--model`) will be verified on the target VPS at setup; config stores the verified command template.
- Exact rate-limit/credit-exhaustion error strings will be captured empirically during implementation testing and stored in config matchers — not guessed from docs.
- `tier3_process_ids` initially includes Socratic tutor, review generated batch, and recall tutor process ids once confirmed in the inventory; empty list disables Tier 3 until populated.
- `grounding_similarity_threshold` default `0.75` is an unvalidated placeholder pending post-launch calibration.
- Orchestrator lives under `orchestrator/` at repo root; progress under `progress/`; does not modify overnight-debug-enrich branch/history.
- Auto-merge without human review is approved policy for this feature.
- ntfy.sh cloud is acceptable (no self-hosted ntfy required for v1).
- Splitting `study.js` and email notifications remain explicit non-goals.

## Out of Scope

- Modularizing/splitting `study.js`.
- Email notifications.
- Resolving behavior of `unknown`-risk processes beyond reachability recon.
- Exploding `llm-c-misc-enrichment` into constituent contracts.
- Payment/credential entry, account creation, or any auth outside existing Cursor CLI + GitHub on the VPS.
- Human review gate before merge.
