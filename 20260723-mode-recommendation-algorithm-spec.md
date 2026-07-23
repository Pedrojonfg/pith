# Spec: Onboarding Questionnaire + Mode Recommendation Algorithm

**Date:** 2026-07-23
**Supersedes:** nothing (first spec for `#recommendationPanel` / flow recommendation logic beyond the existing `recommendation/recommender.js` scaffolding)
**Status:** ready for implementation planning; several items below are explicitly flagged for repo inspection before coding (see §9)

---

## 0. Purpose

Today `shared.modeRecommendation` exists as a data slot and `#recommendationPanel` on `screenModeSelect` exists as UI, but the panel is intentionally left empty — no algorithm populates it. This spec defines:

1. A new onboarding questionnaire (5 questions) collected once per document, after scope selection, while the DPP continues processing in the background.
2. A pure resolution algorithm that turns questionnaire answers + existing DPP signals into a concrete flow template (which modes, in which order) and per-mode parameters (block count modifier, Socratic on/off, Socratic turn caps, test/Socratic ratio).
3. Storage and prompt-injection rules for a new free-text field, `shared.studentIntent`, collected as the questionnaire's 5th question.

This spec does **not** implement the practice ontology domain-matching mechanism, nor the theory/practice content-overlap problem — both are explicitly out of scope (§2).

---

## 1. Terminology

- **Onboarding questionnaire**: the new screen, 5 questions, one-time per document. Do NOT call this "test" or "assessment" anywhere in code, strings, or comments — those terms are reserved for `screenTest` (RSVP MCQ) and the pre-packing knowledge assessment. Use `onboardingQuestionnaire` / `Onboarding Questionnaire` consistently.
- **Flow template**: the ordered list of study modes recommended for a document (e.g. `["read", "practice", "questions"]`).
- **studentIntent**: optional free-text field, per-document, describing the student's goal or relationship to the topic. Distinct from `studyNotes` (see §6).

---

## 2. Non-goals (explicit)

