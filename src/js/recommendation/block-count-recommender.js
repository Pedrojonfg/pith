/**
 * RSVP block count recommender (pure, deterministic).
 * @see specs/20260611-rsvp-block-recommend/contracts/block-count-recommender-api.md
 */

export const MIN_BLOCKS = 5;
export const MAX_BLOCKS = 60;
export const WORDS_PER_BLOCK_TARGET = 2200;
export const BASE_CONCEPTS_PER_BLOCK = 5;

const DEFAULT_CONCEPTUAL_LOAD = 3;
const DEFAULT_ARGUMENTATIVE_DENSITY = 3;
const DEFAULT_GENRE = "unknown";
const DEFAULT_SIZE_CATEGORY = "medium";

/**
 * @param {number} value
 * @param {number} [fallback]
 * @returns {number}
 */
function clampDensity(value, fallback = DEFAULT_CONCEPTUAL_LOAD) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {Record<string, unknown>} signals
 */
function normalizeSignals(signals) {
  const input = signals || {};
  return {
    conceptCount: Math.max(0, Number(input.conceptCount) || 0),
    wordCount: Math.max(0, Number(input.wordCount) || 0),
    sectionCount: Math.max(0, Number(input.sectionCount) || 0),
    conceptualLoad: clampDensity(input.conceptualLoad, DEFAULT_CONCEPTUAL_LOAD),
    argumentativeDensity: clampDensity(
      input.argumentativeDensity,
      DEFAULT_ARGUMENTATIVE_DENSITY,
    ),
    genre:
      typeof input.genre === "string" && input.genre.length > 0
        ? input.genre
        : DEFAULT_GENRE,
    firstPersonRatio: Math.max(0, Number(input.firstPersonRatio) || 0),
    sizeCategory:
      typeof input.sizeCategory === "string" && input.sizeCategory.length > 0
        ? input.sizeCategory
        : DEFAULT_SIZE_CATEGORY,
  };
}

/**
 * @param {ReturnType<typeof normalizeSignals>} normalized
 * @returns {{ multiplier: number, reason: string | null }}
 */
function resolveMultiplier(normalized) {
  const { genre, argumentativeDensity, conceptualLoad, firstPersonRatio } = normalized;

  if (genre === "philosophical" || argumentativeDensity >= 4) {
    return {
      multiplier: 1.15,
      reason: genre === "philosophical" ? "genre" : "argumentativeDensity",
    };
  }

  if (genre === "scientific_theoretical" && conceptualLoad >= 4) {
    return { multiplier: 1.1, reason: "genre" };
  }

  if (genre === "lecture_notes" || firstPersonRatio > 0.03) {
    return {
      multiplier: 0.95,
      reason: genre === "lecture_notes" ? "genre" : "firstPersonRatio",
    };
  }

  return { multiplier: 1.0, reason: null };
}

/**
 * @param {ReturnType<typeof normalizeSignals>} normalized
 * @param {{ conceptN: number, wordN: number, sectionN: number, multiplier: number, multiplierReason: string | null, tinyCapApplied: boolean }} ctx
 * @returns {string[]}
 */
function buildSignalsUsed(normalized, ctx) {
  /** @type {string[]} */
  const used = ["conceptCount"];

  const sectionTerm = ctx.sectionN > 0 ? ctx.sectionN : ctx.conceptN;
  const rawDriver = Math.max(ctx.conceptN, ctx.wordN, sectionTerm);

  if (normalized.wordCount > 0 && ctx.wordN === rawDriver) {
    used.push("wordCount");
  }

  if (normalized.sectionCount > 0 && ctx.sectionN === rawDriver) {
    used.push("sectionCount");
  }

  if (normalized.conceptualLoad !== DEFAULT_CONCEPTUAL_LOAD) {
    used.push("conceptualLoad");
  }

  if (ctx.tinyCapApplied) {
    used.push("sizeCategory");
  }

  if (ctx.multiplier !== 1.0 && ctx.multiplierReason) {
    used.push(ctx.multiplierReason);
  }

  return used;
}

/**
 * @param {ReturnType<typeof normalizeSignals>} normalized
 * @param {{ nBlocks: number, multiplier: number }} ctx
 * @returns {string}
 */
