# Tech Debt Cleanup

**Status:** Draft
**Supersedes:** None. This spec resolves discrepancies flagged in `application-overview.md` §22–24 across `20260613-source-fidelity`, `20260618-ui-dead-weight-removal`, and `20260618-document-preparation-frontload`. It does not redefine any prior spec's pedagogical or architectural decisions — it closes implementation gaps only.

**Out of scope:** Supabase migration (Phase 1 or otherwise). `session-store.js` Supabase seams are untouched by this spec. No persistence-layer schema changes beyond what R4 requires for legacy session removal.

---

## 0. Context

`application-overview.md` §23–24 identified five items as worth resolving before further feature work accumulates on top of them. This spec resolves all five. Each rule below is independently implementable and independently testable — they do not depend on each other except where explicitly noted.

---

## 1. R1 — Restore Source Fidelity Strict toggle

**Problem:** `state.sourceFidelityStrict` and `buildSourceFirstRsvpStructure({ strictMode })` are live and functional in `study.js`, but the UI control that sets them was removed from `index.html`. The flag is hardcoded to `false` via `SOURCE_FIDELITY_STRICT` in `config/flags.js`, making the feature permanently unreachable by users.

**Decision:** Restore the toggle. The feature is not dead — it was disconnected. Reconnect it.

**Requirements:**

