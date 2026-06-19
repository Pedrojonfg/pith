# Quickstart: Supabase Migration QA

## Prerequisites

- Google OAuth configured per `GOOGLE_OAUTH_SETUP.md`
- Supabase project **Pith** active

## Checklist

- [ ] Boot without session → `screenAuth` visible
- [ ] Sign in with Google → lands on app home or settings
- [ ] Upload PDF → appears in document library
- [ ] Reload → session persists
- [ ] Sign out → returns to auth screen
- [ ] Existing localStorage sessions migrate on first authenticated boot
- [ ] Incognito / different Google account → empty library (RLS)
- [ ] `node cursor-tests/20260619_supabase-migration.mjs` passes
- [ ] `node cursor-tests/20260606_validate-sw-update-flow.mjs` passes

## Manual OAuth setup

See `GOOGLE_OAUTH_SETUP.md` at repo root.
