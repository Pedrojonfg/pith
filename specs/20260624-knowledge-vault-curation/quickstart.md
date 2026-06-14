# Quickstart QA: Knowledge Vault Curation

**Feature**: `20260624-knowledge-vault-curation`

## Prerequisites

- API key configured
- At least one document session with RSVP blocks studied (or Recall answered)
- Study Projects migration complete (misc project exists)

## Scenario 1 — App Home navigation

1. Reload app with stored API key.
2. **Expect**: App Home with `Vault` and `Sessions` (not mode picker).
3. Tap **Sessions** → project library opens.
4. Back → App Home. Tap **Vault** → vault branch with `Knowledge Vault` and `Review`.

## Scenario 2 — Session Hub from library

1. From Sessions, open a document with material.
2. **Expect**: Session Hub with mode picker, breadcrumb, `Download session MD`, `Upload to vault`.
3. **Expect**: No Continue/Library/Review hub row at top.

## Scenario 3 — Upload to vault

1. Study ≥1 block in RSVP (answer a question).
2. Return to Session Hub → **Upload to vault**.
3. Wait for LLM candidates.
4. Check one definition → **Add selected to vault**.
5. Open Knowledge Vault (Vault branch) → entry shows new definition.

## Scenario 4 — Vault review in scoped Review

1. Commit a review item from Scenario 3.
2. Vault → Review → scope All subjects → start review.
3. **Expect**: vault item appears with facet badge.
4. Rate quality → complete.
5. Vault debug panel: entry `masteryLastUpdated` recent; `facetCoverage` has facet timestamp.

## Scenario 5 — Idempotent definition

1. Repeat Upload to vault on same session.
2. **Expect**: definition from same doc not duplicated (checkbox unchecked or skipped).

## Automated tests

```bash
node cursor-tests/20260624_knowledge-vault-curation.mjs
node cursor-tests/20260606_validate-sw-update-flow.mjs
```

## Sign-off

- [ ] Scenarios 1–5 pass manually
- [ ] cursor-tests green
- [ ] ROADMAP T01–T12 marked [x]
