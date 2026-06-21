/**
 * Factual question stem pools, category resolution, and stem generation.
 * @see specs/20260702-factual-pools/contracts/factual-stem-pools.md
 */

import { classifyConceptHeuristic } from "./factual-classifier.js";
import { createStemRotator } from "./pool-rotation.js";

const YEAR_PATTERN = /\b(1[0-9]{3}|20[0-9]{2})\b/;
const NUMBER_UNITS_PATTERN =
  /\b(\d+(?:\.\d+)?)\s*(%|km|m|cm|mm|kg|g|mg|ml|l|Hz|MHz|GHz|°C|°F|USD|EUR|\$|€)\b/i;

/** @type {Record<string, Record<string, string[]>>} */
export const FACTUAL_STEM_POOLS = Object.freeze({
  English: Object.freeze({
    date: Object.freeze([
      "In what year did [X] occur?",
      "When did [X] take place?",
      "[X] happened in the year ____.",
      "Which year is associated with [X]?",
      "During which year did [X] happen?",
      "The event [X] occurred in ____.",
      "Identify the year of [X].",
      "What year marks [X]?",
      "Pin the year when [X] occurred.",
      "Select the correct year for [X].",
    ]),
    number_with_unit: Object.freeze([
      "What is the value of [X]?",
      "How much is [X]?",
      "[X] equals ____.",
      "Which measurement matches [X]?",
      "The quantity for [X] is ____.",
      "Identify the number associated with [X].",
      "What numeric value describes [X]?",
      "Choose the correct figure for [X].",
      "The documented amount for [X] is ____.",
      "Which value corresponds to [X]?",
    ]),
    proper_noun: Object.freeze([
      "Who or what was [X]?",
      "Identify [X].",
      "Which name matches [X]?",
      "[X] refers to ____.",
      "What entity is [X]?",
      "Name the person, place, or thing: [X].",
      "Which option correctly names [X]?",
      "The source identifies [X] as ____.",
      "What is [X] in this document?",
      "Select the correct name for [X].",
    ]),
  }),
  Spanish: Object.freeze({
    date: Object.freeze([
      "¿En qué año ocurrió [X]?",
      "¿Cuándo tuvo lugar [X]?",
      "[X] ocurrió en el año ____.",
      "¿Qué año se asocia con [X]?",
      "¿Durante qué año sucedió [X]?",
      "El acontecimiento [X] tuvo lugar en ____.",
      "Identifica el año de [X].",
      "¿Qué año marca [X]?",
      "Señala el año en que ocurrió [X].",
      "Elige el año correcto para [X].",
    ]),
    number_with_unit: Object.freeze([
      "¿Cuál es el valor de [X]?",
      "¿Cuánto es [X]?",
      "[X] equivale a ____.",
      "¿Qué medida corresponde a [X]?",
      "La cantidad de [X] es ____.",
      "Identifica el número asociado con [X].",
      "¿Qué valor numérico describe [X]?",
      "Elige la cifra correcta para [X].",
      "El monto documentado para [X] es ____.",
      "¿Qué valor corresponde a [X]?",
    ]),
    proper_noun: Object.freeze([
      "¿Quién o qué fue [X]?",
      "Identifica [X].",
      "¿Qué nombre corresponde a [X]?",
      "[X] se refiere a ____.",
      "¿Qué entidad es [X]?",
      "Nombra la persona, lugar o cosa: [X].",
      "¿Qué opción nombra correctamente a [X]?",
      "La fuente identifica [X] como ____.",
      "¿Qué es [X] en este documento?",
      "Elige el nombre correcto para [X].",
    ]),
  }),
});

export function resolveLang(language) {
  const lang = String(language || "English").trim();
  if (/spanish|español|es\b/i.test(lang)) return "Spanish";
  return "English";
}

/**
 * @param {object} concept
 * @param {string} [sourceText]
 * @returns {'date'|'number_with_unit'|'proper_noun'|null}
 */
export function resolveFactualCategory(concept, sourceText = "") {
  const result = classifyConceptHeuristic(concept, sourceText);
  if (result.questionClass !== "factual") return null;
  const signals = new Set(result.signals || []);
  if (signals.has("defined_as") || signals.has("enumeration")) return null;
  if (signals.has("year") || signals.has("occurred_in")) return "date";
  if (signals.has("number_units")) return "number_with_unit";
  if (signals.has("proper_noun")) return "proper_noun";
  return null;
}

