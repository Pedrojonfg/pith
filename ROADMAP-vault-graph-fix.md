# ROADMAP — vault-graph-fix

**Feature:** specs/20260628-vault-graph-fix | **Spec:** specs/20260628-vault-graph-fix/spec.md | **Plan:** specs/20260628-vault-graph-fix/plan.md  
**Created:** 2026-06-28

## Dependency diagram

```
T01 (adapter fix) → T02 (SW bump + tests)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Await + normalize projectDocIds in vault-graph-adapter | — | sequential | [x] |
| T02 | PWA version bump + cursor-tests | T01 | sequential | [x] |

## Prompt per task

### T01 — Adapter fix

**Spec ref:** FR-001–FR-004 | **Plan ref:** Implementation steps 1–2  
**Files:** `src/js/concept-registry/vault-graph-adapter.js`  
**Success criterion:** `buildVaultGraph` awaits resolver and normalizes to Set before any `.has()` call; no signature changes.  
**On close:** `/validate` and mark `[x]`.

### T02 — Deploy + tests

**Spec ref:** FR-005, Success Criteria | **Plan ref:** steps 3–4  
**Files:** `src/js/sw-update.js`, `index.html`, `sw.js`, `cursor-tests/20260628_vault-graph-project-doc-ids.mjs`  
**Success criterion:** SW tests pass; new test covers Set normalization and awaited resolver.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-06-28 (none created)

## Notes

Root cause confirmed: missing `await` on async `resolveProjectDocIds` (Promise lacks `.has`). Set normalization added per spec defensively.
