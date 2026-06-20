# Spec: No-Document Interview Capture Sessions

**Status:** Draft
**Folder:** `20260620-nodoc-interview-capture`
**Supersedes:** None. Adds a new session origin alongside file upload; does not change the existing upload → DPP path.
**Depends on:** `session-store.js`, `session-types.js`, `document-preparation.js`, `source-fidelity.js`, `fidelity-validation.js`, `recommendation/recommender.js`, `concept-registry/identity-resolution.js`, `config/flags.js`, `mode-taxonomy.js`.

---

## 1. Problem statement

Pith's pipeline assumes a normalizable source text (PDF, HTML, TXT, MD) as the starting point for every session. A meaningful category of study material — physical books, talks, lectures, films, conversations — has no such file, and uploading is often undesirable or impossible (copyright, format, no digital version).

This spec introduces an alternative session-creation path: a guided, Socratic/Feynman-style interview in which the user explains, in their own words, what they took from the material. The interview transcript becomes the session's source text, structured (never invented) by the LLM into the same `shared` artifacts used by every other session. This keeps the app's core discipline intact: vault content is earned through demonstrated recall, never generated from a title or topic alone.

---

## 2. Goals

- G1. Let a user create a study session from material that cannot be uploaded, by explaining it rather than feeding a file.
- G2. Keep the LLM strictly in a structuring role over the user's own words — never inventing or researching content the user didn't say (same discipline as `source-fidelity.js`, applied to a new source type).
- G3. Make the interview feel responsive: the opening question must appear with zero LLM latency; follow-up questions may take a few seconds, made tolerable by reusing existing "generating" UX patterns.
- G4. Reuse existing architecture (`DocumentSession`, `shared.rawMarkdown`, DPP, mode-bootstrap) rather than building a parallel pipeline for this session type.

## 3. Non-goals

- NG1. No "research mode" where the LLM fills in gaps or adds facts the user did not say, regardless of how plausible.
- NG2. No RSVP or Slow Mode support for interview-origin sessions in v1 — both modes assume a continuous, linear source text this capture method does not produce.
- NG3. No Questions mode support in v1. The same transcript could support it later, but it is out of scope here to keep this spec's surface area small.
- NG4. No voice-to-text transcription pipeline in v1. Typed input is the only required input method; voice can be layered on later without changing this spec's contracts.
- NG5. No retroactive conversion between upload-origin and interview-origin sessions in either direction.
- NG6. No unbounded interview length — always capped per R5.

---

## 4. Data model

### 4.1 Session origin marker

```
shared.uploadMeta.originalFormat = "interview"   // alongside existing "pdf" | "html" | "txt" | "md"
```

### 4.2 New shared field — raw interview transcript

Kept distinct from `shared.rawMarkdown` so the unmodified source (for fidelity validation) is never lost:

```
shared.interviewTranscript = [
  { turn: number, question: string, questionSource: "fixed" | "generated", answer: string, answeredAt: number }
]
```

### 4.3 Synthesis output

`shared.rawMarkdown` is populated by the synthesis step (R7) from `interviewTranscript`, in the same field every other origin type uses — downstream consumers (concept inventory, Cloze, Recall) require no awareness of session origin beyond the mode-availability gate in R10.

---

## 5. Rules

**R1 — New session origin, not a new mode.** Interview capture is a `uploadMeta.originalFormat` value, not a new entry in `modes.*`. Its output feeds the same `shared` artifact pipeline used by uploaded documents.

**R2 — Entry point.** A new, clearly secondary path from `screenCreateSessionStart` (e.g., "I don't have a file for this") leads to the interview capture screen. The default path remains file upload.

**R3 — Fixed opening questions, no LLM call.** The first question (and optionally one or two more) comes from a static, curated bank inspired by Socratic/Feynman-style prompts (e.g., aim/compress/test/own framing). This bank requires no network or LLM call and must render instantly, including offline.

**R4 — Follow-up question generation.** Each follow-up question requires exactly one LLM call that receives the full transcript so far and proposes the next question, targeting gaps, unclear claims, or real-world application — not generic restatement. Must use the existing provider wrapper (`llm.js`) and the categorized parse-error convention (TRUNCATED / PARSE_ERROR / SCHEMA_ERROR) already required by `.cursorrules`.

**R5 — Round cap.** Maximum number of dynamic follow-up rounds is a feature flag in `config/flags.js` (default: 4). On reaching the cap, the interview auto-closes and proceeds to synthesis (R7). The user may also end voluntarily after any answered question, subject to the minimum in R11.

**R6 — Loading state reuse.** Both the wait for a follow-up question and the final synthesis step must use the existing "generating" screen pattern and copy style (consistent with `screenAssessmentGenerating` / `screenReviewGenerating`). No new loading paradigm is introduced.

**R7 — Fidelity-constrained synthesis.** The step that converts `interviewTranscript` into `shared.rawMarkdown` and the concept inventory must not introduce any claim, fact, or detail absent from the transcript. This must route through the same fidelity discipline as `source-fidelity.js` / `fidelity-validation.js`, with `interviewTranscript` (concatenated) treated as the source document for validation purposes.