/**
 * @param {string} answer
 * @param {string} sourceText
 * @param {{ start?: number, end?: number }} [span]
 */
export function verifyFactualInSource(answer, sourceText, span = {}) {
  const ans = String(answer || "").trim();
  const text = String(sourceText || "");
  if (!ans || !text) return false;
  if (Number.isFinite(span.start) && Number.isFinite(span.end)) {
    const slice = text.slice(span.start, span.end);
    if (slice.toLowerCase().includes(ans.toLowerCase())) return true;
  }
  return text.toLowerCase().includes(ans.toLowerCase());
}

function conceptLabel(concept) {
  return String(concept?.label || concept?.title || "").trim();
}

function conceptDefinition(concept) {
  return String(concept?.definition || concept?.summary || concept?.scope_one_line || "").trim();
}

function firstMatchNearLabel(snippet, label, pattern) {
  const text = String(snippet || "");
  const labelIdx = text.toLowerCase().indexOf(String(label || "").toLowerCase());
  const searchFrom = labelIdx >= 0 ? labelIdx : 0;
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let best = null;
  let bestDist = Infinity;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (labelIdx >= 0 && idx < searchFrom) continue;
    const dist = labelIdx >= 0 ? idx - searchFrom : idx;
    if (dist < bestDist) {
      bestDist = dist;
      best = m;
    }
  }
  return best;
}

function extractSnippet(sourceText, label, definition = "") {
  const text = String(sourceText || "");
  for (const needle of [label, definition].filter((s) => s && s.length >= 3)) {
    const idx = text.toLowerCase().indexOf(needle.toLowerCase());
    if (idx >= 0) {
      return text.slice(idx, Math.min(text.length, idx + needle.length + 200));
    }
  }
  return text.slice(0, 400);
}

/**
 * @param {object} concept
 * @param {string} sourceText
 * @returns {{ answer: string, category: string } | null}
 */
export function extractFactualAnswer(concept, sourceText) {
  const label = conceptLabel(concept);
  if (!label) return null;
  const category = resolveFactualCategory(concept, sourceText);
  if (!category) return null;
  const def = conceptDefinition(concept);
  const snippet = extractSnippet(sourceText, label, def);

  if (category === "date") {
    const yearMatch = firstMatchNearLabel(snippet, label, YEAR_PATTERN);
    if (!yearMatch) return null;
    const answer = yearMatch[1];
    if (!verifyFactualInSource(answer, sourceText)) return null;
    return { answer, category };
  }

  if (category === "number_with_unit") {
    const numMatch = firstMatchNearLabel(snippet, label, NUMBER_UNITS_PATTERN);
    if (!numMatch) return null;
    const answer = `${numMatch[1]} ${numMatch[2]}`.trim();
    if (!verifyFactualInSource(numMatch[1], sourceText)) return null;
    return { answer, category };
  }

  if (category === "proper_noun") {
    if (label.length < 3 || label.length > 60) return null;
    if (!verifyFactualInSource(label, sourceText)) return null;
    return { answer: label, category };
  }

  return null;
}

/**
 * @param {object} concept
 * @param {string} sourceText
 * @param {string} [language]
 * @param {{ selectFromPool?: (pool: string[], category: string) => string }} [rotator]
 * @returns {{ question: string, answer: string, category: string, templateKey: string } | null}
 */
export function generateFactualStem(concept, sourceText, language = "English", rotator = null) {
  const label = conceptLabel(concept);
  if (!label) return null;
  const extracted = extractFactualAnswer(concept, sourceText);
  if (!extracted) return null;

  const lang = resolveLang(language);
  const pools = FACTUAL_STEM_POOLS[lang] || FACTUAL_STEM_POOLS.English;
  const pool = pools[extracted.category];
  if (!pool?.length) return null;

  const template =
    rotator && typeof rotator.selectFromPool === "function"
      ? rotator.selectFromPool(pool, extracted.category)
      : pool[0];
  const question = template.replace(/\[X\]/g, label);

  return {
    question,
    answer: extracted.answer,
    category: extracted.category,
    templateKey: extracted.category,
  };
}

/** @deprecated Use generateFactualStem — kept for classifier contract tests */
export function generateFactualQuestion(concept, sourceText, language = "English") {
  const stem = generateFactualStem(concept, sourceText, language);
  if (!stem) return null;
  return {
    question: stem.question,
    answer: stem.answer,
    generation_method: "template_validated",
    templateKey: stem.templateKey,
  };
}

export { createStemRotator };
