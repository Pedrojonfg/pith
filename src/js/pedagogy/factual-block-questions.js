/**
 * Orchestrates templated factual MCQ generation for a block.
 * @see specs/20260702-factual-pools/contracts/distractor-validation.md
 */

import { isDeterministicFactualQuestionsEnabled } from "../config/flags.js";
import { createStemRotator, ensureFactualStemRotationState } from "./pool-rotation.js";
import {
  generateFactualStem,
  resolveFactualCategory,
} from "./factual-templates.js";
import {
  MIN_DISTRACTOR_CANDIDATES,
  hasMinimumDistractorPool,
  sourceDistractorCandidates,
} from "./distractor-sourcing.js";
import { validateDistractorBatch } from "./distractor-validation.js";

const OPTION_KEYS = ["A", "B", "C", "D"];

function conceptId(concept) {
  return String(concept?.canonicalId || concept?.id || "").trim();
}

/**
 * @param {string} correct
 * @param {string[]} distractors
 */
function buildMcqOptions(correct, distractors) {
  const pool = [correct, ...distractors.slice(0, 3)];
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  /** @type {Record<string, string>} */
  const options = {};
  shuffled.forEach((val, idx) => {
    if (idx < OPTION_KEYS.length) options[OPTION_KEYS[idx]] = val;
  });
  const answerKey = OPTION_KEYS.find((k) => options[k] === correct) || "A";
  return { options, answer: answerKey };
}

/**
 * @param {object[]} concepts
 * @param {object[]} conceptInventory
 * @param {string} sourceText
 * @param {string} language
 * @param {object} session
 * @param {{ callLlm?: Function, llmModel?: string, maxQuestions?: number }} [options]
 */
export async function buildFactualBlockQuestions(
  concepts,
  conceptInventory,
  sourceText,
  language,
  session,
  options = {},
) {
  if (!isDeterministicFactualQuestionsEnabled()) {
    return { questions: [], llmFallbackConceptIds: [], validationCallCount: 0 };
  }

  const maxQuestions = Number.isFinite(options.maxQuestions)
    ? Math.max(0, options.maxQuestions)
    : Infinity;
  const rotationState = ensureFactualStemRotationState(session || {});
  const rotator = createStemRotator(rotationState);
  const inv = Array.isArray(conceptInventory) ? conceptInventory : [];
  const list = Array.isArray(concepts) ? concepts : [];

  /** @type {object[]} */
  const pending = [];
  /** @type {string[]} */
  const llmFallbackConceptIds = [];

  for (const concept of list) {
    if (pending.length >= maxQuestions) break;
    if (!concept || concept.questionClass !== "factual") continue;

    const category = resolveFactualCategory(concept, sourceText);
    if (!category) {
      const id = conceptId(concept);
      if (id) llmFallbackConceptIds.push(id);
      continue;
    }

    const stem = generateFactualStem(concept, sourceText, language, rotator);
    if (!stem) {
      const id = conceptId(concept);
      if (id) llmFallbackConceptIds.push(id);
      continue;
    }

    const candidateDistractors = sourceDistractorCandidates(concept, inv, {
      category: stem.category,
      fact: stem.answer,
      sourceText,
    });

    if (!hasMinimumDistractorPool(concept, inv, {
      category: stem.category,
      fact: stem.answer,
      sourceText,
    })) {
      const id = conceptId(concept);
      if (id) llmFallbackConceptIds.push(id);
      continue;
    }

    pending.push({
      conceptId: conceptId(concept),
      category: stem.category,
      fact: stem.answer,
      question: stem.question,
      candidateDistractors,
    });
  }

  if (!pending.length) {
    return { questions: [], llmFallbackConceptIds, validationCallCount: 0 };
  }

  const { results, callCount } = await validateDistractorBatch(
    pending.map((p) => ({ fact: p.fact, candidateDistractors: p.candidateDistractors })),
    {
      callLlm: options.callLlm,
      llmModel: options.llmModel,
      docId: session?.docId || null,
    },
  );

  const resultByFact = new Map(results.map((r) => [String(r.fact).toLowerCase(), r]));
  /** @type {object[]} */
  const questions = [];

  for (const item of pending) {
    const validated = resultByFact.get(String(item.fact).toLowerCase());
    const approved = validated?.approvedDistractors || [];
    if (approved.length < MIN_DISTRACTOR_CANDIDATES) {
      if (item.conceptId) llmFallbackConceptIds.push(item.conceptId);
      continue;
    }

    const { options, answer } = buildMcqOptions(item.fact, approved);
    questions.push({
      type: "test",
      question: item.question,
      options,
      answer,
      feedback: `The correct answer is ${item.fact}.`,
      generation_method: "template_validated",
      factualCategory: item.category,
      conceptId: item.conceptId,
    });
  }

  return {
    questions,
    llmFallbackConceptIds: [...new Set(llmFallbackConceptIds)],
    validationCallCount: callCount,
  };
}

export { MIN_DISTRACTOR_CANDIDATES };
