# Research: Supabase Migration

## Decision: Use existing Supabase project "Pith"

- **Rationale**: `list_projects` returned active project `mnoczpssewnymuxeniyo` in `eu-central-1`.
- **Alternatives**: Create new project — rejected (duplicate infra).

## Decision: ESM CDN for supabase-js

- **Rationale**: PWA has no bundler; other deps use CDN (pdf.js, marked).
- **Alternatives**: npm + import map — rejected for minimal HTML change.

## Decision: Always offload rawMarkdown to Storage

- **Rationale**: Spec recommendation; keeps JSONB lean; removes size threshold branch.
- **Alternatives**: Conditional offload like localStorage — rejected.

## Decision: Google OAuth only (Phase 1)

- **Rationale**: Spec scope; Supabase Auth handles token refresh.
- **Alternatives**: Email/password — deferred.

## Decision: Active doc id stays in localStorage

- **Rationale**: Ephemeral UI state, not user data.
- **Alternatives**: Supabase user metadata — unnecessary latency.
