/**
 * R2 — Veto-gate deduplication (proposals only).
 * @see specs/20260629-vault-embedding/contracts/dedup-gates.md
 */

import {
  DEDUP_GENERATION_FLOOR,
  DEDUP_HARD_GATE_THRESHOLD,
  gateSameLanguageOrTranslatable,
  gateNoConflictingExternalId,
  gateCosineAboveThreshold,
  classifyDedupOutcome,
} from "./dedup-gate-rules.js";
import { isCrossProjectDedupEnabled, isVaultDedupGatesEnabled } from "../config/flags.js";
import {
  buildConceptEmbedText,
  embedText,
  isVaultEmbeddingsEnabled,
} from "../vault/embeddings.js";
import { findNearestConcepts, insertDedupGateLog, hasMergeRejection } from "../vault/embedding-persist.js";
import { getConceptById, loadRegistry } from "./registry-store.js";
import { getProjectScopeIds } from "../vault/novelty-scoring.js";

export {
  gateSameLanguageOrTranslatable,
  gateNoConflictingExternalId,
  gateCosineAboveThreshold,
  classifyDedupOutcome,
} from "./dedup-gate-rules.js";

/**
 * G4 — user rejection history.
 */
export async function gateNoUserRejectionHistory(conceptIdA, conceptIdB) {
  const rejected = await hasMergeRejection(conceptIdA, conceptIdB);
  if (rejected) return { passed: false, reason: "user_rejected_pair" };
  return { passed: true, reason: "no_rejection" };
}

const GATE_ORDER = [
  { id: "G1", run: (a, b, ctx) => gateSameLanguageOrTranslatable(a, b, ctx) },
  { id: "G2", run: (a, b) => gateNoConflictingExternalId(a, b) },
  { id: "G3", run: (_a, _b, ctx) => gateCosineAboveThreshold(ctx.cosineScore) },
  { id: "G4", run: (a, b) => gateNoUserRejectionHistory(a.id, b.id) },
];

/**
 * @param {object} conceptA
 * @param {object} conceptB
 * @param {object} context
 */
export async function evaluateDedupPair(conceptA, conceptB, context = {}) {
  // [debug-enrich]
  console.debug("[concept-registry.dedup-gates.evaluateDedupPair] Entry:", {
    a: conceptA?.id || conceptA?.canonicalName || null,
    b: conceptB?.id || conceptB?.canonicalName || null,
    cosineScore: context.cosineScore ?? null,
  });
  const gateResults = {};
  for (const gate of GATE_ORDER) {
    const result =
      gate.id === "G4"
        ? await gate.run(conceptA, conceptB, context)
        : gate.run(conceptA, conceptB, context);
    gateResults[gate.id] = result;
    if (!result.passed) {
      // [debug-enrich]
      console.info("[concept-registry.dedup-gates.evaluateDedupPair] Rejected at gate:", {
        gate: gate.id,
        outcome: "rejected",
      });
      return { passed: false, gateResults, outcome: "rejected" };
    }
  }

  const cosine = context.cosineScore ?? 0;
  const outcome = classifyDedupOutcome(cosine);
  // [debug-enrich]
  console.info("[concept-registry.dedup-gates.evaluateDedupPair] Done:", {
    outcome,
    cosine,
    passed: outcome !== "rejected",
  });
  return { passed: outcome !== "rejected", gateResults, outcome };
}

/**
 * @param {object} concept
 * @param {{ projectId?: string, generationFloor?: number }} [options]
 */
export async function generateDedupCandidatesForConcept(concept, options = {}) {
  if (!isVaultDedupGatesEnabled() || !isVaultEmbeddingsEnabled()) {
    return { status: "skipped", candidates: [] };
  }

  const floor = options.generationFloor ?? DEDUP_GENERATION_FLOOR;
  const projectId = options.projectId;
  const projectIds = isCrossProjectDedupEnabled()
    ? null
    : getProjectScopeIds(projectId);

  const text = buildConceptEmbedText({
    label: concept.canonicalName,
    definition: concept.description || "",
  });
  if (!text) return { status: "success", candidates: [] };

  const embedding = await embedText(text, {
    conceptId: concept.id,
    projectId: projectId || null,
  });

  const nearest = await findNearestConcepts(embedding, {
    matchCount: 20,
    projectIds,
    excludeConceptId: concept.id,
  });

  const candidates = [];
  for (const hit of nearest) {
    if (hit.similarity < floor) continue;
    const other = getConceptById(hit.conceptId);
    if (!other || other.merged_into) continue;

    const evalResult = await evaluateDedupPair(concept, other, {
      cosineScore: hit.similarity,
      languageA: options.languageA,
      languageB: options.languageB,
    });

    await insertDedupGateLog({
      concept_id_a: concept.id,
      concept_id_b: other.id,
      gate_results: evalResult.gateResults,
      outcome: evalResult.outcome,
    });

    if (evalResult.passed) {
      candidates.push({
        sourceConceptId: concept.id,
        targetConceptId: other.id,
        cosineScore: hit.similarity,
        confidence: evalResult.outcome === "proposal" ? "high" : "suggestion",
        gateResults: evalResult.gateResults,
      });
    }
  }

  return { status: "success", candidates };
}

/**
 * Run dedup candidate generation for all registry concepts linked to a document.
 * @param {object} doc
 */
export async function runDedupForDocument(doc) {
  if (!isVaultDedupGatesEnabled() || !isVaultEmbeddingsEnabled()) {
    // [debug-enrich]
    console.info("[concept-registry.dedup-gates.runDedupForDocument] Skipped — flags off");
    return { status: "skipped", proposals: [] };
  }

  const registry = loadRegistry();
  const docId = doc?.docId;
  const concepts = (registry.concepts || []).filter(
    (c) => !c.merged_into && (c.sourceDocIds || []).includes(docId),
  );

  // [debug-enrich]
  console.info("[concept-registry.dedup-gates.runDedupForDocument] Start:", {
    docId: docId || null,
    conceptCount: concepts.length,
  });

  const proposals = [];
  const language = doc?.shared?.docMeta?.language || null;

  for (const concept of concepts) {
    const { candidates } = await generateDedupCandidatesForConcept(concept, {
      projectId: doc?.projectId,
      languageA: language,
      languageB: language,
    });
    proposals.push(...candidates.filter((c) => c.confidence === "high" || c.confidence === "suggestion"));
  }

  if (!doc.shared) doc.shared = {};
  doc.shared.mergeProposals = mergeProposalList(doc.shared.mergeProposals, proposals);

  // [debug-enrich]
  console.info("[concept-registry.dedup-gates.runDedupForDocument] Done:", {
    docId: docId || null,
    proposalCount: proposals.length,
  });
  return { status: "success", proposals };
}

/**
 * @param {object[]|undefined} existing
 * @param {object[]} incoming
 */
function mergeProposalList(existing, incoming) {
  const map = new Map();
  for (const p of [...(existing || []), ...incoming]) {
    const key = `${p.sourceConceptId}|${p.targetConceptId}`;
    const prev = map.get(key);
    if (!prev || p.cosineScore > prev.cosineScore) map.set(key, { ...p, status: "pending" });
  }
  return [...map.values()];
}
