# Quickstart QA: Global Knowledge Vault (Phase A+)

**Feature**: `20260618-knowledge-vault-a-plus`  
**Branch**: `20260618-knowledge-vault-a-plus`

## Prerequisites

- API key configured
- Pre-packing assessment enabled
- Two short MD/PDF docs on same topic (e.g. calculus derivatives) + one third doc overlapping concepts

## Scenario 1 — Vault populates on session close (T02 + T03)

1. Upload doc A; complete RSVP session with a few wrong/right answers.
2. Exit study screen to home/mode select.
3. Open Settings → Knowledge Vault.
4. **Expect**: N > 0 concepts; mastery bars reflect session activity; sources = 1 doc.

## Scenario 2 — Temporal decay (T01)

1. In DevTools, load vault JSON; set one entry's `masteryLastUpdated` to 8 days ago.
2. Reload Knowledge Vault UI.
3. **Expect**: That entry's displayed mastery is lower than `masteryBase` shown in raw JSON.

## Scenario 3 — Cross-document dedup (T04)

1. Study doc B (same topic) covering overlapping concepts; close session.
2. Open Knowledge Vault; filter by topic.
3. **Expect**: Shared concepts (e.g. chain rule) appear once with sources = 2 docs (SC-001).

## Scenario 4 — Normalization empty vault (T04)

1. Clear vault; study doc A only; close session.
2. **Expect**: No LLM normalization error; concepts created as new entries.

## Scenario 5 — Pack uses vault context (T05)

1. After scenarios 1+3, upload doc C; run pack with vault populated.
2. Compare block count/topics vs. fresh profile (cleared vault) on same doc.
3. **Expect**: Fewer or thinner blocks for mastered concepts (SC-003 — qualitative OK).

## Scenario 6 — Assessment presumed known (T08)

1. With vault mastery ≥0.7 for several concepts, start doc C assessment.
2. **Expect**: Presumed-known markers; user can override; quiz shorter (SC-004).

## Scenario 7 — Prerequisites (T06)

1. After two docs with shared inventory prerequisites, open concept detail in vault.
2. **Expect**: Prerequisite links listed when RSVP inventory had prerequisite_ids.

## Scenario 8 — Export and clear

1. Export JSON → valid `GlobalKnowledgeVault` shape.
2. Clear vault → empty table; assessment/pack behave as without vault.

## Automated tests

```bash
node cursor-tests/20260618_knowledge-vault-a-plus.mjs
```

Minimum coverage: mastery decay, updateMastery weights, topic filter, empty vault normalization fallback, prerequisite sync.

## PWA checklist (if src touched)

- Bump `SW_VERSION` in `src/js/sw-update.js`
- Match `?v=` on `sw-update.js` and `main.js` in `index.html`
- Run `node cursor-tests/20260606_validate-sw-update-flow.mjs`
