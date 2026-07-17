# Data Model: Loop Engineering Orchestrator

## ProcessRecord

Parsed from one inventory table row.

| Field | Type | Notes |
|-------|------|-------|
| id | string | Primary key, e.g. `auth-google-oauth` |
| name | string | Human title |
| entry_point | string | Free text |
| files_involved | string[] | Split on `,`, trimmed |
| trigger | string | Free text |
| depends_on_raw | string | Original cell |
| depends_on_ids | string[] | Subset of inventory ids referenced |
| current_logging_state | string | enum-ish |
| error_handling_state | string | free text |
| static_risk_assessment | `likely-broken` \| `likely-fragile` \| `likely-fine` \| `unknown` | |
| is_critical_path_for_demo | `yes` \| `no` | |
| section_name | string | Parent `##` heading |
| section_index | number | Order of section in file |

## FlowGroup

| Field | Type | Notes |
|-------|------|-------|
| group_id | string | Stable slug from section (e.g. `01-auth-app-boot`) |
| section_name | string | |
| process_ids | string[] | Inventory order within section |
| hub_files | string[] | ∩ `{study.js, api.js, session-store.js}` |
| non_hub_files | string[] | Remaining unique files |
| priority_score | [number, number] | `(critical?0:1, risk_rank)` — lower first |
| free_lane | bool | `hub_files` empty |
| collapsed | bool | true for `llm-c-misc-enrichment` unit |
| needs_recon | bool | any member has risk `unknown`, or group tagged |

`risk_rank`: likely-broken=0, unknown=1, likely-fragile=2, likely-fine=3. For a group, use the **minimum** (worst) risk_rank among members; critical if **any** member is demo-critical.

## ProcessRuntimeState

| Field | Type | Values |
|-------|------|--------|
| status | string | `pending` \| `test_written` \| `fixing` \| `verified` \| `merged` \| `blocked` |
| attempts | number | fix-agent attempts used |
| block_reason | string\|null | e.g. `exhausted`, `regression`, `allowlist` |
| branch | string\|null | `loop-eng/<id>` |
| merged_commit_sha | string\|null | |

### Transitions

```
pending → test_written → fixing → verified → merged
                ↘ blocked
fixing → blocked (exhausted)
verified → blocked (regression)
any non-terminal → pending  (startup reconcile when no merge on main)
merged → pending            (reconcile if SHA missing from main)
```

Never resume `fixing` mid-attempt: always reset to `pending` on startup if not merged.

## FlowGroupRuntimeState

| Field | Type |
|-------|------|
| status | `pending` \| `active` \| `done` |
| processes | map process_id → ProcessRuntimeState |

`done` when every process is `merged` or `blocked`.

## OrchestratorState (progress/state.json)

| Field | Type |
|-------|------|
| run_started_at | ISO8601 |
| last_updated_at | ISO8601 |
| flow_groups | map group_id → FlowGroupRuntimeState |
| active_locks | string[] | currently held hub lock names |
| model_exhaustion | `{ test_agent: ISO8601\|null, fix_agent: ISO8601\|null }` |

## Config (config.yaml)

See `contracts/` and spec §12. Notable: model lists, caps, timeouts, ntfy_topic, fixture_library_path, tier3_process_ids, exhaustion_matchers, agent_command_template, grounding_similarity_threshold.

## Validation rules

- Process id unique across inventory.
- Branch name exactly `loop-eng/<process_id>`.
- Commit messages: `test(<id>): …`, `fix(<id>): …`, `wip(<id>): blocked after N attempts…`.
- Allowlist test-agent: only paths under `cursor-tests/loop-engineering/`.
- Allowlist fix-agent: any path **except** that process's test file (and except `progress/`).
