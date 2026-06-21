/**
 * R3 — Cascade merge with snapshot rollback (client-atomic).
 * @see specs/20260629-vault-embedding/contracts/cascade-merge.md
 */

import { loadRegistry, saveRegistry, getConceptById, upsertConcept } from "./registry-store.js";
import { getAllSessions, saveActiveSession } from "../session-store.js";
import { loadVault, saveVault } from "../vault/vault-store.js";
import { insertVaultMergeLog } from "../vault/embedding-persist.js";
import { supabase } from "../supabase-client.js";
import { getAuthUserId } from "../session-persist-supabase.js";

const MATURITY_RANK = { gray: 0, yellow: 1, green: 2 };

function maxMaturity(a, b) {
  const ra = MATURITY_RANK[a] ?? 1;
  const rb = MATURITY_RANK[b] ?? 1;
  return ra >= rb ? a : b;
}

function relinkId(value, sourceId, targetId) {
  if (value === sourceId) return targetId;
  return value;
}

/**
 * @param {string} sourceId
 * @param {string} targetId
 * @param {object} sessions
 */
export function dryRunCascadeMerge(sourceId, targetId, sessions = null) {
  const relinkDetail = [];
  let relinkCount = 0;
  const src = String(sourceId || "").trim();
  const tgt = String(targetId || "").trim();
  if (!src || !tgt || src === tgt) return { relinkDetail, relinkCount };

  const registry = loadRegistry();
  if (registry.concepts.some((c) => c.id === src)) {
    relinkDetail.push(`registry.concept ${src} → merged_into ${tgt}`);
    relinkCount += 1;
  }

  const sessionList = sessions || [];
  for (const doc of sessionList) {
    const docId = doc?.docId || "unknown";
    const shared = doc?.shared || {};

    for (const item of shared.smItems || []) {
      if (item?.conceptId === src) {
        relinkDetail.push(`smItems.conceptId: ${docId} (1 row)`);
        relinkCount += 1;
      }
    }

    for (const sig of shared.assessmentSignals || []) {
      if (sig?.canonicalId === src || sig?.globalConceptId === src) {
        relinkDetail.push(`assessmentSignals: ${docId}`);
        relinkCount += 1;
      }
    }

    for (const edge of shared.conceptGraph?.edges || []) {
      if (edge?.source === src || edge?.target === src) {
        relinkDetail.push(`conceptGraph.edge: ${docId}`);
        relinkCount += 1;
      }
    }

    for (const entry of shared.conceptInventory || []) {
      if (entry?.globalConceptId === src || entry?.canonicalId === src) {
        relinkDetail.push(`conceptInventory.globalConceptId: ${docId}`);
        relinkCount += 1;
      }
    }

    for (const device of shared.mnemonicDevices || []) {
      if ((device?.conceptIds || []).includes(src)) {
        relinkDetail.push(`mnemonicDevices.conceptIds: ${docId}`);
        relinkCount += 1;
      }
    }

    const clozeItems = doc?.modes?.cloze?.cloze?.items || doc?.modes?.cloze?.items || [];
    for (const item of clozeItems) {
      if ((item?.conceptIds || []).includes(src)) {
        relinkDetail.push(`cloze.items.conceptIds: ${docId}`);
        relinkCount += 1;
      }
    }
  }

  const vault = loadVault();
  for (const entry of vault.entries || []) {
    if ((entry?.related || []).includes(src)) {
      relinkDetail.push(`vault.entry.related: ${entry.id}`);
      relinkCount += 1;
    }
  }

  return { relinkDetail, relinkCount };
}

function snapshotState(sessions) {
  return {
    registry: JSON.parse(JSON.stringify(loadRegistry())),
    vault: JSON.parse(JSON.stringify(loadVault())),
    sessions: JSON.parse(JSON.stringify(sessions)),
  };
}

function restoreState(snapshot) {
  saveRegistry(snapshot.registry);
  saveVault(snapshot.vault);
}

async function restoreSessions(snapshot) {
  for (const doc of snapshot.sessions || []) {
    await saveActiveSession(doc);
  }
}

/**
 * @param {string} sourceId
 * @param {string} targetId
 * @param {{ approvedBy?: string, reasoning?: string, gateResults?: object }} [meta]
 */
