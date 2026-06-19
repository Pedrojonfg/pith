# Tech Debt Cleanup

**Status:** Implementation-ready  
**Folder:** `specs/20260628-tech-debt-cleanup/spec.md`  
**Source:** `spec-debt.md`

Closes implementation gaps flagged in `application-overview.md` §22–24. Does not redefine prior spec decisions — closes gaps only.

## Assumptions

- Pre-packing holistic assessment is the only assessment path (`screenPrePackingAssessment` / `screenPrePackingResults`).
- Supabase migration and DPP logic are out of scope.
- `.specify/` tooling absent; artifacts live under `specs/20260628-tech-debt-cleanup/`.

## R1 — Restore Source Fidelity Strict toggle

Restore Settings toggle for `state.sourceFidelityStrict`; remove hardcoded `SOURCE_FIDELITY_STRICT: false` gate; persist like other Settings fields; re-wire `sourceFidelityStrictToggleBtn` / `sourceFidelityStrictHint`.

**Acceptance:** Toggling strict mode changes RSVP block generation on next session; `#blockFidelityBanner` reflects state.

## R2 — Remove legacy assessment screen

Delete `screenInitialAssessment`, `screenAssessmentGenerating`, and all `showScreen("assessment")` / `assessmentGenerating` paths. Remove `ASSESSMENT_LEGACY_MCQ_UI` flag.

**Acceptance:** `grep` for `screenInitialAssessment|screenAssessmentGenerating` returns zero in `src/` and `index.html`.

## R3 — Align PWA version markers

Single `YYYYMMDD_N` string for `SW_VERSION`, `?v=` on `sw-update.js`, `main.js`, `splash.js`, and `CACHE_NAME`. Bump together; add guardrail comments. Run `cursor-tests/20260606_validate-sw-update-flow.mjs`.

## R4 — Retire legacy `active_session` persistence writes

Keep one-time migration reads in `session-migration.js` and `migrateLegacyActiveSession`. Remove ongoing `localStorage.setItem` to `active_session` / `sessions_by_mode` outside migration. Add header comment in `session-migration.js`.

## R5 — Remove confirmed-dead `@deprecated` exports

Audit six named items; delete if zero usages; annotate if still used. No broader deprecated hunt.

## Sequencing

R3 → R2 → R1 → R5 → R4

## Testing checklist

- [ ] `cursor-tests/20260606_validate-sw-update-flow.mjs` (R3)
- [ ] Manual strict fidelity toggle + banner (R1)
- [ ] No legacy assessment UI path (R2)
- [ ] Fresh profile writes only DocumentSession keys (R4)
- [ ] Grep acceptance per rule
