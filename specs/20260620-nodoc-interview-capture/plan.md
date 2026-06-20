# Implementation Plan: No-Document Interview Capture

**Branch**: `20260620-nodoc-interview-capture` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

## Summary

Add interview-origin sessions where users explain material without uploading a file. Static opening questions render instantly; LLM generates capped follow-ups; fidelity-constrained synthesis populates `shared.rawMarkdown` and concept inventory; mode select hides RSVP/Slow; optional unprompted articulation assessment signals at synthesis.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)  
**Primary Dependencies**: `session-store.js`, `session-types.js`, `document-preparation.js`, `fidelity-validation.js`, `source-fidelity.js`, `llm.js`, `api.js`, `mode-taxonomy.js`, `assessment-signals.js`, `concept-registry/identity-resolution.js`  
**Storage**: `DocumentSession.shared.interviewTranscript` + existing shared fields in localStorage  
**Testing**: `cursor-tests/20260620_nodoc-interview-capture.mjs`  
**Constraints**: English UI/internal; opening bank offline; no LLM on opener; SW bump on ship; no RSVP/Slow for interview origin

## Constitution Check

| Principle | Status |
|-----------|--------|
| English UI / internal | PASS |
| Source fidelity — no invented content | PASS (R7 / FR-008) |
| LLM max_tokens + parse error categories | PASS (follow-up + synthesis) |
| PWA versioning on src changes | PASS (T08) |
| UI minimal — secondary entry only | PASS |

## Project Structure

```text
src/js/interview/
├── opening-questions.js    # static bank per STUDY_LANG_OPTIONS
├── transcript.js           # pure turn helpers, concat for fidelity
├── interview-api.js        # follow-up + synthesis LLM calls
└── synthesis.js            # transcript → rawMarkdown + inventory + signals

src/js/config/flags.js      # INTERVIEW_MAX_FOLLOWUP_ROUNDS, INTERVIEW_MIN_ANSWERED_TURNS
src/js/session-types.js     # interviewTranscript typedef, validation
src/js/fidelity-validation.js  # validateInterviewSynthesisFidelity wrapper
src/js/study.js             # entry, capture flow, mode gate
src/js/ui.js                # screen refs
index.html                  # screenInterviewCapture, no-file link
src/css/main.css            # interview screen styles
```

## Phase 0 Output

See [research.md](./research.md).

## Phase 1 Output

See [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md).
