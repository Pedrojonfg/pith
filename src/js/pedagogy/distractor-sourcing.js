/**
 * Inventory-sourced distractor candidates for templated factual MCQs.
 * @see specs/20260702-factual-pools/contracts/distractor-validation.md
 */

import { classifyConceptHeuristic } from "./factual-classifier.js";
import {
  extractFactualAnswer,
  verifyFactualInSource,
} from "./factual-templates.js";

const YEAR_PATTERN = /\b(1[0-9]{3}|20[0-9]{2})\b/;
const NUMBER_UNITS_PATTERN =
  /\b(\d+(?:\.\d+)?)\s*(%|km|m|cm|mm|kg|g|mg|ml|l|Hz|MHz|GHz|°C|°F|USD|EUR|\$|€)\b/i;

export const MIN_DISTRACTOR_CANDIDATES = 3;

function conceptId(concept) {
  return String(concept?.canonicalId || concept?.id || "").trim();
}

function conceptLabel(concept) {
  return String(concept?.label || concept?.title || "").trim();
}

function conceptText(concept) {
  return `${conceptLabel(concept)} ${String(concept?.definition || concept?.summary || concept?.scope_one_line || "").trim()}`.trim();
}

function entrySnippet(sourceText, concept) {
  const text = String(sourceText || "");
  const label = conceptLabel(concept);
  const def = String(concept?.definition || concept?.summary || concept?.scope_one_line || "").trim();
  for (const needle of [label, def].filter((s) => s.length >= 3)) {
    const idx = text.toLowerCase().indexOf(needle.toLowerCase());
    if (idx >= 0) {
      return text.slice(idx, Math.min(text.length, idx + needle.length + 160));
    }
  }
  return `${text.slice(0, 200)} ${conceptText(concept)}`;
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

/**
 * @param {string} text
 * @returns {string|null}
 */
export function normalizeUnitFromText(text) {
  const m = String(text || "").match(NUMBER_UNITS_PATTERN);
  if (!m) return null;
  return String(m[2]).toLowerCase();
}

/**
 * @param {object} entry
 * @param {string} sourceText
 * @param {string} category
 * @returns {string|null}
 */
function extractInventoryFact(entry, sourceText, category) {
  const fromTemplate = extractFactualAnswer(entry, sourceText);
  if (fromTemplate?.category === category) return fromTemplate.answer;

  const snippet = entrySnippet(sourceText, entry);
  if (category === "date") {
    const yearMatch = firstMatchNearLabel(snippet, conceptLabel(entry), YEAR_PATTERN);
    if (yearMatch && verifyFactualInSource(yearMatch[1], sourceText)) return yearMatch[1];
    return null;
  }
  if (category === "number_with_unit") {
    const numMatch = firstMatchNearLabel(snippet, conceptLabel(entry), NUMBER_UNITS_PATTERN);
    if (numMatch && verifyFactualInSource(numMatch[1], sourceText)) {
      return `${numMatch[1]} ${numMatch[2]}`.trim();
    }
    return null;
  }
  if (category === "proper_noun") {
    const label = conceptLabel(entry);
    if (label.length >= 3 && label.length <= 60 && verifyFactualInSource(label, sourceText)) {
      return label;
    }
  }
  return null;
}

/**
 * @param {string} yearA
 * @param {string} yearB
 */
function yearDistance(yearA, yearB) {
  return Math.abs(Number(yearA) - Number(yearB));
}

/**
 * @param {object} concept
 * @param {object[]} conceptInventory
 * @param {{ category: string, fact: string, sourceText?: string }} opts
 * @returns {string[]}
 */
export function sourceDistractorCandidates(concept, conceptInventory, opts) {
  const category = String(opts?.category || "").trim();
  const fact = String(opts?.fact || "").trim();
  const sourceText = String(opts?.sourceText || "");
  const selfId = conceptId(concept);
  if (!category || !fact) return [];

  const inv = Array.isArray(conceptInventory) ? conceptInventory : [];
  /** @type {{ value: string, distance: number }[]} */
  const candidates = [];

  for (const entry of inv) {
    if (!entry || typeof entry !== "object") continue;
    if (conceptId(entry) === selfId) continue;

    if (category === "date") {
      const year = extractInventoryFact(entry, sourceText, "date");
      if (!year || year === fact) continue;
      candidates.push({ value: year, distance: yearDistance(year, fact) });
      continue;
    }

    if (category === "number_with_unit") {
      const factUnit = normalizeUnitFromText(fact);
      const entryAnswer = extractInventoryFact(entry, sourceText, "number_with_unit");
      if (!entryAnswer || entryAnswer === fact) continue;
      const entryUnit = normalizeUnitFromText(entryAnswer);
      if (!factUnit || !entryUnit || factUnit !== entryUnit) continue;
      candidates.push({ value: entryAnswer, distance: 1 });
      continue;
    }

    if (category === "proper_noun") {
      const label = extractInventoryFact(entry, sourceText, "proper_noun");
      if (!label || label === fact) continue;
      const result = classifyConceptHeuristic(entry, sourceText);
      if (!result.signals?.includes("proper_noun") && label === conceptLabel(entry)) {
        // allow inventory-sourced label when extractInventoryFact verified in source
      } else if (!result.signals?.includes("proper_noun")) {
        continue;
      }
      candidates.push({ value: label, distance: 1 });
    }
  }

  if (category === "date") {
    candidates.sort((a, b) => b.distance - a.distance);
  }

  const seen = new Set();
  const out = [];
  for (const row of candidates) {
    const key = row.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row.value);
  }
  return out;
}

/**
 * @param {object} concept
 * @param {object[]} conceptInventory
 * @param {{ category: string, fact: string, sourceText?: string }} opts
 * @returns {boolean}
 */
export function hasMinimumDistractorPool(concept, conceptInventory, opts) {
  return sourceDistractorCandidates(concept, conceptInventory, opts).length >= MIN_DISTRACTOR_CANDIDATES;
}
