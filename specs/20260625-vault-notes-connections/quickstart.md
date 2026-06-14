# Quickstart: Vault Personal Notes, Connections & Resumable Upload

## Prerequisites

- API key configured
- Document session with at least 2 studied concepts
- Empty or existing vault (migration runs on load)

## Scenario 1 — Notes and related links

1. Open a document Session Hub → **Upload to vault**
2. Wait for suggestions; verify each concept shows **Notes**, **Area**, **Tags**, **Related** sections
3. Edit note draft; check one sibling as related
4. Accept definition → **Commit to vault**
5. Open Knowledge Vault → verify entry has notes, area, tags, related ID
6. Open related entry → verify backlink present

## Scenario 2 — Resume interrupted queue

1. Upload 3+ concepts; commit
2. During processing banner, reload the page mid-way
3. Verify resume banner: "Vault upload pending (N items) — Resume"
4. Click Resume; verify no duplicate definitions for already-done concepts

## Scenario 3 — Migration

1. In devtools, set vault entry without v2 fields
2. Reload app
3. Inspect entry: `type`, `area`, `status`, `related` populated per defaults

## Scenario 4 — Blank notes mode

1. Settings → disable auto-draft notes (or vault settings toggle)
2. Upload to vault → note fields empty
3. Manual note → commit → `notesUpdatedAt` set

## Scenario 5 — Empty related warning

1. Single-concept batch, uncheck all related
2. Commit → non-blocking warning → confirm → succeeds

## Automated tests

```bash
node cursor-tests/20260625_vault-notes-connections.mjs
```
