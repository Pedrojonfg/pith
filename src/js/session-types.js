/**
 * DocumentSession V2 types and validation.
 * @see specs/20260609-unified-session/data-model.md
 * @see specs/20260623-study-projects/data-model.md
 */

/**
 * User-defined study project (tree node via parentId).
 * @typedef {{ id: string, name: string, parentId: string|null, color?: string, createdAt: number, updatedAt: number }} Project
 */

/**
 * Persisted project hierarchy store (`localStorage['mylearning_projects']`).
 * @typedef {{ schemaVersion: 1, projects: Project[] }} ProjectStore
 */

/**
 * Unified cross-mode document session (schemaVersion 2).
 * @typedef {object} DocumentSession
 * @property {string} docId
 * @property {2} schemaVersion
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {string} [projectId] Optional study project assignment
 * @property {object} shared
 * @property {object} modes
 */

/** localStorage key for ProjectStore. */
export const PROJECT_STORE_KEY = "mylearning_projects";

/** ProjectStore schema version. */
export const PROJECT_STORE_SCHEMA = 1;

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
 * @typedef {object} BookMeta
 * @property {string} title
 * @property {string} author
 * @property {string|null} coverUrl
 * @property {boolean} coverUrlVerified
 * @property {boolean} coverLoadFailed
 * @property {string|null} coverMimeType
 * @property {boolean} coverFormatSupported
 * @property {number|null} coverSizeBytes
 * @property {boolean} coverSizeOk
 * @property {'A'|'B'|'C'} level
 * @property {Array<{number?: string, title: string}>|null} toc
 * @property {string|null} description
 * @property {number} cachedAt
 */

/**
 * @typedef {object} SourceFileMeta
 * @property {string} fileId
 * @property {string} fileName
 * @property {string} originalFormat
 * @property {number} sizeBytes
 * @property {number} addedAt
 */

/**
 * @typedef {object} UploadMeta
 * @property {string} fileName
 * @property {string} originalFormat
 * @property {string} uploadedAt
 * @property {BookMeta} [bookMeta]
 * @property {SourceFileMeta[]} [files]
 * @property {Record<string, string>} [sourceMap]
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
 * @property {string} [globalConceptId] Global registry link when resolved
 * @property {'unprompted_articulation'|'tested_recall'} [signalOrigin] Capture context; default tested_recall when absent
 */

/**
 * Pre-packing knowledge profile keyed by concept coverage.
 * @typedef {object} ConceptCoverageKnowledgeProfile
 * @property {Record<string, { assessed: boolean, correct?: boolean }>} byConceptId
 * @property {number} assessedCount
 * @property {number} notAssessedCount
 * @property {number} correctCount
 * @property {number} generatedAt
 * @property {string} [assessed_at]
 * @property {Array<{ concept_id: string, mastery: string, confidence: number }>} [items]
 * @property {number} [coverage]
 */

/**
 * @typedef {object} InterviewTurn
 * @property {number} turn
 * @property {string} question
 * @property {'fixed'|'generated'} questionSource
 * @property {string} answer
 * @property {number} answeredAt
 */

const MODE_KEYS = ["rsvp", "slow", "cloze", "questions", "recall"];

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
  const enHits = (sample.match(/\b(the|and|of|to|in|a|is|for)\b/g) || []).length;
  if (enHits >= 3) language = "en";

  let estimatedGenre = "unknown";
  if (/\b(therefore|thus|hence)\b/i.test(sample)) {
    estimatedGenre = "philosophical";
  } else if (/\b(method|hypothesis|experiment)\b/i.test(sample)) {
    estimatedGenre = "scientific";
  } else if (/\b(essay|reflection)\b/i.test(sample)) {
    estimatedGenre = "essay";
  } else if (text.length < 3000 && /^[-*]\s/m.test(text)) {
    estimatedGenre = "notes";
  }

  return { titleInferred, charCount, language, estimatedGenre };
}

