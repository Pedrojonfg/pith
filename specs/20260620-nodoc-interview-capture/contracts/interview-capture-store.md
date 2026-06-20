# Contract: Interview Capture Store

## Module: `src/js/interview/transcript.js`

### `createTurn({ turn, question, questionSource, answer, answeredAt })`

Returns normalized `InterviewTurn`. Throws if `answer` empty.

### `appendTurn(transcript, turn)`

Returns new array (immutable append).

### `concatTranscriptForSource(transcript)`

Returns plain string: `Q: …\nA: …` per turn for fidelity source text.

### `countAnsweredTurns(transcript)`

Returns number of turns with non-empty answers.

### `canProceedToSynthesis(transcript, minTurns)`

Boolean — `countAnsweredTurns >= minTurns`.

### `dynamicFollowUpsUsed(transcript)`

Count turns where `questionSource === "generated"`.

---

# Contract: Opening Questions

## Module: `src/js/interview/opening-questions.js`

### `getOpeningQuestions(studyLang)`

- **Input**: language string from `STUDY_LANG_OPTIONS` values
- **Output**: `{ questions: string[], defaultIndex: 0 }`
- **Behavior**: No async; falls back to English if lang unknown

---

# Contract: Interview API

## Module: `src/js/interview/interview-api.js`

### `generateInterviewFollowUp({ transcript, studyLang })`

- One LLM call; `max_tokens` declared
- Returns `{ question: string }` or throws with `.code` in `INTERVIEW_FOLLOWUP_TRUNCATED` | `INTERVIEW_FOLLOWUP_PARSE_ERROR` | `INTERVIEW_FOLLOWUP_SCHEMA_ERROR`

### `synthesizeInterviewToMarkdown({ transcript, studyLang, sessionTitle })`

- Returns `{ rawMarkdown, concepts: ConceptInventoryItem[], articulatedConceptIds: string[] }`
- Post-parse runs `validateInterviewSynthesisFidelity`; on failure retries once then throws `INTERVIEW_SYNTHESIS_FIDELITY`

---

# Contract: Session helpers

## `isInterviewOriginSession(session)`

`session.shared.uploadMeta.originalFormat === "interview"`

## `getInterviewAvailableModes()`

Subset of taxonomy excluding rsvp, slow, questions.
