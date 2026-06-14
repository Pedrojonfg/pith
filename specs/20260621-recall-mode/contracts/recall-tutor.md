# Contract: recall-tutor

**Module**: `src/js/api.js` — `deepSeekRecallTutor`  
**FR**: FR-010, FR-011

## Signature

```javascript
deepSeekRecallTutor({
  question,
  recall_type,
  student_answer,
  concept_ids,
  concept_definitions,  // { term, definition }[] from inventory/dictionary
  source_chunk,         // joined source_chunks or primary excerpt
  lang,
}) → Promise<TutorFeedback>
```

## Output

```json
{
  "critique": "...",
  "suggested_answer": "...",
  "quality": "strong" | "adequate" | "partial" | "insufficient"
}
```

## Prompt rules

- Evaluate synthesis-level response against source_chunk and concept definitions.
- Critique: acknowledge strengths, gaps, inaccuracies with concept references.
- Suggested answer: complete model answer grounded in source (not generic).
- Quality rubric per spec (strong / adequate / partial / insufficient).
- Temperature ~0.2.

## Validation

- Reject missing or empty `student_answer` (trimmed).
- Normalize unknown quality to `partial` with console warn in dev only.

## Contrast with RSVP socratic tutor

| Input | RSVP socratic (legacy) | Recall tutor |
|-------|------------------------|--------------|
| Context | `block.title` only | source_chunk + definitions |
| Output quality | Often unused | Drives SM-2 + signals |

Follow-up task T10 retrofits RSVP to pass block explanation + concepts.
