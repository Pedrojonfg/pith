# Deploying Pith

Personal single-tenant setup: one Supabase project, one Vercel (or static) frontend, secrets on Edge Functions only.

## 1. Frontend (Vercel)

1. Connect the GitHub repo to Vercel (root = static PWA, no build command required unless you add one).
2. Set production domain to `pith.pedrojon.com` (or your domain) in Vercel → Domains.
3. Optional: keep the old preview hostname and add a redirect in `vercel.json` (already configured for `mylearning-zeta.vercel.app` → production host).

After any change to `src/js/**`, `index.html`, or `src/css/**`, bump PWA versions together (`SW_VERSION`, `?v=` on scripts, `CACHE_NAME` in `sw.js`) before deploy.

## 2. Supabase migrations

From a machine with [Supabase CLI](https://supabase.com/docs/guides/cli) linked to your project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Critical migrations for public exposure:

- `20261005_lock_shared_caches_rls.sql` — initial cache RLS hardening
- `20261005140000_cache_key_read_edge_writes.sql` — RPC read-by-key; revoke direct client writes

## 3. Edge Functions

Deploy all functions under `supabase/functions/`:

```bash
supabase functions deploy llm-proxy
supabase functions deploy books-proxy
supabase functions deploy geocode-proxy
supabase functions deploy shared-cache-upsert
```

Set secrets (Dashboard or CLI):

| Secret | Required |
|--------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (auto-injected in hosted Supabase) |
| `DEEPSEEK_API_KEY` | Yes for LLM |
| `GEMINI_API_KEY` | Yes for Gemini / embeddings |
| `GOOGLE_BOOKS_API_KEY` | Yes for book lookup |
| `PITH_CORS_ORIGINS` | Yes — e.g. `https://pith.pedrojon.com,http://localhost:3000` |
| `LLM_PROXY_ALLOWED_USER_IDS` | Yes — your `auth.users` id(s); **empty = 403 for everyone** |
| `LLM_PROXY_MAX_PER_HOUR` | Optional |
| `LLM_PROXY_ALLOWED_MODELS` | Optional override |

Find your user id: Supabase Dashboard → Authentication → Users, or `auth.getUser()` in the app after sign-in.

## 4. Google OAuth

See [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md). Add redirect URLs for production and localhost.

## 5. Demo mode

No backend required: open `https://your-domain/?demo=1` — preloaded Gettysburg sample, AI disabled.

## 6. CI

GitHub Actions runs `npm test` (JS smoke + orchestrator pytest). Full JS suite: `npm run test:js:full` (many loop-engineering fixtures still stale).

## 7. Secrets hygiene

Run gitleaks on history before going public; rotate **service role** and provider keys if anything real leaked. The committed Supabase **anon** JWT is expected for client PWAs; security is RLS + proxy allowlists, not hiding the anon key.
