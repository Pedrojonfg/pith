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
| `persist-blocks-externalize` | done | debug threshold check; info when externalized; error on localStorage write |
| `persist-blocks-write-through` | done | debug entry; info ok; warn invalid; error with quota vs persist_failed |
| `persist-supabase-upsert` | done | debug entry; info ok; error with code/details/hint on failure |
| `vault-collect-observations` | done | info entry (signals/mode slots) + exit counts by type |
| `vault-mastery-labels` | done | debug mastery value + label (mastered/acquired/partial/unknown) |
| `registry-identity-resolve` | done | debug resolve; info exact/fuzzy/create paths; error on empty name |
| `registry-ingest-study` | done | info MCQ promote entry; warn missing session / per-concept fail; debug ok/fail counts |
| `vault-spaced-review-sync` | done | info sync start/pool rebuild counts; warn missing docId/shared |
| `llm-proxy-client` | done | debug request; info success; warn retry; error auth/network/status (no token logged) |
| `llm-chat-deepseek` | done | debug start (msg count, max_tokens); info content len/usage; error missing content |
| `llm-c-socratic-tutor` | done | info start (lens/scope flags); info reply shape; error on failure |
| `pwa-sw-fetch` | done | debug strategy choice + networkFirst/cache hit-miss; warn network fail; CACHE_NAME→pith-v151 |
| `row-cache-sessions` | done | debug cache hit/miss; info row count on populate; error on fetch failure |
| `auth-google-oauth` | done | info OAuth start (redirect host); error on OAuth/UI failure |
| `auth-session-listen` | done | info auth events + boot start/complete; error on boot fail (notes stuck appBooted) |
| `dpp-t0.1-normalize-marker` | skipped | already adequate — info log with char/word/image counts present |
| `dpp-t0.2-text-metrics` | skipped | already adequate — info log with metrics/sizeCategory present |
| `dpp-t1.5-mode-recommendation` | done | info compute/skip/result (method, primaryFlow, profile flags) |
| `dpp-scope-structure` | done | info ensure start (flight join); info done (prepStatus, hierarchy); warn missing docId |
| `dpp-final-persist` | done | info attempt/applied; enriched stale-skip warns with docId |
| `gate-universal-scope` | done | info apply/auto/enter UI; debug skip reasons; scoped lengths |
| `rsvp-confirm-session` | done | info confirm click + session init; error on confirm failure |
| `rsvp-start-block` | done | info start (index/mode/docId); debug prefetch next |
| `rsvp-block-generate` | done | debug cache hit/miss; info LLM gen params; warn JSON retry |
| `rsvp-finish-read` | done | info finishRSVP → showQuestions (block indices, mode) |
| `rsvp-mcq` | done | info on answer (chosen/correct/block/q indices; assessment flag) |
| `rsvp-socratic` | done | info submit click + reply len; error on tutor failure |
| `persist-session-create` | done | info create/images/created; warn image fail; error validation/upsert |
| `persist-session-read` | done | debug load; info loaded (markdown len, prep, blocks) or not-found |
| `persist-markdown-rehydrate` | done | debug inline/download; info ok/legacy; warn/error empty fallback paths |
| `persist-blocks-rehydrate` | done | debug start; info blocks/responses rehydrated; warn missing data; error on parse/fetch |
| `persist-retry-keyed` | done | debug start; info superseded; debug silent drop; error on real failure |
| `persist-retry-transient` | done | debug attempt fail; warn backoff; info success-after-retry; error exhausted |
| `persist-user-stores-hydrate` | done | info hydrate start/complete; debug per-store; warn missing userId |
| `persist-blocks-cloud-upload` | done | info schedule/ok for blocks+responses; warn missing args; error upload fail |
| `vault-load-save` | done | info load/save counts; warn invalid/corrupt; debug empty |
| `vault-session-close` | done | info start/diff/obs/saved; warn normalize fallback + cleanup fail |
| `registry-maturity-promotion` | done | debug engagement; info resolve/done (maturity, green promote) |
| `vault-normalize-llm` | done | debug entry; info LLM/short-circuit/fallback; warn empty mappings + LLM fail |
| `llm-proxy-edge` | done | warn 4xx paths; info request/response tokens; error missing key + non-JSON upstream |
| `llm-c-block-explanation` | done | info start/done; debug LLM calls; warn paragraph/fidelity retries + vault hint fail |
| `llm-c-block-questions` | done | info wrap start/done; regenerate debug + count mismatch warn |
| `llm-c-block-json` | done | info orchestrator + generateBlockFromChunk; debug claims; warn concept enrich fail |
| `llm-c-hierarchy` | done | info start/done + LLM call; warn no key; error on failure |
| `llm-c-vault-normalize` | skipped | already adequate — same entry as `vault-normalize-llm` |
| `pwa-sw-register-update` | done | info register/updatefound/toast/reload; warn unsupported; error register fail |
| `pwa-sw-cache-install` | done | info install start/complete/skipWaiting; warn precache partial fail |
| `rsvp-legacy-pack-from-assessment` | done | Pass3 broken: warn missing nBlocks; info skip paths; error pack fail |
| `concept-anchoring-unwired` | done | Pass3 broken: info start/done + qualityCounts; warn empty/skip + per-concept fail |
| `questions-block-generate` | done | Pass3 fragile: info start/done/offline; debug config; warn JSON retry; error missing chunk |
| `cloze-pipeline-p0-graph` | done | Pass3 fragile: info start/done node/edge counts; error invalid graph |
| `cloze-pipeline-p2-base` | done | Pass3 fragile: info start/done with candidate + item counts |
| `review-generated-session` | done | Pass3 fragile: info start/loaded; debug render; error empty selection/index |
| `sm2-ingest-recall` | done | Pass3 fragile: debug entry/skip; info upserted count |
| `persist-vault-sync` | done | Pass3 fragile: info schedule/ok; warn abort; error upsert fail; debug offline |
| `persist-registry-sync` | done | Pass3 fragile: info schedule/ok; warn abort; error upsert fail; debug offline |
| `registry-dedup-gates` | done | Pass3 fragile: debug pair; info gate reject/done + doc run |
| `vault-embeddings` | done | Pass3 fragile: info API/batch; debug cache hit; error empty/auth |

