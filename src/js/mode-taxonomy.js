/**
 * Exposure vs retrieval mode taxonomy (code-only, not persisted).
 * @see specs/20260622-exposure-retrieval-hub/contracts/mode-taxonomy.md
 */

/** @typedef {'exposure'|'retrieval'} ModeRole */
/** @typedef {'document'|'vault'} ModeScope */

/** @typedef {'rsvp'|'slow'|'questions'|'read'|'cloze'|'recall'|'review'} TaxonomyModeKey */

/**
 * @typedef {object} ModeTaxonomyEntry
 * @property {ModeRole} role
 * @property {ModeScope} scope
 * @property {string} label
 * @property {string} hint
 */

/** @type {Record<TaxonomyModeKey, ModeTaxonomyEntry>} */
export const MODE_TAXONOMY = {
  rsvp: {
    role: "exposure",
    scope: "document",
    label: "RSVP",
    hint: "Fast blocks with embedded questions.",
  },
  read: {
    role: "exposure",
    scope: "document",
    label: "Read",
    hint: "Textbook-style blocks with optional diagrams, then questions.",
  },
  slow: {
    role: "exposure",
    scope: "document",
    label: "Slow Mode",
    hint: "Paginated reading with annotations and phases.",
  },
  questions: {
    role: "retrieval",
    scope: "document",
    label: "Questions",
    hint: "Quiz-only — test and Socratic questions per block.",
  },
  cloze: {
    role: "retrieval",
    scope: "document",
    label: "Cloze Detection",
    hint: "Active recall with cloze NODE/EDGE items.",
  },
  recall: {
    role: "retrieval",
    scope: "document",
    label: "Recall",
    hint: "Open-ended retrieval with AI tutor feedback.",
  },
  review: {
    role: "retrieval",
    scope: "vault",
    label: "Review",
    hint: "Spaced review across all your documents.",
  },
};

const DOCUMENT_RETRIEVAL_ORDER = ["questions", "cloze", "recall"];

/**
 * @param {ModeRole} role
 * @returns {TaxonomyModeKey[]}
 */
export function getModesByRole(role) {
  const target = String(role || "").trim();
  return /** @type {TaxonomyModeKey[]} */ (
    Object.entries(MODE_TAXONOMY)
      .filter(([, entry]) => entry.role === target)
      .map(([key]) => key)
  );
}

/**
 * Document-scoped retrieval modes for the practice hub (stable order).
 * @returns {Array<{ key: TaxonomyModeKey, label: string, hint: string }>}
 */
export function getDocumentRetrievalModes() {
  return DOCUMENT_RETRIEVAL_ORDER.map((key) => {
    const entry = MODE_TAXONOMY[key];
    return {
      key,
      label: entry.label,
      hint: entry.hint,
    };
  });
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isExposureMode(key) {
  const entry = MODE_TAXONOMY[/** @type {TaxonomyModeKey} */ (key)];
  return entry?.role === "exposure";
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isVaultMode(key) {
  const entry = MODE_TAXONOMY[/** @type {TaxonomyModeKey} */ (key)];
  return entry?.scope === "vault";
}
