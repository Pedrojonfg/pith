/**
 * DocumentSession V2 types and validation.
 * @see specs/20260609-unified-session/data-model.md
 */

/**
 * @typedef {'tiny'|'short'|'medium'|'long'|'very_long'} SizeCategory
 */

/**
 * @typedef {object} TextMetrics
 * @property {number} charCount
 * @property {number} wordCount
 * @property {number} estimatedReadTimeMin
 * @property {{ hasExplicitHeadings: boolean, headingDensity: number, avgParagraphLength: number, longParagraphRatio: number }} structureSignals
 * @property {{ hasBibliography: boolean, hasMathNotation: boolean, hasDefinitionPatterns: boolean, academicVocabDensity: number, firstPersonRatio: number }} contentSignals
 * @property {SizeCategory} sizeCategory
 */

/**
 * @typedef {'philosophical'|'scientific_theoretical'|'scientific_empirical'|'essay'|'lecture_notes'|'textbook_chapter'|'unknown'} PedagogicalGenre
 */

/**
 * @typedef {'understand_argument'|'memorize_facts'|'learn_procedure'|'survey_field'} PrimaryLearningGoal
 */

/**
 * @typedef {object} PedagogicalMeta
 * @property {PedagogicalGenre} genre
 * @property {1|2|3|4|5} argumentativeDensity
 * @property {1|2|3|4|5} conceptualLoad
 * @property {PrimaryLearningGoal} primaryLearningGoal
 * @property {string} genreReasoning
 */

/**
 * @typedef {object} UploadMeta
 * @property {string} fileName
 * @property {string} originalFormat
 * @property {string} uploadedAt
 */

/**
 * @typedef {object} AssessmentSignal
 * @property {string} canonicalId
 * @property {string} conceptLabel
 * @property {number|null} blockIndex
 * @property {'rsvp'|'questions'} sourceMode
 * @property {number} wrongCount
 * @property {number} correctCount
 * @property {'wrong'|'correct'} lastResult
 * @property {number} lastAt
 * @property {number} weight
 */

const MODE_KEYS = ["rsvp", "slow", "cloze", "questions"];

const STOPWORDS = new Set([
  "a", "an", "the", "el", "la", "los", "las", "de", "del", "en", "y", "o", "un", "una",
]);

/**
 * Normalize markdown for stable docId hashing.
 * @param {string} raw
 */
export function normalizeMarkdownForHash(raw) {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

/**
 * @param {string} label
 */
export function normalizeConceptLabel(label) {
  let s = String(label || "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ");
  const words = s.split(" ").filter((w) => w && !STOPWORDS.has(w));
  return words.join(" ").trim();
}

/**
 * @param {string} label
 */
export function computeCanonicalId(label) {
  const normalized = normalizeConceptLabel(label);
  if (!normalized) return "";
  return djb2Hex12(normalized);
}

function djb2Hex12(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  const hex2 = ((hash * 31) >>> 0).toString(16).padStart(8, "0");
  return (hex + hex2).slice(0, 12);
}

/**
 * @param {string} rawMarkdown
 */
export function inferDocMeta(rawMarkdown) {
  const text = String(rawMarkdown || "");
  const charCount = text.length;
  let titleInferred = "";
  const headingMatch = text.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    titleInferred = String(headingMatch[1] || "").trim().slice(0, 120);
  } else {
    const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    titleInferred = words.slice(0, 8).join(" ").slice(0, 80);
  }
  if (!titleInferred) titleInferred = "Untitled document";

  const sample = text.slice(0, 2000).toLowerCase();
  let language = "other";
  const esHits = (sample.match(/\b(el|la|de|que|en|un|una|por|con)\b/g) || []).length;
  const enHits = (sample.match(/\b(the|and|of|to|in|a|is|for)\b/g) || []).length;
  if (esHits > enHits && esHits >= 3) language = "es";
  else if (enHits >= 3) language = "en";

  let estimatedGenre = "unknown";
  if (/\b(therefore|thus|hence|por tanto|por lo tanto)\b/i.test(sample)) {
    estimatedGenre = "philosophical";
  } else if (/\b(method|hypothesis|experiment|método|hipótesis)\b/i.test(sample)) {
    estimatedGenre = "scientific";
  } else if (/\b(essay|ensayo|reflection|reflexión)\b/i.test(sample)) {
    estimatedGenre = "essay";
  } else if (text.length < 3000 && /^[-*]\s/m.test(text)) {
    estimatedGenre = "notes";
  }

  return { titleInferred, charCount, language, estimatedGenre };
}

