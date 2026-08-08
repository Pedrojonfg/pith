/**
 * One-shot Slow annotation migration to schema v2 (D-MIG option a).
 */
import { resolveBlockOffset, splitTextIntoBlocks } from "./block-ids.js";

export const ANNOTATION_SCHEMA_VERSION = 2;

function isLegacyAnnotation(ann) {
  if (!ann || typeof ann !== "object") return false;
  if (ann.anchor && typeof ann.anchor === "object" && ann.anchor.kind) return false;
  return Number.isFinite(Number(ann.charStart)) || Number.isFinite(Number(ann.charEnd));
}

function inferViewerMode(slowSlice, originalFormat) {
  if (slowSlice?.viewerMode === "pdf" || slowSlice?.viewerMode === "scroll") {
    return slowSlice.viewerMode;
  }
  return String(originalFormat || "").trim().toLowerCase() === "pdf" ? "pdf" : "scroll";
}

/**
 * Mutates `modeSlice.slow` in place. Idempotent via annotationSchemaVersion.
 * @param {object} modeSlice — createSlowSession-shaped object (`{ slow, materialMeta? }`)
 * @returns {{ migrated: boolean, droppedPdf: boolean, orphaned: number }}
 */
export function migrateSlowAnnotations(modeSlice) {
  const slow = modeSlice?.slow;
  if (!slow || typeof slow !== "object") {
    return { migrated: false, droppedPdf: false, orphaned: 0 };
  }

  const version = Number(slow.annotationSchemaVersion) || 1;
  if (version >= ANNOTATION_SCHEMA_VERSION) {
    return { migrated: false, droppedPdf: false, orphaned: 0 };
  }

  const originalFormat =
    modeSlice.materialMeta?.originalFormat ||
    modeSlice.materialMeta?.format ||
    "";
  const viewerMode = inferViewerMode(slow, originalFormat);
  slow.viewerMode = viewerMode;

  const list = Array.isArray(slow.annotations) ? slow.annotations : [];
  let orphaned = 0;
  let droppedPdf = false;

  if (viewerMode === "pdf") {
    const hadLegacy = list.some(isLegacyAnnotation);
    if (hadLegacy || list.length) {
      // Drop all legacy (and any pre-schema) annotations — no recoverable page/rect data
      const onlyNew = list.filter((a) => a?.anchor?.kind === "pdf-rect");
      if (onlyNew.length !== list.length) {
        slow.annotations = onlyNew;
        droppedPdf = true;
        if (!slow.pdfLegacyAnnotationsDroppedNotice) {
          slow.pdfLegacyAnnotationsDroppedNotice = true;
        }
      }
    }
  } else {
    const text = String(slow.normalizedTextFull || "");
    const blocks = splitTextIntoBlocks(text);
    slow.annotations = list.map((ann) => {
      if (!isLegacyAnnotation(ann)) return ann;
      const start = Math.max(0, Math.floor(Number(ann.charStart) || 0));
      const end = Math.min(text.length, Math.max(start, Math.floor(Number(ann.charEnd) || start)));
      const snippet =
        String(ann.snippet || "").trim() || text.slice(start, end);
      const local = resolveBlockOffset(blocks, start, end);
      const next = {
        id: ann.id,
        type: ann.type,
        snippet: snippet || "(empty)",
        userText: String(ann.userText || "").trim(),
        createdAt: ann.createdAt,
        aiReply: ann.aiReply ?? null,
        graphLinks: Array.isArray(ann.graphLinks) ? ann.graphLinks : [],
      };
      if (ann.isIAQuery) next.isIAQuery = true;
      if (ann.skippedSteelMan) next.skippedSteelMan = true;
      if (!local || !snippet) {
        next.anchor = {
          kind: "block-offset",
          blockId: blocks[0]?.blockId || "b0",
          charStart: 0,
          charEnd: 0,
        };
        next.orphaned = true;
        orphaned += 1;
        return next;
      }
      next.anchor = {
        kind: "block-offset",
        blockId: local.blockId,
        charStart: local.charStart,
        charEnd: local.charEnd,
      };
      return next;
    });
  }

  slow.annotationSchemaVersion = ANNOTATION_SCHEMA_VERSION;
  return { migrated: true, droppedPdf, orphaned };
}

/**
 * One-time gate for PDF legacy-drop notice (R-MIG-3). Marks shown on first consume.
 * @param {object} slow
 * @returns {boolean} true when the UI should show the notice now
 */
export function consumePdfLegacyDropNotice(slow) {
  if (!slow || typeof slow !== "object") return false;
  if (!slow.pdfLegacyAnnotationsDroppedNotice) return false;
  if (slow.pdfLegacyAnnotationsDroppedNoticeShown) return false;
  slow.pdfLegacyAnnotationsDroppedNoticeShown = true;
  return true;
}

/**
 * Migrate modes.slow on a document session if present.
 * Sets `__slowAnnotationMigrationDirty` when migration mutated the slice so the
 * loader can persist version + annotations in the same save.
 * @param {object} session
 * @returns {object} session (possibly mutated)
 */
export function migrateSlowAnnotationsInSession(session) {
  const slice = session?.modes?.slow;
  if (slice?.slow) {
    if (!slice.materialMeta && session.shared?.uploadMeta) {
      slice.materialMeta = {
        originalFormat: session.shared.uploadMeta.originalFormat || "",
      };
    }
    if (!slice.materialMeta && session.shared?.docMeta) {
      slice.materialMeta = {
        originalFormat: session.shared.docMeta.originalFormat || "",
      };
    }
    const result = migrateSlowAnnotations(slice);
    if (result.migrated) {
      session.__slowAnnotationMigrationDirty = true;
    }
  }
  return session;
}
