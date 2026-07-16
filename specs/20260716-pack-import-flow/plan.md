# Implementation Plan: Pack Import Flow

**Branch**: `20260716-pack-import-flow` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260716-pack-import-flow/spec.md`

## Summary

Assign a unique share code when a pack publishes; add an additive create-session path to look up a published pack by code, deep-clone its snapshot into a new importer-owned DocumentSession in the active project, stamp pack attribution on `uploadMeta`, and run importer-only Vault linking (exported T1.6) — no LLM regeneration of resolved study artifacts.

## Technical Context

**Language/Version**: JavaScript ES modules (browser PWA)  
**Primary Dependencies**: `pack-export.js` (`finalizePack`), `session-store.js`, `session-types.js`, `document-preparation.js` (T1.6), `supabase-client.js` (`lookup_shared_pack_by_code`), `study.js` / `index.html` create-session UI  
**Storage**: Supabase `shared_packs` (assign `code`; optional `owner_display_name`); local DocumentSession store  
**Testing**: `cursor-tests/20260716_pack-import-flow.mjs` (fixtures + mocked Supabase RPC)  
**Target Platform**: Existing Pith PWA  
**Project Type**: Web PWA  
**Performance Goals**: Import without inventory/block/question LLM; Vault link only  
**Constraints**: No creator Vault copy; no dedup; no sync; English UI strings; SW version bump with JS/HTML/CSS  
**Scale/Scope**: Code share only (no marketplace); whole-pack clone

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Library-first / minimal surface: `pack-import.js` + small hooks in export/session/DPP/UI — **pass**
- Test-first: cursor-tests before roadmap `[x]` — **pass**
- Simplicity / YAGNI: no browse UI, no sync, no analytics — **pass**
- English UI / prompts — **pass**

Post-design re-check: **pass** (T1.6 thin export preferred over forcing `runPostCacheUserPhases` gate that needs `blockRecommendation` absent from pack snapshot).

## Project Structure

### Documentation (this feature)

```text
specs/20260716-pack-import-flow/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/pack-import.md
└── checklists/requirements.md
```

### Source Code

```text
supabase/migrations/20260716_shared_packs_owner_display_name.sql  # optional column
src/js/pack-export.js          # generatePackCode + assign on finalize; stamp owner_display_name
src/js/pack-import.js          # lookup + importPackAsSession
src/js/document-preparation.js # export runVaultLinkPhase
src/js/session-types.js        # UploadMeta pack attribution fields
src/js/session-store.js        # setUploadMeta whitelist
src/js/study.js                # publish code UI; create-session pack branch
index.html / src/css/main.css  # pack-code entry markup
src/js/sw-update.js / sw.js / index.html  # SW bump
cursor-tests/20260716_pack-import-flow.mjs
```

**Structure Decision**: Mirror `pack-export.js` as a sibling `pack-import.js`; keep UI wiring in `study.js` (existing create-session / publish handlers).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Export T1.6 alone vs `runPostCacheUserPhases` | Pack snapshot lacks `blockRecommendation`; post-cache gate would no-op | Synthesizing fake blockRecommendation is brittle and pulls T1.8/T1.9 |

## Implementation sequence

1. Code generation + assign on `finalizePack`; stamp `owner_display_name`; show code after publish  
2. `uploadMeta` attribution fields + `setUploadMeta` whitelist  
3. Export `runVaultLinkPhase` (clear importer inventory `globalConceptId` before link)  
4. `importPackAsSession` (RPC lookup, clone, persist, vault link)  
5. Create-session pack-code UI (preview → confirm)  
6. Attribution label + cursor-tests + SW bump + quickstart QA  

Artifacts: [research.md](./research.md), [data-model.md](./data-model.md), [contracts/pack-import.md](./contracts/pack-import.md), [quickstart.md](./quickstart.md)
