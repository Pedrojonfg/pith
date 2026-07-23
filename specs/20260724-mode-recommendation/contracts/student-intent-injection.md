# Contract: Student Intent Injection

## Helper

```js
buildStudentIntentAppendix(studentIntent: string | null | undefined): string | null
```

When non-empty trimmed string, returns:

```text
STUDENT INTENT (optional; from onboarding — calibrate examples, depth, and urgency;
do not invent facts absent from the source material):
"""
${studentIntent}
"""
```

Otherwise `null`.

## High priority (must inject)

- Block generation system/user builders (`buildBlockGenerationSystemPrompt` / user content) beside previousComment/study notes channel
- `deepSeekSocraticTutor`, `deepSeekReviewSocraticTutor` — after scope note
- `guide-chat.js` `buildGuidePrompt` — after scope note
- `generateRecallQuestions` / `buildRecallQuestionsSystemPrompt` — after primaryLearningGoal
- `deepSeekPackConceptsToBlocks` — user notes section (same channel pattern as studyNotes, do not duplicate empty blocks)
- `deepSeekGenerateReviewBatch` — alongside reviewInstructions

## Medium priority (same feature if cheap)

- Concept inventory / split — same channel as studyNotes
- Slow Phase 0 — guideQuestion framing only; must not alter thesis/argumentMap instructions

## Never inject

- Pre-packing assessment family
- `deepSeekExtractSourceClaims`
- Cloze pipeline phases 0–4
- Hierarchy build prompts
- Vault extract/normalize
- Merge/dedup/audit inventory functions
