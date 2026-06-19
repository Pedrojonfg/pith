# Implementation Plan: Supabase Migration

**Branch**: `20260617-supabase-migration` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

## Summary

Replace localStorage document session persistence with Supabase Postgres + Storage behind the existing `session-store.js` facade. Add Google OAuth auth gate at boot. Minimal surface: persistence layer rewrite + async propagation + auth UI.

## Technical Context

**Language/Version**: JavaScript ES modules (PWA, no bundler)  
**Primary Dependencies**: `@supabase/supabase-js` via `esm.sh` CDN  
**Storage**: Supabase Postgres (`document_sessions`) + Storage (`markdown_files`)  
**Testing**: `cursor-tests/20260619_supabase-migration.mjs`  
**Target Platform**: Browser PWA  
**Constraints**: Anon key only client-side; RLS user isolation; SW version bump on deploy  
**Scale/Scope**: Single-user / friend testing Phase 1

## Constitution Check

*GATE: Pass — focused change, tests added, no service_role exposure.*

## Project Structure

```text
src/js/
├── config/supabase.js          # URL + anon key
├── supabase-client.js          # createClient singleton
├── session-persist-supabase.js # low-level DB/Storage ops
├── auth.js                     # OAuth + localStorage migration
├── session-store.js            # rewritten persistence (async API)
└── main.js                     # auth gate

specs/20260617-supabase-migration/
GOOGLE_OAUTH_SETUP.md
```

**Structure Decision**: Persistence split into `session-persist-supabase.js` + `auth.js` keeps `session-store.js` business logic intact.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Async API across 30+ callers | Supabase I/O is async | Sync wrapper would hide errors and block UI |
