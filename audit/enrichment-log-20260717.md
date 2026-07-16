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
