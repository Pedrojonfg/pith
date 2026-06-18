import {
  DOC_SESSION_SIZE_THRESHOLD,
  LS_ACTIVE_DOC_ID_KEY,
  LS_DOC_SESSIONS_KEY,
  LS_DOC_TEXT_PREFIX,
  LS_PROJECTS_KEY,
} from "./config.js";
import {
  docBlocksKey,
  docResponsesKey,
  rehydrateBlocks,
  stripBlocksForPersist,
} from "./block-store.js";
import {
  extractSignalsFromBlockSession,
  mergeAssessmentSignals,
  buildRecallAssessmentSignals,
} from "./assessment-signals.js";
import { normalizeSmItem } from "./sm2.js";
import { loadVault } from "./vault/vault-store.js";
import { getGlobalReviewDueCount } from "./concept-registry/global-review.js";
import { normalizeRecallSlice } from "./recall-slice.js";
import {
  computeCanonicalId,
  inferDocMeta,
  MISC_PROJECT_ID,
  normalizeConceptLabel,
  normalizeMarkdownForHash,
  PROJECT_STORE_SCHEMA,
  validateDocumentSession,
} from "./session-types.js";
import { ensureMiscProject } from "./project-store.js";

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
  if (!session?.shared) return rehydrateSessionModes(session);
  const sh = session.shared;
  if (typeof sh.rawMarkdown === "string") return rehydrateSessionModes(session);
  const ref = sh.rawMarkdownRef;
  if (!ref?.storageKey) return rehydrateSessionModes(session);
  try {
    const text = localStorage.getItem(ref.storageKey);
    if (text == null) {
      console.warn(`[session-store] missing externalized text: ${ref.storageKey}`);
      return rehydrateSessionModes({
        ...session,
        shared: { ...sh, rawMarkdown: "" },
      });
    }
    return rehydrateSessionModes({
      ...session,
      shared: { ...sh, rawMarkdown: text },
    });
  } catch (err) {
    console.warn("[session-store] rehydrate failed", err);
    return rehydrateSessionModes({ ...session, shared: { ...sh, rawMarkdown: "" } });
  }
}

function rehydrateSessionModes(session) {
  if (!session?.docId) return session;
  const docId = session.docId;
  const modes = session.modes && typeof session.modes === "object" ? { ...session.modes } : {};
  let changed = false;
  if (modes.rsvp) {
    const next = rehydrateBlocks(modes.rsvp, docId);
    if (next !== modes.rsvp) {
      modes.rsvp = next;
      changed = true;
    }
  }
  if (modes.questions) {
    const next = rehydrateBlocks(modes.questions, docId);
    if (next !== modes.questions) {
      modes.questions = next;
      changed = true;
    }
  }
  return changed ? { ...session, modes } : session;
}

function normalizeSessionSmItems(session) {
  if (!session?.shared || !Array.isArray(session.shared.smItems)) return session;
  const docId = session.docId;
  const normalized = session.shared.smItems
    .map((raw) => normalizeSmItem({ ...raw, docId: raw?.docId || docId }))
    .filter(Boolean);
  return { ...session, shared: { ...session.shared, smItems: normalized } };
}

function normalizeSessionModes(session) {
  if (!session?.modes || typeof session.modes !== "object") return session;
  const modes = { ...session.modes };
  let changed = false;
  if (!("recall" in modes)) {
    modes.recall = null;
    changed = true;
  }
  if (modes.recall && typeof modes.recall === "object") {
    const next = normalizeRecallSlice(modes.recall);
    if (JSON.stringify(next) !== JSON.stringify(modes.recall)) {
      modes.recall = next;
      changed = true;
    }
  }
  if ("review" in modes) {
    delete modes.review;
    changed = true;
  }
  return changed ? { ...session, modes } : session;
}

function normalizeLoadedSession(session) {
  return migrateSessionV3(normalizeSessionModes(normalizeSessionSmItems(session)));
}

