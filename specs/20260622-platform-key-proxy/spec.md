# Feature Specification: Platform Key Proxy

**Feature Branch**: `20260622-platform-key-proxy`

**Created**: 2026-06-22

**Status**: Draft

**Input**: User description: Replace client-side BYOK API keys with Supabase Edge Function proxies. All LLM calls and Google Books lookups route through authenticated server-side functions using platform-owned secrets. Remove BYOK UI. Log LLM usage per user.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Authenticated study without API keys (Priority: P1)

A signed-in user opens Pith and starts an RSVP study session without entering any API keys. AI features work using platform-managed credentials.

**Why this priority**: Core value — removes friction and secures keys.

**Independent Test**: Sign in, upload material, complete RSVP generation without localStorage API keys.

**Acceptance Scenarios**:

1. **Given** a user with a valid Supabase session and no `ds_api_key` in localStorage, **When** they start RSVP generation, **Then** the session completes successfully.
2. **Given** an unauthenticated user, **When** they open the app, **Then** they see the sign-in screen, not an API key form.

---

### User Story 2 - Platform usage logging (Priority: P2)

Every proxied LLM call records usage attributed to the authenticated user with platform key ownership.

**Why this priority**: Enables future quota and cost visibility.

**Independent Test**: After one LLM call, verify a row in `llm_usage_logs` with correct `user_id` and `key_ownership: platform`.

**Acceptance Scenarios**:

1. **Given** an authenticated DeepSeek call via proxy, **When** the upstream responds, **Then** a log row is inserted with service, model, and token counts when available.

---

### User Story 3 - Settings without key fields (Priority: P2)

Users manage preferences (language, fidelity) in Settings without API key inputs.

**Why this priority**: Completes BYOK removal UX.

**Independent Test**: Open Settings — no DeepSeek, Gemini, or Google Books key fields visible.

**Acceptance Scenarios**:

1. **Given** any authenticated user, **When** they open Settings, **Then** API key inputs and save-key flow are absent.

---

### Edge Cases

- Proxy called without JWT → 401, client shows auth error.
- Google Books proxy fails → book lookup degrades gracefully (Open Library / Wikipedia still work).
- `llm_usage_logs` pre-exists with extended schema → migration adds columns additively, no data loss.
- Gemini native embed uses query-param auth → proxy handles separately from Bearer-based chat.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store DeepSeek, Gemini, and Google Books keys only as Supabase Edge Function secrets.
- **FR-002**: System MUST reject unauthenticated proxy requests with 401.
- **FR-003**: System MUST log each proxied LLM call to `llm_usage_logs` with `user_id`, service, model, tokens when available, and `key_ownership: platform`.
- **FR-004**: System MUST remove all API key input fields and localStorage key persistence from the client.
- **FR-005**: System MUST gate app boot on Supabase auth session, not localStorage API keys.
- **FR-006**: System MUST route DeepSeek chat, Gemini chat/vision, and Gemini embeddings through `llm-proxy`.
- **FR-007**: System MUST route Google Books volume search through `books-proxy`.
- **FR-008**: System MUST NOT log Google Books calls to `llm_usage_logs`.

### Key Entities

- **LLM usage log**: Per-call record (user, service, model, tokens, key ownership, timestamp).
- **Platform proxy request**: Authenticated client payload forwarding provider endpoint and body.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of production LLM HTTP calls from the client go through Edge Function proxies (no direct provider URLs with user keys).
- **SC-002**: Unauthenticated users cannot invoke proxies (401 on missing/invalid JWT).
- **SC-003**: Authenticated users complete a full RSVP session without configuring API keys.
- **SC-004**: Settings screen contains zero API key input fields.

## Assumptions

- Supabase auth (Google OAuth) is already wired; boot gate replaces key gate only.
- Existing `llm_usage_logs` table may use `phase`/`metadata` columns; migration adds `service`, `input_tokens`, `output_tokens`, `key_ownership` additively.
- Non-streaming LLM calls only; streaming deferred.
- Hard quota enforcement is out of scope (log only).
- Client-side `logLlmUsage` may continue for phase/doc context; proxy adds authoritative platform logging server-side.
