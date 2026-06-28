/**
 * V1 → DocumentSession migration (read + one-time upgrade).
 *
 * WRITES here are allowed only for upgrading legacy localStorage into DocumentSession
 * (`saveActiveSession`, backup key, then remove legacy keys). Do not add new write paths
 * to `active_session` or `sessions_by_mode` outside this migration flow.
 */
import {
  LS_ACTIVE_SESSION_KEY,
  LS_SESSIONS_BY_MODE_KEY,
  LS_V1_BACKUP_KEY,
} from "./config.js";
import {
  computeDocId,
  getAllSessions,
  loadProjectStore,
  cleanupMiscProjectAssignments,
  saveActiveSession,
  saveProjectStore,
  setActiveSession,
  validateDocumentSession,
} from "./session-store.js";
import { computeCanonicalId, inferDocMeta } from "./session-types.js";
import { parseSessionsByModeRaw } from "./session.js";
import { migrateLegacyHtmlMinSession } from "./normalization/migrate-html-min.js";

async function hasV2Sessions() {
  return (await getAllSessions()).some((s) => s?.schemaVersion >= 2);
}

function slotHasData(slot) {
  return slot && typeof slot === "object" && Object.keys(slot).length > 0;
}

function extractMarkdownFromSlot(slot) {
  if (!slot || typeof slot !== "object") return "";
  const candidates = [
    slot.slow?.normalizedTextFull,
    slot.slow?.rawMarkdown,
    slot.slow?.rawText,
    slot.slow?.materialText,
    slot.rawMarkdown,
    slot.rawText,
    slot.originalMaterialText,
    slot.cloze?.normalizedText,
    slot.cloze?.rawMarkdown,
    slot.cloze?.rawText,
  ];
  for (const c of candidates) {
    const t = String(c || "").trim();
    if (t) return t;
  }
  return "";
}

function migrateSlot(slot) {
  if (!slot || typeof slot !== "object") return null;
  return migrateLegacyHtmlMinSession({ ...slot });
}

function slowPayload(slot) {
  return slot?.slow && typeof slot.slow === "object" ? slot.slow : slot;
}

function collectConceptsFromV1(slots) {
  const out = [];
  const slow = slowPayload(slots.slow);
  if (slow?.phase0?.conceptsToFind) {
    for (const c of slow.phase0.conceptsToFind) {
      const label = String(c?.term || c?.label || "").trim();
      if (!label) continue;
      out.push({
        canonicalId: computeCanonicalId(label),
        label,
        definition: String(c?.authorUsage || c?.definition || "").trim(),
        detectedBy: "slow",
      });
    }
  }
  const mg = slow?._meta?.material_graph || slots.rsvp?._meta?.material_graph;
  if (Array.isArray(mg?.conceptInventory)) {
    for (const c of mg.conceptInventory) {
      const label = String(c?.term || c?.label || "").trim();
      if (!label) continue;
      out.push({
        canonicalId: computeCanonicalId(label),
        label,
        definition: String(c?.definition || "").trim(),
        detectedBy: "rsvp",
      });
    }
  }
  const clozeNodes = slots.cloze?.epistemicGraph?.nodes;
  if (Array.isArray(clozeNodes)) {
    for (const n of clozeNodes) {
      const label = String(n?.text || n?.label || "").trim();
      if (!label) continue;
      out.push({
        canonicalId: computeCanonicalId(label),
        label,
        definition: "",
        detectedBy: "cloze",
      });
    }
  }
  const byId = new Map();
  for (const c of out) {
    if (!c.canonicalId) continue;
    const prev = byId.get(c.canonicalId);
    if (!prev || String(c.definition).length > String(prev.definition).length) {
      byId.set(c.canonicalId, c);
    }
  }
  return [...byId.values()];
}

function collectSmItemsFromV1(slots) {
  const items = [];
  const pushAll = (arr, sourceMode) => {
    if (!Array.isArray(arr)) return;
    for (const it of arr) {
      if (!it?.id) continue;
      items.push({ ...it, sourceMode: it.sourceMode || sourceMode });
    }
  };
  pushAll(slots.cloze?.smItems, "cloze");
  pushAll(slots.rsvp?.smItems, "rsvp");
  pushAll(slots.cloze?.reviewItems, "cloze");
  return items;
}

function collectAnnotationsFromSlow(slowSlot) {
  const anns = slowPayload(slowSlot)?.annotations || slowSlot?.annotations;
  if (!Array.isArray(anns)) return [];
  return anns.map((a) => ({
    id: String(a.id || `ann_${a.createdAt || Date.now()}`),
    type: String(a.type || "≈"),
    text: String(a.userText || a.text || "").trim(),
    offset: Number(a.charStart ?? a.offset ?? 0),
    createdAt: Number(a.createdAt) || Date.now(),
  }));
}

