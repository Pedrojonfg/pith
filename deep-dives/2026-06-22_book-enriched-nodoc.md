# Deep Dive: Book-Enriched Nodoc Interview

**Date:** 2026-06-22  
**Feature:** `specs/20260622-book-enriched-nodoc`  
**Roadmap:** `ROADMAP-book-enriched-nodoc.md`

---

## 1. What we built

Nodoc interview sessions can now optionally start with a book title/author lookup before the user explains what they read. A client-side cascade (Open Library → Google Books → Wikipedia) resolves coverage level A/B/C, caches results globally in Supabase `pith_book_cache`, and stores `bookMeta` on `shared.uploadMeta`. Level A replaces generic opening questions with chapter-anchored prompts; Level B injects a synopsis into the first LLM follow-up only. Vault entries from book-enriched sessions gain `source_title` and `source_author`. The skip path is unchanged — no `bookMeta`, generic interview.

---

## 2. Design decisions

### Optional sub-step between "no file" and interview (not a new study mode)

**Chosen:** `screenBookSearch` with three panel states (`search` / `confirm` / `levelC`), gated by `BOOK_LOOKUP_ENABLED`.  
**Alternatives:** Inline fields on interview screen; dedicated top-level mode.  
**Discarded:** Pollutes interview UX; mode would fork bootstrap and hub routing.  
**Trade-off:** `study.js` owns another small state machine (`bookSearchState`) beside `interviewCaptureState`.

### Client-side API cascade with global Supabase cache (no LLM for metadata)

**Chosen:** `book-lookup.js` runs fetches in the browser; cache read before any network; upsert after resolve (non-blocking on failure).  
**Alternatives:** Edge function proxy; LLM grounding for TOC/synopsis.  
**Discarded:** Extra infra/cost; spec explicitly forbids LLM metadata generation.  
**Trade-off:** CORS and API availability are user-environment dependencies; cache key normalization is lossy (punctuation/hyphens).

### Coverage levels A / B / C as progressive enrichment, not errors

**Chosen:** Level C is valid — user continues with typed title/author only; neutral UI copy.  
**Alternatives:** Block session creation on lookup failure; require manual TOC entry.  
**Discarded:** Violates FR "lookup never blocks"; NG6 rules out manual TOC in v1.  
**Trade-off:** Many lookups will be Level C for obscure titles; vault still gets user-typed source tags.

### Cover URL HEAD verification before render

**Chosen:** `verifyCoverUrl` checks `Content-Type` (jpeg/png/webp/gif) and `Content-Length` ≤ 512KB; `<img onerror>` hides broken loads.  
**Alternatives:** Render thumbnail directly from API; proxy through Supabase storage.  
**Discarded:** Risk of broken images, huge payloads, or non-image responses in UI.  
**Trade-off:** HEAD may fail on CORS-hostile CDNs even when GET would work — cover often absent.

### Level A opening questions via extended `getOpeningQuestions(studyLang, bookMeta?)`

**Chosen:** Same return shape `{ questions, defaultIndex }`; chapter templates per study language; shuffle + cap at 6 when TOC > 8.  
**Alternatives:** Separate question bank module; sequential chapter order.  
**Discarded:** Format mismatch with interview flow; sequential order biases recency.  
**Trade-off:** Opening pool size can exceed `INTERVIEW_MAX_FOLLOWUP_ROUNDS` — interview still capped by existing round logic.

### Level B context only on first follow-up LLM call

**Chosen:** `generateInterviewFollowUp` injects `bookMeta.description` into system prompt when `answeredTurns === 1` and `level === 'B'`.  
**Alternatives:** Show synopsis in UI; inject on every follow-up; change opening bank for B.  
**Discarded:** Spec says description not user-visible; repeated injection leaks book facts into later turns.  
**Trade-off:** First follow-up quality depends on synopsis length/quality from Google Books or Wikipedia.

### Vault tagging via `bookSource` param on `mergeNormalizationResult`

**Chosen:** `session-close.js` passes `uploadMeta.bookMeta`; new and merged entries get `source_title` / `source_author`.  
**Alternatives:** Post-close vault sweep; tags on `sources[]` sub-objects.  
**Discarded:** Easy to miss entries; spec names top-level vault fields.  
**Trade-off:** Re-merge into existing vault entry overwrites source fields on every session close from that book.

