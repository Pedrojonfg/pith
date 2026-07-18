# Contract: progress/state.json

## Schema (authoritative for scheduling)

```json
{
  "run_started_at": "ISO8601",
  "last_updated_at": "ISO8601",
  "flow_groups": {
    "<group_id>": {
      "status": "pending | active | done",
      "processes": {
        "<process_id>": {
          "status": "pending | test_written | fixing | verified | merged | blocked",
          "attempts": 0,
          "block_reason": null,
          "block_detail": null,
          "branch": "loop-eng/<process_id> | null",
          "merged_commit_sha": null
        }
      }
    }
  },
  "active_locks": ["study.js"],
  "model_exhaustion": { "test_agent": null, "fix_agent": null }
}
```

## Reconciliation rules (startup)

1. If file missing → initialize all pending from `flow_groups.json`.
2. `git fetch origin main`; parse `git log main --grep` / message prefixes `test(`, `fix(` for process ids actually merged (prefer `fix(<id>):` as merge evidence; require SHA exists).
3. `merged` without SHA on main → `pending`, clear SHA, warn.
4. `verified` | `fixing` | `test_written` without merge → `pending`, attempts=0, clear branch pointer if branch deleted.
5. Recompute `active_locks` as empty on startup (no in-flight agents survive restart).

## Write policy

Atomic write: write temp file then `os.replace`. Update `last_updated_at` on every mutation.

## Process fields

| Field | Notes |
|-------|-------|
| `block_reason` | Category only when `status=blocked`: `test_agent_failed`, `exhausted`, `regression`, `merge_conflict`, `allowlist`, etc. |
| `block_detail` | When blocked: truncated (~500 chars) last error message from the failing agent/verification step; `null` otherwise. |

## Per-process run log

Failed agent attempts append full raw stdout+stderr to `progress/run-log-<process_id>.md` (one file per process; create `progress/` as needed; never overwrite another process's log). Each entry includes a UTC timestamp and which agent/attempt failed. These files are runtime diagnostics (typically gitignored); they are not part of `state.json`.
