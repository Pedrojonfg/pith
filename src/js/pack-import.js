/**
 * Pack import — lookup published pack by code and clone into a DocumentSession.
 * @see specs/20260716-pack-import-flow
 */

import { supabase } from "./supabase-client.js";
import {
  createSession as defaultCreateSession,
  getSession as defaultGetSession,
  saveActiveSession as defaultSaveActiveSession,
} from "./session-store.js";
import { runVaultLinkPhase as defaultRunVaultLinkPhase } from "./document-preparation.js";
import { normalizePackCode } from "./pack-export.js";

function deepCloneJson(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // fall through
    }
  }
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {string} packId
 * @returns {string}
 */
export function buildImportedDocId(packId) {
  const short = String(packId || "")
    .replace(/-/g, "")
    .slice(0, 8) || "pack";
  // ponytail: random suffix avoids same-ms collisions on double import
  const salt = Math.random().toString(36).slice(2, 6);
  return `pack-${short}-${Date.now().toString(36)}-${salt}`;
}

/**
 * @param {string} packCode
 * @param {{ supabase?: object }} [deps]
 * @returns {Promise<object|null>}
 */
export async function lookupPublishedPackByCode(packCode, deps = {}) {
  const code = normalizePackCode(packCode);
  if (!code) return null;
  const db = deps.supabase || supabase;
  const { data, error } = await db.rpc("lookup_shared_pack_by_code", { p_code: code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.status !== "published" || !row.code) return null;
  return row;
}

/**
 * Strip creator vault links so importer T1.6 can re-bind.
 * @param {unknown[]} inventory
 * @returns {object[]}
 */
function cloneInventoryForImporter(inventory) {
  const list = Array.isArray(inventory) ? inventory : [];
  return list.map((item) => {
    if (!item || typeof item !== "object") return item;
    const copy = deepCloneJson(item);
    delete copy.globalConceptId;
    return copy;
  });
}

/**
 * @param {string} packCode
 * @param {string} importingUserId
 * @param {string} projectId
 * @param {object} [deps]
 * @returns {Promise<object>} DocumentSession
 */
export async function importPackAsSession(packCode, importingUserId, projectId, deps = {}) {
  const importer = String(importingUserId || "").trim();
  const project = String(projectId || "").trim();
  if (!importer) throw new Error("importPackAsSession: importingUserId required");
  if (!project) throw new Error("importPackAsSession: projectId required");

  const pack = await lookupPublishedPackByCode(packCode, deps);
  if (!pack) throw new Error("Invalid pack code");

  const snap = deepCloneJson(pack.snapshot) || {};
  const docId = buildImportedDocId(pack.id);
  const rawMarkdown = typeof snap.rawMarkdown === "string" ? snap.rawMarkdown : "";

  const createSessionFn = deps.createSession || defaultCreateSession;
  const getSessionFn = deps.getSession || defaultGetSession;
  const saveFn = deps.saveActiveSession || defaultSaveActiveSession;
  const vaultLinkFn = deps.runVaultLinkPhase || defaultRunVaultLinkPhase;

  await createSessionFn(rawMarkdown, { docId, projectId: project });
  const session = await getSessionFn(docId);
  if (!session) throw new Error("importPackAsSession: failed to create session");

  const now = Date.now();
  session.createdAt = now;
  session.updatedAt = now;
  session.projectId = project;

  const modes = snap.modes && typeof snap.modes === "object" ? snap.modes : {};
  session.shared.docMeta = deepCloneJson(snap.docMeta) || session.shared.docMeta;
  session.shared.docHierarchy = deepCloneJson(snap.docHierarchy ?? null);
  session.shared.conceptInventory = cloneInventoryForImporter(snap.conceptInventory);
  session.shared.conceptGraph = deepCloneJson(snap.conceptGraph ?? { nodes: [], edges: [] });
  session.shared.modeRecommendation = deepCloneJson(snap.modeRecommendation ?? null);
  session.shared.rawMarkdown = rawMarkdown;
  session.shared.scopedMarkdown = rawMarkdown;
  session.shared.images = Array.isArray(snap.images) ? deepCloneJson(snap.images) : [];
  session.shared.annotations = [];
  session.shared.smItems = [];
  session.shared.preparation = {
    status: "ready",
    fingerprint: "",
    startedAt: null,
    completedAt: now,
    currentPhase: null,
    currentWave: 0,
    waves: [],
    phaseResults: {},
    errors: [],
  };

  session.modes.rsvp = deepCloneJson(modes.rsvp ?? null);
  session.modes.questions = deepCloneJson(modes.questions ?? null);
  session.modes.recall = deepCloneJson(modes.recall ?? null);
  session.modes.cloze = deepCloneJson(modes.cloze ?? null);
  session.modes.slow = deepCloneJson(snap.slowSlice ?? modes.slow ?? null);
  session.modes.read = null;

  // ponytail: satisfy isTier1PreparationComplete without re-running DPP packing
  const rsvpBlocks = Array.isArray(session.modes.rsvp?.blocks) ? session.modes.rsvp.blocks.length : 0;
  session.shared.blockRecommendation = {
    nBlocks: Math.max(1, rsvpBlocks),
    source: "pack_import",
  };

  const title = String(pack.title || snap.docMeta?.titleInferred || "Pack").trim() || "Pack";
  const ownerName = String(pack.owner_display_name || "").trim() || "Pack creator";
  session.shared.uploadMeta = {
    fileName: title,
    originalFormat: "pack",
    uploadedAt: new Date(now).toISOString(),
    sourcePackId: String(pack.id),
    sourcePackOwnerName: ownerName,
    sourcePackTitle: title,
  };

  await saveFn(session);

  const linked = await vaultLinkFn(session);
  await saveFn(linked || session);
  return (await getSessionFn(docId)) || linked || session;
}
