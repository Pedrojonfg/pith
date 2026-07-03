# Spec: Shared Pre-Mode Assessment Layer

**Folder:** `specs/20260702-shared-pre-mode-assessment/`
**Supersedes:** `20260611-rsvp-assessment-reposition` (assessment moves from RSVP-embedded to shared-layer; RSVP-specific invocation code is removed, not dual-maintained)
**Status:** Ready for implementation
**Author context:** Conversational design session, 2026-07-02

---

## 1. Problem statement

The pre-packing assessment currently lives inside the RSVP mode-creation flow (`screenPrePackingAssessment`, invoked from the `create` screen submit handler in `study.js`, per `20260611-rsvp-assessment-reposition`). Its only consumer is `packInventoryToBlocks` (RSVP block packing).

This is architecturally wrong for two reasons:

1. The assessment's purpose — avoid re-teaching what the learner already knows — is a cross-mode concern, at the same layer as `conceptInventory` and the Knowledge Vault, not a feature of one mode.
2. As Pith moves toward a larger mode catalog with a strong recommendation engine (long-term goal), mode recommendation needs to account for the *learner's* prior knowledge, not just document properties (`textMetrics`, `docHierarchy`). Today `modeRecommendation` (DPP T1.5) is computed blind to the user.

## 2. Target behavior