/**
 * @typedef {object} DocumentImage
 * @property {string} imageId
 * @property {"embedded"|"full_page_fallback"} sourceType
 * @property {"pdf"|"html"} sourceFormat
 * @property {number|null} pageNumber
 * @property {string} storagePath
 * @property {number|null} width
 * @property {number|null} height
 * @property {string} mimeType
 * @property {number} createdAt
 * @property {"pending"|"ready"|"failed"|"skipped"} visionStatus
 * @property {string|null} visionDescription
 * @property {string[]} conceptLinks
 */

/**
 * @param {unknown} raw
 * @returns {DocumentImage|null}
 */
export function normalizeDocumentImage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const imageId = String(raw.imageId || "").trim();
  const storagePath = String(raw.storagePath || "").trim();
  if (!imageId || !storagePath) return null;
  const sourceType = raw.sourceType === "full_page_fallback" ? "full_page_fallback" : "embedded";
  const sourceFormat = raw.sourceFormat === "html" ? "html" : "pdf";
  const visionStatus =
    raw.visionStatus === "ready" ||
    raw.visionStatus === "failed" ||
    raw.visionStatus === "skipped"
      ? raw.visionStatus
      : "pending";
  return {
    imageId,
    sourceType,
    sourceFormat,
    pageNumber: Number.isFinite(raw.pageNumber) ? raw.pageNumber : null,
    storagePath,
    width: Number.isFinite(raw.width) ? raw.width : null,
    height: Number.isFinite(raw.height) ? raw.height : null,
    mimeType: String(raw.mimeType || "image/png"),
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    visionStatus,
    visionDescription:
      raw.visionDescription != null ? String(raw.visionDescription) : null,
    conceptLinks: Array.isArray(raw.conceptLinks)
      ? raw.conceptLinks.map((id) => String(id).trim()).filter(Boolean)
      : [],
  };
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
  if (session.schemaVersion !== 2 && session.schemaVersion !== 3) {
    errors.push("schemaVersion must be 2 or 3");
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
  if (session.projectId != null) {
    if (typeof session.projectId !== "string" || !session.projectId.trim()) {
      errors.push("projectId must be a non-empty string when present");
    }
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
        const bm = sh.uploadMeta.bookMeta;
        if (bm != null) {
          if (typeof bm !== "object" || Array.isArray(bm)) {
            errors.push("shared.uploadMeta.bookMeta must be object");
          } else {
            if (typeof bm.title !== "string") errors.push("bookMeta.title must be string");
            if (typeof bm.author !== "string") errors.push("bookMeta.author must be string");
            if (!["A", "B", "C"].includes(String(bm.level || ""))) {
              errors.push("bookMeta.level must be A, B, or C");
            }
          }
        }
        const uploadFiles = sh.uploadMeta.files;
        if (uploadFiles != null) {
          if (!Array.isArray(uploadFiles)) {
            errors.push("shared.uploadMeta.files must be array when present");
          } else {
            uploadFiles.forEach((f, i) => {
              if (!f || typeof f !== "object") {
                errors.push(`shared.uploadMeta.files[${i}] must be object`);
                return;
              }
              if (typeof f.fileId !== "string") errors.push(`shared.uploadMeta.files[${i}].fileId must be string`);
              if (typeof f.fileName !== "string") errors.push(`shared.uploadMeta.files[${i}].fileName must be string`);
              if (typeof f.originalFormat !== "string") {
                errors.push(`shared.uploadMeta.files[${i}].originalFormat must be string`);
              }
            });
          }
        }
      }
    }
    if (sh.assessmentSignals != null && !Array.isArray(sh.assessmentSignals)) {
      errors.push("shared.assessmentSignals must be array");
    }
    if (sh.docTopics != null && !Array.isArray(sh.docTopics)) {
      errors.push("shared.docTopics must be array");
    }
    if (sh.mnemonicDevices != null && !Array.isArray(sh.mnemonicDevices)) {
      errors.push("shared.mnemonicDevices must be array");
    }
    if (sh.interviewTranscript != null && !Array.isArray(sh.interviewTranscript)) {
      errors.push("shared.interviewTranscript must be array");
    }
    if (sh.interviewSynthesisComplete != null && typeof sh.interviewSynthesisComplete !== "boolean") {
      errors.push("shared.interviewSynthesisComplete must be boolean");
    }
    if (sh.images != null && !Array.isArray(sh.images)) {
      errors.push("shared.images must be array");
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

/**
 * Recall-aligned facet taxonomy for vault review items.
 * @typedef {'synthesis'|'relational'|'argumentative'|'applicative'|'cloze'} ConceptFacet
 */

/** @type {readonly ConceptFacet[]} */
export const CONCEPT_FACETS = Object.freeze([
  "synthesis",
  "relational",
  "argumentative",
  "applicative",
  "cloze",
]);

/**
 * Global registry facets (includes recognition for RSVP/Cloze).
 * @typedef {'recognition'|'synthesis'|'relational'|'argumentative'|'applicative'} RegistryConceptFacet
 */

/** @type {readonly RegistryConceptFacet[]} */
export const REGISTRY_CONCEPT_FACETS = Object.freeze([
  "recognition",
  "synthesis",
  "relational",
  "argumentative",
  "applicative",
]);

/**
 * @typedef {object} ConceptFacetSchedule
 * @property {RegistryConceptFacet} facet
 * @property {number} interval
 * @property {number} repetitions
 * @property {number} easeFactor
 * @property {string} dueDate
 * @property {string} lastReviewedAt
 * @property {number} lastQuality
 */

/**
 * @typedef {object} ConceptContentBlock
 * @property {string} id
 * @property {RegistryConceptFacet} facet
 * @property {string} text
 * @property {string} sourceDocId
 * @property {string} sourceSessionDate
 * @property {string|null} supersededBy
 */

/**
 * @typedef {object} ConceptContent
 * @property {ConceptContentBlock[]} blocks
 */

/**
 * @typedef {object} Concept
 * @property {string} id
 * @property {string} canonicalName
 * @property {string} slug
 * @property {string[]} aliases
 * @property {'yellow'|'green'} maturity
 * @property {number} mastery
 * @property {ConceptFacetSchedule[]} facets
 * @property {ConceptContent|null} content
 * @property {string[]} sourceDocIds
 * @property {string[]} [relatedConceptIds]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} VaultObservationGlobal
 * @property {string} conceptId
 * @property {RegistryConceptFacet} facet
 * @property {string} observedAt
 * @property {number} quality
 * @property {string} sourceDocId
 */

/**
 * @typedef {object} ConceptRegistry
 * @property {number} schemaVersion
 * @property {Concept[]} concepts
 * @property {VaultObservationGlobal[]} observations
 * @property {number} lastUpdated
 */

/** @type {Record<string, string>} */
export const FACET_LABELS = Object.freeze({
  synthesis: "Synthesis",
  relational: "Relational",
  argumentative: "Argumentative",
  applicative: "Applicative",
  cloze: "Cloze",
});

/**
 * @typedef {{ text: string, sourceDocId: string, sourceChunk?: string, addedAt: number }} VaultDefinition
 */

/**
 * @typedef {{ interval: number, easeFactor: number, dueDate: number, repetitions: number }} VaultReviewSm2
 */

/**
 * @typedef {{ id: string, vaultEntryId: string, facet: ConceptFacet, prompt: string, answer: string, sourceDocId: string, sm2: VaultReviewSm2, createdAt: number }} VaultReviewItem
 */

/**
 * @typedef {'CONCEPT'|'CLASS'|'CONVERSATION'|'PROJECT'} VaultEntryType
 */

/**
 * @typedef {'pending'|'ready'} VaultEntryStatus
 */

/**
 * @typedef {{
 *   type: VaultEntryType,
 *   area: string[],
 *   tags: string[],
 *   notes: string,
 *   notesUpdatedAt: number|null,
 *   related: string[],
 *   status: VaultEntryStatus
 * }} VaultPersonalFields
 */

/** @type {readonly string[]} */
export const PREPARATION_STATUSES = Object.freeze([
  "pending",
  "running",
  "ready",
  "partial",
  "failed",
  "legacy",
]);

/**
 * @param {unknown} raw
 * @returns {object}
 */
export function createEmptyPreparationState(fingerprint = "") {
  return {
    status: "pending",
    fingerprint: String(fingerprint || ""),
    startedAt: null,
    completedAt: null,
    updatedAt: null,
    currentPhase: null,
    currentWave: 0,
    waves: [],
    phaseResults: {},
    errors: [],
    failReason: null,
    staleRetryCount: 0,
  };
}

/**
 * Set preparation.status and bump updatedAt (ms epoch).
 * @param {object} prep
 * @param {string} status
 * @returns {object}
 */
export function setPreparationStatus(prep, status) {
  prep.status = status;
  prep.updatedAt = Date.now();
  return prep;
}

/**
 * @param {unknown} raw
 * @returns {object}
 */
export function normalizePreparationState(raw) {
  const base = createEmptyPreparationState();
  if (!raw || typeof raw !== "object") return base;
  const status = String(raw.status || "pending").trim();
  base.status = PREPARATION_STATUSES.includes(status) ? status : "pending";
  base.fingerprint = String(raw.fingerprint || "");
  base.startedAt = Number.isFinite(Number(raw.startedAt)) ? Number(raw.startedAt) : null;
  base.completedAt = Number.isFinite(Number(raw.completedAt)) ? Number(raw.completedAt) : null;
  base.updatedAt = Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : null;
  base.currentPhase = raw.currentPhase != null ? String(raw.currentPhase) : null;
  base.currentWave = Number.isFinite(Number(raw.currentWave)) ? Math.floor(Number(raw.currentWave)) : 0;
  base.waves = Array.isArray(raw.waves) ? raw.waves : [];
  base.phaseResults =
    raw.phaseResults && typeof raw.phaseResults === "object" && !Array.isArray(raw.phaseResults)
      ? { ...raw.phaseResults }
      : {};
  base.errors = Array.isArray(raw.errors) ? [...raw.errors] : [];
  base.failReason = raw.failReason != null ? String(raw.failReason) : null;
  base.staleRetryCount = Number.isFinite(Number(raw.staleRetryCount))
    ? Math.max(0, Math.floor(Number(raw.staleRetryCount)))
    : 0;
  return base;
}

/**
 * @param {unknown} session
 * @returns {boolean}
 */
export function isTier1PreparationComplete(session) {
  const prep = normalizePreparationState(session?.shared?.preparation);
  const shared = session?.shared;
  const inv = shared?.conceptInventory;
  const hasInventory = Array.isArray(inv) && inv.length > 0;
  const hasBlockRec =
    shared?.blockRecommendation != null &&
    Number(shared.blockRecommendation.nBlocks) > 0;
  const hasModeRec =
    shared?.modeRecommendation != null && typeof shared.modeRecommendation === "object";
  const artifactsReady = hasInventory && hasBlockRec && hasModeRec;

  if (prep.status === "ready" || prep.status === "legacy") return artifactsReady;
  if (prep.status === "partial") return artifactsReady;
  return false;
}

/**
 * @param {unknown} session
 * @returns {object[] | null}
 */
export function resolvePreparedRsvpInventory(session) {
  if (!isTier1PreparationComplete(session)) return null;
  const inv = session?.shared?.conceptInventory;
  if (!Array.isArray(inv) || inv.length === 0) return null;
  return inv;
}

/**
 * @param {unknown} session
 * @returns {boolean}
 */
export function shouldSkipRsvpInventoryLlm(session) {
  return resolvePreparedRsvpInventory(session) != null;
}

export { MODE_KEYS };
