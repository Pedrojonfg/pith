# ROADMAP — platform-key-proxy

**Feature:** specs/20260622-platform-key-proxy | **Spec:** specs/20260622-platform-key-proxy/spec.md | **Plan:** specs/20260622-platform-key-proxy/plan.md
**Created:** 2026-06-22 | **Completed:** 2026-06-22

## Dependency diagram

```
T01 (migration)
 ├── T02 (llm-proxy) ──┐
 └── T03 (books-proxy)─┤
                       ▼
                    T04 (llm.js)
                    ├─ T05 (embeddings)
                    └─ T06 (vision)
                       ▼
                    T07 (book-lookup)
                       ▼
                    T08 (boot + session + config)
                       ▼
                    T09 (settings UI)
                       ▼
                    T10 (tests + SW)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02, T03 | parallel |
| 3 | T04 | sequential |
| 4 | T05, T06 | parallel |
| 5 | T07 | sequential |
| 6 | T08 | sequential |
| 7 | T09 | sequential |
| 8 | T10 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Additive llm_usage_logs migration | — | sequential | [x] |
| T02 | llm-proxy Edge Function | T01 | parallel | [x] |
| T03 | books-proxy Edge Function | T01 | parallel | [x] |
| T04 | llm.js proxy client + remove BYOK | T02 | sequential | [x] |
| T05 | vault/embeddings.js via proxy | T04 | parallel | [x] |
| T06 | document-images/vision.js via proxy | T04 | parallel | [x] |
| T07 | book-lookup.js books-proxy | T03,T04 | sequential | [x] |
| T08 | main.js boot gate, session.js + config cleanup | T04 | sequential | [x] |
| T09 | Remove Settings API key UI | T08 | sequential | [x] |
| T10 | cursor-tests + SW version bump | T09 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-06-22 — none created (sequential implementation in parent chat).

## Notes

- `llm_usage_logs` migration is additive; deploy SQL before Edge Functions.
- Gemini `embedContent` uses query-param auth in proxy (not Bearer).
- Set Supabase secrets: `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_BOOKS_API_KEY`.
