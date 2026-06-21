# Contract: Factual Question Generation

## classifyConceptQuestionClass(concept, sourceText, options?)

Returns `{ questionClass: 'factual'|'conceptual', confidence: number, method: 'heuristic'|'llm' }`.

Heuristic triggers: date/year, number+units, proper-noun-heavy short def, enumeration, "X is defined as Y".

## resolveFactualCategory(concept, sourceText)

Returns `'date' | 'number_with_unit' | 'proper_noun' | null`.

Definitions and enumerations return `null` (LLM path).

## generateFactualStem(concept, sourceText, language, rotator?)

Returns `{ question, answer, category, templateKey }` or `null` (→ LLM fallback).

Must pass `verifyFactualInSource(answer, sourceText, conceptSpan)`.

## buildFactualBlockQuestions(...)

Returns templated MCQs with `generation_method: 'template_validated'` after batched distractor validation.

Per-concept LLM fallback when sourcing or validation yields fewer than 3 approved distractors.

## generation_method values

| Value | Meaning |
|-------|---------|
| `template_validated` | Templated stem + inventory distractors + validation batch |
| `llm` | Full LLM generation |
| `template` | Reserved (not emitted in factual-pools patch) |

## logLlmUsage meta

Classification calls: `meta: { generation_method: 'llm', purpose: 'question_class' }`  
Validation batch: `phase: 'distractor_validation'`, `meta.generation_method: 'template_validated'`
