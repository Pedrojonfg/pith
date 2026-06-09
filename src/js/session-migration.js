import {
  LS_ACTIVE_SESSION_KEY,
  LS_SESSIONS_BY_MODE_KEY,
  LS_V1_BACKUP_KEY,
} from "./config.js";
import {
  computeDocId,
  getAllSessions,
  saveActiveSession,
  setActiveSession,
  validateDocumentSession,
} from "./session-store.js";
import { computeCanonicalId, inferDocMeta } from "./session-types.js";
import { parseSessionsByModeRaw } from "./session.js";
import { migrateLegacyHtmlMinSession } from "./normalization/migrate-html-min.js";

function hasV2Sessions() {
  return getAllSessions().some((s) => s?.schemaVersion >= 2);
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
export async function detectAndMigrateV1() {
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

    saveActiveSession(session);
    setActiveSession(session.docId);
    localStorage.removeItem(LS_SESSIONS_BY_MODE_KEY);
  } catch (err) {
    console.error("[migration] failed — keeping V1", err);
  }
}
