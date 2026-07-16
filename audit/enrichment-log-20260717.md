# Debug-enrich overnight log — 2026-07-17

Pass order: (1) critical+none → (2) critical+minimal → (3) non-critical likely-broken/fragile.

| Process | Status | Note |
|---------|--------|------|
| `auth-llm-token-sync` | done | info on sync (had/has token, changed, userId, expiresAt); warn on clear — no token values logged |
| `auth-llm-token-fetch` | done | debug cache hit/miss; info on session resolve; warn null token; error on getSession failure — no token values |
