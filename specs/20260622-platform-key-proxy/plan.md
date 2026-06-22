# Implementation Plan: Platform Key Proxy

**Branch**: `20260622-platform-key-proxy` | **Date**: 2026-06-22 | **Spec**: [spec.md](./spec.md)

## Summary

Replace BYOK localStorage keys with two Supabase Edge Functions (`llm-proxy`, `books-proxy`) that verify JWT, forward to providers using platform secrets, and log LLM usage server-side. Client modules (`llm.js`, `embeddings.js`, `vision.js`, `book-lookup.js`) call proxies; Settings UI and key persistence are removed; boot gate uses auth session.

## Technical Context

**Language/Version**: TypeScript (Deno Edge Functions), ES modules (client PWA)

**Primary Dependencies**: `@supabase/supabase-js`, Deno std HTTP server

**Storage**: Supabase Postgres (`llm_usage_logs` additive migration)

**Testing**: `cursor-tests/*.mjs` Node test runners

**Target Platform**: Supabase Edge Functions + browser PWA

**Performance Goals**: Non-blocking usage logging (fire-and-forget)

**Constraints**: Non-streaming proxy only; PWA SW version bump on `src/js` changes

**Scale/Scope**: ~10 client files, 2 edge functions, 1 SQL migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Minimize scope: proxy layer + BYOK removal only — PASS
- English-only prompts/heuristics — PASS
- SW_VERSION + CACHE_NAME bump on client changes — REQUIRED at close
- No LLM on mnemonic device paths — N/A

## Project Structure

### Documentation (this feature)

```text
specs/20260622-platform-key-proxy/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── llm-proxy.md
│   └── books-proxy.md
└── checklists/requirements.md
```

### Source Code

```text
supabase/
├── migrations/20260622_platform_key_proxy_usage_logs.sql
└── functions/
    ├── llm-proxy/index.ts
    └── books-proxy/index.ts

src/js/
├── llm.js              # callViaProxy, auth token cache
├── book-lookup.js      # books-proxy client
├── vault/embeddings.js # gemini-embed via proxy
├── document-images/vision.js
├── config.js           # remove LS_*_KEY exports
├── session.js          # remove getStoredKey/saveKey
├── main.js             # auth boot gate, remove key form
├── ui.js               # remove key UI refs
└── config/supabase.js  # SUPABASE_URL (existing)

index.html              # remove API key section
sw.js / sw-update.js    # version bump
```

**Structure Decision**: Single PWA + Supabase functions; no new packages.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Sync auth cache in llm.js | Many sync `getApiKeyForLlmModel()` call sites | Full async refactor of study.js too large for this feature |

## Implementation Waves

1. DB migration (additive columns)
2. Edge functions (parallel)
3. `llm.js` proxy core
4. Gemini consumers: embeddings + vision (parallel)
5. `book-lookup.js`
6. Boot gate + session/config cleanup
7. Settings UI removal
8. Tests + SW bump
