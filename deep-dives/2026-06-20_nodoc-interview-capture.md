# Deep Dive: No-Document Interview Capture

**Date:** 2026-06-20  
**Feature:** `specs/20260620-nodoc-interview-capture`  
**Roadmap:** `ROADMAP-nodoc-interview-capture.md`

---

## 1. What we built

Pith now supports creating a study session without uploading a file. The user picks a secondary path from create-session start ("I don't have a file for this"), answers a fixed opening question instantly (offline), then optional LLM follow-ups in a Socratic style. The transcript is synthesized into `shared.rawMarkdown` and a gray concept inventory under strict source-fidelity rules — nothing the user didn't say. Interview-origin sessions reuse the existing DPP and mode-bootstrap pipeline but gate out RSVP, Slow Mode, and Questions; Cloze and Recall remain available.

---

## 2. Design decisions

### Session origin via `uploadMeta.originalFormat = "interview"` (not a new mode)

**Chosen:** Marker on shared upload metadata, same `DocumentSession` shape.  
**Alternatives:** New `modes.interview` slice; parallel session type.  
**Discarded:** Would fork mode-bootstrap, DPP entry, and library UX.  
**Trade-off:** Mode availability is a runtime gate on origin, not a first-class mode — callers must check `isInterviewOriginSession()` before exposing RSVP/Slow.

### Separate `shared.interviewTranscript` from `shared.rawMarkdown`

**Chosen:** Immutable Q/A turns kept distinct; synthesis writes `rawMarkdown`.  
**Alternatives:** Store only markdown; embed transcript in markdown comments.  
**Discarded:** Loses structured fidelity source and question-source metadata (`fixed` vs `generated`).  
**Trade-off:** Two source fields to keep in sync until synthesis; after `interviewSynthesisComplete`, transcript is read-only by convention only (no hard enforcement in store).

### Static opening bank in `opening-questions.js` (per `STUDY_LANG_OPTIONS`)

**Chosen:** Curated strings keyed by study language; zero network on first paint.  
**Alternatives:** LLM-generated opener; fetched JSON locale files.  
**Discarded:** Violates SC-001 (instant opener) and offline requirement.  
**Trade-off:** Copy maintenance across four languages; quality is fixed, not adaptive.

### Fidelity via thin wrapper over `validateBlockFidelity`

**Chosen:** `validateInterviewSynthesisFidelity({ transcriptText, synthesizedMarkdown })` passes transcript as `chunk`.  
**Alternatives:** New validator; skip validation for interview.  
**Discarded:** Duplicates jaccard/term logic; skipping breaks FR-008.  
**Trade-off:** Block-oriented validator applied to whole-document synthesis — good enough for v1, not claim-level auditing.

### `signalOrigin: 'unprompted_articulation'` on existing assessment signals

**Chosen:** Optional field on `AssessmentSignal`; merge path unchanged.  
**Alternatives:** Separate signal array; overload `sourceMode`.  
**Discarded:** Splits assessment pipeline; `sourceMode` is study mode, not capture context.  
**Trade-off:** Consumers must explicitly read `signalOrigin`; default absent means `tested_recall` by convention.

### DPP skips T1.2 re-inventory and T2.3 Slow orientation for interview

**Chosen:** T12 short-circuit when `interviewSynthesisComplete` + inventory present; T23 no-op for interview origin.  
**Alternatives:** Full DPP re-run including inventory LLM; bespoke interview-only prep function.  
**Discarded:** Re-inventory wastes tokens and may overwrite fidelity-bound concepts; parallel prep duplicates DPP.  
**Trade-off:** DPP phase table grows origin-specific branches — acceptable until a third origin appears.

### Reuse `screenReviewGenerating` for follow-up and synthesis waits

**Chosen:** Same generating screen + label updates.  
**Alternatives:** Inline spinner on capture screen; new dedicated screen.  
**Discarded:** New UX surface; inconsistent with assessment/review patterns.  
**Trade-off:** User briefly leaves capture screen during LLM calls — acceptable per spec R6.

---

## 3. Concepts applied

