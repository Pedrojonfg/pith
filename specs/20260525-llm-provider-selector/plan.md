# Implementation Plan: Multi-LLM Provider Selector

**Branch**: `20260525-llm-provider-selector` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260525-llm-provider-selector/spec.md`

## Summary

Add **DeepSeek** (default) and **Gemini 2.5 Flash** as selectable models for study sessions. Users save **both API keys** in setup (Gemini optional until used). A **dropdown on “Create a study session”** sets `active_session._meta.llm_model` for all session API work (split, blocks, assessment, gap synthesis, tutor, review). A single **`llmChatCompletions` adapter** routes requests to the correct OpenAI-compatible endpoint. Guide chat and review follow the **active session model** (clarify Q2-A).

## Technical Context

**Language/Version**: JavaScript (ES modules), browser vanilla  
**Primary Dependencies**: DeepSeek Chat API (`deepseek-chat`); Gemini OpenAI-compat (`gemini-2.5-flash` @ `generativelanguage.googleapis.com/v1beta/openai/`)  
**Storage**: `localStorage` — `ds_api_key`, `gemini_api_key`; session `_meta.llm_model`  
**Testing**: Manual [quickstart.md](./quickstart.md); optional smoke in `cursor-tests/`  
**Target Platform**: Modern browsers; WSL dev  
**Project Type**: Single-page study app (`index.html` + `src/js/*`)  
**Performance Goals**: No added latency beyond provider RTT; no double-call fallback  
**Constraints**: No backend; no frameworks; Flutter-portable session metadata; surgical central adapter  
**Scale/Scope**: ~6 files (`config.js`, `api.js`, `study.js`, `index.html`, `guide-chat.js`, `review.js`, `sw.js`)

## Constitution Check

*GATE: Project uses `.cursorrules` (constitution template not ratified).*

| Principle (.cursorrules) | Status | Notes |
|--------------------------|--------|-------|
| No backend | PASS | Keys remain client-only |
| No frameworks | PASS | `<select>` + adapter function |
| Simplicity / surgical | PASS | One HTTP adapter; no provider plugin system |
| Flutter portability | PASS | `llm_model` enum on session JSON only |
| RSVP critical path | PASS | No RSVP timer changes |
| Single-file preference | PASS | Stays in existing modules |

**Post-design re-check**: PASS — no gate violations.

## Project Structure

### Documentation (this feature)

```text
specs/20260525-llm-provider-selector/
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── llm-chat-adapter.md
│   └── session-llm-ui.md
└── tasks.md             # /speckit-tasks (next)
```

### Source Code (repository root)

```text
index.html                 # Dual API keys; model dropdown on generate form
src/js/
├── config.js              # GEMINI_OPENAI_CHAT_URL, LS_GEMINI_KEY
├── api.js                 # resolveLlmContext, llmChatCompletions; migrate fetches
├── study.js               # Dropdown read/write _meta.llm_model; validation
├── guide-chat.js          # Use adapter + session model
└── review.js              # Via api exports (session model)
sw.js                      # Allow generativelanguage.googleapis.com
```

**Structure Decision**: Extend existing modules; no new npm packages.

## Phase 0: Research

Complete — see [research.md](./research.md). All technical unknowns resolved (Gemini OpenAI-compat, storage keys, session binding, SW host).

## Phase 1: Design & Contracts

Complete:

- [data-model.md](./data-model.md)
- [contracts/llm-chat-adapter.md](./contracts/llm-chat-adapter.md)
- [contracts/session-llm-ui.md](./contracts/session-llm-ui.md)
- [quickstart.md](./quickstart.md)

**Agent context**: `.cursor/rules/specify-rules.mdc` updated to reference this plan.

## Phase 2: Implementation Outline (for /speckit-tasks)

| ID | Work package | Files |
|----|--------------|-------|
| WP1 | Constants + `resolveLlmContext` + `llmChatCompletions` | `config.js`, `api.js` |
| WP2 | Migrate all `fetch(DS_…)` in `api.js` to adapter | `api.js` |
| WP3 | API setup UI: Gemini key field + save/load | `index.html`, `study.js` or `app.js` |
| WP4 | Session dropdown + `_meta.llm_model` on new session | `index.html`, `study.js`, `session.js` |
| WP5 | Guide chat + review session routing | `guide-chat.js`, `review.js` |
| WP6 | SW allowlist + status copy + quickstart validation | `sw.js`, `study.js`, `review.js` |

**Execution order**: WP1 → WP2 → WP3 ∥ WP4 → WP5 → WP6.

**Rename policy**: Keep exported names like `deepSeekSplitIntoBlocks` as aliases wrapping `llm*` internals to avoid breaking imports across modules until a dedicated cleanup pass.

## Complexity Tracking

No constitution violations requiring justification.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Gemini JSON less strict than DeepSeek | Existing `parseModelJsonValue`; quickstart retry path |
| 15 call sites miss migration | Grep `DS_CHAT_COMPLETIONS_URL`; single adapter contract |
| Legacy sessions without `llm_model` | Default `deepseek` in resolver |
| SW blocks Gemini host | `sw.js` update in WP6 |
| User expects auto-failover | Spec excludes; error message suggests new session + Gemini |

## Next command

`/speckit-tasks` — generate `tasks.md`, or implement WP1–WP6 directly.
