import {
  BLOCKS_INLINE_THRESHOLD,
  LS_DOC_BLOCKS_PREFIX,
  LS_DOC_RESPONSES_PREFIX,
  LS_SESSION_CONCEPTS_KEY,
  LS_V1_BACKUP_KEY,
} from "./config.js";
import { saveActiveSession } from "./session-store.js";
import { downloadBlocksJson, downloadResponsesJson } from "./user-data-persist-supabase.js";
import { getAuthUserId } from "./session-persist-supabase.js";
import { scheduleBlocksUpload, scheduleResponsesUpload } from "./user-store-sync.js";

const GUIDE_CHAT_KEY_PREFIX = "guide_chat_";

/** @type {Record<string, string | null>} */
const lastWriteErrorByDocId = {};

function blockHasContent(block) {
  if (!block || typeof block !== "object") return false;
  if (String(block.explanation || "").trim()) return true;
  const questions = Array.isArray(block.questions) ? block.questions : [];
  return questions.length > 0;
}

export function docBlocksKey(docId) {
  return `${LS_DOC_BLOCKS_PREFIX}${String(docId || "").trim()}`;
}

export function docResponsesKey(docId) {
  return `${LS_DOC_RESPONSES_PREFIX}${String(docId || "").trim()}`;
}

export function stripBlocksForPersist(rsvpSlice, docId) {
  if (!rsvpSlice || typeof rsvpSlice !== "object") return rsvpSlice;
  const id = String(docId || "").trim();
  if (!id) return rsvpSlice;

  const clone = JSON.parse(JSON.stringify(rsvpSlice));
  const blocks = Array.isArray(clone.blocks) ? clone.blocks : [];
  const blocksJson = JSON.stringify(blocks);

  // [debug-enrich]
  console.debug('[block-store.stripBlocksForPersist] Evaluating externalize:', {
    docId: id,
    blockCount: blocks.length,
    blocksJsonLen: blocksJson.length,
    threshold: BLOCKS_INLINE_THRESHOLD,
    willExternalizeBlocks:
      blocks.length > 0 && blocksJson.length > BLOCKS_INLINE_THRESHOLD,
  });

  if (blocks.length > 0 && blocksJson.length > BLOCKS_INLINE_THRESHOLD) {
    const storageKey = docBlocksKey(id);
    try {
      localStorage.setItem(storageKey, blocksJson);
      scheduleBlocksUpload(id, blocksJson);
      delete clone.blocks;
      clone.blocksRef = {
        storageKey,
        blockCount: blocks.length,
        charCount: blocksJson.length,
        schemaVersion: 1,
      };
      // [debug-enrich]
      console.info('[block-store.stripBlocksForPersist] Blocks externalized:', {
        docId: id,
        blockCount: blocks.length,
        charCount: blocksJson.length,
        storageKey,
      });
    } catch (err) {
      // [debug-enrich]
      console.error('[block-store.stripBlocksForPersist] localStorage write failed:', {
        docId: id,
        message: err?.message ?? String(err),
        name: err?.name ?? null,
      });
      throw err;
    }
  }

  if (clone._responses && typeof clone._responses === "object") {
    const respJson = JSON.stringify(clone._responses);
    if (respJson.length > BLOCKS_INLINE_THRESHOLD) {
      const storageKey = docResponsesKey(id);
      try {
        localStorage.setItem(storageKey, respJson);
        scheduleResponsesUpload(id, respJson);
        delete clone._responses;
        clone.responsesRef = { storageKey };
        // [debug-enrich]
        console.info('[block-store.stripBlocksForPersist] Responses externalized:', {
          docId: id,
          charCount: respJson.length,
          storageKey,
        });
      } catch (err) {
        // [debug-enrich]
        console.error('[block-store.stripBlocksForPersist] Responses localStorage write failed:', {
          docId: id,
          message: err?.message ?? String(err),
          name: err?.name ?? null,
        });
        throw err;
      }
    }
  }

  return clone;
}

async function readExternalJson(storageKey, docId, downloadFn) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw != null) return raw;
  } catch {
    // ignore
  }
  try {
    const userId = await getAuthUserId();
    const remote = await downloadFn(userId, docId);
    if (remote != null) {
      localStorage.setItem(storageKey, remote);
      return remote;
    }
  } catch (err) {
    console.warn("[block-store] storage fetch failed", err);
  }
  return null;
}