| Concept | What it is | Where in our code |
|--------|------------|-------------------|
| **Origin pattern / feature flag gating** | Behavior varies by session metadata, not user role | `origin.js`: `isInterviewOriginSession`, `isModeAvailableForSession`; `flags.js`: `INTERVIEW_MAX_FOLLOWUP_ROUNDS`, `INTERVIEW_MIN_ANSWERED_TURNS` |
| **Immutable append-only transcript** | Event log of turns; pure helpers return new arrays | `transcript.js`: `appendTurn`, `createTurn`, `normalizeInterviewTranscript` |
| **Pure functions + side-effect boundary** | Core logic testable without DOM/LLM | `transcript.js`, `opening-questions.js`, `buildUnpromptedArticulationSignals` in `synthesis.js` |
| **Adapter / wrapper pattern** | Reuse existing validator with different source parameterization | `fidelity-validation.js`: `validateInterviewSynthesisFidelity` → `validateBlockFidelity` |
| **Structured LLM output + error taxonomy** | Named `max_tokens`, parse categories, retry path | `interview-api.js`: `INTERVIEW_FOLLOWUP_*` / `INTERVIEW_SYNTHESIS_*` error codes; synthesis retry on fidelity failure |
| **Orchestration / pipeline integration** | Post-synthesis hooks into existing DPP | `study.js`: `applyInterviewSynthesis` → `startDocumentPreparation`; `document-preparation.js`: phase short-circuits |
| **UI state machine (informal)** | `interviewCaptureState.runId` cancels stale async | `study.js`: `loadNextInterviewQuestion`, `handleInterviewFinish` |
| **Progressive enhancement entry** | Secondary CTA; upload remains primary | `index.html`: `createSessionNoFileBtn` below upload flow |
| **Schema extension with backward compatibility** | Optional fields on shared session; validation tolerates absence | `session-types.js`: `InterviewTurn`, `interviewTranscript`, `signalOrigin` |
| **Integration tests without browser** | Node + register.mjs imports ES modules | `cursor-tests/20260620_nodoc-interview-capture.mjs` |

---

## 4. Technical debt and improvements

**Well done**
- Clear module split: `opening-questions`, `transcript`, `origin`, `interview-api`, `synthesis`.
- Opening path is genuinely offline; tests cover gates, fidelity wrapper, and signals.
- DPP integration avoids a parallel pipeline.

**Functional duct tape**
- `sourceMode: "questions"` on unprompted signals — misleading for analytics; only `signalOrigin` is honest.
- Placeholder `rawMarkdown` until synthesis satisfies session validation on create.
- `alert()` when user picks a gated mode — should be inline UI.
- Synthesis fidelity retry is a full second LLM call, not a targeted repair prompt.

**Would not scale**
- `study.js` interview block adds another large orchestration surface; extract `interview-study.js` controller when a second origin type appears.
- Per-language static bank does not scale to many locales — needs extraction to JSON or i18n layer.
- `validateBlockFidelity` jaccard on whole transcript vs whole markdown is coarse for long interviews; claim-level extraction would be tighter.
- No resume UX if user leaves mid-interview beyond whatever `getActiveSession` restores — `currentQuestion` is in-memory only (`interviewCaptureState`), lost on reload unless we persist pending question.

---

## 5. Consolidation questions

1. **Why is `interviewTranscript` kept separate from `rawMarkdown` after synthesis, and what would break if synthesis overwrote or deleted the transcript?**

2. **Walk through the exact sequence from "Submit answer" when `dynamicFollowUpsUsed === INTERVIEW_MAX_FOLLOWUP_ROUNDS` — which functions run, and how does R11 (min 2 turns) interact with the auto-finish on cap?**

3. **If DPP T1.2 were not short-circuited for `interviewSynthesisComplete`, how could a second concept inventory pass violate source fidelity or user trust?**

---

## 6. Suggested update for .cursorrules

1. **Interview-origin sessions:** For `uploadMeta.originalFormat === "interview"`, never run RSVP block packing or Slow orientation (T2.3); synthesis must populate inventory before DPP T1.2 runs.

2. **Interview LLM calls:** Follow-up and synthesis calls in `interview-api.js` must declare named `max_tokens` and throw categorized errors (`*_TRUNCATED`, `*_PARSE_ERROR`, `*_SCHEMA_ERROR`, `*_FIDELITY`); user-facing paths require visible retry.

3. **Mnemonic + interview fidelity:** Interview synthesis is subject to the same source-fidelity discipline as uploads — no LLM may invent content on the capture or synthesis path; structuring only.
