import { hasGeneratedBlockContent, normalizeStudyMode, isConceptInventoryValid } from "./session.js";
import { createClozeSession, createSlowSession } from "./study.js";
import {
  normalizePreparationState,
  isTier1PreparationComplete,
  resolveScopedMarkdown,
  isPackImportSession,
  packImportHasSourceDocument,
  PACK_SOURCE_REQUIRED_MODES,
} from "./session-types.js";
import { getValidItems } from "./cloze/pipeline.js";

/**
 * @param {import('./session-types.js').DocumentSession | null | undefined} doc
 * @returns {boolean}
 */
function hasSharedMaterial(doc) {
  const sh = doc?.shared;
  if (!sh || typeof sh !== "object") return false;
  if (typeof sh.rawMarkdown === "string" && sh.rawMarkdown.trim().length > 0) return true;
  const ref = sh.rawMarkdownRef;
  if (ref && typeof ref === "object" && String(ref.storageKey || "").trim()) return true;
  // No-source pack imports still carry derived study content (rsvp/recall/questions).
  if (isPackImportSession(doc) && normalizePreparationState(sh.preparation).status === "ready") {
    return true;
  }
  return false;
}

function preparationAllowsBootstrap(doc) {
  const prep = normalizePreparationState(doc?.shared?.preparation);
  if (prep.status === "ready" || prep.status === "partial") return isTier1PreparationComplete(doc);
  if (prep.status === "legacy") return hasConceptInventory(doc);
  return false;
}

function logModeBootstrapInventoryCheck(doc, modeKey, checks) {
  console.debug("[DPP-GUARD.resolveModeEntryState] Inventory gate", {
    docId: doc?.docId ?? null,
    mode: modeKey,
    ...checks,
    prepStatus: doc?.shared?.preparation?.status ?? null,
    conceptCount: doc?.shared?.conceptInventory?.length ?? 0,
  }); // [debug-enrich]
}

/**
 * @param {object | null | undefined} slice
 * @returns {boolean}
 */
function hasReadyClozeItems(slice) {
  const cloze = slice?.cloze;
  if (!cloze || typeof cloze !== "object") return false;
  if (String(cloze.pipelineStatus || "") !== "ready") return false;
  return getValidItems(cloze.items || []).length > 0;
}

/**
 * Keep an existing cloze slice when it already has generated items or pipeline progress.
 * @param {object | null | undefined} slice
 * @returns {boolean}
 */
function shouldPreserveClozeSlice(slice) {
  if (!slice || typeof slice !== "object") return false;
  if (hasReadyClozeItems(slice)) return true;
  const cloze = slice.cloze;
  if (!cloze || typeof cloze !== "object") return false;
  const validCount = getValidItems(cloze.items || []).length;
  if (validCount > 0) return true;
  const status = String(cloze.pipelineStatus || "");
  if (status === "generating" || /^phase\d$/.test(status)) return true;
  if (status === "failed" && (cloze.items?.length || cloze.epistemicGraph || cloze.analysis)) {
    return true;
  }
  return false;
}

/**
 * @param {import('./session-types.js').DocumentSession | null | undefined} doc
 * @returns {boolean}
 */
function hasPrepReadyCloze(doc) {
  return hasReadyClozeItems(doc?.modes?.cloze);
}

/**
 * @param {import('./session-types.js').DocumentSession | null | undefined} doc
 * @returns {boolean}
 */
function hasConceptInventory(doc) {
  const inv = doc?.shared?.conceptInventory;
  return Array.isArray(inv) && inv.length > 0;
}

/**
 * @param {object | null | undefined} slice
 * @param {'rsvp'|'slow'|'cloze'|'questions'|'recall'|'read'} slot
 * @returns {boolean}
 */