- **NG1.** Deduplicating or coordinating content coverage between practice mode and theory/memorization modes (the "overlap" problem). Deferred; revisit after real usage data.
- **NG2.** The practice ontology domain-matching mechanism itself (i.e., how the system decides a given document's domain has a matching ontology graph). This spec only consumes that result as a boolean/status; it does not define how it's computed.
- **NG3.** A global, cross-document user profile for `studentIntent` or questionnaire answers. Everything in this spec is per-document only, decided fresh on every upload.
- **NG4.** Editing `studentIntent` or the questionnaire answers after initial submission. No edit UI, no re-generation, no DPP cache invalidation logic for this field — it is fixed at answer time.
- **NG5.** Calibrating exact numeric thresholds (ratios, multipliers). All numeric constants in this spec are placeholders per project convention and must be named/exported as such (e.g. `PACE_URGENT_BLOCK_MULTIPLIER`) so they can be tuned later without touching logic.
- **NG6.** Detecting "needs diagrams" as a new signal if it does not already exist in `textMetrics` / `docHierarchy.pedagogical_meta`. See open question OQ1 — if the signal doesn't exist, ship without the diagram-based override and log it as a backlog item; do not build new visual-density detection as part of this spec.

---

## 3. Data model additions

### 3.1 `shared.onboardingResponses`

New optional field on `shared`, additive, no schema version bump required (mirrors `scopeContext` precedent — nullable, validated only when present).

```
shared.onboardingResponses: {
  socraticModality: "voice" | "text" | "avoid",
  pace: "deep" | "moderate" | "urgent",
  memorizationVsUnderstanding: "memorize" | "both" | "understand",
  sourceVsExplained: "original" | "explained" | "indifferent",
  answeredAt: number  // ms epoch
} | null
```

Default in `createSession`: `null`. Validation: if present, all four enum fields required and must match their enum; `answeredAt` required number.

### 3.2 `shared.studentIntent`

New optional field on `shared`, additive, no schema version bump required.

```
shared.studentIntent: string | null
```

Default in `createSession`: `null`. Validation: if present, must be `typeof === "string"`. No length cap enforced in v1 (mirrors current `studyNotes` behavior); no sanitization beyond what LLM proxy already does.

Both fields are set exactly once, at questionnaire submission time, and never rewritten thereafter (NG4).

### 3.3 `shared.modeRecommendation` (redefinition — additive to existing slot)

The existing `modeRecommendation` field (currently populated by `recommendation/recommender.js`, consumed by `#recommendationPanel`) is extended to carry the algorithm's full output:

```
shared.modeRecommendation: {
  flow: Array<"slow" | "read" | "rsvp" | "practice" | "cloze" | "questions">,
  params: {
    blockCountMultiplier: number,        // R-PARAM-1, applied on top of block-count-recommender.js output
    socraticEnabled: boolean,            // R-PARAM-2
    socraticTurnCapOverride: {
      followUps: number,
      totalTurns: number
    } | null,                            // R-PARAM-3, null = use existing defaults unmodified
    socraticRatio: number | null         // R-PARAM-4, fraction of socratic vs test (0.0-1.0), null if not applicable
  },
  reasoning: string,                     // short human-readable explanation for #recommendationPanel display
  computedAt: number
} | null
```

**Open question (OQ2, §9):** confirm all existing read/write call sites of `shared.modeRecommendation` before changing its shape, since it is not a new field.

---

## 4. Navigation flow changes

Insert a new screen, `screenOnboardingQuestionnaire` (`showScreen` id: `onboardingQuestionnaire`), into the flow:

```
... → [scope selection / scope gate resolved] → screenOnboardingQuestionnaire → [DPP continues Tier 1/2 in background] → screenModeSelect → ...
```

- The questionnaire screen must not block or wait for DPP Tier 1/2 completion — it runs concurrently. **Open question (OQ3, §9):** confirm the existing scope-gate mechanism already supports "show a screen while DPP keeps running in the background," and reuse that pattern rather than inventing a new one.
- On submission, `shared.onboardingResponses` and `shared.studentIntent` are written immediately; `shared.modeRecommendation` is computed as soon as both the questionnaire response and the required DPP artifacts (`textMetrics`, `docHierarchy.pedagogical_meta`, practice-ontology match status) are available — whichever finishes last.
- `screenModeSelect`'s `#recommendationPanel` reads `shared.modeRecommendation` and renders `reasoning` + a Start button for `flow[0]`, same UX pattern as today (manual mode picker remains as fallback).

---

## 5. Questionnaire content (R-Q1–R-Q5)

All UI strings in English per project convention (interface strings are always English regardless of conversational language).

**R-Q1 — Socratic modality**
> "Are you comfortable answering Socratic questions out loud using the transcriber?"
- `voice` — "Yes, I prefer thinking out loud"
- `text` — "I prefer writing my answers"
- `avoid` — "I'd rather avoid Socratic questions"

**R-Q2 — Pace**
> "How much time do you want to spend on this content?"
- `deep` — "I want to go deep, I have plenty of time"
- `moderate` — "Moderate amount of time"
- `urgent` — "I'm in a hurry, just the essentials"

**R-Q3 — Memorization vs. understanding**
> "Do you need this content more to memorize concrete facts, or to understand and reason about ideas?"
- `memorize` — "Memorize concrete facts"
- `both` — "Both"
- `understand` — "Understand and reason"

**R-Q4 — Source vs. explained**
> "Do you want to work directly with the original text (with our help), or would you prefer we explain it to you?"
- `original` — "Original text"
- `explained` — "Explain it to me"
- `indifferent` — "Doesn't matter"

**R-Q5 — Student intent (optional, free text)**
> "Is there anything about your goal with this content, or your relationship to the topic, that you'd like us to take into account?"
- Free-text textarea, optional, no character limit enforced in v1.

All four closed questions (R-Q1–R-Q4) are mandatory and always shown, regardless of document type or practice-mode availability (per product decision: they tune parameters across every mode, not just flow choice).

---

## 6. Relationship to `studyNotes`

`studyNotes` (existing: `localStorage['study_notes']`, ephemeral, per-regeneration) and `shared.studentIntent` (new: persisted on `shared`, fixed at onboarding, durable for the document's lifetime) remain **separate fields with separate semantics**:

- `studyNotes` = "for this specific regeneration, take this into account" (transient, editable, no persistence contract).
- `studentIntent` = "here's why I'm studying this document at all" (durable, immutable per NG4).

Both are injected into prompts using the **same labeled-appendix template** for consistency:

```
STUDENT INTENT (optional; from onboarding — calibrate examples, depth, and urgency;
do not invent facts absent from the source material):
"""
${studentIntent}
"""
```

(`studyNotes` keeps its existing "Student comments / study focus" wording unchanged — do not merge the two channels.)

---

## 7. `studentIntent` prompt injection points

Per prior audit (`student-intent-integration-points.md`), inject `studentIntent` at these call sites, in this priority order:

**High priority (implement first):**
- `buildBlockGenerationSystemPrompt` / `buildBlockGenerationUserContent` (block explanations + Socratic stems) — beside `previousComment`
- `deepSeekSocraticTutor`, `deepSeekReviewSocraticTutor` — system prompt, after scope note
- `guide-chat.js` `buildGuidePrompt` — after scope note
- `generateRecallQuestions` / `buildRecallQuestionsSystemPrompt` — after `primaryLearningGoal` line
- `deepSeekPackConceptsToBlocks` — user notes section (reuse existing `studyNotes` slot pattern, do not duplicate)
- `deepSeekGenerateReviewBatch` — alongside existing `reviewInstructions`

**Medium priority:**
- `deepSeekConceptInventory` / `deepSeekSplitIntoBlocks` — same channel as `studyNotes`, do not add a second competing message
- Slow Phase 0 (`generatePhase0ForScope`) — `guideQuestion` framing only, explicit instruction not to alter `thesis`/`argumentMap`

**Do not inject (fidelity/fairness-critical, per audit):**
- `generatePrePackingAssessmentItems` and the whole pre-packing assessment family
- `deepSeekExtractSourceClaims`
- Cloze pipeline phases 0–4 (`generateEpistemicGraph`, `analyzeSemanticCandidates`, `generateBaseItems`, `generateDistractors`, `qaCalibrateItems`)
- `normalization/hierarchy.js` `buildHierarchyUserPrompt`
- `extractVaultCandidates`, `normalizeConceptsToVault`
- Any merge/dedup/audit functions (`deepSeekMergeConceptInventories`, `deepSeekAuditBlockIndex`, etc.)

If `studentIntent` is `null`, omit the appendix entirely rather than injecting an empty block.

---

## 8. Recommendation algorithm

Implemented as a pure function, e.g. `computeModeRecommendation(onboardingResponses, textMetrics, pedagogicalMeta, practiceMatchStatus)` → `modeRecommendation` shape from §3.3. Pure and side-effect-free so it can be fixture-tested deterministically (per project TDD convention — this is a deterministic pipeline component, not a generative one, so exact-match fixtures apply, not property-based).

### R-FLOW-1 — Theory mode

```
IF sourceVsExplained == "original":
    theoryMode = "slow"
ELSE:  # "explained" or "indifferent"
    theoryMode = "rsvp" IF pace == "urgent" ELSE "read"
    # R-FLOW-1b (conditional on OQ1): if a visual-density / diagram signal exists,
    # override theoryMode = "read" when the document is diagram-heavy, even if pace == "urgent"
```

### R-FLOW-2 — Practice mode

```
IF practiceMatchStatus indicates a matched ontology domain for this document:
    include "practice" in flow, immediately after theoryMode
# Independent of all questionnaire answers. See NG2 for what practiceMatchStatus is / how it's computed.
```

### R-FLOW-3 — Memorization mode

```
IF memorizationVsUnderstanding == "memorize":
    memorizationMode = "cloze"
ELSE:  # "both" or "understand"
    memorizationMode = "questions"
```

### R-FLOW-4 — Flow assembly

```
flow = [theoryMode, (practice if R-FLOW-2 matched), memorizationMode]
```

### R-PARAM-1 — Block count modulation

```
baseBlockCount = output of block-count-recommender.js (unchanged)
blockCountMultiplier =
    PACE_URGENT_BLOCK_MULTIPLIER   (placeholder, e.g. 0.7)  IF pace == "urgent"
    1.0                                                      IF pace == "moderate" or "deep"
```
Applied only when `theoryMode` is `"rsvp"` or `"read"`. Multiplier reduces block count (fewer, larger blocks) — never increases it in v1 (NG5: exact value is a calibration placeholder).

### R-PARAM-2 — Socratic gate (hard override)

```
IF socraticModality == "avoid":
    socraticEnabled = false
    # ALL Socratic touchpoints in the flow (screenSocratic, Recall tutor loop,
    # Review tutor loop, Questions-mode socratic) are replaced with equivalent
    # test/MCQ-only interaction. This overrides R-FLOW-3 / R-PARAM-4 entirely —
    # even if memorizationVsUnderstanding == "understand", zero Socratic turns are generated.
ELSE:
    socraticEnabled = true
```

### R-PARAM-3 — Socratic turn cap modulation

Only evaluated when `socraticEnabled == true`.

```
Default caps (existing, from 20260722-socratic-multi-turn):
  RSVP/Read:      1 follow-up / 2 total learner turns
  Recall/Review:  2 follow-ups / 3 total learner turns

IF socraticModality == "text":
    socraticTurnCapOverride = { followUps: default.followUps - 1 (floor 0), totalTurns: default.totalTurns - 1 (floor 1) }
ELSE:  # "voice"
    socraticTurnCapOverride = null  # use existing defaults unmodified
```
(`TEXT_MODALITY_TURN_REDUCTION = 1` is a placeholder constant, NG5.)

### R-PARAM-4 — Test/Socratic ratio

Only evaluated when `socraticEnabled == true` and `memorizationMode == "questions"` (Cloze has no Socratic component, so this is `null` when `memorizationMode == "cloze"`).

```
socraticRatio =
    SOCRATIC_RATIO_BOTH        (placeholder, e.g. 0.5)  IF memorizationVsUnderstanding == "both"
    SOCRATIC_RATIO_UNDERSTAND  (placeholder, e.g. 0.7)  IF memorizationVsUnderstanding == "understand"
```
Feeds into the existing `n_test` / `n_socratic` parameters already present in block generation (`buildBlockGenerationSystemPrompt`). R-PARAM-2 takes precedence: if `socraticEnabled == false`, `socraticRatio = null` and all slots go to test questions.

---

## 9. Open questions for Cursor to resolve via repo inspection before coding

**OQ1.** Does `textMetrics` (from `recommendation/analyzer.js`) or `docHierarchy.pedagogical_meta` already expose a diagram/visual-density signal? If yes, name the exact field and wire R-FLOW-1b. If no, implement R-FLOW-1 without the override in v1 and add "diagram-density override for theory mode" to `a_implementar` as a follow-up — do not build new detection logic as part of this spec (NG6).

**OQ2.** Enumerate every current read/write call site of `shared.modeRecommendation` (it is an existing field, not new) and confirm the shape change in §3.3 is additive and won't break existing consumers (`#recommendationPanel`, `recommendation/tracker.js`, etc.).

**OQ3.** Confirm whether the existing scope-gate / scope-selection screen already implements a "show a screen while DPP keeps running in the background" pattern. If so, reuse it for `screenOnboardingQuestionnaire`; if not, report what mechanism would need to be added.

**OQ4.** Confirm the exact shape/enum of the practice-ontology match status field (audit noted `practicePrep` on `shared` as "(feature) optional — spec'd" but not yet fully defined) so R-FLOW-2 can read a concrete boolean/status.

**OQ5.** Confirm exact current call sites for `n_test` / `n_socratic` parameters in block generation so R-PARAM-4's `socraticRatio` can be wired into them without duplicating logic.

**OQ6.** Confirm the exact current default Socratic turn caps in code (this spec assumes RSVP/Read = 1 follow-up/2 total, Recall/Review = 2 follow-ups/3 total, per project memory) — verify against the actual `20260722-socratic-multi-turn` implementation before applying R-PARAM-3's reduction.

---

## 10. Risk-ordered implementation sequence

1. **Data model additions** (§3.1, §3.2) — `shared.onboardingResponses`, `shared.studentIntent`, validation, `createSession` defaults. Additive, no migration, lowest risk.
2. **`computeModeRecommendation()` pure function** (§8) — fixture-based TDD, no UI/screen dependency yet. Test matrix must cover all combinations of the 4 closed answers (representative subset is acceptable, but every branch of R-FLOW-1 through R-PARAM-4 needs at least one fixture).
3. **`screenOnboardingQuestionnaire`** — new screen, router wiring in `ui.js`, resolves OQ3 before wiring background-DPP concurrency.
4. **Navigation flow change** — insert the screen after scope resolution (§4).
5. **Wire `modeRecommendation.params` into existing consumers**: block-count-recommender output multiplier, `n_test`/`n_socratic` in block generation, Socratic turn cap overrides in the multi-turn loop, Cloze-vs-Questions mode selection at `screenModeSelect` / `create` time.
6. **`studentIntent` injection** — high-priority sites first (§7), then medium-priority.
7. **`#recommendationPanel` UI** — render `flow` + `reasoning`, Start button wired to `flow[0]`, manual mode picker remains as fallback (existing behavior preserved).
8. **Remove** any dead placeholder logic that currently leaves `#recommendationPanel` empty by design.

---

## 11. Testing checklist

- [ ] Fixture-based unit tests for `computeModeRecommendation()` covering every rule branch in §8 (R-FLOW-1/1b/2/3/4, R-PARAM-1/2/3/4), including the hard-override case (`socraticModality == "avoid"` overrides `memorizationVsUnderstanding == "understand"`).
- [ ] Validation tests: `onboardingResponses` and `studentIntent` reject malformed input (wrong enum values, wrong types) per §3.1/§3.2.
- [ ] Immutability: no code path allows rewriting `onboardingResponses` or `studentIntent` after `answeredAt` is set (NG4) — confirm no edit UI exists and no API allows it.
- [ ] `shared.modeRecommendation` shape change doesn't break existing readers found in OQ2.
- [ ] Practice mode inclusion (R-FLOW-2) tested independently of questionnaire answers, for both matched and unmatched ontology cases.
- [ ] Property-based tests (not exact-match, per project convention for generative components) confirming the `STUDENT INTENT` appendix appears in constructed prompts when `studentIntent` is non-null, and is absent when null, for each high-priority injection site in §7.
- [ ] Manual QA: full flow end-to-end for at least one combination per theory mode (`slow`, `rsvp`, `read`) and one per memorization mode (`cloze`, `questions`), with and without a matched practice ontology.

---

## 12. Sources

- `application-overview.md` (2026-06-28) — screen map, DPP phases, data model, LLM contracts
- `student-intent-integration-points.md` (2026-07-23 audit) — `shared` inventory, injection points, `studyNotes`/`scopeContext`/`interviewTranscript` precedents, schema migration analysis
- Prior conversation decisions (this thread, 2026-07-23): questionnaire content, per-document scope, immutability, block-count/pace direction, Socratic avoid-mode hard override
