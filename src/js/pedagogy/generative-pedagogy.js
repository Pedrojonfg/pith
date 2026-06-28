/**
 * Generative pedagogy prompt fragments (self-explanation, elaborative interrogation).
 * @see specs/20260703-threshold-generative-pedagogy/contracts/generative-pedagogy-prompts.md
 */

export const SOCRATIC_STEM_GENERATIVE_RULES = `Generative pedagogy (Socratic questions only — NOT test/MCQ):
- At least one Socratic question MUST use elaborative interrogation: ask WHY the claim is true, or ask the student to explain IN THEIR OWN WORDS how it works.
- Prefer causal mechanism and principle-level reasoning over definition recall.
- Optional pattern: "What would have to change for this to be false?"
- Do NOT apply these patterns to type "test" questions.`;

export const SOCRATIC_TUTOR_GENERATIVE_RULES = `Generative evaluation:
- In Critique, check whether the student explained the underlying mechanism or only restated terms.
- Name missing causal links, unjustified leaps, or circular reasoning.
- In Suggested answer, model a principle-level explanation the student could have generated.`;

export const RECALL_QUESTION_GENERATIVE_RULES = `Generative pedagogy for open-ended recall:
- Prefer questions that require the student to reconstruct WHY or HOW, not only WHAT.
- For integrative prompts, ask how this idea connects to prerequisites already in the material.
- Include at least one elaborative-interrogation stem when multiple questions are generated.`;

export const RECALL_TUTOR_GENERATIVE_RULES = `Generative evaluation:
- Critique must distinguish paraphrase from genuine explanation (causal links, constraints, implications).
- Suggested answer should show how a strong student would self-explain the idea from the source.`;

export const SLOW_PHASE0_GENERATIVE_RULES = `Generative orientation (careful — learner may lack vocabulary):
- Include at least one question that invites integrative or causal thinking about the section thesis.
- If the concept is likely unfamiliar, prefix the question with 2 short bullet hints (scaffold) before the open why-question.
- Do not ask bare "why" without anchoring to a specific claim from the orientation text.`;

export const SLOW_PHASE3_GENERATIVE_RULES = `Generative retrieval:
- Retrieval and devil's advocate questions should force the student to defend or explain mechanisms, not quote phrases.
- Use "why" or "what follows if" patterns where appropriate.`;

export const REVIEW_SOCRATIC_GENERATIVE_RULES = SOCRATIC_STEM_GENERATIVE_RULES;