### `setUploadMeta` spread for optional `bookMeta`

**Chosen:** Extend store helper to persist `bookMeta` alongside interview `uploadMeta` trinity.  
**Alternatives:** Separate `shared.bookMeta` top-level field.  
**Discarded:** Spec canonical signal is presence inside `uploadMeta`.  
**Trade-off:** `ensureInterviewSession` also sets `doc.shared.uploadMeta.bookMeta` inline — dual write path to keep in sync.

---

## 3. Concepts applied

| Concept | What it is | Where in our code |
|--------|------------|-------------------|
| **Fallback chain** | Try providers in order until success or exhaust | `lookupBook()` → `fetchOpenLibrary` → `fetchGoogleBooks` → `fetchWikipedia` |
| **Cache-aside** | Read cache first; populate on miss | `readCache` / `writeCache` in `book-lookup.js` |
| **Normalized cache key** | Deterministic string for fuzzy user input | `buildCacheKey()` — lowercase, strip punctuation, underscore join |
| **AbortController timeout** | Bound hung network calls | `fetchWithTimeout()` with `BOOK_LOOKUP_TIMEOUT_MS` |
| **Feature flag gate** | Runtime kill switch without UI surgery | `isBookLookupEnabled()` in `createSessionNoFileBtn` handler |
| **State machine (UI)** | Panel transitions driven by lookup outcome | `bookSearchState.panel` in `study.js` |
| **Strategy by coverage level** | Different interview behavior per enum | Level A → `opening-questions.js`; B → `interview-api.js`; C → generic |
| **Optional field extension** | Additive schema without version bump | `BookMeta` on `UploadMeta` in `session-types.js` |
| **Cross-cutting metadata stamp** | Propagate session context into derived records | `applyBookSource()` in `vault/normalization.js` |

---

## 4. Technical debt and improvements

**Well done**
- Skip path preserves pre-feature behavior; flags and optional API key degrade gracefully.
- Pure `buildCacheKey` and opening-question logic are unit-testable without browser.
- Cover verification and non-blocking cache write respect safety spec.

**Functional duct tape**
- Cache hit returns `rowToBookMeta` with `coverUrlVerified: true` without re-HEAD — stale or revoked URLs possible until cache row updated.
- `buildCacheKey` treats `Sun-Tzu` and `Sun Tzu` as different keys (hyphen removal joins tokens).
- Wikipedia fallback uses title-only slug — weak for common titles/disambiguation.
- Open Library editions scan is best-effort (first edition with TOC ≥ 3); wrong edition → wrong chapters.
- No integration test hits live APIs (by design); manual QA required for Sapiens Level A.

**Would not scale**
- Global cache with RLS disabled and no rate limiting — abuse or hot-title write contention at scale.
- Serial 5s × 3 API calls per uncached lookup — painful on slow networks (15s worst case).
- Every vault merge overwrites `source_title`/`source_author` on merged entries — last session wins, not multi-source bibliography.

---

## 5. Consolidation questions

1. When `lookupBook` returns Level C after a cache hit vs a fresh API miss, how does the confirmation UI differ, and what exactly is persisted in `bookMeta` for vault tagging in each case?

2. Why is Level B description injected only when `answeredTurns === 1` in `generateInterviewFollowUp`, and what happens to follow-up specificity on turns 2–4 if the user never mentioned themes from the synopsis?

3. If Supabase `pith_book_cache` is empty because migration was not applied, what is the user-visible behavior — does session creation still succeed, and which code paths swallow cache errors?

---

## 6. Suggested update for .cursorrules

1. **Book metadata lookups:** No LLM calls on the book lookup / cache / confirmation path. Only the existing interview follow-up generator may receive `bookMeta` as passive context (Level B, first follow-up only).

2. **Global Supabase cache tables:** Document intentional no-RLS global caches in migration comments; client writes must be non-blocking (session creation never awaits cache upsert success).

3. **Nodoc extensions:** New nodoc enrichment steps must remain optional with a skip path identical to pre-extension behavior; gate behind a named flag in `config/flags.js`.
