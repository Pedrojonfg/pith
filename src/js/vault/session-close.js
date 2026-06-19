/** Session-close vault update pipeline. */

import { rehydrateBlocks } from "../block-store.js";
import { loadSessionForMode } from "../session.js";
import { resolveTaskKind, updateMastery } from "./mastery-model.js";
import { buildAllNewMappings, mergeNormalizationResult } from "./normalization.js";
import { runMisconceptionDetectionForEntries } from "./misconceptions.js";
import { elevatePrerequisiteRelations } from "./prerequisites.js";
import { maybeInferPrerequisites } from "./prerequisite-graph.js";
import { getEntriesByTopic, loadVault, saveVault } from "./vault-store.js";

/**
 * @param {Array<object>} inventory
 * @param {object} vault
 * @param {string} docId
 */
export function filterNewConcepts(inventory, vault, docId) {
  const id = String(docId || "").trim();
  const entries = Array.isArray(vault?.entries) ? vault.entries : [];
  const known = new Set();
  for (const entry of entries) {
    for (const source of Array.isArray(entry?.sources) ? entry.sources : []) {
      if (String(source?.docId || "") === id) {
        known.add(String(source?.conceptId || "").trim());
      }
    }
  }
  return (Array.isArray(inventory) ? inventory : []).filter((c) => {
    const conceptId = String(c?.id || c?.canonicalId || "").trim();
    return conceptId && !known.has(conceptId);
  });
}

/**
 * @param {object} session
 * @returns {string[]}
 */
export function getDocTopics(session) {
  const topics = session?.shared?.docTopics;
  return Array.isArray(topics) ? topics : [];
}

function normalizeConceptRow(raw) {
  const id = String(raw?.id || raw?.canonicalId || "").trim();
  const title = String(raw?.title || raw?.label || "").trim();
  return id ? { id, title, label: title, prerequisite_ids: raw?.prerequisite_ids } : null;
}

function collectInventoryConcepts(session) {
  const shared = Array.isArray(session?.shared?.conceptInventory)
    ? session.shared.conceptInventory
    : [];
  const out = new Map();
  for (const raw of shared) {
    const row = normalizeConceptRow(raw);
    if (row) out.set(row.id, row);
  }
  return [...out.values()];
}

function isAnswerCorrect(response) {
  if (!response || typeof response !== "object") return false;
  if (response.is_correct === true) return true;
  if (response.is_correct === false) return false;
  const user = String(response.user_answer || "").trim();
  const correct = String(response.correct_answer || "").trim();
  if (!user || !correct) return false;
  return user.toLowerCase() === correct.toLowerCase();
}

/**
 * @param {object} session
 * @param {string} mode
 * @param {string} docId
 * @returns {Array<{ conceptId: string, type: string, rawSignal?: number, timestamp: number, docId: string, taskKind?: string, wrongAnswer?: string }>}
 */
export async function collectObservations(session, mode, docId) {
  const observations = [];
  const now = Date.now();

  const signals = Array.isArray(session?.shared?.assessmentSignals)
    ? session.shared.assessmentSignals
    : [];
  for (const signal of signals) {
    const conceptId = String(signal?.canonicalId || "").trim();
    if (!conceptId) continue;
    const lastResult = signal?.lastResult === "correct" ? "mcq_correct" : "mcq_wrong";
    observations.push({
      conceptId,
      type: lastResult,
      rawSignal: undefined,
      timestamp: Number(signal?.lastAt) || now,
      docId,
      taskKind: resolveTaskKind({ type: lastResult, taskKind: signal?.taskKind }),
    });
  }

  const modes = ["rsvp", "questions", "cloze"];
  for (const m of modes) {
    let slice = session?.modes?.[m];
    if (!slice) slice = await loadSessionForMode(m);
    if (!slice) continue;
    slice = rehydrateBlocks(slice, docId);

    const profile = slice?._meta?.knowledge_profile;
    const items = Array.isArray(profile?.items) ? profile.items : [];
    for (const item of items) {
      const conceptId = String(item?.concept_id || "").trim();
      if (!conceptId) continue;
      let type = "assessment_unknown";
      const mastery = String(item?.mastery || "").toLowerCase();
      if (mastery === "full") type = "assessment_mastered";
      else if (mastery === "partial") type = "assessment_partial";
      observations.push({
        conceptId,
        type,
        rawSignal: undefined,
        timestamp: now,
        docId,
        taskKind: resolveTaskKind({ type, taskKind: item?.taskKind }),
      });
    }

    const blocks = Array.isArray(slice?.blocks) ? slice.blocks : [];
    const respBlocks =
      slice?._responses?.blocks && typeof slice._responses.blocks === "object"
        ? slice._responses.blocks
        : {};
    for (let bi = 0; bi < blocks.length; bi += 1) {
      const block = blocks[bi];
      const questions = Array.isArray(block?.questions) ? block.questions : [];
      const qResp = respBlocks[String(bi)]?.questions || {};
      for (const qi of Object.keys(qResp)) {
        const response = qResp[qi];
        if (!response || typeof response !== "object") continue;
        const userAnswer = String(response.user_answer || "").trim();
        if (!userAnswer) continue;
        const question = questions[Number(qi)];
        const qType = String(question?.type || response.question_type || "test").toLowerCase();
        let conceptId = String(question?.concept_id || "").trim();
        if (!conceptId && Array.isArray(block?.concept_ids)) {
          conceptId = String(block.concept_ids[Number(qi)] || block.concept_ids[0] || "").trim();
        }
        if (!conceptId) continue;
        const correct = isAnswerCorrect(response);
        let type = "mcq_wrong";
        if (qType === "socratic") type = correct ? "socratic_passed" : "socratic_partial";
        else type = correct ? "mcq_correct" : "mcq_wrong";
        const row = {
          conceptId,
          type,
          rawSignal: undefined,
          timestamp: Number(response.answered_at) || now,
          docId,
          taskKind: resolveTaskKind({
            type,
            taskKind: question?.taskKind,
            questionKind: question?.kind || question?.question_kind || question?.questionKind,
          }),
        };
        if (!correct) row.wrongAnswer = userAnswer;
        observations.push(row);
      }
    }
  }

  const vaultOverrides = session?.shared?._vaultPendingObservations;
  if (Array.isArray(vaultOverrides)) {
    for (const row of vaultOverrides) {
      const conceptId = String(row?.conceptId || "").trim();
      const type = String(row?.type || "").trim();
      if (!conceptId || !type) continue;
      observations.push({
        conceptId,
        type,
        rawSignal: undefined,
        timestamp: Number(row?.timestamp) || now,
        docId: String(row?.docId || docId),
        taskKind: resolveTaskKind({ type, taskKind: row?.taskKind, questionKind: row?.questionKind }),
        ...(String(row?.wrongAnswer || "").trim() && !type.includes("correct")
          ? { wrongAnswer: String(row.wrongAnswer).trim() }
          : {}),
      });
    }
  }

  return observations;
}

