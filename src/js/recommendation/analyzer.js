/**
 * Text metrics for flow recommendation (pure, deterministic).
 * @see specs/20260609-flow-recommendation/contracts/analyzer-api.md
 */

const HEADING_RE = /^#{1,6}\s+/gm;
const BIBLIOGRAPHY_RE =
  /\([A-Z][a-z]+,?\s+\d{4}\)|\[\d+\]/;
const MATH_RE = /\$|\\frac|\\sum|∑|∫/;
const DEFINITION_RE =
  /(refers to as|is defined as)/i;
const FIRST_PERSON_RE = /\b(I|we|my)\b/gi;

/** @type {Set<string>} */
const ACADEMIC_VOCAB = new Set(
  [
    "epistemology",
    "ontology",
    "phenomenology",
    "hermeneutics",
    "dialectic",
    "metaphysics",
    "ethics",
    "normative",
    "hypothesis",
    "theorem",
    "empirical",
    "paradigm",
    "methodology",
    "therefore",
    "thus",
    "hence",
    "consequently",
    "argument",
    "premise",
    "conclusion",
    "inference",
    "concept",
    "notion",
    "definition",
    "proposition",
    "analysis",
    "synthesis",
    "critique",
    "discourse",
    "framework",
    "theoretical",
    "empiricism",
    "rationalism",
    "subjectivity",
    "objectivity",
    "consciousness",
    "intentionality",
    "causality",
    "determinism",
    "relativism",
    "utilitarianism",
    "deontology",
    "virtue",
    "autonomy",
    "legitimacy",
    "sovereignty",
    "ideology",
    "hegemony",
    "dialectical",
    "phenomenological",
    "existential",
    "transcendental",
    "a priori",
    "a posteriori",
    "noumenon",
    "phenomenon",
    "categorical",
    "imperative",
    "dialectics",
    "hermeneutic",
    "semantics",
    "pragmatics",
    "syntax",
    "axiom",
    "lemma",
    "corollary",
    "postulate",
    "quantifier",
    "predicate",
    "epistemic",
    "normativity",
    "justification",
    "warrant",
    "coherence",
    "consistency",
    "validity",
    "soundness",
  ].map((w) => w.toLowerCase()),
);

/**
 * @param {string} markdownText
 * @returns {import("../session-types.js").TextMetrics}
 */
export function analyzeText(markdownText) {
  const text = String(markdownText ?? "");
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = text.length;
  const estimatedReadTimeMin = Math.max(0, Math.ceil(wordCount / 200));

  HEADING_RE.lastIndex = 0;
  const headingMatches = text.match(HEADING_RE) || [];
  const headingCount = headingMatches.length;
  const hasExplicitHeadings = headingCount > 0;
  const headingDensity = wordCount > 0 ? headingCount / (wordCount / 1000) : 0;

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
  const paragraphWordCounts = paragraphs.map((p) => p.split(/\s+/).filter(Boolean).length);
  const avgParagraphLength =
    paragraphWordCounts.length > 0
      ? paragraphWordCounts.reduce((a, b) => a + b, 0) / paragraphWordCounts.length
      : wordCount;
  const longParagraphs = paragraphWordCounts.filter((n) => n > 150).length;
  const longParagraphRatio =
    paragraphWordCounts.length > 0 ? longParagraphs / paragraphWordCounts.length : 0;

  const hasBibliography = BIBLIOGRAPHY_RE.test(text);
  const hasMathNotation = MATH_RE.test(text);
  const hasDefinitionPatterns = DEFINITION_RE.test(text);

  let academicMatches = 0;
  const lowerWords = words.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ""));
  for (const w of lowerWords) {
    if (ACADEMIC_VOCAB.has(w)) academicMatches += 1;
  }
  const academicVocabDensity = wordCount > 0 ? academicMatches / wordCount : 0;

  const firstPersonMatches = text.match(FIRST_PERSON_RE) || [];
  const firstPersonRatio = wordCount > 0 ? firstPersonMatches.length / wordCount : 0;

  return {
    charCount,
    wordCount,
    estimatedReadTimeMin,
    structureSignals: {
      hasExplicitHeadings,
      headingDensity,
      avgParagraphLength,
      longParagraphRatio,
    },
    contentSignals: {
      hasBibliography,
      hasMathNotation,
      hasDefinitionPatterns,
      academicVocabDensity,
      firstPersonRatio,
    },
    sizeCategory: sizeCategoryFromChars(charCount),
  };
}

/**
 * @param {number} charCount
 * @returns {'tiny'|'short'|'medium'|'long'|'very_long'}
 */
function sizeCategoryFromChars(charCount) {
  if (charCount < 2000) return "tiny";
  if (charCount < 8000) return "short";
  if (charCount < 30000) return "medium";
  if (charCount < 80000) return "long";
  return "very_long";
}

export const _internals = {
  ACADEMIC_VOCAB,
  HEADING_RE,
  BIBLIOGRAPHY_RE,
};
