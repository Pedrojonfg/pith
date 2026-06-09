/**
 * Text metrics for flow recommendation (pure, deterministic).
 * @see specs/20260609-flow-recommendation/contracts/analyzer-api.md
 */

const HEADING_RE = /^#{1,6}\s+/gm;
const BIBLIOGRAPHY_RE =
  /\([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+,?\s+\d{4}\)|\[\d+\]/;
const MATH_RE = /\$|\\frac|\\sum|∑|∫/;
const DEFINITION_RE =
  /(se define como|se denomina|denominamos|refers to as|is defined as)/i;
const FIRST_PERSON_RE = /\b(yo|nosotros|me|mi|I|we|my)\b/gi;

/** @type {Set<string>} */
const ACADEMIC_VOCAB = new Set(
  [
    "epistemology",
    "epistemología",
    "ontology",
    "ontología",
    "phenomenology",
    "fenomenología",
    "hermeneutics",
    "hermenéutica",
    "dialectic",
    "dialéctica",
    "metaphysics",
    "metafísica",
    "ethics",
    "ética",
    "normative",
    "normativo",
    "hypothesis",
    "hipótesis",
    "theorem",
    "teorema",
    "empirical",
    "empírico",
    "paradigm",
    "paradigma",
    "methodology",
    "metodología",
    "therefore",
    "thus",
    "hence",
    "por tanto",
    "por lo tanto",
    "consequently",
    "consecuentemente",
    "argument",
    "argumento",
    "premise",
    "premisa",
    "conclusion",
    "conclusión",
    "inference",
    "inferencia",
    "concept",
    "concepto",
    "notion",
    "noción",
    "definition",
    "definición",
    "proposition",
    "proposición",
    "analysis",
    "análisis",
    "synthesis",
    "síntesis",
    "critique",
    "crítica",
    "discourse",
    "discurso",
    "framework",
    "marco",
    "theoretical",
    "teórico",
    "empiricism",
    "empirismo",
    "rationalism",
    "racionalismo",
    "subjectivity",
    "subjetividad",
    "objectivity",
    "objetividad",
    "consciousness",
    "conciencia",
    "intentionality",
    "intencionalidad",
    "causality",
    "causalidad",
    "determinism",
    "determinismo",
    "relativism",
    "relativismo",
    "utilitarianism",
    "utilitarismo",
    "deontology",
    "deontología",
    "virtue",
    "virtud",
    "autonomy",
    "autonomía",
    "legitimacy",
    "legitimidad",
    "sovereignty",
    "soberanía",
    "ideology",
    "ideología",
    "hegemony",
    "hegemonía",
    "dialectical",
    "dialéctico",
    "phenomenological",
    "fenomenológico",
    "existential",
    "existencial",
    "transcendental",
    "transcendental",
    "a priori",
    "a posteriori",
    "noumenon",
    "noumeno",
    "phenomenon",
    "fenómeno",
    "categorical",
    "categórico",
    "imperative",
    "imperativo",
    "dialectics",
    "dialéctica",
    "hermeneutic",
    "hermenéutico",
    "semantics",
    "semántica",
    "pragmatics",
    "pragmática",
    "syntax",
    "sintaxis",
    "axiom",
    "axioma",
    "lemma",
    "lema",
    "corollary",
    "corolario",
    "postulate",
    "postulado",
    "quantifier",
    "cuantificador",
    "predicate",
    "predicado",
    "ontology",
    "ontología",
    "epistemic",
    "epistémico",
    "normativity",
    "normatividad",
    "justification",
    "justificación",
    "warrant",
    "fundamento",
    "coherence",
    "coherencia",
    "consistency",
    "consistencia",
    "validity",
    "validez",
    "soundness",
    "solidez",
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