---

## Checkpoint (pause)

**Stopped after:** `sm2-ingest-recall` (Pass 3 fragile, mid-list).

**Completed:** Pass 1 fully. Pass 2 fully (critical+minimal). Pass 3: both `likely-broken` + fragile through `sm2-ingest-recall`.

**Resume Pass 3 next (non-critical likely-fragile, top-to-bottom):**
1. `persist-vault-sync`
2. `persist-registry-sync`
3. `registry-dedup-gates`
4. `vault-embeddings`
5. `vault-novelty-score`
6. `vault-inventory-merge-embed`
7. `llm-gemini-chat`
8. `llm-gemini-embed`
9. `llm-c-block-split`
10. `llm-c-char-boundary-refine`
11. `llm-c-block-audit`
12. `llm-c-block-overlap-audit`
13. `llm-c-assessment-items`
14. `llm-c-assessment-holistic`
15. `llm-c-assessment-evaluate`
16. `llm-c-review-batch`
17. `llm-c-phase0`
18. `llm-c-cloze-phases`
19. `llm-c-recall-questions`
20. `llm-c-recall-tutor`
21. `llm-c-vision-image`
22. `llm-c-vision-ocr`
23. `llm-c-interview-followup`
24. `llm-c-interview-synthesis`
25. `llm-c-pack-rewrite`
26. `interview-loop`
27. `interview-synthesis`
28. `export-offline-pack-build`
29. `pack-snapshot-build`

**Also see:** `audit/bugs-found-20260717.md`  
**SW_VERSION now:** `20260717_44` · **CACHE_NAME:** `pith-v151`
**Branch:** `overnight-debug-enrich`
