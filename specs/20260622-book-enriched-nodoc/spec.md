# Feature Specification: Book-Enriched Nodoc Interview

**Feature Branch**: `20260622-book-enriched-nodoc`

**Created**: 2026-06-22

**Status**: Draft

**Input**: Extend nodoc interview capture with optional book title/author lookup (Open Library → Google Books → Wikipedia), global Supabase cache, chapter-anchored opening questions, and vault `source_title` / `source_author` tagging.

**Depends on**: `20260620-nodoc-interview-capture`, Supabase migration (live)

**Extends (does NOT supersede)**: `20260620-nodoc-interview-capture`

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Optional book lookup before interview (Priority: P1)

As a learner capturing a book I read without a file, I want to optionally search by title and author so interview questions can reference real chapter structure when available.

**Why this priority**: Core enrichment path; skip path must remain identical to pre-feature nodoc.

**Independent Test**: Choose no-file path → enter book search → skip → generic interview with no `bookMeta`.

**Acceptance Scenarios**:

1. **Given** create-session start, **When** user chooses no-file and `BOOK_LOOKUP_ENABLED`, **Then** book search panel appears before interview setup.
2. **Given** book search, **When** user chooses "Continue without search", **Then** interview starts with no `bookMeta` — identical to pre-spec behavior.
3. **Given** title entered, **When** user searches, **Then** spinner shows during lookup (max ~15s worst case).

---

### User Story 2 — Confirm book with cover (Priority: P1)

As a learner who found metadata, I want to confirm the correct edition (with cover when available) before the interview starts.

**Why this priority**: Prevents wrong-book enrichment; cover is confirmation-only (not shown during study).

**Independent Test**: Search "Sapiens" + "Harari" → Level A or B confirmation with optional cover → confirm → `bookMeta` on session.

**Acceptance Scenarios**:

1. **Given** Level A or B result, **When** confirmation panel shows, **Then** cover renders only if HEAD-verified (image type, ≤512KB); broken images hide via `onerror`.
2. **Given** Level A, **When** confirmation shows, **Then** "Table of contents found" indicator appears.
3. **Given** Level B, **When** confirmation shows, **Then** no TOC indicator; description not shown to user.
4. **Given** Level C, **When** lookup completes, **Then** neutral message (no error styling); user can continue with user-typed title/author stored.

---

### User Story 3 — Chapter-anchored opening questions (Priority: P1)

As a learner with Level A book metadata, I want opening interview questions tied to real chapter titles so recall prompts are specific.

**Why this priority**: Primary pedagogical value of the feature.

**Independent Test**: Level A session → first questions reference TOC chapter titles (shuffled, max 6 if >8 chapters).

**Acceptance Scenarios**:

1. **Given** `bookMeta.level === 'A'` with ≥3 TOC entries, **When** interview opens, **Then** opening question pool uses chapter titles, not generic static bank.
2. **Given** >8 chapters, **When** pool built, **Then** 6 random chapters sampled.
3. **Given** Level B, **When** interview opens, **Then** generic opening bank; description injected only into first follow-up LLM system prompt (not shown to user).
4. **Given** Level C, **When** interview opens, **Then** generic nodoc behavior unchanged.

---

### User Story 4 — Vault source tagging (Priority: P2)

As a learner, I want vault entries from book-enriched sessions tagged with book title and author for later discovery.

**Why this priority**: Additive metadata; not blocking interview flow.

**Independent Test**: Complete book-enriched session → vault entries have `source_title` and `source_author`; non-book sessions do not.

**Acceptance Scenarios**:

1. **Given** session with `uploadMeta.bookMeta`, **When** vault entries created at session close, **Then** each carries `source_title` and `source_author` (user-typed strings).
2. **Given** session without `bookMeta`, **When** vault entries created, **Then** no `source_title` / `source_author` fields.

---

### Edge Cases

- Supabase cache unavailable: session creation proceeds with API-only or Level C; no crash.
- Google Books API key missing: skip R2; fall through to Wikipedia then Level C.
- Individual API timeout (5s): skip that source; try next fallback.
- Second lookup for same book: cache hit — zero external API calls.
- `BOOK_LOOKUP_ENABLED: false`: entire book search step hidden; nodoc identical to pre-spec.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST offer optional book title (+ optional author) search in nodoc flow before interview setup.
- **FR-002**: System MUST fetch metadata client-side from Open Library, then Google Books (if key present), then Wikipedia — no LLM for metadata.
- **FR-003**: System MUST cache results globally in Supabase `pith_book_cache` keyed by normalized title+author; cache hits skip all API calls.
- **FR-004**: System MUST resolve coverage levels A (TOC ≥3), B (description ≥100 chars), or C (fallback) without blocking session creation.
- **FR-005**: System MUST verify cover URLs via HEAD (image/jpeg|png|webp|gif, ≤512KB) before UI render.
- **FR-006**: System MUST store `bookMeta` on `shared.uploadMeta` when user confirms or continues at Level C.
- **FR-007**: System MUST apply Level A chapter-anchored opening questions and Level B first-follow-up context injection per coverage rules.
- **FR-008**: System MUST tag vault entries with `source_title` and `source_author` when `bookMeta` present.
- **FR-009**: System MUST gate book search UI behind `BOOK_LOOKUP_ENABLED` flag.
- **FR-010**: Cover image MUST NOT appear during study session — confirmation step only.

### Key Entities

- **BookCacheRow**: Global Supabase cache — cache_key, title, author, coverage_level, toc, description, cover_url, searched_at.
- **BookMeta**: Session-scoped uploadMeta extension — user-typed title/author, level, toc, description, cover verification fields, cachedAt.
- **VaultEntry extension**: Optional `source_title`, `source_author` on entries from book-enriched sessions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can skip book lookup and reach interview in the same number of steps as pre-feature nodoc.
- **SC-002**: Known book ("Sapiens", "Harari") resolves Level A with ≥3 TOC entries via Open Library.
- **SC-003**: Repeat lookup for cached book completes with zero external API requests.
- **SC-004**: 100% of book-enriched vault entries include `source_title`; `source_author` when user provided author.
- **SC-005**: Lookup failure never blocks session creation — user always has a continue path.

## Assumptions

- Open Library, Google Books, and Wikipedia REST APIs remain CORS-accessible from browser.
- Google Books API key is optional in Settings; feature degrades gracefully without it.
- Book search UI uses English copy consistent with the rest of the app.
- `uploadMeta` is persisted with DocumentSession (including `bookMeta`).
- Nodoc entry seam: `createSessionNoFileBtn` → book search (when enabled) → `enterInterviewCaptureScreen`.
- Vault `source_title` / `source_author` are new optional fields (not present in nodoc spec).
- Inline book search panel within nodoc flow preferred over new full screen (minimal HTML surgery).