/**
 * @param {object} vault
 * @param {Array<object>} observations
 * @param {Record<string, string>} normalizationMap
 * @returns {Set<string>}
 */
export function applyObservations(vault, observations, normalizationMap) {
  const map = normalizationMap && typeof normalizationMap === "object" ? normalizationMap : {};
  const touched = new Set();
  for (const obs of Array.isArray(observations) ? observations : []) {
    const vaultId = map[String(obs?.conceptId || "").trim()];
    if (!vaultId) continue;
    const entry = vault.entries.find((e) => String(e?.id || "") === vaultId);
    if (!entry) continue;
    updateMastery(entry, {
      type: obs.type,
      rawSignal: obs.rawSignal,
      timestamp: obs.timestamp,
      docId: obs.docId,
      taskKind: obs.taskKind,
      questionKind: obs.questionKind,
      wrongAnswer: obs.wrongAnswer,
      wrongAnswerPattern: obs.wrongAnswerPattern,
      facet: obs.facet,
    });
    entry.lastSeen = Math.max(Number(entry.lastSeen) || 0, Number(obs.timestamp) || 0);
    touched.add(String(vaultId));
  }
  return touched;
}

/**
 * @param {object} session
 * @param {string} mode
 */
export async function updateVaultFromSession(session, mode) {
  if (!session?.docId) return;
  const docId = String(session.docId);
  const inventory = collectInventoryConcepts(session);
  if (!inventory.length) return;

  let vault = loadVault();
  const docTopics = getDocTopics(session);
  const newConcepts = filterNewConcepts(inventory, vault, docId);

  let normalizationMap = /** @type {Record<string, string>} */ ({});
  const existingForConcept = new Map();
  for (const entry of vault.entries) {
    for (const source of Array.isArray(entry?.sources) ? entry.sources : []) {
      if (String(source?.docId || "") === docId) {
        existingForConcept.set(String(source?.conceptId || "").trim(), entry.id);
      }
    }
  }
  for (const [conceptId, vaultId] of existingForConcept) {
    normalizationMap[conceptId] = vaultId;
  }

  if (newConcepts.length) {
    const existingEntries = getEntriesByTopic(docTopics).map((e) => ({
      id: e.id,
      canonicalTitle: e.canonicalTitle,
      aliases: e.aliases || [],
    }));

    let mappings;
    if (!existingEntries.length) {
      mappings = buildAllNewMappings(newConcepts);
    } else {
      try {
        const { normalizeConceptsToVault } = await import("../api.js");
        const topic = docTopics[0] || "general";
        mappings = await normalizeConceptsToVault({
          existingEntries,
          newConcepts: newConcepts.map((c) => ({
            id: c.id,
            title: c.title,
            type: c.type || "CONCEPT",
          })),
          topic,
        });
      } catch (err) {
        console.warn("[session-close] normalization failed, fallback all-new", err);
        mappings = buildAllNewMappings(newConcepts);
      }
    }

    const merged = mergeNormalizationResult(vault, mappings, newConcepts, docTopics, docId);
    normalizationMap = { ...normalizationMap, ...merged };
  }

  for (const concept of inventory) {
    const conceptId = String(concept?.id || "").trim();
    if (!conceptId || normalizationMap[conceptId]) continue;
    const existingId = existingForConcept.get(conceptId);
    if (existingId) normalizationMap[conceptId] = existingId;
  }

  const observations = await collectObservations(session, mode, docId);
  const touchedEntryIds = applyObservations(vault, observations, normalizationMap);
  await runMisconceptionDetectionForEntries(vault, touchedEntryIds);
  elevatePrerequisiteRelations(session, normalizationMap);

  if (Array.isArray(session?.shared?._vaultPendingObservations)) {
    session.shared._vaultPendingObservations = [];
    try {
      const { saveActiveSession, getSession } = await import("../session-store.js");
      const fresh = await getSession(docId);
      if (fresh?.shared) {
        fresh.shared._vaultPendingObservations = [];
        await saveActiveSession(fresh);
      }
    } catch {
      // ignore persistence cleanup errors
    }
  }

  vault.lastUpdated = Date.now();
  saveVault(vault);

  for (const topic of docTopics) {
    const label = String(topic || "").trim();
    if (!label) continue;
    try {
      vault = loadVault();
      await maybeInferPrerequisites(vault, label);
    } catch (err) {
      console.warn("[session-close] prerequisite inference failed", label, err);
    }
  }
}
