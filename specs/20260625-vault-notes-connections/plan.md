# Implementation Plan: Vault Personal Notes, Connections & Resumable Upload

**Branch**: `20260625-vault-notes-connections` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)

## Summary

Extend `KnowledgeVaultEntry` to v2 personal fields (`notes`, `area`, `tags`, `related`, `status`, `type`), enrich Upload to Vault curation (LLM drafts + dedup-related suggestions), commit with bidirectional backlinks, and process commits through a persisted resumable queue (`pith_vault_upload_queue`) with boot resume banner.

## Technical Context

**Language/Version**: JavaScript ES modules (browser PWA)

**Primary Dependencies**: vault-store, vault-curation, normalization, api.js LLM, study.js, ui.js, main.js boot

**Storage**: localStorage (`pith_knowledge_vault`, `pith_vault_upload_queue`, `pith_vault_settings`)

**Testing**: `cursor-tests/20260625_vault-notes-connections.mjs`

**Target Platform**: Browser PWA

**Performance Goals**: One dedup call per concept; queue sequential to avoid vault write races

**Constraints**: English UI; SW_VERSION bump; no localStorage wipe on migration

**Scale/Scope**: ~12 files; 2 new modules (`vault-upload-queue.js`, `vault-settings.js`)

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Library-first modules | PASS | queue + settings as pure modules |
| Test coverage | PASS | cursor-tests per spec §9 |
| Simplicity | PASS | extends existing curation path |
| PWA versioning | PASS | SW bump in T08 |

## Project Structure

### Documentation

```text
specs/20260625-vault-notes-connections/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── checklists/requirements.md
```

### Source Code

```text
src/js/
├── vault/
│   ├── vault-store.js           # schema v3 entry fields, getDistinctAreas, backlink helper
│   ├── vault-curation.js        # extended commit, notes merge, related writes
│   ├── vault-upload-queue.js    # NEW resumable processor
│   └── vault-settings.js        # NEW autoDraftNotes preference
├── api.js                       # extended normalizeConceptsToVault + extractVaultCandidates
├── session-types.js             # entry v2 typedefs
├── study.js                     # curation UI + queue wiring + resume banner
├── main.js                      # boot queue + banner
├── ui.js                        # new DOM refs
index.html / main.css
sw.js / sw-update.js
cursor-tests/20260625_vault-notes-connections.mjs
```

## Phase 0: Research

See [research.md](./research.md) — all NEEDS CLARIFICATION resolved.

## Phase 1: Design

See [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md).

## Phase 2: Task Outline (ROADMAP)

| ID | Task | Deps |
|----|------|------|
| T01 | Entry v2 schema + lazy migration | — |
| T02 | Extended dedup + extractVaultCandidates LLM | T01 |
| T03 | Commit, notes append, bidirectional related | T01 |
| T04 | vault-upload-queue.js + persistence | T01, T03 |
| T05 | Curation UI (notes/area/tags/related) + enqueue | T02, T04 |
| T06 | Settings toggle + resume banner | T04, T05 |
| T07 | Integration tests + SW bump | T01–T06 |

**Parallel waves**: T01 → (T02 + T03) → T04 → (T05 + T06) → T07
