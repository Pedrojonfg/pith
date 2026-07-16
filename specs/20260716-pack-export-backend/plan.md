# Implementation Plan: Pack Export Backend

**Branch**: `20260716-pack-export-backend` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260716-pack-export-backend/spec.md`

## Summary

Backend-only pack draft + publish pipeline: deep-clone agreed DocumentSession subtrees into Supabase `shared_packs`, then finalize either as full-fidelity publish or copyright-safe publish (strip source-bearing trees + DeepSeek rewrite of recall excerpts with Jaccard gate). No UI. Unblocks graph-editor and import specs.

## Technical Context

**Language/Version**: JavaScript ES modules (browser PWA)  
**Primary Dependencies**: `session-store.js` (`getSession`), `llm.js` (`llmChatCompletions`), `supabase-client.js`, `fidelity-validation.js` (`jaccardOverlap` export)  
**Storage**: Supabase Postgres `shared_packs` + RLS + `lookup_shared_pack_by_code` RPC  
**Testing**: `cursor-tests/20260716_pack-export-backend.mjs` (fixtures + mocked LLM)  
**Target Platform**: Existing Pith PWA  
**Project Type**: Web PWA (data layer)  
**Performance Goals**: One-shot rewrite per excerpt at publish; no hot-path caching required  
**Constraints**: Fail-closed rewrite; never touch real vault tables; no share-code assignment; English prompts  
**Scale/Scope**: Whole-document packs only; draft→published once

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Library-first / minimal surface: single `pack-export.js` module — **pass**
- Test-first: cursor-tests before `[x]` — **pass**
- Simplicity / YAGNI: no Mistral proxy, no vault rewrite path, no UI — **pass**
- English LLM prompts — **pass**

Post-design re-check: **pass** (research resolved provider mismatch without expanding platform).

## Project Structure

### Documentation (this feature)

```text
specs/20260716-pack-export-backend/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/pack-export.md
└── checklists/requirements.md
```

### Source Code

```text
supabase/migrations/20260716_shared_packs.sql
src/js/pack-export.js
src/js/fidelity-validation.js          # export jaccardOverlap
src/js/sw-update.js / index.html / sw.js  # version bump with JS change
cursor-tests/20260716_pack-export-backend.mjs
```

**Structure Decision**: Follow `recall-api.js` single-module pattern; migration mirrors cross-device RLS style with SECURITY DEFINER code lookup.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Spec asked Mistral; platform is DeepSeek | Chat proxy has no Mistral | Adding Mistral service needs credentials/ops outside this feature |

## Implementation sequence

1. Migration + RLS + RPC  
2. Pure `buildPackSnapshot` + `stripSourceBearingFields`  
3. `rewritePackExcerpt` + export `jaccardOverlap` + overlap assert  
4. `createPackDraft` + `finalizePack`  
5. Integration tests + SW bump + quickstart QA  

Artifacts: [research.md](./research.md), [data-model.md](./data-model.md), [contracts/pack-export.md](./contracts/pack-export.md), [quickstart.md](./quickstart.md)
