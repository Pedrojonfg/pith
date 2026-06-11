import {
  DOC_SESSION_SIZE_THRESHOLD,
  LS_ACTIVE_DOC_ID_KEY,
  LS_DOC_SESSIONS_KEY,
  LS_DOC_TEXT_PREFIX,
} from "./config.js";
import {
  extractSignalsFromBlockSession,
  mergeAssessmentSignals,
} from "./assessment-signals.js";
import {
  computeCanonicalId,
  inferDocMeta,
  normalizeConceptLabel,
  normalizeMarkdownForHash,
  validateDocumentSession,
} from "./session-types.js";

export {
  computeCanonicalId,
  inferDocMeta,
  normalizeConceptLabel,
  validateDocumentSession,
} from "./session-types.js";

function docTextKey(docId) {
  return `${LS_DOC_TEXT_PREFIX}${docId}`;
}

function readSessionsRaw() {
  try {
    const raw = localStorage.getItem(LS_DOC_SESSIONS_KEY);
    if (!raw || !raw.trim()) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (err) {
    console.warn("[session-store] corrupt sessions JSON", err);
    return [];
  }
}

function writeSessionsRaw(sessions) {
  localStorage.setItem(LS_DOC_SESSIONS_KEY, JSON.stringify(sessions));
}

function rehydrateMarkdown(session) {
  if (!session?.shared) return session;
  const sh = session.shared;
  if (typeof sh.rawMarkdown === "string") return session;
  const ref = sh.rawMarkdownRef;
  if (!ref?.storageKey) return session;
  try {
    const text = localStorage.getItem(ref.storageKey);
    if (text == null) {
      console.warn(`[session-store] missing externalized text: ${ref.storageKey}`);
      return {
        ...session,
        shared: { ...sh, rawMarkdown: "" },
      };
    }
    return {
      ...session,
      shared: { ...sh, rawMarkdown: text },
    };
  } catch (err) {
    console.warn("[session-store] rehydrate failed", err);
    return { ...session, shared: { ...sh, rawMarkdown: "" } };
  }
}

function stripMarkdownForPersist(session) {
  const clone = JSON.parse(JSON.stringify(session));
  const sh = clone.shared;
  if (!sh || typeof sh.rawMarkdown !== "string") return clone;

  let payload = JSON.stringify(clone);
  if (payload.length <= DOC_SESSION_SIZE_THRESHOLD) return clone;

  const docId = clone.docId;
  const storageKey = docTextKey(docId);
  const charCount = sh.rawMarkdown.length;
  localStorage.setItem(storageKey, sh.rawMarkdown);
  delete sh.rawMarkdown;
  sh.rawMarkdownRef = { storageKey, charCount };
  return clone;
}

function upsertSessionInStore(session) {
  const toSave = stripMarkdownForPersist(session);
  const sessions = readSessionsRaw();
  const idx = sessions.findIndex((s) => s?.docId === session.docId);
  if (idx >= 0) sessions[idx] = toSave;
  else sessions.push(toSave);
  writeSessionsRaw(sessions);
}

/**
 * @param {string} rawMarkdown
 * @returns {Promise<string>}
 */
export async function computeDocId(rawMarkdown) {
  const normalized = normalizeMarkdownForHash(rawMarkdown);
  if (
    typeof globalThis.crypto !== "undefined" &&
    crypto.subtle &&
    typeof crypto.subtle.digest === "function"
  ) {
    const data = new TextEncoder().encode(normalized);
    const buf = await crypto.subtle.digest("SHA-1", data);
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hex.slice(0, 12);
  }
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
 * @param {{ docId?: string }} [options]
 * @returns {Promise<import('./session-types.js').DocumentSession>}
 */
export async function createSession(rawMarkdown, options = {}) {
  const markdown = String(rawMarkdown || "");
  const docId = options.docId || (await computeDocId(markdown));
  const now = Date.now();
  const session = {
    docId,
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now,
    shared: {
      rawMarkdown: markdown,
      docMeta: inferDocMeta(markdown),
      docHierarchy: null,
      conceptInventory: [],
      annotations: [],
      smItems: [],
      modeRecommendation: null,
      uploadMeta: null,
      assessmentSignals: [],
    },
    modes: { rsvp: null, slow: null, cloze: null, questions: null },
  };
  const v = validateDocumentSession(session);
  if (!v.ok) throw new Error(`invalid session: ${v.errors.join("; ")}`);
  upsertSessionInStore(session);
  return session;
}

/**
 * @param {string} docId
 */
export function getSession(docId) {
  const id = String(docId || "").trim();
  if (!id) return null;
  const found = readSessionsRaw().find((s) => s?.docId === id);
  if (!found) return null;
  return rehydrateMarkdown(found);
}

export function getActiveSession() {
  const docId = localStorage.getItem(LS_ACTIVE_DOC_ID_KEY);
  if (!docId || !docId.trim()) return null;
  return getSession(docId);
}

/**
 * @param {string} docId
 */
export function setActiveSession(docId) {
  const id = String(docId || "").trim();
  if (!getSession(id)) throw new Error("session not found");
  localStorage.setItem(LS_ACTIVE_DOC_ID_KEY, id);
}

/**
 * @param {object} session
 */
export function saveActiveSession(session) {
  const v = validateDocumentSession(session);
  if (!v.ok) throw new Error(`invalid session: ${v.errors.join("; ")}`);
  const updated = { ...session, updatedAt: Date.now() };
  upsertSessionInStore(updated);
  const activeId = localStorage.getItem(LS_ACTIVE_DOC_ID_KEY);
  if (activeId === updated.docId) {
    localStorage.setItem(LS_ACTIVE_DOC_ID_KEY, updated.docId);
  }
}

export function getAllSessions() {
  return readSessionsRaw()
    .map((s) => rehydrateMarkdown(s))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * @param {string} docId
 */
export function deleteSession(docId) {
  const id = String(docId || "").trim();
  const sessions = readSessionsRaw();
  const target = sessions.find((s) => s?.docId === id);
  if (target?.shared?.rawMarkdownRef?.storageKey) {
    try {
      localStorage.removeItem(target.shared.rawMarkdownRef.storageKey);
    } catch {
      // ignore
    }
  } else {
    try {
      localStorage.removeItem(docTextKey(id));
    } catch {
      // ignore
    }
  }
  writeSessionsRaw(sessions.filter((s) => s?.docId !== id));
  const activeId = localStorage.getItem(LS_ACTIVE_DOC_ID_KEY);
  if (activeId === id) {
    localStorage.removeItem(LS_ACTIVE_DOC_ID_KEY);
  }
}

function mergeDetectedBy(existing, incoming) {
  const toArr = (v) => {
    if (Array.isArray(v)) return v.map(String);
    if (v) return [String(v)];
    return [];
  };
  return [...new Set([...toArr(existing), ...toArr(incoming)])];
}

/**
 * @param {string} docId
 * @param {object[]} concepts
 */
export function addConceptsToShared(docId, concepts) {
  const session = getSession(docId);
  if (!session) throw new Error("session not found");
  const list = Array.isArray(concepts) ? concepts : [];
  const byId = new Map(
    (session.shared.conceptInventory || []).map((c) => [c.canonicalId, c]),
  );
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const label = String(raw.label || raw.term || "").trim();
    if (!label) continue;
    const canonicalId = raw.canonicalId || computeCanonicalId(label);
    const existing = byId.get(canonicalId);
    const definition = String(raw.definition || raw.authorUsage || "").trim();
    if (existing) {
      const existingDef = String(existing.definition || "").trim();
      byId.set(canonicalId, {
        ...existing,
        label: existing.label || label,
        definition: definition.length > existingDef.length ? definition : existingDef,
        detectedBy: mergeDetectedBy(existing.detectedBy, raw.detectedBy || "slow"),
        importance:
          raw.importance != null ? Number(raw.importance) : existing.importance,
      });
    } else {
      byId.set(canonicalId, {
        canonicalId,
        label,
        definition,
        detectedBy: raw.detectedBy || "slow",
        importance: raw.importance != null ? Number(raw.importance) : undefined,
      });
    }
  }
  session.shared.conceptInventory = [...byId.values()];
  saveActiveSession(session);
}

/**
 * @param {string} docId
 * @param {object} annotation
 */
export function addAnnotationToShared(docId, annotation) {
  const session = getSession(docId);
  if (!session) throw new Error("session not found");
  if (!annotation || typeof annotation !== "object") return;
  if (!Array.isArray(session.shared.annotations)) session.shared.annotations = [];
  const id = String(annotation.id || "").trim();
  const existingIdx = id
    ? session.shared.annotations.findIndex((a) => a?.id === id)
    : -1;
  const entry = {
    id: id || `ann_${Date.now()}`,
    type: String(annotation.type || "≈"),
    text: String(annotation.text || annotation.userText || "").trim(),
    offset: Number(annotation.offset ?? annotation.charStart ?? 0),
    sectionTitle: annotation.sectionTitle ? String(annotation.sectionTitle) : undefined,
    createdAt: Number(annotation.createdAt) || Date.now(),
  };
  if (existingIdx >= 0) session.shared.annotations[existingIdx] = entry;
  else session.shared.annotations.push(entry);
  saveActiveSession(session);
}

/**
 * @param {string} docId
 * @param {object} recommendation
 */
export function updateRecommendation(docId, recommendation) {
  const session = getSession(docId);
  if (!session) throw new Error("session not found");
  session.shared.modeRecommendation = recommendation;
  saveActiveSession(session);
}

/**
 * @param {string} docId
 * @param {object} item
 */
export function upsertSmItem(docId, item) {
  const session = getSession(docId);
  if (!session) throw new Error("session not found");
  if (!item?.id) throw new Error("sm item requires id");
  if (!Array.isArray(session.shared.smItems)) session.shared.smItems = [];
  const idx = session.shared.smItems.findIndex((x) => x?.id === item.id);
  if (idx >= 0) session.shared.smItems[idx] = { ...session.shared.smItems[idx], ...item };
  else session.shared.smItems.push(item);
  saveActiveSession(session);
}

/**
 * @param {string} docId
 * @param {{ fileName?: string, originalFormat?: string, uploadedAt?: string }|null} meta
 */
export function setUploadMeta(docId, meta) {
  const session = getSession(docId);
  if (!session) throw new Error("session not found");
  if (meta == null) {
    session.shared.uploadMeta = null;
  } else {
    session.shared.uploadMeta = {
      fileName: String(meta.fileName || ""),
      originalFormat: String(meta.originalFormat || ""),
      uploadedAt: String(meta.uploadedAt || new Date().toISOString()),
    };
  }
  saveActiveSession(session);
}

/**
 * @param {string} docId
 * @param {object} slice
 * @param {'rsvp'|'questions'} sourceMode
 */
export function syncAssessmentSignalsToShared(docId, slice, sourceMode) {
  const session = getSession(docId);
  if (!session) throw new Error("session not found");
  const incoming = extractSignalsFromBlockSession(slice, sourceMode);
  const existing = Array.isArray(session.shared.assessmentSignals)
    ? session.shared.assessmentSignals
    : [];
  session.shared.assessmentSignals = mergeAssessmentSignals(existing, incoming);
  saveActiveSession(session);
}

/**
 * @param {string} docId
 * @returns {import('./session-types.js').AssessmentSignal[]}
 */
export function getAssessmentSignals(docId) {
  const session = getSession(docId);
  if (!session) return [];
  return Array.isArray(session.shared.assessmentSignals)
    ? [...session.shared.assessmentSignals]
    : [];
}

export function getSmItemsDueToday(docId) {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const cutoff = endOfDay.getTime();
  const sessions = docId ? [getSession(docId)].filter(Boolean) : getAllSessions();
  const due = [];
  for (const session of sessions) {
    for (const item of session.shared?.smItems || []) {
      if (!item?.id) continue;
      const next = Number(item.nextReview);
      if (!Number.isFinite(next) || next <= cutoff) {
        due.push({ ...item, docId: session.docId });
      }
    }
  }
  return due;
}