function findDocHierarchy(slots) {
  for (const key of ["slow", "rsvp", "cloze", "questions"]) {
    const h = slots[key]?.docHierarchy;
    if (h && typeof h === "object") return h;
  }
  return null;
}

async function buildDocumentSessionFromV1(slots) {
  const order = ["slow", "rsvp", "cloze", "questions"];
  let rawMarkdown = "";
  for (const key of order) {
    rawMarkdown = extractMarkdownFromSlot(slots[key]);
    if (rawMarkdown) break;
  }
  const docId = rawMarkdown
    ? await computeDocId(rawMarkdown)
    : `legacy-${Date.now().toString(36)}`;

  const modes = {
    rsvp: migrateSlot(slots.rsvp),
    slow: migrateSlot(slots.slow),
    cloze: migrateSlot(slots.cloze),
    questions: migrateSlot(slots.questions),
    recall: null,
  };

  const now = Date.now();
  const session = {
    docId,
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now,
    shared: {
      rawMarkdown: rawMarkdown || "",
      docMeta: {
        titleInferred: rawMarkdown.slice(0, 80) || "Legacy session",
        charCount: rawMarkdown.length,
        language: "other",
        estimatedGenre: "unknown",
      },
      docHierarchy: findDocHierarchy(slots),
      conceptInventory: collectConceptsFromV1(slots),
      annotations: collectAnnotationsFromSlow(slots.slow),
      smItems: collectSmItemsFromV1(slots),
    },
    modes,
  };

  if (rawMarkdown) {
    session.shared.docMeta = inferDocMeta(rawMarkdown);
  }
  return session;
}

function loadV1Backup() {
  try {
    const raw = localStorage.getItem(LS_V1_BACKUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Idempotent V1 → V2 migration. Call at boot before study init.
 */
/**
 * Strip legacy per-document review slot; smItems remain on shared.
 * @param {object} session
 * @returns {object}
 */
export function stripLegacyReviewSlot(session) {
  if (!session?.modes || typeof session.modes !== "object") return session;
  if (!("review" in session.modes)) return session;
  const modes = { ...session.modes };
  delete modes.review;
  return { ...session, modes };
}

export async function detectAndMigrateV1() {
  migrateProjects();
  if (hasV2Sessions()) return;

  let rawV1 = localStorage.getItem(LS_SESSIONS_BY_MODE_KEY);
  let sessionsByMode = parseSessionsByModeRaw(rawV1);
  let activeSession = null;
  try {
    const legacyRaw = localStorage.getItem(LS_ACTIVE_SESSION_KEY);
    if (legacyRaw) activeSession = JSON.parse(legacyRaw);
  } catch {
    // ignore
  }

  if (!sessionsByMode) {
    const backup = loadV1Backup();
    if (backup?.sessionsByMode) {
      sessionsByMode = backup.sessionsByMode;
      activeSession = backup.activeSession ?? activeSession;
    }
  }

  if (!sessionsByMode) return;
  const hasAny = ["rsvp", "slow", "cloze", "questions"].some((k) =>
    slotHasData(sessionsByMode[k]),
  );
  if (!hasAny) return;

  try {
    const session = await buildDocumentSessionFromV1(sessionsByMode);
    const v = validateDocumentSession(session);
    if (!v.ok) {
      console.error("[migration] validation failed", v.errors);
      return;
    }

    localStorage.setItem(
      LS_V1_BACKUP_KEY,
      JSON.stringify({
        migratedAt: Date.now(),
        sessionsByMode: JSON.parse(JSON.stringify(sessionsByMode)),
        activeSession,
      }),
    );

    await saveActiveSession(session);
    await setActiveSession(session.docId);
    localStorage.removeItem(LS_SESSIONS_BY_MODE_KEY);
  } catch (err) {
    console.error("[migration] failed — keeping V1", err);
  }
}

/**
 * Idempotent project store cleanup (remove legacy misc project).
 * @see specs/20260623-study-projects/contracts/project-migration.md
 */
export async function migrateProjects() {
  let store = loadProjectStore();
  if (!store || store.schemaVersion !== 1 || !Array.isArray(store.projects)) {
    store = { schemaVersion: 1, projects: [] };
  }
  const before = JSON.stringify(store);
  store.projects = (store.projects || []).filter((p) => p?.id !== "misc");

  const sessionsChanged = await cleanupMiscProjectAssignments();

  if (JSON.stringify(store) !== before || sessionsChanged) {
    saveProjectStore(store);
  }
}
