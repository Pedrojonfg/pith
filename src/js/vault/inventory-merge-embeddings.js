/**
 * Embedding-assisted triage for DPP T1.2 inventory merge.
 * @see specs/20260710-embedding-inventory-dedup/contracts/inventory-merge-embeddings.md
 */

import { embedBatch, isVaultEmbeddingsEnabled } from "./embeddings.js";
import { deInfo, deLog, deWarn } from "../debug-enrich.js";
import { classifyConceptRelation } from "./contradiction-check.js";
import { getMaxContradictionChecksPerDppRun } from "../config/flags.js";
import {
  triagePairSimilarity,
  buildInventoryConceptEmbedText,
  UnionFind,
  flattenPartialsForEmbed,
  findCandidatePairs,
  materializeMergedConcepts,
  conceptsToSinglePartial,
} from "./inventory-merge-triage.js";

export {
  triagePairSimilarity,
  buildInventoryConceptEmbedText,
  flattenPartialsForEmbed,
  mergeConceptCluster,
  findCandidatePairs,
  materializeMergedConcepts,
  conceptsToSinglePartial,
} from "./inventory-merge-triage.js";

let arbitrationCallsThisRun = 0;

export function resetInventoryMergeArbitrationBudget() {
  arbitrationCallsThisRun = 0;
}

/**
 * @param {{ label?: string, concepts?: object[] }[]} partials
 * @param {{ mode?: string, llmModel?: string, embedFn?: (texts: string[]) => Promise<number[][]>, testBypassGate?: boolean }} [options]
 */
export async function runEmbeddingAssistedInventoryMerge(partials, options = {}) {
  const mode = String(options.mode || "shadow").trim();
  const payload = (Array.isArray(partials) ? partials : []).filter(
    (p) => Array.isArray(p?.concepts) && p.concepts.length > 0,
  );

  const emptyTelemetry = {
    autoMerged: 0,
    llmArbitrated: 0,
    rejectedDistinct: 0,
    finalConceptCount: 0,
    auditAutoMerges: [],
    shadowDecisions: [],
  };

  deInfo("[vault.inventory-merge-embed.runEmbeddingAssistedInventoryMerge] Start:", {
    mode,
    partialCount: payload.length,
    embeddingsEnabled: isVaultEmbeddingsEnabled(),
    testBypassGate: Boolean(options.testBypassGate),
  });

  if (payload.length < 2 || (!options.testBypassGate && !isVaultEmbeddingsEnabled())) {
    const reason = payload.length < 2 ? "single_partial" : "embeddings_disabled";
    deInfo("[vault.inventory-merge-embed.runEmbeddingAssistedInventoryMerge] Skipped:", { reason });
    return {
      status: "skipped",
      reason,
      telemetry: emptyTelemetry,
    };
  }

  const rows = flattenPartialsForEmbed(payload);
  if (rows.length < 2) {
    deInfo("[vault.inventory-merge-embed.runEmbeddingAssistedInventoryMerge] Skipped — too_few_concepts:", {
      rowCount: rows.length,
    });
    return { status: "skipped", reason: "too_few_concepts", telemetry: emptyTelemetry };
  }

  const texts = rows.map((r) => buildInventoryConceptEmbedText(r.concept));
  const embedFn = options.embedFn || ((list) => embedBatch(list));
  let vectorsList;
  try {
    deLog("[vault.inventory-merge-embed.runEmbeddingAssistedInventoryMerge] Embedding batch:", {
      textCount: texts.length,
    });
    vectorsList = await embedFn(texts);
  } catch (err) {
    deWarn("[vault.inventory-merge-embed.runEmbeddingAssistedInventoryMerge] Embed failed — fallback:", {
      message: err?.message || err,
    });
    return { status: "skipped", reason: "embed_failed", telemetry: emptyTelemetry };
  }

  /** @type {Map<string, number[]>} */
  const vectors = new Map();
  rows.forEach((row, i) => {
    if (Array.isArray(vectorsList[i]) && vectorsList[i].length) {
      vectors.set(row.flatId, vectorsList[i]);
      row.concept._embedding = vectorsList[i];
    }
  });

  const pairs = findCandidatePairs(rows, vectors);
  deLog("[vault.inventory-merge-embed.runEmbeddingAssistedInventoryMerge] Candidate pairs:", {
    pairCount: pairs.length,
    vectorCount: vectors.size,
  });
  const uf = new UnionFind(rows.map((r) => r.flatId));
  const cap = getMaxContradictionChecksPerDppRun();
  const rowById = new Map(rows.map((r) => [r.flatId, r]));

  const telemetry = {
    autoMerged: 0,
    llmArbitrated: 0,
    rejectedDistinct: 0,
    finalConceptCount: 0,
    auditAutoMerges: [],
    shadowDecisions: [],
  };

  for (const pair of pairs) {
    const triage = triagePairSimilarity(pair.similarity);
    const decision = { ...pair, triage };

    if (triage === "distinct") {
      telemetry.rejectedDistinct += 1;
      if (mode === "shadow") telemetry.shadowDecisions.push({ ...decision, action: "keep_distinct" });
      continue;
    }

    if (triage === "auto") {
      if (mode !== "shadow") uf.union(pair.idA, pair.idB);
      telemetry.autoMerged += 1;
      telemetry.auditAutoMerges.push({ idA: pair.idA, idB: pair.idB, similarity: pair.similarity });
      if (mode === "shadow") telemetry.shadowDecisions.push({ ...decision, action: "would_auto_merge" });
      continue;
    }

    if (mode === "full" && arbitrationCallsThisRun < cap) {
      const rowA = rowById.get(pair.idA);
      const rowB = rowById.get(pair.idB);
      if (rowA && rowB) {
        arbitrationCallsThisRun += 1;
        telemetry.llmArbitrated += 1;
        const result = await classifyConceptRelation(
          { canonicalName: rowA.concept.title, description: rowA.concept.scope_one_line },
          { canonicalName: rowB.concept.title, description: rowB.concept.scope_one_line },
          { llmModel: options.llmModel },
        );
        if (result.label === "entailment") {
          uf.union(pair.idA, pair.idB);
          telemetry.shadowDecisions.push({ ...decision, action: "llm_merge", llmLabel: result.label });
        } else {
          telemetry.rejectedDistinct += 1;
          telemetry.shadowDecisions.push({ ...decision, action: "llm_keep_distinct", llmLabel: result.label });
        }
        continue;
      }
    }

    telemetry.rejectedDistinct += 1;
    if (mode === "shadow") {
      telemetry.shadowDecisions.push({ ...decision, action: "would_review_or_distinct" });
    }
  }

  if (mode === "shadow") {
    telemetry.finalConceptCount = rows.length;
    deInfo("[vault.inventory-merge-embed.runEmbeddingAssistedInventoryMerge] Shadow done:", telemetry);
    return { status: "skipped", reason: "shadow_mode", telemetry, inventoryMode: "embed_shadow" };
  }

  const concepts = materializeMergedConcepts(rows, uf, vectors);
  telemetry.finalConceptCount = concepts.length;
  deInfo("[vault.inventory-merge-embed.runEmbeddingAssistedInventoryMerge] Merge done:", telemetry);

  const inventoryMode = mode === "full" ? "embed_full" : "embed_auto";
  return { status: "success", concepts, telemetry, inventoryMode };
}