export async function rehydrateBlocks(rsvpSlice, docId) {
  if (!rsvpSlice || typeof rsvpSlice !== "object") return rsvpSlice;
  const id = String(docId || "").trim();
  let slice = rsvpSlice;

  const blocksRef = slice.blocksRef;
  const hasInlineBlocks = Array.isArray(slice.blocks) && slice.blocks.length > 0;
  if (blocksRef?.storageKey && !hasInlineBlocks) {
    try {
      const raw = await readExternalJson(blocksRef.storageKey, id, downloadBlocksJson);
      if (raw != null) {
        const blocks = JSON.parse(raw);
        if (Array.isArray(blocks)) slice = { ...slice, blocks };
      }
    } catch (err) {
      console.warn("[block-store] rehydrate blocks failed", err);
    }
  }

  if (slice.responsesRef?.storageKey && !slice._responses) {
    try {
      const raw = await readExternalJson(slice.responsesRef.storageKey, id, downloadResponsesJson);
      if (raw != null) slice = { ...slice, _responses: JSON.parse(raw) };
    } catch (err) {
      console.warn("[block-store] rehydrate responses failed", err);
    }
  }

  return slice;
}

function isQuotaError(err) {
  if (!err) return false;
  if (err.name === "QuotaExceededError") return true;
  const msg = String(err.message || err).toLowerCase();
  return msg.includes("quota") || msg.includes("exceeded");
}

export async function writeThroughRsvpBlocks(doc, rsvpSlice) {
  return writeThroughModeSlice(doc, "rsvp", rsvpSlice);
}

export async function writeThroughModeSlice(doc, modeSlot, slice) {
  const id = String(doc?.docId || "").trim();
  if (!id || !slice || typeof slice !== "object") {
    // [debug-enrich]
    console.warn('[block-store.writeThroughModeSlice] Invalid args:', {
      docId: id || null,
      modeSlot,
      hasSlice: Boolean(slice),
    });
    return { ok: false, error: "invalid" };
  }
  // [debug-enrich]
  console.debug('[block-store.writeThroughModeSlice] Writing through:', {
    docId: id,
    modeSlot,
    blockCount: Array.isArray(slice.blocks) ? slice.blocks.length : null,
    hasBlocksRef: Boolean(slice.blocksRef),
  });
  try {
    if (!doc.modes || typeof doc.modes !== "object") doc.modes = {};
    doc.modes[modeSlot] = slice;
    await saveActiveSession(doc);
    lastWriteErrorByDocId[id] = null;
    // [debug-enrich]
    console.info('[block-store.writeThroughModeSlice] Write-through ok:', {
      docId: id,
      modeSlot,
    });
    return { ok: true };
  } catch (err) {
    const error = isQuotaError(err) ? "quota" : "persist_failed";
    lastWriteErrorByDocId[id] = error;
    // [debug-enrich]
    console.error('[block-store.writeThroughModeSlice] Write-through failed:', {
      docId: id,
      modeSlot,
      error,
      message: err?.message ?? String(err),
      name: err?.name ?? null,
    });
    return { ok: false, error };
  }
}

function hasGuideChatForDoc(doc) {
  const sessionId = String(doc?.modes?.rsvp?._meta?.session_id || "").trim();
  if (sessionId) {
    try {
      const raw = localStorage.getItem(`${GUIDE_CHAT_KEY_PREFIX}${sessionId}`);
      if (raw && raw.trim()) return true;
    } catch {
      // ignore
    }
  }
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(GUIDE_CHAT_KEY_PREFIX)) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function hasDictionaryEntries() {
  try {
    const raw = localStorage.getItem(LS_SESSION_CONCEPTS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

export async function computePersistenceHealth(doc) {
  const rsvp = doc?.modes?.rsvp;
  const hydrated = rsvp && doc?.docId ? await rehydrateBlocks(rsvp, doc.docId) : rsvp;
  const blocks = Array.isArray(hydrated?.blocks) ? hydrated.blocks : [];
  const blocksWithContent = blocks.filter(blockHasContent).length;
  const nBlocks = Math.max(Number(hydrated?.n_blocks) || 0, blocks.length);
  const hasDictionary = hasDictionaryEntries();
  const hasGuideChat = hasGuideChatForDoc(doc);
  const lastWriteError = doc?.docId ? lastWriteErrorByDocId[doc.docId] ?? null : null;

  let status = "empty";
  if (blocksWithContent > 0) {
    status = nBlocks > 0 && blocksWithContent < nBlocks ? "partial" : "ok";
  } else if (hasDictionary || hasGuideChat) {
    status = "partial";
  }

  return {
    blocksWithContent,
    nBlocks,
    hasDictionary,
    hasGuideChat,
    status,
    lastWriteError,
  };
}

export function tryRecoverBlocksFromV1Backup(currentSlice) {
  const currentBlocks = Array.isArray(currentSlice?.blocks) ? currentSlice.blocks : [];
  if (currentBlocks.some(blockHasContent)) return null;

  try {
    const raw = localStorage.getItem(LS_V1_BACKUP_KEY);
    if (!raw) return null;
    const backup = JSON.parse(raw);
    const blocks = backup?.sessionsByMode?.rsvp?.blocks;
    if (!Array.isArray(blocks) || !blocks.length) return null;
    if (!blocks.some(blockHasContent)) return null;
    return blocks;
  } catch {
    return null;
  }
}
