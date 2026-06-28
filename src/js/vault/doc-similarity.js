/**
 * R5 — Document-to-document similarity within study projects.
 */

import { isDocSimilarityEnabled } from "../config/flags.js";
import { isVaultEmbeddingsEnabled, embedText } from "./embeddings.js";
import { cosineSimilarity } from "./embedding-math.js";
import {
  DOC_SIMILARITY_TOP_CONCEPTS,
} from "./embedding-thresholds.js";
import { upsertDocumentSimilarity, fetchDocumentSimilaritiesForDoc } from "./embedding-persist.js";
import { getAllSessions } from "../session-store.js";

/**
 * @param {object} doc
 */
export function buildDocumentSummaryText(doc) {
  return String(doc?.shared?.docMeta?.titleInferred || doc?.title || "").trim();
}

/**
 * @param {object} doc
 */
export function buildDocumentConceptsText(doc) {
  const inv = doc?.shared?.conceptInventory || [];
  const names = inv
    .map((c) => String(c?.label || c?.term || "").trim())
    .filter(Boolean)
    .slice(0, DOC_SIMILARITY_TOP_CONCEPTS);
  return names.join(" ");
}

/**
 * @param {object} docA
 * @param {object} docB
 */
export async function computeDocumentPairSimilarity(docA, docB) {
  const summaryA = buildDocumentSummaryText(docA);
  const summaryB = buildDocumentSummaryText(docB);
  const conceptsA = buildDocumentConceptsText(docA);
  const conceptsB = buildDocumentConceptsText(docB);

  if (!summaryA && !conceptsA) return { score: 0, field_scores: {} };
  if (!summaryB && !conceptsB) return { score: 0, field_scores: {} };

  const projectId = docA?.projectId;
  const [embSummaryA, embSummaryB, embConceptsA, embConceptsB] = await embedBatchSafe([
    summaryA || conceptsA,
    summaryB || conceptsB,
    conceptsA || summaryA,
    conceptsB || summaryB,
  ], projectId);

  const summarySim = cosineSimilarity(embSummaryA, embSummaryB);
  const conceptsSim = cosineSimilarity(embConceptsA, embConceptsB);
  const score = 0.5 * summarySim + 0.5 * conceptsSim;

  return {
    score,
    field_scores: { summary: summarySim, concepts: conceptsSim },
  };
}

async function embedBatchSafe(texts, projectId) {
  const out = [];
  for (const text of texts) {
    out.push(
      await embedText(text, {
        scopeType: "document",
        projectId: projectId || null,
      }),
    );
  }
  return out;
}

/**
 * @param {object} doc
 */
export async function runDocumentSimilarityForProject(doc) {
  if (!isDocSimilarityEnabled() || !isVaultEmbeddingsEnabled()) {
    return { status: "skipped" };
  }

  const projectId = String(doc?.projectId || "").trim();
  if (!projectId) {
    return { status: "skipped", reason: "no_project" };
  }

  const sessions = await getAllSessions();
  const peers = sessions.filter(
    (s) => s.docId !== doc.docId && String(s.projectId || "") === projectId,
  );

  if (!peers.length) return { status: "success", pairs: 0 };

  let pairs = 0;
  const relatedHints = [];
  for (const peer of peers) {
    const { score, field_scores } = await computeDocumentPairSimilarity(doc, peer);
    await upsertDocumentSimilarity(doc.docId, peer.docId, score, field_scores);
    relatedHints.push({
      docId: peer.docId,
      title: peer.shared?.docMeta?.titleInferred || peer.title || peer.docId,
      score,
      field_scores,
    });
    pairs += 1;
  }

  if (!doc.shared) doc.shared = {};
  doc.shared.relatedDocuments = relatedHints.sort((a, b) => b.score - a.score);

  return { status: "success", pairs };
}

export { fetchDocumentSimilaritiesForDoc };