/**
 * @param {unknown} session
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateDocumentSession(session) {
  const errors = [];
  if (!session || typeof session !== "object") {
    return { ok: false, errors: ["session must be an object"] };
  }
  if (session.schemaVersion !== 2) {
    errors.push("schemaVersion must be 2");
  }
  if (!session.docId || typeof session.docId !== "string" || !session.docId.trim()) {
    errors.push("docId must be a non-empty string");
  }
  if (typeof session.createdAt !== "number" || !Number.isFinite(session.createdAt)) {
    errors.push("createdAt must be a finite number");
  }
  if (typeof session.updatedAt !== "number" || !Number.isFinite(session.updatedAt)) {
    errors.push("updatedAt must be a finite number");
  }
  if (!session.shared || typeof session.shared !== "object") {
    errors.push("shared must be an object");
  } else {
    const sh = session.shared;
    if (!sh.docMeta || typeof sh.docMeta !== "object") {
      errors.push("shared.docMeta required");
    }
    if (!Array.isArray(sh.conceptInventory)) errors.push("shared.conceptInventory must be array");
    if (!Array.isArray(sh.annotations)) errors.push("shared.annotations must be array");
    if (!Array.isArray(sh.smItems)) errors.push("shared.smItems must be array");
    if (sh.docHierarchy != null && typeof sh.docHierarchy !== "object") {
      errors.push("shared.docHierarchy must be object or null");
    }
    const hasInline = typeof sh.rawMarkdown === "string";
    const hasRef = sh.rawMarkdownRef && typeof sh.rawMarkdownRef === "object";
    if (!hasInline && !hasRef) {
      errors.push("shared must have rawMarkdown or rawMarkdownRef");
    }
    if (hasRef) {
      if (!sh.rawMarkdownRef.storageKey || typeof sh.rawMarkdownRef.storageKey !== "string") {
        errors.push("rawMarkdownRef.storageKey required");
      }
    }
    if (sh.modeRecommendation != null) {
      const rec = sh.modeRecommendation;
      if (typeof rec !== "object" || Array.isArray(rec)) {
        errors.push("shared.modeRecommendation must be an object");
      } else if (!Array.isArray(rec.primaryFlow)) {
        errors.push("shared.modeRecommendation.primaryFlow must be an array");
      }
    }
    if (sh.uploadMeta != null) {
      if (typeof sh.uploadMeta !== "object" || Array.isArray(sh.uploadMeta)) {
        errors.push("shared.uploadMeta must be object or null");
      } else {
        if (typeof sh.uploadMeta.fileName !== "string") {
          errors.push("shared.uploadMeta.fileName must be string");
        }
        if (typeof sh.uploadMeta.originalFormat !== "string") {
          errors.push("shared.uploadMeta.originalFormat must be string");
        }
        if (typeof sh.uploadMeta.uploadedAt !== "string") {
          errors.push("shared.uploadMeta.uploadedAt must be string");
        }
      }
    }
    if (sh.assessmentSignals != null && !Array.isArray(sh.assessmentSignals)) {
      errors.push("shared.assessmentSignals must be array");
    }
  }
  if (!session.modes || typeof session.modes !== "object") {
    errors.push("modes must be an object");
  } else {
    for (const key of MODE_KEYS) {
      if (!(key in session.modes)) {
        errors.push(`modes.${key} key required`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export { MODE_KEYS };
