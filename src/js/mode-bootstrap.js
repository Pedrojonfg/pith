import { hasGeneratedBlockContent, normalizeStudyMode } from "./session.js";
import { createClozeSession, createSlowSession } from "./study.js";

/**
 * @param {import('./session-types.js').DocumentSession | null | undefined} doc
 * @returns {boolean}
 */
function hasSharedMaterial(doc) {
  const sh = doc?.shared;
  if (!sh || typeof sh !== "object") return false;
  if (typeof sh.rawMarkdown === "string" && sh.rawMarkdown.trim().length > 0) return true;
  const ref = sh.rawMarkdownRef;
  return Boolean(ref && typeof ref === "object" && String(ref.storageKey || "").trim());
}

/**
 * @param {object | null | undefined} slice
 * @param {'rsvp'|'slow'|'cloze'|'questions'} slot
 * @returns {boolean}
 */
function isSliceResumable(slice, slot) {
  if (!slice || typeof slice !== "object") return false;
  if (slot === "rsvp" || slot === "questions") {
    const blocks = Array.isArray(slice.blocks) ? slice.blocks : [];
    return blocks.some(hasGeneratedBlockContent);
  }
  if (slot === "slow") {
    return String(slice.slow?.phase || "").trim().length > 0;
  }
  if (slot === "cloze") {
    const text = slice.cloze?.normalizedText;
    return typeof text === "string" && text.length > 0;
  }
  return false;
}

/**
 * @param {import('./session-types.js').DocumentSession} doc
 * @returns {{ fileName: string, originalFormat: string, uploadedAt: string }}
 */
function resolveMaterialMeta(doc) {
  const um = doc.shared?.uploadMeta;
  if (um && typeof um === "object") {
    return {
      fileName: String(um.fileName || "").trim(),
      originalFormat: String(um.originalFormat || "").trim(),
      uploadedAt: String(um.uploadedAt || new Date().toISOString()),
    };
  }
  const title = String(doc.shared?.docMeta?.titleInferred || "document").trim() || "document";
  return {
    fileName: title,
    originalFormat: "markdown",
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * @param {import('./session-types.js').DocumentSession | null} doc
 * @param {'rsvp'|'slow'|'cloze'|'questions'|'review'} mode
 * @returns {{
 *   kind: 'resume' | 'bootstrap' | 'upload_required',
 *   mode: string,
 *   reason: string,
 *   existingSlice: object | null,
 * }}
 */
export function resolveModeEntryState(doc, mode) {
  const modeKey = String(mode || "").trim() || "rsvp";
  const slot = modeKey === "review" ? null : normalizeStudyMode(modeKey);

  if (!doc || !hasSharedMaterial(doc)) {
    return {
      kind: "upload_required",
      mode: modeKey,
      reason: "no_document_or_shared_material",
      existingSlice: null,
    };
  }

  const existingSlice =
    slot && doc.modes && typeof doc.modes === "object" ? doc.modes[slot] ?? null : null;

  if (existingSlice && slot && isSliceResumable(existingSlice, slot)) {
    return {
      kind: "resume",
      mode: modeKey,
      reason: "resumable_slice_present",
      existingSlice,
    };
  }

  return {
    kind: "bootstrap",
    mode: modeKey,
    reason: existingSlice ? "slice_not_resumable" : "no_slice",
    existingSlice: existingSlice && typeof existingSlice === "object" ? existingSlice : null,
  };
}

/**
 * @param {import('./session-types.js').DocumentSession} doc
 * @param {'rsvp'|'slow'|'cloze'|'questions'|'review'} mode
 * @param {{ llmModel?: string, language?: string, criticalMode?: boolean }} [options]
 * @returns {object}
 */
export function buildModeSliceFromShared(doc, mode, options = {}) {
  const modeKey = String(mode || "").trim() || "rsvp";
  const slot = modeKey === "review" ? "rsvp" : normalizeStudyMode(modeKey);
  const normalizedText = String(doc.shared?.rawMarkdown || "");
  const meta = resolveMaterialMeta(doc);
  const common = {
    normalizedText,
    normalizedFormat: "markdown",
    fileName: meta.fileName,
    originalFormat: meta.originalFormat,
    llmModel: options.llmModel,
    language: options.language,
  };

  if (slot === "slow") {
    const slice = createSlowSession({
      ...common,
      criticalMode: Boolean(options.criticalMode),
    });
    if (doc.shared?.docHierarchy) {
      slice.docHierarchy = doc.shared.docHierarchy;
    }
    return slice;
  }

  if (slot === "cloze") {
    return createClozeSession(common);
  }

  const studyMode = slot === "questions" ? "questions" : "rsvp";
  return {
    studyMode,
    materialMeta: {
      fileName: meta.fileName,
      originalFormat: meta.originalFormat,
      uploadedAt: meta.uploadedAt,
    },
    n_blocks: 0,
    blocks: [],
  };
}
