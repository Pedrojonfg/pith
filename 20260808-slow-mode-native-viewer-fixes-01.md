# Spec: Native Viewer — Post-Ship Fixes 01

**Status:** Draft
**Target folder:** `specs/20260808-slow-mode-native-viewer/fixes-01.md`
**Date:** 2026-08-08
**Context:** Findings from `audit/20260808-native-viewer-post-ship.md` (read-only audit against the shipped `specs/20260808-slow-mode-native-viewer/spec.md` implementation, T01-T10).
**Supersedes/corrects:** `spec.md` R-PDF-1..8 (source availability, not covered explicitly there), R-MIG-1 (persistence), R-ANN-3 (ai-context wiring), R-MIG-3 (drop notice).
**Does not reopen:** the viewer architecture itself (pdf.js vs scroll, anchor model, checkpoint triggers) — those are confirmed working per T01-T10 green and are out of scope here. This spec only fixes the four gaps below.

---

## 0. Priority order (do not reorder without reason)

1. §1 — `pdfSource` availability (confirmed blocker: breaks the primary entry path)
2. §2 — `ai-context.js` viewerMode branching (confirmed blocker: breaks or unsafely degrades a core LLM feature on PDF sessions)
3. §3 — migration flag persistence (latent correctness bug, no current user impact per audit §2, but must land before real PDF annotations accumulate)
4. §4 — PDF drop notice wiring (cosmetic, same urgency tier as §3)
5. §5 — investigate, then fix if needed, orphaned-annotation consumers beyond the sidebar

---

## 1. `pdfSource` availability across all entry paths

**Finding.** `shared.pdfSource` → `slow.pdfSource` is populated ONLY by the legacy Slow generate path (`study.js:10325`). Every other path into Slow with a PDF-sourced document — direct `screenCreateSessionStart → screenModeSelect → Slow`, the recommend-upload path, and RSVP/Questions → Slow — leaves it unset. Missing source currently surfaces as `"PDF source unavailable. Re-upload…"`, which is graceful (no crash) but means the native PDF viewer does not work on what is very likely the most common entry path.

**R1.1.** Do not keep patching this as a per-entry-path stash. Move `pdfSource` resolution to the shared layer, resolved once, independent of which mode the user picks first — the same principle already applied to `shared.docHierarchy`, `shared.conceptInventory`, etc. A PDF is a property of the DOCUMENT, not of the fact that someone once routed through Slow's legacy generate path.

**R1.2.** Preferred hook point: DPP normalization (`document-preparation.js`, alongside where `uploadMeta.originalFormat` is already known — T0.1/T0.2 territory). When `uploadMeta.originalFormat === "pdf"`, resolve and store `shared.pdfSource` (storage key/reference to the original PDF bytes, whatever shape `pdfSource` currently takes — inspect the legacy `study.js:10325` write to confirm the exact shape before replicating it) at that point, for every PDF upload, regardless of which mode is chosen afterward.