- **R1.1** Add a toggle control to `screenSettings`, in the same form section as `#llmModelSelect` (model/behavior settings, not API keys). Label: "Strict source fidelity" with a one-line explanation of what it does (pull exact wording from `source-fidelity.js` prompt rules — do not invent new copy describing behavior the code doesn't implement).
- **R1.2** The toggle reads/writes `state.sourceFidelityStrict`, persisted the same way other Settings fields persist (check existing pattern in `ui.js` Settings handlers — do not introduce a new storage key naming convention).
- **R1.3** Remove the hardcoded `false` override behavior from `config/flags.js` `SOURCE_FIDELITY_STRICT` — the flag should now reflect the live toggle state, not a constant. If `SOURCE_FIDELITY_STRICT` was also gating something else (verify before removing), keep that gate but feed it from the new toggle's persisted value.
- **R1.4** Re-wire `sourceFidelityStrictToggleBtn` / `sourceFidelityStrictHint` references in `ui.js` (~L565-566) and `study.js` (~L7348-7351, ~L9011-9017) to the new HTML elements. Do not create new handler functions if the old ones are still structurally correct — verify they still match current state shape before reusing.
- **R1.5** `#blockFidelityBanner` in `screenTest` must reflect the toggle state correctly when strict mode is on (verify this still works now that the path is reachable again — it was likely untested since the toggle was removed).
- **R1.6** Out of scope for this rule: changing what strict mode *does* pedagogically. Only restoring its reachability.

**Acceptance:** Toggling strict mode in Settings changes RSVP block generation behavior on the next session created, and the banner in `screenTest` appears/disappears correctly.

---

## 2. R2 — Remove legacy assessment screen

**Problem:** `ASSESSMENT_LEGACY_MCQ_UI: false` in `config/flags.js` signals this path is meant to be dead, but `screenInitialAssessment`, `screenAssessmentGenerating`, and the `showScreen("assessment")` code path in `study.js` are still present and invocable.

**Decision:** Full removal. The pre-packing holistic assessment (`screenPrePackingAssessment` / `screenPrePackingResults`) is the only assessment path going forward.

**Requirements:**

- **R2.1** Delete `<section id="screenInitialAssessment">` and `<section id="screenAssessmentGenerating">` from `index.html`.
- **R2.2** Remove the `"assessment"` and `"assessmentGenerating"` cases from `showScreen()` in `ui.js`.
- **R2.3** Find every call site that triggers `showScreen("assessment")` or `showScreen("assessmentGenerating")` in `study.js` and remove them. Do not leave the calling function as a no-op shell — remove the dead branch entirely and verify the surrounding control flow still reaches `screenPrePackingAssessment` (or skips to packing directly) correctly.
- **R2.4** Remove any `els.*` references in `ui.js` pointing to elements inside these two screens.
- **R2.5** Remove `ASSESSMENT_LEGACY_MCQ_UI` from `config/flags.js` entirely — there is no longer a flag to gate, since the code path doesn't exist.
- **R2.6** Search for any localStorage keys written exclusively by the legacy assessment flow (distinct from pre-packing assessment keys). If found, leave key *reads* defensive (don't crash on stale data from old sessions) but remove any *write* path tied to the deleted screens.
- **R2.7** Update `dictionary.js` comment pattern (the existing `screenBetweenBlocks removed — no-op` style) — add an equivalent note for `screenInitialAssessment` if any nearby code references it defensively, following the same convention already established in that file.
- **R2.8** Do not touch `screenPrePackingAssessment`, `screenPrePackingResults`, or any holistic assessment map-reduce logic — those are the surviving, correct path.

**Acceptance:** No code path in the app can reach a screen called "assessment" or "assessmentGenerating". `grep -ri "screenInitialAssessment\|screenAssessmentGenerating"` across `src/` and `index.html` returns zero results.

---

## 3. R3 — Align PWA version markers

**Problem:** `index.html` references `splash.js?v=20260620_1` while `sw.js` declares `SW_VERSION = "20260618_5"`. These should move together; a user can see a stale splash screen while the rest of the app is already updated.

**Requirements:**

- **R3.1** Establish a single version string used for `SW_VERSION` (`sw-update.js`), the `?v=` query param on `sw-update.js`, `main.js`, and `splash.js` in `index.html`, and `CACHE_NAME` in `sw.js`. Pick the format already in use (`YYYYMMDD_N`) — do not invent a new format.
- **R3.2** On this change, bump all four to the same new value reflecting the date this spec is implemented, not a copy of either existing stale value.
- **R3.3** Add a one-line comment in `sw.js` directly above `CACHE_NAME` and in `index.html` directly above the script tags, stating: "Bump all four version markers together: CACHE_NAME, SW_VERSION, splash.js?v=, and this comment's neighbors." This is a guardrail against the same drift recurring.
- **R3.4** Run `cursor-tests/20260606_validate-sw-update-flow.mjs` after this change — it is mandatory per `.cursorrules` for any PWA-touching change.

**Acceptance:** All four version markers match exactly. The SW update test passes.

---

## 4. R4 — Retire legacy `active_session` persistence path

**Problem:** Two session storage systems coexist: `DocumentSession` (current, `session-store.js`) and legacy `active_session` / `sessions_by_mode` (`session-migration.js`). The overview confirms migration to v3 is the active path but the legacy keys and their read/write logic remain live in parallel rather than purely as a one-time upgrade step.

**Requirements:**

- **R4.1** Audit `session-migration.js` and confirm its actual current role: is `active_session` still ever *written* by any live code path, or only *read* for one-time migration of old users? This determines what's safe to remove. Do not assume — verify by tracing call sites.
- **R4.2** If `active_session` / `sessions_by_mode` are write targets anywhere outside the migration function itself, remove those write paths. All session writes must go through `session-store.js` / `DocumentSession`.
- **R4.3** Keep the one-time migration *read* path (`active_session` → `DocumentSession` upgrade) intact and untouched — this is what protects existing users' data, not dead code. Do not delete migration logic that is still needed for users who haven't opened the app since the v3 schema shipped.
- **R4.4** Add a clear code comment at the top of `session-migration.js` distinguishing "this part runs once to upgrade old data" from "this part should never be a write target again" so a future cleanup pass (once enough time has passed that no legacy users remain) knows what's safe to delete next.
- **R4.5** Do not change `schemaVersion` handling or the `"legacy"` status value for `preparation.status` — those are correct and orthogonal to this rule.

**Acceptance:** No `localStorage.setItem` call targets `active_session` or `sessions_by_mode` keys outside the migration function. Existing migration tests (if present in `cursor-tests/`) still pass.

---

## 5. R5 — Remove confirmed-dead `@deprecated` exports

**Problem:** Several functions are marked `@deprecated` and, per the overview, are candidates for removal once zero imports are confirmed: `graph/view.js`, `graph/adapters.js`, `graph/proximity.js` deprecated exports; `recall-api.js` `normalizeRecallTutorFeedback`; `recommendation/recommender.js` `GENRE_LABEL`; `study.js` `syncFlowRecommendOnModeSelect`.

**Requirements:**

- **R5.1** For each function listed above, grep the full `src/` tree for import/usage sites. Only remove if the count of usages is exactly zero (excluding the declaration itself and any re-export barrel file).
- **R5.2** If a function has zero usages, delete it and its `@deprecated` JSDoc entirely. Do not leave a commented-out husk.
- **R5.3** If a function has nonzero usages (i.e., the overview's assumption was wrong), do not delete it — instead, leave it and note in a code comment why it's still alive, so future passes don't repeat the same audit from scratch.
- **R5.4** This rule explicitly excludes anything not named in the list above. Do not go hunting for additional `@deprecated` tags beyond this enumerated set — that's a separate audit, not this spec.

**Acceptance:** Each of the six named items is either deleted (if unused) or annotated with why it remains (if used). `grep -r "@deprecated"` across `src/` shows only items that were explicitly kept with a justification comment, or items outside this spec's named list.

---

## 6. Explicit non-goals

- No Supabase work of any kind.
- No changes to `source-fidelity.js` prompt rules or strict-mode pedagogical behavior — R1 restores reachability only.
- No changes to the holistic pre-packing assessment logic — R2 only removes the legacy alternative.
- No general `@deprecated` audit beyond the six items named in R5.
- No changes to `docHierarchy`, `conceptInventory`, or any DPP phase logic.

---

## 7. Sequencing

Recommended implementation order (each independently shippable, no hard dependencies between them):

1. R3 (version alignment) — smallest, lowest-risk, do first to clear easy ground.
2. R2 (legacy assessment removal) — self-contained deletion.
3. R1 (restore toggle) — touches Settings UI + `study.js`, slightly larger surface.
4. R5 (dead export audit) — mechanical, do after the above since R1/R2 changes might affect what counts as "used."
5. R4 (legacy session path) — do last; requires the most careful tracing and has the highest blast radius if done carelessly (risk of real data loss for users on old schema).

---

## 8. Testing checklist

- [ ] `cursor-tests/20260606_validate-sw-update-flow.mjs` passes (R3)
- [ ] Manual: toggle strict fidelity in Settings, create new RSVP session, confirm banner + block generation reflect it (R1)
- [ ] Manual: confirm no UI path reaches a screen titled "assessment" outside pre-packing flow (R2)
- [ ] Manual: fresh browser profile (no localStorage) → create session → confirm only `DocumentSession` keys are written, never `active_session` (R4)
- [ ] `grep` checks from each rule's Acceptance section