- After Tier 1 DPP completes (`conceptInventory` ready) and **before** the user reaches `screenModeSelect`, offer an **opt-in** assessment gate.
- If the user accepts: run the assessment (existing MCQ mechanism, unchanged in this spec), compute a `knowledgeProfile`, store it at `shared` level, **recompute** `modeRecommendation` using that profile, then enter `screenModeSelect`.
- If the user skips: proceed straight to `screenModeSelect` with the document-only recommendation, exactly as today.
- Any mode the user later picks can read `shared.knowledgeProfile` if it chooses to consume it (only RSVP does today; that's fine — see Non-goals).
- **Redo semantics:** requesting the assessment again for a document that already has one is *not* a patch — it resets the document to a fresh session. Document-intrinsic artifacts survive; learner-progress artifacts are wiped. See §5.
- The interview flow (`screenInterviewCapture`) never triggers this gate — interview capture is itself a form of assessment.
- No special-casing for multi-file sessions — the gate operates once, on the already-merged inventory, exactly like every other DPP phase.

## 3. Non-goals (explicitly out of scope for this spec)

- **Adaptive probing / Expected Information Gain question selection** — tracked in `20260630-adaptive-knowledge-probing`. This spec only relocates *where* the assessment lives, not *how* it selects questions.
- **Open-ended/Socratic assessment questions and Vault-filling from them** — assessment stays MCQ-only for now. Log as tech debt in `a_implementar`: "assessment questions should eventually include open-ended items that feed the Vault the same way in-mode retrieval does."
- **Showing the knowledge profile to the user** — the profile is consumed silently by the recommendation engine and by RSVP packing. No summary screen. (Possible future tier-gated feature; not now.)
- **Assessment length/design tuning, question count, model choice** — unchanged from current implementation.
- **Personalizing Tier 2 artifacts** (`slowOrientation`, Cloze items, Recall questions) by `knowledgeProfile` — these stay document-only for now; flagged as future integration in §7.

## 4. Data model changes

### 4.1 New shared field: `shared.knowledgeProfile`

Promote the profile from an RSVP-local, ephemerally-computed object (currently built inline during the RSVP create-submit handler and passed directly into `packInventoryToBlocks`) to a persisted shared field:

```
shared.knowledgeProfile: {
  computedAt: number,          // ms epoch
  source: "assessment" | null, // null if never run
  perConcept: {
    [canonicalId]: {
      mastery: "full" | "partial" | "none",
      confidence: number
    }
  }
}
```

If the assessment was never run or was skipped, `shared.knowledgeProfile` is `null` (or `source: null`) and every consumer must treat that as "no profile — behave as today."

### 4.2 `modeRecommendation` recomputation

`recommendation/recommender.js` → `computeModeRecommendation()` must accept an optional `knowledgeProfile` argument. When the gate produces a profile, `shared.modeRecommendation` (T1.5 artifact) is **recomputed** with it before the user sees `screenModeSelect`. When skipped, it runs exactly as it does today (document-only).

This is the actual point of the whole feature — mode recommendation becomes learner-aware, not just document-aware.

## 5. Redo-assessment reset table

When the user triggers "redo assessment" on a document that already has one, apply this per-field policy. This is not a partial edit — it's a controlled re-initialization of the learner-dependent parts of the session while keeping the document-dependent parts.

| `shared.*` field | Policy | Rationale |
|---|---|---|
| `rawMarkdown` / `rawMarkdownRef` | **KEEP** | Document text, learner-independent |
| `docMeta` | **KEEP** | Document-intrinsic |
| `docHierarchy` / `docTopics` | **KEEP** | Document-intrinsic |
| `conceptInventory` | **KEEP** | Document-intrinsic, expensive to regenerate |
| `conceptGraph` | **KEEP** | Document structure, not learner-dependent |
| `images` | **KEEP** | Document-intrinsic (vision analysis) |
| `textMetrics` | **KEEP** | Document-intrinsic |
| `blockRecommendation` | **KEEP** | Currently derived from `textMetrics` only, not from the profile |
| `slowOrientation` | **KEEP** | Document-based cached Phase 0 payload |
| `mergeProposals` | **KEEP** | Vault dedup, document-based novelty scoring |
| `uploadMeta` | **KEEP** | Document-intrinsic |
| `knowledgeProfile` | **RESET → recomputed** | This is literally what's being redone |
| `modeRecommendation` | **RESET → recomputed** | Depends on the new profile |
| `annotations` | **RESET** | Learner-authored during Slow mode |
| `smItems` | **RESET** | Learner mastery / spaced repetition state |
| `assessmentSignals` | **RESET** | Learner performance signals from prior study |
| `mnemonicDevices` | **⚠ OPEN QUESTION — see §8** | User-authored content; ambiguous whether it should survive |
| `modes.*` (all mode slices: rsvp, questions, slow, cloze, recall) | **RESET (full wipe)** | Per Pedro: "lo que haya que volver a hacer, se vuelve a hacer" |

`preparation` (DPP state machine) transitions back to a state that reflects "Tier 1 artifacts present, gate pending" — it does **not** re-run Tier 0/Tier 1 phases, since those artifacts are kept.

## 6. Implementation (risk-ordered)

1. **Add `shared.knowledgeProfile` field** to `session-types.js` (schema, default `null`). No behavior change yet.
2. **Extract assessment invocation out of RSVP.** Remove the assessment trigger from the `create` screen submit handler in `study.js` (the code path from `20260611-rsvp-assessment-reposition`). `generatePrePackingAssessmentItems()` / `evaluatePrePackingAssessmentResponses()` (in `api.js`) are reused as-is — only the *call site* moves.
3. **Add the gate screen/flow** between DPP Tier 1 completion and `screenModeSelect` entry. Reuse `screenPrePackingAssessment` UI component; only the entry/exit wiring changes (enters from the DPP gate instead of from RSVP's `create` submit, exits to `screenModeSelect` instead of to `screenBlocksList`).
4. **Wire profile → recommendation.** Update `computeModeRecommendation()` signature and its call site (DPP T1.5 phase runner in `document-preparation.js`) to accept and use `knowledgeProfile` when present. Re-run T1.5 after the gate resolves (accept or skip).
5. **Update RSVP packing call site.** `packInventoryToBlocks()` reads `shared.knowledgeProfile` instead of receiving a profile computed inline. No change to `packInventoryToBlocks()`'s internal logic or to the LLM prompt in `api.js`.
6. **Add "redo assessment" entry point** (e.g., in `screenModeSelect` or `screenDocLibrary`), with a confirmation dialog stating explicitly that in-progress study will be lost. Implement the reset per the §5 table.
7. **Guard the interview flow.** Ensure the new gate never fires when `session` originates from `screenInterviewCapture` (check existing `uploadMeta`/session-origin markers).
8. **Feature flag.** Repurpose or replace `isPrePackingAssessmentEnabled()` in `config/flags.js` to gate the new shared-layer behavior. Remove the old RSVP-embedded path entirely rather than keeping both — this spec supersedes `20260611`, it doesn't sit alongside it.
9. **Version bump.** Per `.cursorrules`: this touches `document-preparation.js`, `study.js`, `session-types.js`, `recommendation/recommender.js`, `session.js`, `config/flags.js`, and likely `index.html` screen wiring — bump `SW_VERSION`, `CACHE_NAME`, and all internal `?v=` import strings together after implementation.

## 7. Future integration hooks (not built now, just don't block them)

- Other modes (Cloze, Recall, Slow) currently ignore `shared.knowledgeProfile`. Nothing in this spec prevents them from reading it later (e.g., Cloze prioritizing weaker concepts, Recall scoping questions away from mastered material). Log as `a_implementar` items per mode.
- Assessment question generation becoming adaptive (EIG-based) plugs into the same gate without changing this spec's flow — it only changes what happens *inside* the gate screen.
- Open-ended assessment questions feeding the Vault: once the assessment supports non-MCQ items, route their answers through the same retrieval-signal path used by in-mode study (`vault/session-close.js`), so Vault entries can mature (gray → yellow) from assessment responses.

## 8. Open questions for Cursor to resolve before implementing

Written in plain language — flag findings back before writing code.

1. **`mnemonicDevices` on redo:** should a learner's self-authored mnemonics survive a "redo assessment" (since they wrote them, not the system), or should they be wiped along with the rest of the learner's progress? Default to **KEEP** if no stronger signal is found in code comments or prior specs, but confirm with Pedro before implementing — this wasn't explicitly settled in the design conversation.
2. **Exact Tier 1 completion signal:** verify in `document-preparation.js` which `PHASE_RUNNERS`/`preparation.status` transition currently marks "Tier 1 done, safe to show the gate" — confirm it's after T1.5 (mode recommendation) or before it, since T1.5 now needs to run twice (once without profile as a fallback default, once after the gate resolves) or only once (after the gate resolves, blocking on the gate). Recommend: T1.5 should NOT run inside the Tier 1 batch anymore — it should run only after the gate resolves (whether accepted or skipped), to avoid a wasted duplicate LLM call.
3. **Current exact call site of `generatePrePackingAssessmentItems()` / `evaluatePrePackingAssessmentResponses()`:** confirm file/line before extracting, to avoid missing a secondary call site (e.g., prefetch-on-submit per `20260611`'s parallelism note).
4. **Redo entry point placement:** confirm whether "redo assessment" should live in `screenModeSelect`, `screenDocLibrary`, or both, before wiring the confirmation dialog.

## 9. Testing checklist

- [ ] Skip path: `modeRecommendation` unchanged from current (document-only) behavior when the gate is skipped.
- [ ] Accept path: `knowledgeProfile` persisted to `shared`, `modeRecommendation` recomputed and reflects mastered concepts.
- [ ] RSVP packing reads `shared.knowledgeProfile` correctly (mastered blocks omitted, same behavior as before the relocation).
- [ ] Non-RSVP modes are unaffected by the presence/absence of a profile (no crashes, no silent behavior change).
- [ ] Redo flow wipes exactly the fields marked RESET in §5 and preserves exactly the fields marked KEEP — write an explicit assertion test per field.
- [ ] Interview-originated sessions never show the gate.
- [ ] Multi-file sessions (up to 5 files) show the gate exactly once, on the merged inventory.
- [ ] Old RSVP-embedded assessment code path is fully removed (no dead code, no dual maintenance) — grep for residual calls to the pre-relocation invocation point.