**R1.3.** If DPP-time resolution turns out to be impractical (e.g. the original PDF bytes aren't retained in Storage post-extraction today and would need a new upload-time write), the fallback is lazy resolution: any Slow PDF-viewer bootstrap that finds `shared.pdfSource` missing but `uploadMeta.originalFormat === "pdf"` should attempt to resolve it on demand (from wherever the original bytes live, if anywhere) and cache the result on `shared`, rather than failing straight to the "re-upload" message. Only fall through to the re-upload message if resolution genuinely fails (bytes no longer available anywhere).

**R1.4.** This is flagged as an open question for Cursor to resolve via inspection, not to decide unilaterally: confirm whether original PDF bytes are retained anywhere after upload-time extraction today (check `normalization/pdf-loader.js` and whatever Storage write happens at upload). If they are NOT retained today for non-legacy paths, R1.2 requires a new Storage write at upload time for all PDFs, which is a bigger change than a pure "fix the stash location" — report this back before implementing if that's the case, since it changes the size of this fix.

**R1.5.** Regression test: for each of the three previously-broken paths (direct create→Slow, recommend-upload, RSVP/Questions→Slow), a fixture session must reach the PDF reader with `pdfSource` resolved and the actual PDF rendering, not the fallback message.

---

## 2. `ai-context.js` — viewerMode branching

**Finding.** `ai-context.js` still reads only `maxReadCharEnd`, which is empty/meaningless for `viewerMode: "pdf"` sessions (per `spec.md` §5.1, PDF sessions use `maxReadPdfPage` instead). This affects the anti-spoiler read-progress guard used by IA query / Ask AI.

**R2.1.** `ai-context.js` must branch on `session.slow.viewerMode`. For `"scroll"`, behavior is unchanged (`maxReadCharEnd`). For `"pdf"`, the anti-spoiler boundary is `maxReadPdfPage` — context handed to the LLM must be limited to content up to and including that page, not the full document.

**R2.2.** Before implementing, confirm current behavior on PDF sessions today (does the guard currently pass an empty/undefined boundary, meaning NO limit is applied and the LLM can see the whole document including unread pages, or does an empty boundary cause it to pass NO context, breaking the feature entirely). This determines severity — an unbounded-context bug (spoiler leak) and a broken-feature bug (no context, generic answers) are both real but need different urgency framing when reporting back. Report which one it actually is.

**R2.3.** Regression test: for a PDF session with `maxReadPdfPage = N`, an IA query must not receive content from pages beyond N in its context.

---

## 3. Migration flag persistence

**Finding.** The annotation-schema migration mutates session data on load but does not persist `annotationSchemaVersion` (or whatever the actual flag field ended up being called — confirm exact name in shipped code) back to storage. This means migration logic re-runs on every load rather than once.

**R3.1.** After migration runs, the version flag write and the migrated-annotations write must be persisted together, in the SAME `storeActiveSession`/session-persist call — not as two separate writes where one could land and the other not. This is a direct instance of the "persist immediately, then re-read from a layer that might be stale" pattern that has caused bugs before in this codebase (scope-gating stale-reread series); do not introduce a new instance of it while fixing this.

**R3.2.** Confirm the migration function is idempotent regardless — i.e., running it a second time against already-migrated (new-shape) data should be a safe no-op, not a corruption risk — as defense in depth even after R3.1 lands, since this session-state class of bug has a track record of appearing in more than one place at once in this codebase.

**R3.3.** Regression test: load a session with old-shape annotations twice in sequence (simulating the flag not being persisted, to verify the idempotency guard from R3.2 independently of the R3.1 fix) — result must be identical after both loads, no double-transformation artifacts, no duplicate annotations.

---

## 4. PDF annotation drop notice

**Finding.** Per `spec.md` R-MIG-3 / decision D-MIG(a), users whose PDF-viewer annotations couldn't be migrated (no recoverable position data existed) were supposed to see a one-time notice. The flag/logic exists but the UI never shows it.

**R4.1.** Wire the existing flag to an actual one-time toast/banner on next load of the affected session, using the copy already agreed in D-MIG(a): "we upgraded the reader; your PDF highlights on this document couldn't be carried over, sorry" (adapt to existing app copy style/language — Slow Mode UI is likely in the study language, not hardcoded English; check how other one-time notices in the app are localized, e.g. the SW update banner pattern, and match it).

**R4.2.** Given §2 of the audit found zero real sessions currently have pdfSource or old-shape annotations, this has no current user impact — implement and test against a fixture, no urgency to verify against real data before merging.

---

## 5. Orphaned-annotation consumers beyond the sidebar

**Finding.** Sidebar correctly marks orphaned annotations and the reader correctly skips rendering their highlight overlay. Audit called this "partially real" without specifying what the other part is.

**R5.1.** Before writing any fix, inspect every OTHER place that reads `session.slow.annotations` and report whether each respects `orphaned`:
- Phase 3 Module A (`comparePhase0ToAnnotations` / eligibility)
- Phase 3 Module B (`eligibleRetrievalAnnotations`, flashcard-convert eligibility)
- Graph adapter (`resolveEnrichedGraphInputs`)
- Any export path that includes annotations

**R5.2.** For each consumer found NOT to check `orphaned`: assess whether that actually produces a bad outcome (e.g., generating a Phase 3 retrieval question from an annotation whose position/context can't be resolved, or creating a flashcard from a snippet that no longer matches anything in the document) versus being harmless (e.g., a consumer that only uses `type`/`userText` and never touches position, where `orphaned` status genuinely doesn't matter). Only patch the consumers where it's a real problem — do not add blanket `if (annotation.orphaned) skip` checks everywhere reflexively; that risks silently dropping annotations from features where it doesn't matter and where the user would reasonably expect them to still show up (e.g. flashcard conversion only needs `userText`, an orphaned position shouldn't block that).

**R5.3.** Report findings from R5.1/R5.2 before implementing any change — this is the one item in this spec where the fix itself isn't fully specified yet, by design, since we don't know the shape of the gap.

---

## Sequence

1. §1 (pdfSource) — biggest blast radius, do first.
2. §2 (ai-context) — independent of §1, can be done in parallel by risk profile but sequence after §1 for one-commit-per-unit discipline.
3. §3 (migration flag persistence) — independent, low risk, do anytime.
4. §5 investigation (report only, no fix yet) — do early enough that its findings can inform whether it needs to land before or after §4.
5. §4 (drop notice) — lowest urgency, do last.
6. §5 fix (if R5.2 found real problems) — after investigation report is reviewed.

## Test requirements

- New regression tests for R1.5, R2.3, R3.3 as specified above.
- Re-run (do not just re-read) the existing `20260808_t0X` suite after each fix to confirm no regression in already-green coverage.
- Once §1 lands and real PDF sessions with `pdfSource` start accumulating, re-run audit §2 (real-data migration dry run) — it was inconclusive only because no qualifying data existed yet, not because the check was satisfied.