function isSliceResumable(slice, slot) {
  if (!slice || typeof slice !== "object") return false;
  if (slot === "recall") {
    return String(slice.status || "").trim() === "in_progress";
  }
  if (slot === "rsvp" || slot === "questions" || slot === "read") {
    const blocks = Array.isArray(slice.blocks) ? slice.blocks : [];
    const nBlocks = Math.floor(Number(slice.n_blocks) || 0);
    if (nBlocks > 0 && blocks.length > 0) return true;
    return blocks.some(hasGeneratedBlockContent);
  }
  if (slot === "slow") {
    // Nested (full SlowSession) or flat pack-import slowSlice { phase }
    return (
      String(slice.slow?.phase || "").trim().length > 0 ||
      String(slice.phase || "").trim().length > 0
    );
  }
  if (slot === "cloze") {
    if (hasReadyClozeItems(slice) || shouldPreserveClozeSlice(slice)) return true;
    // Flat pack-import cloze slice { pipelineStatus, items }
    if (String(slice.pipelineStatus || "") === "ready" && Array.isArray(slice.items) && slice.items.length > 0) {
      return true;
    }
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
 * @param {'rsvp'|'slow'|'cloze'|'questions'|'recall'|'read'|'review'} mode
 * @returns {{
 *   kind: 'resume' | 'bootstrap' | 'generate_fresh' | 'upload_required',
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

  // Pack without source document: Slow/Cloze are unavailable (no raw text to ground them).
  if (
    slot &&
    PACK_SOURCE_REQUIRED_MODES.includes(slot) &&
    isPackImportSession(doc) &&
    !packImportHasSourceDocument(doc)
  ) {
    return {
      kind: "upload_required",
      mode: modeKey,
      reason: "pack_without_source_document",
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

  if (slot === "recall") {
    const recallSlice = existingSlice && typeof existingSlice === "object" ? existingSlice : null;
    if (recallSlice && String(recallSlice.status || "") === "ready" && recallSlice.questions?.length) {
      return {
        kind: "bootstrap",
        mode: modeKey,
        reason: "recall_prep_ready",
        existingSlice: recallSlice,
      };
    }
    const inventoryValid = isConceptInventoryValid(doc);
    const hasInv = hasConceptInventory(doc);
    const prepAllows = preparationAllowsBootstrap(doc);
    if (inventoryValid || hasInv || prepAllows) {
      logModeBootstrapInventoryCheck(doc, modeKey, {
        inventoryValid,
        hasInventory: hasInv,
        prepAllowsBootstrap: prepAllows,
        branch: "recall_bootstrap",
      });
      return {
        kind: "bootstrap",
        mode: modeKey,
        reason: existingSlice ? "inventory_ready_slice_exists" : "inventory_ready",
        existingSlice: recallSlice,
      };
    }
    return {
      kind: "generate_fresh",
      mode: modeKey,
      reason: "material_without_inventory",
      existingSlice: recallSlice,
    };
  }

  if (slot === "cloze" && hasPrepReadyCloze(doc)) {
    return {
      kind: "resume",
      mode: modeKey,
      reason: "cloze_prep_ready",
      existingSlice,
    };
  }

  const inventoryValid = isConceptInventoryValid(doc);
  const hasInv = hasConceptInventory(doc);
  const prepAllows = preparationAllowsBootstrap(doc);
  if (inventoryValid || prepAllows || hasInv) {
    logModeBootstrapInventoryCheck(doc, modeKey, {
      inventoryValid,
      hasInventory: hasInv,
      prepAllowsBootstrap: prepAllows,
      branch: "prep_ready_bootstrap",
    });
    return {
      kind: "bootstrap",
      mode: modeKey,
      reason: existingSlice ? "prep_ready_slice_exists" : "prep_ready",
      existingSlice: existingSlice && typeof existingSlice === "object" ? existingSlice : null,
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
 * @param {'rsvp'|'slow'|'cloze'|'questions'|'recall'|'read'|'review'} mode
 * @param {{ llmModel?: string, language?: string, criticalMode?: boolean }} [options]
 * @returns {object}
 */
export function buildModeSliceFromShared(doc, mode, options = {}) {
  const modeKey = String(mode || "").trim() || "rsvp";
  const slot = modeKey === "review" ? "rsvp" : normalizeStudyMode(modeKey);
  const normalizedText = String(resolveScopedMarkdown(doc) || doc.shared?.rawMarkdown || "");
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
    const existing = doc.modes?.cloze;
    if (existing && shouldPreserveClozeSlice(existing)) {
      return JSON.parse(JSON.stringify(existing));
    }
    const slice = createClozeSession(common);
    if (doc.shared?.conceptGraph?.nodes?.length) {
      slice.cloze.epistemicGraph = doc.shared.conceptGraph;
    }
    return slice;
  }

  const studyMode =
    slot === "questions" ? "questions" : slot === "read" ? "read" : "rsvp";
  const nBlocksDefault = doc.shared?.blockRecommendation?.nBlocks;
  return {
    studyMode,
    materialMeta: {
      fileName: meta.fileName,
      originalFormat: meta.originalFormat,
      uploadedAt: meta.uploadedAt,
    },
    n_blocks: Number.isFinite(Number(nBlocksDefault)) ? Math.floor(Number(nBlocksDefault)) : 0,
    blocks: [],
  };
}
