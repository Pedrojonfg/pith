# Deep Dive — Tech Debt Cleanup (20260628)

## 1. What we built

Closed five implementation gaps flagged in `application-overview.md` §22–24 without changing pedagogical behavior. Restored the strict source-fidelity Settings toggle, deleted the unreachable legacy post-packing assessment UI, aligned PWA cache-bust markers, removed dead `@deprecated` exports, and stopped ongoing writes to legacy `active_session` / `sessions_by_mode` keys while preserving one-time migration reads.

## 2. Design decisions

**PWA version bump first (R3 before R2/R1)**  
Chosen to land a low-risk, fully testable change before touching study flow. Alternative: bump only at the end — rejected because mid-feature JS edits would again desync splash vs `SW_VERSION`. Trade-off: one extra `CACHE_NAME` increment (`pith-v55`) for users on old SW.

**Delete legacy assessment path entirely (R2)**  
Pre-packing holistic assessment is always on (`ASSESSMENT_BEFORE_PACKING: true`); the legacy MCQ screen was unreachable. Alternative: keep HTML behind a flag — rejected as dead weight and source of false “two assessment systems” confusion. Trade-off: ~600 lines removed from `study.js`; `generateAssessmentQuestions` remains in `api.js` for API compatibility but has no UI caller.

**Strict fidelity via Settings + `localStorage`, not feature flag (R1)**  
`SOURCE_FIDELITY_STRICT: false` in `flags.js` made the feature unreachable despite live `state.sourceFidelityStrict` wiring. Alternative: env-only flag — rejected; user-facing toggle matches original source-fidelity spec intent. Persistence uses `source_fidelity_strict` key alongside `default_llm_model`. Trade-off: session-level `_meta.source_fidelity_mode` still wins when set on an existing session.

**Legacy session writes: no-op `storeSessionsByMode`, keep migration writes (R4)**  
DocumentSession is the write path; mirroring RSVP slices to `active_session` duplicated state. Alternative: delete migration entirely — rejected (data loss for users who never opened app post-v3). `storeSessionsByMode` now returns normalized object without `setItem`; only `migrateLegacyActiveSession` may write `sessions_by_mode`. Trade-off: code paths without an active `DocumentSession` no longer persist via legacy keys (should be unreachable post-migration).

**Surgical deprecated export removal (R5)**  
Removed only symbols with zero imports (`mountEnrichedGraphScreen`, `buildEnrichedGraph`, `GENRE_LABEL_ES`, `wireFlowRecommendUpload`, `parseRecallTutorFeedbackFromModelResponse`). Kept `PROXIMITY` and `normalizeRecallTutorFeedback` with comments because `slow/phase3.js` and `recall-api.js` still depend on them.

## 3. Concepts applied

| Concept | Where |
|--------|--------|
| **Feature flag vs user preference** | `flags.js`: removed compile-time `SOURCE_FIDELITY_STRICT`; runtime `getSourceFidelityStrictPreference()` |
| **Cache busting / deploy identity** | `sw-update.js` `SW_VERSION`, `index.html` `?v=`, `sw.js` `CACHE_NAME` kept in sync |
| **Strangler migration** | `session-migration.js` reads legacy keys once → `DocumentSession`; writes to legacy keys removed elsewhere |
| **Dead code elimination** | Legacy assessment screens, handlers, and unused graph adapter aliases |
| **Defensive read / no write** | `guide-chat.js` / `llm.js` may still read `active_session`; writes centralized to `session-store.js` |
| **Contract re-exports** | `api.js` barrel updated when deprecated recall alias removed |

## 4. Technical debt and improvements

**Well done:** Independent rules with grep + cursor-test acceptance; migration comments document what is safe to delete next; PWA guardrail comments reduce version drift.

**Duct tape:** `storeSessionsByMode` still exists as a no-op write API for callers that predate DocumentSession — should eventually be deleted once all call sites use `saveDocumentSession`. Strict fidelity hint copy is lifted from prompt rules but `#blockFidelityBanner` still shows Spanish anchor/fidelity messages unrelated to strict toggle (pre-existing).

**Won't scale:** Static cursor-tests grep source files; they won't catch runtime regressions in `showScreen` routing without DOM harness. Some older regression tests (`rsvp-assessment-reposition`, `source-fidelity`) fail in Node because they import `ui.js` without `document` — unrelated to this change but blocks full CI green.

**Not covered (manual):** End-to-end RSVP block generation under strict mode; fresh browser profile confirming zero legacy key writes during normal study flow.

## 5. Consolidation questions

1. When `resolveSourceFidelityStrictForSession` sees `_meta.source_fidelity_mode === "standard"` on a session created before the toggle existed, does it override the user's current Settings preference — and is that intentional?
2. If `getActiveDocumentSession()` returns null after migration, what happens to `storeSessionForMode` callers now that `storeSessionsByMode` no longer writes — is any code path still reachable?
3. Which remaining `@deprecated` symbols in `graph/` and `recall-api.js` are blocked on refactors in `slow/phase3.js` or external API consumers?

## 6. Suggested update for .cursorrules

1. When removing a Settings control, verify whether backend state (`state.*`, `flags.js`, session meta) is still live — disconnecting UI without removing the flag creates silent dead features.
2. Legacy screen removal checklist: delete HTML section, `showScreen` cases, `els.*` refs, event listeners, and importers (`generateAssessmentQuestions`) in one pass; grep for screen id string literals.
3. `storeSessionsByMode` / `active_session` are migration-read-only; new persistence must go through `session-store.js` — add to code review checklist for any `localStorage.setItem` PR.
