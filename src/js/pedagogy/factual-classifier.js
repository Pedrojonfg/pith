/**
 * Deterministic factual vs conceptual classification for concept inventory entries.
 * @see specs/20260701-pedagogical-principles/contracts/factual-generation.md
 */

const YEAR_PATTERN = /\b(1[0-9]{3}|20[0-9]{2})\b/;
const NUMBER_UNITS_PATTERN = /\b\d+(?:\.\d+)?\s*(?:%|km|m|cm|mm|kg|g|mg|ml|l|Hz|MHz|GHz|°C|°F|USD|EUR|\$|€)\b/i;
const ENUM_PATTERN = /(?:^|[\s:—-])(?:first|second|third|\d+\.)\s+/i;
const DEFINED_AS_PATTERN = /\b(?:is|was|are|were)\s+(?:defined as|known as|called)\b/i;
const OCCURRED_PATTERN = /\b(?:occurred|happened|born|died|founded|published|released)\s+(?:in|on|during)\b/i;

/**
 * @param {object} concept
 * @param {string} [sourceText]
 * @returns {{ questionClass: 'factual'|'conceptual', confidence: number, method: 'heuristic', signals: string[] }}
 */
export function classifyConceptHeuristic(concept, sourceText = "") {
  const label = String(concept?.label || concept?.title || "").trim();
  const definition = String(
    concept?.definition || concept?.summary || concept?.scope_one_line || "",
  ).trim();
  const combined = `${label} ${definition}`.trim();
  const snippet = extractConceptSnippet(sourceText, label, definition);
  const probe = `${combined} ${snippet}`.trim();

  /** @type {string[]} */
  const signals = [];
  let score = 0;

  if (YEAR_PATTERN.test(probe)) {
    signals.push("year");
    score += 0.35;
  }
  if (NUMBER_UNITS_PATTERN.test(probe)) {
    signals.push("number_units");
    score += 0.3;
  }
  if (ENUM_PATTERN.test(probe)) {
    signals.push("enumeration");
    score += 0.2;
  }
  if (DEFINED_AS_PATTERN.test(probe)) {
    signals.push("defined_as");
    score += 0.25;
  }
  if (OCCURRED_PATTERN.test(probe)) {
    signals.push("occurred_in");
    score += 0.3;
  }
  if (isProperNounHeavy(label)) {
    signals.push("proper_noun");
    score += 0.2;
  }
  if (looksConceptual(combined)) {
    signals.push("conceptual_cue");
    score -= 0.35;
  }

  const confidence = Math.max(0, Math.min(1, score));
  const questionClass = confidence >= 0.45 ? "factual" : "conceptual";
  return { questionClass, confidence, method: "heuristic", signals };
}

function isProperNounHeavy(text) {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < 2 || words.length > 8) return false;
  const capped = words.filter((w) => /^[A-Z][a-z]+/.test(w)).length;
  return capped / words.length >= 0.5;
}

function looksConceptual(text) {
  return /\b(?:because|therefore|implies|relationship|compare|contrast|mechanism|why|how|argument|theory|framework|model)\b/i.test(
    text,
  );
}

function extractConceptSnippet(sourceText, label, definition) {
  const text = String(sourceText || "");
  if (!text.length) return "";
  for (const needle of [label, definition].filter((s) => s && s.length >= 4)) {
    const idx = text.toLowerCase().indexOf(needle.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 80);
      const end = Math.min(text.length, idx + needle.length + 120);
      return text.slice(start, end);
    }
  }
  return "";
}

/**
 * @param {object[]} inventory
 * @param {string} sourceText
 * @param {{ threshold?: number }} [options]
 * @returns {{ inventory: object[], ambiguous: object[] }}
 */
export function classifyInventoryHeuristic(inventory, sourceText, options = {}) {
  const threshold = Number.isFinite(options.threshold) ? options.threshold : 0.55;
  const inv = Array.isArray(inventory) ? inventory : [];
  const ambiguous = [];
  const classified = inv.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    if (entry.questionClass === "factual" || entry.questionClass === "conceptual") return entry;
    const result = classifyConceptHeuristic(entry, sourceText);
    if (result.confidence >= threshold) {
      return { ...entry, questionClass: result.questionClass };
    }
    ambiguous.push({ ...entry, _classificationConfidence: result.confidence });
    return entry;
  });
  return { inventory: classified, ambiguous };
}

/**
 * Apply LLM batch classification results to ambiguous entries.
 * @param {object[]} inventory
 * @param {Record<string, 'factual'|'conceptual'>} classById
 */
export function applyBatchClassification(inventory, classById) {
  const map = classById && typeof classById === "object" ? classById : {};
  return (Array.isArray(inventory) ? inventory : []).map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    if (entry.questionClass) return entry;
    const id = String(entry.canonicalId || entry.id || "").trim();
    const qc = map[id];
    if (qc === "factual" || qc === "conceptual") {
      return { ...entry, questionClass: qc };
    }
    return { ...entry, questionClass: entry.questionClass || "conceptual" };
  });
}