function migrateSessionV3(session) {
  if (!session?.shared) return session;
  let changed = false;
  const sh = session.shared;
  if (!sh.preparation) {
    sh.preparation = {
      status: "legacy",
      fingerprint: "",
      startedAt: null,
      completedAt: null,
      currentPhase: null,
      currentWave: 0,
      waves: [],
      phaseResults: {},
      errors: [],
    };
    changed = true;
  }
  const clozeGraph =
    session.modes?.cloze?.cloze?.epistemicGraph ||
    session.modes?.cloze?.epistemicGraph ||
    null;
  if (clozeGraph?.nodes?.length && !sh.conceptGraph?.nodes?.length) {
    sh.conceptGraph = clozeGraph;
    changed = true;
  }
  const inventory = Array.isArray(sh.conceptInventory) ? sh.conceptInventory : [];
  const nextInv = inventory.map((entry) => {
    if (entry && typeof entry === "object" && !("globalConceptId" in entry)) {
      changed = true;
      return { ...entry, globalConceptId: entry.globalConceptId ?? null };
    }
    return entry;
  });
  if (changed) sh.conceptInventory = nextInv;

  const signals = Array.isArray(sh.assessmentSignals) ? sh.assessmentSignals : [];
  const nextSig = signals.map((sig) => {
    if (sig && typeof sig === "object" && !("globalConceptId" in sig)) {
      changed = true;
      return { ...sig, globalConceptId: sig.globalConceptId ?? null };
    }
    return sig;
  });
  if (changed) sh.assessmentSignals = nextSig;

  const version = Number(session.schemaVersion) || 2;
  if (version < 3) {
    changed = true;
    session.schemaVersion = 3;
  }
  return changed ? { ...session, shared: sh } : session;
}

function stripMarkdownForPersist(session) {
  const clone = JSON.parse(JSON.stringify(session));
  const docId = clone.docId;

  if (clone.modes?.rsvp) {
    clone.modes.rsvp = stripBlocksForPersist(clone.modes.rsvp, docId);
  }
  if (clone.modes?.questions) {
    clone.modes.questions = stripBlocksForPersist(clone.modes.questions, docId);
  }

  const sh = clone.shared;
  if (!sh || typeof sh.rawMarkdown !== "string") return clone;

  let payload = JSON.stringify(clone);
  if (payload.length <= DOC_SESSION_SIZE_THRESHOLD) return clone;

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
    schemaVersion: 3,
    projectId: options.projectId || MISC_PROJECT_ID,
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
      docTopics: [],
      preparation: {
        status: "pending",
        fingerprint: "",
        startedAt: null,
        completedAt: null,
        currentPhase: null,
        currentWave: 0,
        waves: [],
        phaseResults: {},
        errors: [],
      },
      conceptGraph: null,
      blockRecommendation: null,
      slowOrientation: null,
    },
    modes: { rsvp: null, slow: null, cloze: null, questions: null, recall: null },
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
  return normalizeLoadedSession(rehydrateMarkdown(found));
}

export function getActiveSession() {
  const docId = localStorage.getItem(LS_ACTIVE_DOC_ID_KEY);
  if (!docId || !docId.trim()) return null;
  return getSession(docId);
}

