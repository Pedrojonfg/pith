# Spec: Supabase Migration
`specs/20260617-supabase-migration/spec.md`

## Status
ACTIVE — supersedes localStorage persistence described in `20260609-unified-session` (persistence layer only; DocumentSession schema unchanged).

---

## 1. Scope

Replace the localStorage persistence layer with Supabase (Postgres + Storage + Auth).

**In scope:**
- `session-store.js` rewrite (sole file requiring changes per minimal-intervention principle)
- Supabase project provisioning via MCP
- DB schema: `document_sessions` table + `markdown_files` storage bucket
- Google OAuth via Supabase Auth
- Boot-time localStorage→Supabase data migration for existing sessions
- `main.js` auth gate

**Out of scope (deferred):**
- Multi-tab safety mechanisms (resolved by this migration, no extra work needed)
- Server-side background vault upload (post-migration)
- Any changes to study modes, pipeline, graph logic, or LLM calls
- RLS (Row Level Security) policies beyond basic user isolation — Phase 2

---

## 2. Architecture

```
Browser
  └── session-store.js  (rewritten — only file that changes)
        ├── supabase-js client
        ├── Auth: Google OAuth (Supabase Auth)
        ├── Data: Postgres (document_sessions table)
        └── Files: Supabase Storage (markdown_files bucket)
```

All modes, `study.js`, `mode-bootstrap.js`, `session.js`, `session-types.js`, and all LLM/pipeline logic remain untouched. They call `session-store.js` exclusively.

---

## 3. Database Schema

### Table: `document_sessions`

```sql
CREATE TABLE document_sessions (
  id            TEXT NOT NULL,           -- docId (hash of normalized markdown)
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_data  JSONB NOT NULL,          -- full DocumentSession minus rawMarkdown
  markdown_ref  TEXT,                    -- Storage path if markdown offloaded, else NULL
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- Index for fast user session listing
CREATE INDEX idx_document_sessions_user_id ON document_sessions(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_document_sessions_updated_at
  BEFORE UPDATE ON document_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### What lives in `session_data` (JSONB)

The full `DocumentSession` object (schemaVersion 2) **minus** `shared.rawMarkdown`.

`rawMarkdown` is stored separately (see §4) because:
- It can exceed Postgres's practical JSONB cell size for large documents
- It never changes after upload (immutable per docId)
- Storage retrieval can be lazy (only needed when a mode actually starts)

### Storage: `markdown_files` bucket

```
markdown_files/
  {user_id}/
    {docId}.md
```

- Bucket visibility: **private** (authenticated access only)
- File stored when `rawMarkdown.length > 50_000 chars` (≈ current localStorage split threshold)
- File stored always for simplicity (recommended) — negligible cost, eliminates conditional logic

**Recommendation: always offload rawMarkdown to Storage.** Keeps JSONB lean, removes the size-conditional branch.

---

## 4. Row Level Security

Minimal policy for Phase 1 (single user / friend testing):

```sql
ALTER TABLE document_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own sessions" ON document_sessions
  FOR ALL USING (auth.uid() = user_id);
```

Storage bucket: set to **authenticated** access; path prefix `{user_id}/` enforces isolation.

---

## 5. `session-store.js` Rewrite Contract

### Initialization

```js
// supabase client singleton
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` sourced from `config/supabase.js` (committed, anon key is safe to expose).

### Public API — all methods become async

The public surface of `session-store.js` must remain identical in shape; callers only need to add `await`.

```js
// READ
async getAllSessions() → DocumentSession[]
async getSessionById(docId) → DocumentSession | null
async getActiveDocId() → string | null

// WRITE
async saveSession(session: DocumentSession) → void
async setActiveDocId(docId: string) → void
async deleteSession(docId: string) → void
```

### saveSession implementation

```
1. Separate rawMarkdown from session object
2. Upload rawMarkdown to Storage: markdown_files/{userId}/{docId}.md
   - Use upsert (overwrite if exists — markdown is immutable so this is a no-op after first upload)
3. Upsert session_data (DocumentSession minus rawMarkdown) to document_sessions
   - Set markdown_ref = storage path
