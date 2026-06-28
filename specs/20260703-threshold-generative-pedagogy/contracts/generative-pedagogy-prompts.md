# Contract: Generative Pedagogy Prompts

## Module: `pedagogy/generative-pedagogy.js`

Exports string constants (English):

| Export | Used in |
|--------|---------|
| `SOCRATIC_STEM_GENERATIVE_RULES` | `api.js` block socratic generation |
| `SOCRATIC_TUTOR_GENERATIVE_RULES` | `deepSeekSocraticTutor` |
| `RECALL_QUESTION_GENERATIVE_RULES` | `generateRecallQuestions` |
| `RECALL_TUTOR_GENERATIVE_RULES` | `deepSeekRecallTutor` |
| `SLOW_PHASE0_GENERATIVE_RULES` | `slow/phase0.js` orientation prompts |
| `SLOW_PHASE3_GENERATIVE_RULES` | `slow/phase3.js` retrieval / devil's advocate |
| `REVIEW_SOCRATIC_GENERATIVE_RULES` | `review.js` generated socratic |

## Stem rules (summary)

- At least one Socratic/recall question per applicable block uses "why", "in your own words", or "what would change if".
- Prefer causal mechanism over definition recall.
- Do NOT apply to `type: "test"` questions.

## Tutor rules (summary)

- Critique must identify missing causal links and unjustified leaps.
- Suggested answer models principle-level explanation.

## Phase 0 rules (summary)

- Include scaffold: "If the learner lacks vocabulary, prefix with 2 bullet hints before the why-question."

## Exclusions

- `guide-chat.js`
- Cloze pipeline
- MCQ test generation