export async function mergeConceptProposal(sourceId, targetId, meta = {}) {
  const src = String(sourceId || "").trim();
  const tgt = String(targetId || "").trim();
  if (!src || !tgt) throw new Error("mergeConceptProposal requires source and target ids");
  if (src === tgt) return { ok: true, noop: true };

  const sourceConcept = getConceptById(src);
  const targetConcept = getConceptById(tgt);
  if (!sourceConcept) throw new Error(`Source concept not found: ${src}`);
  if (!targetConcept) throw new Error(`Target concept not found: ${tgt}`);

  if (sourceConcept.merged_into === tgt) {
    return { ok: true, noop: true, idempotent: true };
  }
  if (sourceConcept.merged_into && sourceConcept.merged_into !== tgt) {
    throw new Error(`Source already merged into ${sourceConcept.merged_into}`);
  }

  const sessions = await getAllSessions();
  const snap = snapshotState(sessions);
  const { relinkDetail, relinkCount } = dryRunCascadeMerge(src, tgt, sessions);

  try {
    for (const doc of sessions) {
      let dirty = false;
      const shared = doc.shared || {};

      for (const item of shared.smItems || []) {
        if (item?.conceptId === src) {
          item.conceptId = tgt;
          dirty = true;
        }
      }

      for (const sig of shared.assessmentSignals || []) {
        if (sig?.canonicalId === src) {
          sig.canonicalId = tgt;
          dirty = true;
        }
        if (sig?.globalConceptId === src) {
          sig.globalConceptId = tgt;
          dirty = true;
        }
      }

      for (const edge of shared.conceptGraph?.edges || []) {
        if (edge?.source === src) {
          edge.source = tgt;
          dirty = true;
        }
        if (edge?.target === src) {
          edge.target = tgt;
          dirty = true;
        }
      }

      for (const entry of shared.conceptInventory || []) {
        if (entry?.globalConceptId === src) {
          entry.globalConceptId = tgt;
          dirty = true;
        }
        if (entry?.canonicalId === src) {
          entry.canonicalId = tgt;
          dirty = true;
        }
      }

      for (const device of shared.mnemonicDevices || []) {
        if (Array.isArray(device.conceptIds) && device.conceptIds.includes(src)) {
          device.conceptIds = [...new Set(device.conceptIds.map((id) => relinkId(id, src, tgt)))];
          dirty = true;
        }
      }

      const clozeItems = doc?.modes?.cloze?.cloze?.items || doc?.modes?.cloze?.items || [];
      for (const item of clozeItems) {
        if (Array.isArray(item?.conceptIds) && item.conceptIds.includes(src)) {
          item.conceptIds = [...new Set(item.conceptIds.map((id) => relinkId(id, src, tgt)))];
          dirty = true;
        }
      }

      if (dirty) await saveActiveSession(doc);
    }

    const vault = loadVault();
    let vaultDirty = false;
    for (const entry of vault.entries || []) {
      if (Array.isArray(entry.related) && entry.related.includes(src)) {
        entry.related = [...new Set(entry.related.map((id) => relinkId(id, src, tgt)))];
        vaultDirty = true;
      }
    }
    if (vaultDirty) saveVault(vault);

    const mergedMaturity = maxMaturity(sourceConcept.maturity || "yellow", targetConcept.maturity || "yellow");
    const mergedAliases = [
      ...new Set([...(targetConcept.aliases || []), ...(sourceConcept.aliases || []), sourceConcept.canonicalName]),
    ];
    const mergedRelated = [
      ...new Set([...(targetConcept.relatedConceptIds || []), ...(sourceConcept.relatedConceptIds || [])]),
    ].filter((id) => id !== src && id !== tgt);

    upsertConcept({
      ...targetConcept,
      maturity: mergedMaturity,
      aliases: mergedAliases,
      relatedConceptIds: mergedRelated,
      updatedAt: new Date().toISOString(),
    });

    upsertConcept({
      ...sourceConcept,
      merged_into: tgt,
      updatedAt: new Date().toISOString(),
    });

    try {
      const userId = await getAuthUserId();
      if (userId) {
        await supabase.rpc("relink_embedding_concept_id", {
          p_source_id: src,
          p_target_id: tgt,
        });
      }
    } catch (err) {
      console.warn("[cascade-merge] embedding relink rpc failed", err?.message || err);
    }

    await insertVaultMergeLog({
      source_concept_id: src,
      target_concept_id: tgt,
      gate_results: meta.gateResults || {},
      approved_by: meta.approvedBy || "user",
      reasoning: meta.reasoning || "",
      reference_relink_count: relinkCount,
      reference_relink_detail: relinkDetail,
    });

    return { ok: true, relinkCount, relinkDetail };
  } catch (err) {
    restoreState(snap);
    await restoreSessions(snap);
    throw err;
  }
}