```

### getSessionById implementation

```
1. SELECT session_data, markdown_ref FROM document_sessions WHERE id = docId AND user_id = auth.uid()
2. If markdown_ref: fetch rawMarkdown from Storage
3. Merge rawMarkdown back into session_data.shared.rawMarkdown
4. Return full DocumentSession
```

### getAllSessions implementation

```
1. SELECT id, session_data FROM document_sessions WHERE user_id = auth.uid()
2. Do NOT fetch rawMarkdown for listing (not needed for library/mode-select screens)
3. Return sessions with rawMarkdown = null (callers that need it call getSessionById)
```

> ⚠️ Callers of `getAllSessions` must not assume `rawMarkdown` is present. Audit: `study.js` library screen and `mode-bootstrap.js` use this — verify neither reads `rawMarkdown` from the list result.

### getActiveDocId / setActiveDocId

These remain in **localStorage** (`pith_active_doc_id`). They are UI state (which doc is open right now), not persistent user data. No Supabase call needed.

---

## 6. Auth Gate in `main.js`

### Boot sequence (new)

```
1. supabase.auth.getSession()
2a. Session exists → proceed to normal app boot (load sessions, show mode select)
2b. No session → show auth screen (see §7)
```

### Session persistence

Supabase JS client handles token refresh automatically. No manual token management needed.

### Sign-out

Add sign-out option in settings/sidebar. Calls `supabase.auth.signOut()`, clears `pith_active_doc_id` from localStorage, redirects to auth screen.

---

## 7. Auth Screen (`screenAuth`)

New screen added to `index.html`. Shown when no Supabase session exists.

**Contents:**
- Pith logo / name
- "Sign in with Google" button → calls `supabase.auth.signInWithOAuth({ provider: 'google' })`
- No email/password option (Phase 1)

**Flow:**
```
screenAuth → Google OAuth redirect → callback → Supabase sets session cookie → app boot
```

After OAuth callback, Supabase JS client automatically picks up the session from the URL hash. No manual callback handling needed beyond ensuring the app URL is the redirect target.

---

## 8. localStorage → Supabase Migration (boot-time)

Runs once at boot, after auth, before loading sessions from Supabase.

```js
async function migrateLocalStorageToSupabase() {
  const migrated = localStorage.getItem('pith_supabase_migrated')
  if (migrated) return  // already done

  const raw = localStorage.getItem('mylearning_doc_sessions')
  if (!raw) {
    localStorage.setItem('pith_supabase_migrated', 'true')
    return  // nothing to migrate
  }

  const sessions = JSON.parse(raw)
  for (const session of sessions) {
    // Reconstitute rawMarkdown from split key if needed
    const mdKey = `mylearning_doc_text_${session.docId}`
    if (localStorage.getItem(mdKey)) {
      session.shared.rawMarkdown = localStorage.getItem(mdKey)
    }
    await saveSession(session)  // uses new Supabase saveSession
  }

  localStorage.setItem('pith_supabase_migrated', 'true')
  // Do NOT delete localStorage data yet — keep as backup for 1 week
}
```

**Notes:**
- Idempotent: `pith_supabase_migrated` flag prevents re-running
- Old localStorage keys are preserved (not deleted) during Phase 1 as fallback
- Migration runs silently; show a loading indicator in the auth→boot transition

---

## 9. Async Propagation Audit

The critical consequence of making `session-store.js` async is that every caller must `await`. Audit list:

| Caller | Method used | Action required |
|--------|-------------|-----------------|
| `study.js` — upload flow | `saveSession`, `getAllSessions` | Add `await` |
| `study.js` — mode entry | `getSessionById`, `setActiveDocId` | Add `await` |
| `study.js` — library screen | `getAllSessions` | Add `await`; verify no rawMarkdown read |
| `mode-bootstrap.js` | `getSessionById`, `saveSession` | Add `await` |
| `main.js` | `getAllSessions`, `getActiveDocId` | Add `await`; wrap boot in async function |
| `session-migration.js` | `getAllSessions`, `saveSession` | Add `await` |
| Any mode that calls store directly | — | Modes must NOT call store directly (architectural constraint); verify |

**Strategy for Cursor:** search codebase for all imports of `session-store.js` and all usages of its exported functions. Add `await` at each call site. Wrap any non-async caller functions in `async`.

---

## 10. Environment Config

### `src/js/config/supabase.js` (new file, committed)

```js
export const SUPABASE_URL = 'https://<PROJECT-REF>.supabase.co'
export const SUPABASE_ANON_KEY = '<ANON-KEY>'  // safe to commit — anon key only
```

> The anon key is intentionally public. It is scoped to authenticated requests only via RLS. Do NOT commit the service_role key.

### `.env` (optional, for local dev override)

Not strictly needed for a PWA with a committed config. Skip for Phase 1.

---

## 11. Dependencies

```bash
npm install @supabase/supabase-js
```

No other new dependencies. Supabase JS client is tree-shakeable; only Auth + DB + Storage modules are used.

---

## 12. Implementation Order

Execute in this order to minimize broken intermediate states:

```
1. INFRA (via MCP in Cursor)
   1a. create_project — provision Supabase project
   1b. get_publishable_keys — copy URL + anon key
   1c. apply_migration — create document_sessions table + RLS + trigger
   1d. Create markdown_files storage bucket (execute_sql or dashboard)

2. MANUAL (browser)
   2a. Follow GOOGLE_OAUTH_SETUP.md

3. CODE
   3a. npm install @supabase/supabase-js
   3b. Create src/js/config/supabase.js with URL + anon key
   3c. Rewrite session-store.js (new async API + Supabase client)
   3d. Add screenAuth to index.html
   3e. Add auth gate to main.js (getSession → branch)
   3f. Add migrateLocalStorageToSupabase() to main.js boot sequence
   3g. Audit all callers → add await (see §9 table)
   3h. Add sign-out control to settings/sidebar

4. VERIFY
   4a. Boot app → redirects to screenAuth
   4b. Sign in with Google → lands on mode select
   4c. Upload document → appears in library
   4d. Reload page → session persists
   4e. Open incognito tab → separate session (RLS isolation)
   4f. Existing localStorage sessions → auto-migrated on first boot
```

---

## 13. Open Questions / Deferred

- **Offline support**: Supabase JS has no built-in offline queue. PWA offline mode (`offline.js`) will break for write operations. Mitigation for Phase 1: show "you're offline" banner, disable upload. Full offline support deferred.
- **Vault upload queue** (`pith_vault_upload_queue`): currently in localStorage. Migration to Supabase deferred — handle in vault spec update.
- **service_role key**: never expose client-side. Any future server-side job (background vault upload) uses it only in edge functions.
- **Multiple Google accounts**: not handled. One Supabase user = one Google account. Fine for Phase 1.