/** Drop the active document pointer without deleting library entries. */
export function clearActiveDocumentPointer() {
  try {
    localStorage.removeItem(LS_ACTIVE_DOC_ID_KEY);
  } catch {
    // ignore
  }
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
  try {
    localStorage.removeItem(docBlocksKey(id));
    localStorage.removeItem(docResponsesKey(id));
  } catch {
    // ignore
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
        globalConceptId: null,
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
 * Upsert a spaced-memory item on shared.smItems.
 * Vault-driven items use source `vault_decay` and include vaultEntryId (see spaced-review.js).
 * @param {string} docId
 * @param {object} item
 */
export function upsertSmItem(docId, item) {
  const session = getSession(docId);
  if (!session) throw new Error("session not found");
  const incoming = normalizeSmItem({ ...item, docId: item?.docId || docId });
  if (!incoming?.id) throw new Error("sm item requires id");
  if (!Array.isArray(session.shared.smItems)) session.shared.smItems = [];

  const items = session.shared.smItems
    .map((raw) => normalizeSmItem({ ...raw, docId }))
    .filter(Boolean);

  let idx = items.findIndex((x) => x.id === incoming.id);
  if (idx < 0) {
    idx = items.findIndex(
      (x) => x.sourceType === incoming.sourceType && x.sourceId === incoming.sourceId,
    );
  }
  if (idx >= 0) items[idx] = { ...items[idx], ...incoming };
  else items.push(incoming);

  session.shared.smItems = items;
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

/**
 * @param {string} docId
 * @param {object} question
 */
export function syncAssessmentSignalsFromRecall(docId, question) {
  const session = getSession(docId);
  if (!session) throw new Error("session not found");
  const incoming = buildRecallAssessmentSignals(question);
  if (!incoming.length) return;
  const existing = Array.isArray(session.shared.assessmentSignals)
    ? session.shared.assessmentSignals
    : [];
  session.shared.assessmentSignals = mergeAssessmentSignals(existing, incoming);
  saveActiveSession(session);
}

export function getVaultReviewDueCount() {
  const globalDue = getGlobalReviewDueCount();
  const smDue = getSmItemsDueToday().length;
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const cutoff = endOfDay.getTime();
  const vault = loadVault();
  const vaultDue = (vault.reviewItems || []).filter((item) => {
    const due = Number(item?.sm2?.dueDate);
    return !Number.isFinite(due) || due <= cutoff;
  }).length;
  return globalDue + smDue + vaultDue;
}

export function getSmItemsDueToday(docId) {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const cutoff = endOfDay.getTime();
  const sessions = docId ? [getSession(docId)].filter(Boolean) : getAllSessions();
  const due = [];
  for (const session of sessions) {
    for (const raw of session.shared?.smItems || []) {
      const item = normalizeSmItem({ ...raw, docId: session.docId });
      if (!item?.id) continue;
      const scheduledDue = Number(item.scheduledDue);
      if (!Number.isFinite(scheduledDue) || scheduledDue <= cutoff) {
        due.push({ ...item, docId: session.docId });
      }
    }
  }
  return due;
}

/**
 * @returns {import("./session-types.js").ProjectStore|null}
 */
export function loadProjectStore() {
  try {
    const raw = localStorage.getItem(LS_PROJECTS_KEY);
    if (!raw || !raw.trim()) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.projects)) {
      return null;
    }
    return /** @type {import("./session-types.js").ProjectStore} */ (parsed);
  } catch (err) {
    console.warn("[session-store] corrupt project store JSON", err);
    return null;
  }
}

/**
 * @param {import("./session-types.js").ProjectStore} store
 */
export function saveProjectStore(store) {
  localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(store));
}

/**
 * @returns {import("./session-types.js").ProjectStore}
 */
export function getProjectStore() {
  const loaded = loadProjectStore();
  const store = ensureMiscProject(
    loaded && loaded.schemaVersion === PROJECT_STORE_SCHEMA
      ? loaded
      : { schemaVersion: PROJECT_STORE_SCHEMA, projects: [] },
  );
  return store;
}

/**
 * Persist the in-memory project store (call after mutations).
 * @param {import("./session-types.js").ProjectStore} store
 */
export function persistProjectStore(store) {
  saveProjectStore(ensureMiscProject(store));
}

/** Backfill projectId on all persisted sessions missing it. @returns {boolean} whether any session changed */
export function backfillMissingProjectIds() {
  const sessions = readSessionsRaw();
  let changed = false;
  for (const session of sessions) {
    if (!session || typeof session !== "object") continue;
    if (!session.projectId) {
      session.projectId = MISC_PROJECT_ID;
      changed = true;
    }
  }
  if (changed) writeSessionsRaw(sessions);
  return changed;
}
