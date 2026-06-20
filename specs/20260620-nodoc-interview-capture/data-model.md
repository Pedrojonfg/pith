# Data Model: No-Document Interview Capture

## Session origin

```typescript
shared.uploadMeta.originalFormat = "interview"  // extends pdf | html | txt | md
shared.uploadMeta.fileName = user session title or "Interview session"
```

## InterviewTranscript

```typescript
type InterviewQuestionSource = "fixed" | "generated";

interface InterviewTurn {
  turn: number;              // 1-based
  question: string;
  questionSource: InterviewQuestionSource;
  answer: string;
  answeredAt: number;        // epoch ms
}

shared.interviewTranscript: InterviewTurn[]
```

**Validation**:
- Array of objects with required fields
- `turn` sequential starting at 1
- `answer` non-empty for completed turns
- Immutable after synthesis completes (`shared.interviewSynthesisComplete = true` flag optional)

## Synthesis state

After R7:
- `shared.rawMarkdown` — structured markdown from transcript only
- `shared.conceptInventory` — gray concepts only
- `shared.interviewSynthesisComplete: true` — blocks re-capture

## AssessmentSignal extension

```typescript
interface AssessmentSignal {
  // existing fields...
  signalOrigin?: "unprompted_articulation" | "tested_recall";  // default tested_recall
}
```

Recorded at synthesis for concepts user articulated in answers (matched by label/id from inventory mapping).

## Mode availability

When `uploadMeta.originalFormat === "interview"`:
- Hidden: `rsvp`, `slow`, `questions`
- Visible: `cloze`, `recall`, hub review paths as today

## Feature flags (`config/flags.js`)

| Flag | Default | Purpose |
|------|---------|---------|
| `INTERVIEW_MAX_FOLLOWUP_ROUNDS` | 4 | Max LLM follow-up rounds after fixed opener |
| `INTERVIEW_MIN_ANSWERED_TURNS` | 2 | Minimum before synthesis allowed |

## Relationships

```text
screenCreateSessionStart
  └─► interview capture (no file)
        └─► interviewTranscript[]
              └─► synthesis → rawMarkdown + conceptInventory
                    └─► DPP (interview subset) → mode select (gated)
```
