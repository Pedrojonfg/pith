# Pith

AI study PWA: turn documents into faithful, multi-mode study sessions, then consolidate what you learn in a cross-document knowledge vault. Preparation stays tied to the source; practice spans RSVP, reading, slow study, questions, cloze, recall, and spaced review.

## Try it

**Live demo:** [https://mylearning-zeta.vercel.app](https://mylearning-zeta.vercel.app)

AI features use **allowlisted** platform keys (invite-only). To run with your own backend, fork the repo and wire up your Supabase project.

## Why different

- **Source fidelity** — Sessions and generated material respect the uploaded document; the app is built around staying faithful to what you imported.
- **Document Preparation Pipeline (DPP)** — Front-loaded analysis and structuring so each study mode consumes a consistent, document-aware representation.
- **Multi-mode pedagogy** — RSVP, Read, Slow, Questions, Cloze, Recall, and Review modes share one prepared source instead of one-size-fits-all flashcards.
- **Knowledge Vault + SM-2** — Cross-document facts and mastery, with spaced repetition to prioritize what needs review.

## Stack

- **Client:** Vanilla ESM PWA (service worker, offline-friendly static assets)
- **Hosting:** Vercel (static)
- **Backend:** Supabase Auth, Postgres, Storage, Edge Functions (`llm-proxy`, `books-proxy`, `geocode-proxy`)
- **Models:** DeepSeek and Gemini via server-side proxy — no provider API keys in the browser

## Architecture

The PWA talks to Supabase for auth and data; LLM and external API calls go through Edge Function proxies so secrets and allowlists stay server-side. Document preparation orchestrates LLM steps once per import; study modes and the vault read from shared stores and close the loop with review scheduling.

For UI and product constraints, see [DESIGN.md](DESIGN.md). Flagship specs:

- [specs/20260618-document-preparation-frontload/](specs/20260618-document-preparation-frontload/)
- [specs/20260622-platform-key-proxy/](specs/20260622-platform-key-proxy/)
- [specs/20260618-knowledge-vault-a-plus/](specs/20260618-knowledge-vault-a-plus/)
- [specs/20260701-pedagogical-principles/](specs/20260701-pedagogical-principles/)

## Local run

```bash
git clone <your-fork-url>
cd pith
npm ci
npx serve .   # or any static server from the repo root
```

You need your own Supabase project with Edge Functions deployed and secrets set (names only):

- `SUPABASE_SERVICE_ROLE_KEY`
- `DEEPSEEK_API_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_BOOKS_API_KEY`
- Optional: `LLM_PROXY_ALLOWED_USER_IDS`, `LLM_PROXY_MAX_PER_HOUR`

Google sign-in setup: [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md).

## Status

Personal research product, production-hardened for single-tenant / allowlisted use.

## License

[MIT](LICENSE) — Copyright (c) 2026 Pedro Fuentes.
