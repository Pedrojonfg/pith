# Debug-enrich overnight log — 2026-07-17

Pass order: (1) critical+none → (2) critical+minimal → (3) non-critical likely-broken/fragile.

| Process | Status | Note |
|---------|--------|------|
| `auth-llm-token-sync` | done | info on sync (had/has token, changed, userId, expiresAt); warn on clear — no token values logged |
| `auth-llm-token-fetch` | done | debug cache hit/miss; info on session resolve; warn null token; error on getSession failure — no token values |
| `dpp-t1.4-block-recommendation` | done | info at T14 entry/exit (signals + nBlocks/factors); debug in recommender; noted rationale vs reasoning bug |
| `dpp-checkpoint-persist` | done | info before/after checkpoint save (docId, prepStatus, runId, inventory/hierarchy flags); error on missing docId or save failure |
| `rsvp-blocks-editor` | done | info on apply (block/inventory counts, pipeline); warn on empty blockIndex |
| `rsvp-session-ready` | done | info on ready screen entry (nBlocks requested/resolved, studyMode, docId) |
| `rsvp-start-studying` | done | info on click + enter loop (docId, mode, block/q indices, nTest/nSocratic); error if no session |
| `rsvp-overlay-read` | done | info on mode choice (rsvp/paced/read); RSVP entry with explanationLen; warn/error on missing/unreadable block |
| `rsvp-overlay-playback` | done | info on start (chunkCount, wpm, wpf); warn empty chunks; debug resize/skipCountdown/abort |
| `rsvp-block-transition` | done | info on finishQuestions (last vs next); warn on concept commit fail; sneakPeek extract debug |
| `rsvp-session-complete` | done | info on complete screen; warn concept commit / WPM calibration failures previously silent |
| `review-vault-sm2` | done | info on start/queue (poolSource, length); warn empty; mnemonics filter before/after |
| `review-project-scope-filter` | done | info on all/scoped pools (counts, vault skips for missing origin / out of scope) |
| `review-sm2-item-grade` | done | debug render; info on grade; error if originDocId missing (grade dropped); warn missing session |
| `sm2-core-update` | done | debug create/update/queue; error on invalid create params |
| `sm2-ingest-mcq` | done | debug call; info upsert/gate-block; error on missing session or ids |
| `persist-session-save` | done | debug entry; info saved; error on validation/upsert failure |
| `persist-active-pointer` | done | info on set (prev/new); error if session missing |
| `persist-markdown-externalize` | done | debug strip; info upload ok; error on storage upload failure |