**R8 — No maturity shortcut.** Concepts extracted from an interview session enter the inventory at `gray` (inventory-only), exactly like concepts from an uploaded document. There is no special-cased path to `yellow` or `green` for this origin type.

**R9 — Recall-as-evidence signal.** Articulating a concept unprompted, with no source material visible, is genuine retrieval evidence. At capture time, the system may record an `assessmentSignal` for each concept the user articulated, using the existing signal mechanism (not a bespoke bypass), which may accelerate `gray → yellow` promotion through the existing identity-resolution path. This signal must be distinguishable from signals generated by answering against shown material (see Open Questions, Q3).

**R10 — Mode availability gate.** For any session where `uploadMeta.originalFormat === "interview"`, `screenModeSelect` must hide RSVP and Slow Mode. Cloze and Recall remain available. This mirrors the existing pattern where Questions mode already hides RSVP-specific controls.

**R11 — Minimum viable transcript.** The interview must include at least 2 answered turns before synthesis (R7) is allowed to run, to ensure enough material exists for meaningful concept extraction. Ending after only the opening question is not permitted to proceed to synthesis; the user is prompted to answer at least one follow-up first.

**R12 — Text input is sufficient.** The capture UI must fully function with typed input alone. Voice input, if added later, is additive and must not become a hidden dependency of this spec's contracts (NG4).

---

## 6. Implementation sequence (ordered by risk)

1. **Static opening-question bank + entry screen wiring.** New screen reachable from `screenCreateSessionStart`; fixed first question rendered with no network dependency (R2, R3). Lowest risk — no LLM integration yet.
2. **Transcript accumulation.** Capture and store `interviewTranscript` turns client-side as the user answers, without dynamic follow-up generation yet. Still low risk.
3. **Dynamic follow-up generation.** Wire the per-round LLM call (R4), enforce the cap (R5), reuse the generating-screen pattern (R6). Medium risk — new prompt, standard parse-error handling.
4. **Fidelity-constrained synthesis.** Build the `interviewTranscript → shared.rawMarkdown` + concept inventory step, gated through `fidelity-validation.js` (R7). Higher risk — first point of integration with the shared DPP-adjacent pipeline; must not disturb upload-origin sessions.
5. **Mode availability gate.** Hide RSVP/Slow Mode for interview-origin sessions in `screenModeSelect` (R10). Low-medium risk, mostly UI gating.
6. **Recall-as-evidence signal wiring.** Connect unprompted articulation to `assessmentSignals` / identity-resolution (R9). Done last — an enhancement, not a blocker for the feature to function end-to-end.

---

## 7. Testing checklist

- [ ] Opening question renders instantly, including with no network connection.
- [ ] Follow-up question count never exceeds the configured cap.
- [ ] Interview cannot proceed to synthesis with fewer than 2 answered turns (R11).
- [ ] Reaching the round cap automatically transitions to synthesis without extra user action.
- [ ] Synthesized `rawMarkdown` / concept inventory contains no claim absent from `interviewTranscript` (spot-check via `fidelity-validation.js`).
- [ ] Concepts from an interview session start at `gray` maturity; none appear as `green` immediately after synthesis.
- [ ] An `assessmentSignal` is recorded for unprompted articulation and visibly nudges the concept toward `yellow` via identity-resolution.
- [ ] `screenModeSelect` for an interview-origin session does not display RSVP or Slow Mode.
- [ ] `screenModeSelect` for an interview-origin session does display Cloze and Recall.
- [ ] A simulated LLM parse failure on a follow-up call surfaces a categorized error (TRUNCATED / PARSE_ERROR / SCHEMA_ERROR) with a retry path, not a silent dead end.
- [ ] Existing upload-origin sessions show zero regression — DPP and mode-bootstrap behavior unchanged for `pdf`/`html`/`txt`/`md` origins.

---

## 8. Open questions (verify before implementation)

- **Q1.** Where should the static opening-question bank live, and should it vary per study language (the app already exposes `STUDY_LANG_OPTIONS`)? If yes, the bank needs a per-language structure from the start rather than a retrofit.
- **Q2.** Is `fidelity-validation.js` currently architected to accept an arbitrary source-text parameter, or does it assume an uploaded document's `rawMarkdown`? If the latter, R7 requires a small refactor to accept `interviewTranscript` as the source.
- **Q3.** Confirm whether `assessmentSignals` can currently carry a signal subtype (e.g., `origin: "unprompted_articulation"` vs `origin: "tested_recall"`), or whether this needs to be added. This also affects the co-occurrence granularity question raised in `20260620-typed-weighted-connections` — worth resolving both together if they touch the same write path.
- **Q4 (product decision, not engineering).** Should a user be allowed to add more interview turns to a session after synthesis has already run once (e.g., they remember more later), or is the transcript closed permanently after R7 executes? This affects whether `interviewTranscript` needs to support incremental re-synthesis.