function buildReasoning(normalized, ctx) {
  const conceptPart = `${normalized.conceptCount} concepts`;
  /** @type {string[]} */
  const contextParts = [];

  if (normalized.wordCount > 0) {
    contextParts.push(`~${normalized.wordCount.toLocaleString("en-US")} words`);
  }
  if (normalized.conceptualLoad !== DEFAULT_CONCEPTUAL_LOAD) {
    contextParts.push(`conceptual load ${normalized.conceptualLoad}`);
  } else if (normalized.genre !== DEFAULT_GENRE) {
    contextParts.push(`${normalized.genre.replace(/_/g, " ")} genre`);
  }

  let adjustment = "";
  if (ctx.multiplier >= 1.15) {
    adjustment = "Philosophical density favors more blocks.";
  } else if (ctx.multiplier >= 1.1) {
    adjustment = "Theoretical density favors slightly more blocks.";
  } else if (ctx.multiplier <= 0.95) {
    adjustment = "Note-style text allows slightly fewer blocks.";
  }

  const context =
    contextParts.length > 0 ? ` across ${contextParts.join(" and ")}` : "";
  const tail = adjustment ? ` ${adjustment}` : "";
  return `${conceptPart}${context}; recommended ${ctx.nBlocks} blocks.${tail}`.trim();
}

/**
 * @param {Record<string, unknown>} signals
 * @returns {{ computedAt: number, nBlocks: number, reasoning: string, signalsUsed: string[], factors: { conceptN: number, wordN: number, sectionN: number, multiplier: number, rawN: number } }}
 */
export function computeBlockCountRecommendation(signals) {
  const normalized = normalizeSignals(signals);
  // [debug-enrich]
  console.debug('[block-count-recommender.computeBlockCountRecommendation] Normalized signals:', {
    conceptCount: normalized.conceptCount,
    wordCount: normalized.wordCount,
    sectionCount: normalized.sectionCount,
    sizeCategory: normalized.sizeCategory,
    conceptualLoad: normalized.conceptualLoad,
  });

  const targetConceptsPerBlock =
    BASE_CONCEPTS_PER_BLOCK - (normalized.conceptualLoad - 1) * 0.75;
  const conceptN = Math.ceil(
    normalized.conceptCount / Math.max(targetConceptsPerBlock, 0.25),
  );
  const wordN =
    normalized.wordCount > 0
      ? Math.ceil(normalized.wordCount / WORDS_PER_BLOCK_TARGET)
      : 0;
  const sectionN = normalized.sectionCount > 0 ? normalized.sectionCount : 0;
  const sectionTerm = sectionN > 0 ? sectionN : conceptN;

  let rawN = Math.max(conceptN, wordN, sectionTerm);

  let tinyCapApplied = false;
  if (normalized.sizeCategory === "tiny" && rawN > 8) {
    rawN = Math.min(rawN, 8);
    tinyCapApplied = true;
  }

  const { multiplier, reason: multiplierReason } = resolveMultiplier(normalized);
  const nBlocks = clamp(Math.round(rawN * multiplier), MIN_BLOCKS, MAX_BLOCKS);

  const factors = {
    conceptN,
    wordN,
    sectionN,
    multiplier,
    rawN,
  };

  const signalsUsed = buildSignalsUsed(normalized, {
    conceptN,
    wordN,
    sectionN,
    multiplier,
    multiplierReason,
    tinyCapApplied,
  });

  const reasoning = buildReasoning(normalized, { nBlocks, multiplier });

  // [debug-enrich]
  console.debug('[block-count-recommender.computeBlockCountRecommendation] Result:', {
    nBlocks,
    tinyCapApplied,
    multiplier,
    multiplierReason,
    factors,
  });

  return {
    computedAt: Date.now(),
    nBlocks,
    reasoning,
    signalsUsed,
    factors,
  };
}

/**
 * @param {{ nBlocks?: number, reasoning?: string, signalsUsed?: string[], factors?: Record<string, unknown> }} rec
 * @returns {string}
 */
export function formatBlockCountReasoning(rec) {
  if (!rec) return "No block count recommendation available.";

  if (typeof rec.reasoning === "string" && rec.reasoning.length > 0) {
    return rec.reasoning.trim();
  }

  const factors = rec.factors || {};
  const conceptN = Number(factors.conceptN) || 0;
  const wordN = Number(factors.wordN) || 0;
  const multiplier = Number(factors.multiplier) || 1;
  const nBlocks = typeof rec.nBlocks === "number" ? rec.nBlocks : MIN_BLOCKS;

  let driver = "concept count";
  if (wordN > conceptN) driver = "document length";

  let tone = "";
  if (multiplier > 1) tone = " Dense material favors smaller chunks.";
  else if (multiplier < 1) tone = " Personal notes can use slightly larger blocks.";

  return `Based on ${conceptN} concept-driven blocks and length signals, ${driver} is the main factor.${tone} Recommended: ${nBlocks} blocks.`;
}
