/**
 * Document Preparation Pipeline (DPP) — upload-time shared artifact orchestration.
 * @see specs/20260618-document-preparation-frontload/contracts/dpp-orchestrator.md
 */

import { analyzeText } from "./recommendation/analyzer.js";
import { computeBlockCountRecommendation } from "./recommendation/block-count-recommender.js";
import { buildDocumentHierarchy, buildDeterministicPedagogicalMeta } from "./normalization/hierarchy.js";
import { computeModeRecommendation } from "./recommendation/recommender.js";
import {
  generateEpistemicGraph,
  getValidItems,
  runClozePipelinePhases,
} from "./cloze/pipeline.js";
import { generatePhase0ForScope } from "./slow/phase0.js";
import { generateRecallSliceForDoc } from "./recall-study.js";
import { resolveGlobalConcept } from "./concept-registry/identity-resolution.js";
import { backfillGlobalConceptIds } from "./concept-registry/promotion.js";
import { promoteGraphConnectionsToRegistry } from "./concept-registry/connection-promotion.js";
import { isInterviewOriginSession } from "./interview/origin.js";
import { runConceptInventoryWithFallback } from "./session.js";
import { assertLlmKeyPresent } from "./llm.js";
import { isOfflineMode } from "./offline.js";
import { isVaultEmbeddingsEnabled } from "./vault/embeddings.js";
import { scoreConceptNovelty } from "./vault/novelty-scoring.js";
import { runDedupForDocument } from "./concept-registry/dedup-gates.js";
import {
  filterProposalsWithContradictionCheck,
  resetContradictionCheckBudget,
} from "./vault/contradiction-check.js";
import { runDocumentSimilarityForProject } from "./vault/doc-similarity.js";
import {
  getSession,
  saveActiveSession,
  addConceptsToShared,
  updateRecommendation,
} from "./session-store.js";
import {
  createEmptyPreparationState,
  normalizePreparationState,
  normalizeMarkdownForHash,
  isTier1PreparationComplete,
} from "./session-types.js";

const TIER1_PHASES = new Set(["T1.1", "T1.2", "T1.3", "T1.4", "T1.5", "T1.6", "T1.7", "T1.8", "T1.9"]);
const PHASE_DEPS = {
  "T0.1": [],
  "T0.2": ["T0.1"],
  "T1.1": ["T0.1"],
  "T1.2": ["T1.1"],
  "T1.3": ["T0.1"],
  "T1.4": ["T1.2"],
  "T1.5": ["T1.1", "T0.2"],
  "T1.6": ["T1.2"],
  "T1.7": ["T1.2"],
  "T1.8": ["T1.2", "T1.6"],
  "T1.9": ["T1.2", "T1.8"],
  "T2.1": ["T1.3"],
  "T2.2": ["T1.2", "T1.5"],
  "T2.3": ["T1.1"],
};

const PHASE_LABELS = {
  "T0.1": "Normalizing document",
  "T0.2": "Analyzing text metrics",
  "T1.1": "Building document structure",
  "T1.2": "Indexing concepts",
  "T1.3": "Building concept graph",
  "T1.4": "Computing block recommendation",
  "T1.5": "Recommending study flow",
  "T1.6": "Linking vault concepts",
  "T1.7": "Analyzing document figures",
  "T1.8": "Scoring concept novelty",
  "T1.9": "Computing project document similarity",
  "T2.1": "Generating Cloze items",
  "T2.2": "Generating Recall questions",
  "T2.3": "Preparing Slow orientation",
};

function djb2Hex(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * @param {object} doc
 * @param {{ studyNotes?: string }} [options]
 */
export function computePreparationFingerprint(doc, options = {}) {
  const markdown = String(doc?.shared?.rawMarkdown || "");
  const notes = String(options.studyNotes ?? "").trim();
  const normalized = normalizeMarkdownForHash(markdown);
  return djb2Hex(`${normalized}#${notes}`);
}

function hashPayload(value) {
  try {
    return djb2Hex(JSON.stringify(value));
  } catch {
    return djb2Hex(String(value));
  }
}

function getMarkdown(doc) {
  return String(doc?.shared?.rawMarkdown || "").trim();
}

async function persistDoc(doc) {
  await saveActiveSession(doc);
  return doc;
}

function ensurePreparation(doc) {
  if (!doc.shared) doc.shared = {};
  doc.shared.preparation = normalizePreparationState(doc.shared.preparation);
  return doc.shared.preparation;
}

function phaseSucceeded(prep, phaseId, fingerprint) {
  const row = prep.phaseResults?.[phaseId];
  return (
    row?.status === "success" &&
    row?.outputHash &&
    prep.fingerprint === fingerprint
  );
}

function markPhase(prep, phaseId, status, outputHash, error) {
  if (!prep.phaseResults) prep.phaseResults = {};
  prep.phaseResults[phaseId] = {
    phaseId,
    status,
    completedAt: Date.now(),
    outputHash: outputHash || undefined,
    error: error ? String(error) : undefined,
  };
  prep.currentPhase = phaseId;
}

function tier1Complete(doc) {
  const inv = doc?.shared?.conceptInventory;
  return Array.isArray(inv) && inv.length > 0;
}

function resolveFinalStatus(prep, tier1Ok, stopAfterTier) {
  const results = prep.phaseResults || {};
  const failed = Object.values(results).filter((r) => r?.status === "failed");
  if (!tier1Ok) {
    prep.status = failed.length ? "failed" : "partial";
    return;
  }
  if (stopAfterTier === 1) {
    prep.status = failed.length ? "partial" : "ready";
    return;
  }
  const tier2Ids = ["T2.1", "T2.2", "T2.3"];
  const tier2Failed = tier2Ids.some((id) => results[id]?.status === "failed");
  prep.status = tier2Failed || failed.length ? "partial" : "ready";
}

async function runPhaseT01(doc, ctx) {
  const text = getMarkdown(doc);
  if (!text) throw new Error("T0.1: empty document");
  return hashPayload(text.slice(0, 200));
}

async function runPhaseT02(doc, ctx) {
  const metrics = analyzeText(getMarkdown(doc));
  doc.shared.textMetrics = metrics;
  return hashPayload(metrics);
}

async function runPhaseT11(doc, ctx) {
  const text = getMarkdown(doc);
  const hierarchy = await buildDocumentHierarchy(text, null, {
    useCache: true,
    llmModel: ctx.llmModel,
  });
  doc.shared.docHierarchy = hierarchy;
  doc.shared.docTopics = Array.isArray(hierarchy?.topics) ? hierarchy.topics : [];
  return hashPayload(hierarchy);
}

async function runPhaseT12(doc, ctx) {
  if (
    doc.shared?.interviewSynthesisComplete === true &&
    Array.isArray(doc.shared.conceptInventory) &&
    doc.shared.conceptInventory.length > 0
  ) {
    return hashPayload(doc.shared.conceptInventory.length);
  }
  const text = getMarkdown(doc);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const invResult = await runConceptInventoryWithFallback(text, {
    llmModel: ctx.llmModel,
    language: ctx.language,
    studyNotes: ctx.studyNotes,
    docHierarchy: doc.shared.docHierarchy,
    wordCount,
    onProgress: (msg) => ctx.onProgress?.({ phaseId: "T1.2", label: msg, status: "running" }),
  });
  if (invResult.kind === "fallback_mono") {
    throw new Error("Concept inventory unavailable");
  }
  const inventory = invResult.inventory || [];
  doc.shared.conceptInventory = inventory;
  if (inventory.length) {
    await addConceptsToShared(
      doc.docId,
      inventory.map((c) => ({
        label: c.label || c.term,
        definition: c.definition || c.authorUsage || "",
        canonicalId: c.canonicalId || c.id,
        detectedBy: "dpp",
      })),
    );
  }
  return hashPayload(inventory.map((c) => c.canonicalId || c.id));
}

async function runPhaseT13(doc, ctx) {
  const graph = await generateEpistemicGraph(getMarkdown(doc), {
    llmModel: ctx.llmModel,
    signal: ctx.signal,
  });
  doc.shared.conceptGraph = graph;
  promoteGraphConnectionsToRegistry(doc, graph);
  return hashPayload({ nodes: graph.nodes?.length, edges: graph.edges?.length });
}

async function runPhaseT14(doc) {
  const inventory = doc.shared.conceptInventory || [];
  const textMetrics = doc.shared.textMetrics || analyzeText(getMarkdown(doc));
  const hierarchy = doc.shared.docHierarchy;
  const pedagogicalMeta =
    hierarchy?.pedagogical_meta || buildDeterministicPedagogicalMeta(textMetrics);
  const signals = {
    conceptCount: inventory.length,
    wordCount: textMetrics.wordCount || 0,
    sectionCount: hierarchy?.tree?.length || 0,
    conceptualLoad: pedagogicalMeta.conceptualLoad,
    argumentativeDensity: pedagogicalMeta.argumentativeDensity,
    genre: pedagogicalMeta.genre,
    firstPersonRatio: textMetrics.contentSignals?.firstPersonRatio || 0,
    sizeCategory: textMetrics.sizeCategory,
  };
  const recommendation = computeBlockCountRecommendation(signals);
  doc.shared.blockRecommendation = {
    nBlocks: recommendation.nBlocks,
    rationale: recommendation.rationale,
    computedAt: Date.now(),
    signals: recommendation,
  };
  return hashPayload(doc.shared.blockRecommendation);
}

async function runPhaseT15(doc, ctx) {
  const text = getMarkdown(doc);
  const textMetrics = doc.shared.textMetrics || analyzeText(text);
  const hierarchy = doc.shared.docHierarchy;
  const pedagogicalMeta =
    hierarchy?.pedagogical_meta || buildDeterministicPedagogicalMeta(textMetrics);
  const method = hierarchy?.method === "llm" ? "llm_meta" : "deterministic";
  const recommendation = computeModeRecommendation(textMetrics, pedagogicalMeta, { method });
  doc.shared.modeRecommendation = recommendation;
  await updateRecommendation(doc.docId, recommendation);
  return hashPayload(recommendation.primaryFlow);
}

async function runPhaseT16(doc) {
  const inventory = doc.shared.conceptInventory || [];
  for (const entry of inventory) {
    const name = String(entry?.label || entry?.term || "").trim();
    const entryId = String(entry?.canonicalId || entry?.id || "").trim();
    if (!name || entry.globalConceptId) continue;
    try {
      const { conceptId } = await resolveGlobalConcept({
        canonicalName: name,
        description: String(entry?.definition || "").trim(),
        sourceDocId: doc.docId,
        inventoryEntryId: entryId,
      });
      backfillGlobalConceptIds(doc, conceptId, entryId);
    } catch (err) {
      console.warn("[dpp] vault link failed", name, err?.message || err);
    }
  }
  persistDoc(doc);
  return hashPayload(inventory.map((c) => c.globalConceptId || c.canonicalId));
}

async function runPhaseT17(doc, ctx) {
  const images = doc.shared?.images;
  if (!Array.isArray(images) || !images.length) {
    return hashPayload(0);
  }
  const pending = images.filter((img) => img.visionStatus === "pending");
  if (!pending.length) {
    return hashPayload(images.map((img) => img.imageId));
  }
  const { runImageVisionAnalysis } = await import("./document-images/vision.js");
  const result = await runImageVisionAnalysis(doc, {
    llmModel: ctx.llmModel,
    language: ctx.language,
    onProgress: (msg) =>
      ctx.onProgress?.({ phaseId: "T1.7", label: msg, status: "running" }),
  });
  return hashPayload({ analyzed: result.analyzed, failed: result.failed });
}

async function runPhaseT18(doc, ctx) {
  if (!isVaultEmbeddingsEnabled()) {
    return { skipped: true, hash: "embeddings_disabled" };
  }
  const result = await scoreConceptNovelty(doc);
  if (result.status === "skipped") {
    return { skipped: true, hash: result.reason || "skipped" };
  }
  resetContradictionCheckBudget();
  const dedup = await runDedupForDocument(doc);
  if (dedup.status !== "skipped" && Array.isArray(dedup.proposals)) {
    const filtered = await filterProposalsWithContradictionCheck(dedup.proposals, {
      llmModel: ctx?.llmModel,
    });
    doc.shared.mergeProposals = filtered.map((p) => ({ ...p, status: "pending" }));
  }
  persistDoc(doc);
  return hashPayload({
    novelty: (doc.shared.conceptInventory || []).map((c) => [c.canonicalId, c.noveltyScore]),
    proposals: doc.shared?.mergeProposals?.length ?? 0,
  });
}

async function runPhaseT19(doc) {
  if (!isVaultEmbeddingsEnabled()) {
    return { skipped: true, hash: "embeddings_disabled" };
  }
  const sim = await runDocumentSimilarityForProject(doc);
  if (sim.status === "skipped") {
    return { skipped: true, hash: sim.reason || "doc_similarity_skipped" };
  }
  persistDoc(doc);
  return hashPayload({ pairs: sim.pairs ?? 0 });
}

async function runPhaseT21(doc, ctx) {
  const text = getMarkdown(doc);
  const meta = doc.shared?.uploadMeta || {};
  const session = {
    studyMode: "cloze",
    llmModel: ctx.llmModel,
    language: ctx.language,
    materialMeta: meta,
    cloze: {
      normalizedText: text,
      normalizedFormat: "markdown",
      pipelineStatus: "generating",
      epistemicGraph: doc.shared.conceptGraph || null,
      items: [],
    },
  };
  const result = await runClozePipelinePhases(text, session, {
    signal: ctx.signal,
    onPhase: (idx, key, payload) => {
      ctx.onProgress?.({
        phaseId: "T2.1",
        label: `Cloze ${key} (${idx + 1}/5)`,
        status: "running",
      });
      if (payload?.epistemicGraph?.nodes?.length) {
        doc.shared.conceptGraph = payload.epistemicGraph;
      }
    },
  });
  if (result.epistemicGraph?.nodes?.length) {
    doc.shared.conceptGraph = result.epistemicGraph;
  }
  const validItems = getValidItems(result.items || []);
  if (!doc.modes) doc.modes = {};
  doc.modes.cloze = {
    studyMode: "cloze",
    llmModel: ctx.llmModel,
    language: ctx.language,
    materialMeta: meta,
    cloze: {
      normalizedText: text,
      normalizedFormat: "markdown",
      pipelineStatus: validItems.length ? "ready" : "failed",
      epistemicGraph: result.epistemicGraph,
      analysis: result.analysis,
      items: result.items || [],
      studyIndex: 0,
      studyStats: { correct: 0, shown: 0 },
    },
  };
  if (!validItems.length) throw new Error("Cloze pipeline produced no valid items");
  return hashPayload(validItems.map((i) => i.id));
}

async function runPhaseT22(doc, ctx) {
  const slice = await generateRecallSliceForDoc(doc, {
    llmModel: ctx.llmModel,
    language: ctx.language,
  });
  if (!doc.modes) doc.modes = {};
  doc.modes.recall = slice;
  return hashPayload(slice.questions?.map((q) => q.id));
}

async function runPhaseT23(doc, ctx) {
  if (isInterviewOriginSession(doc)) {
    return hashPayload("skipped-interview-origin");
  }
  const text = getMarkdown(doc);
  const meta = doc.shared?.uploadMeta || {};
  const slowSession = {
    studyMode: "slow",
    llmModel: ctx.llmModel,
    slow: {
      normalizedText: text,
      normalizedFormat: "markdown",
      criticalMode: false,
    },
    docHierarchy: doc.shared.docHierarchy,
  };
  const orientation = await generatePhase0ForScope(text, slowSession, {
    llmModel: ctx.llmModel,
    signal: ctx.signal,
  });
  doc.shared.slowOrientation = {
    fingerprint: computePreparationFingerprint(doc, ctx),
    scopeKey: "full_document",
    payload: orientation,
    generatedAt: Date.now(),
  };
  return hashPayload(orientation?.conceptsToFind?.length || 0);
}

const PHASE_RUNNERS = {
  "T0.1": runPhaseT01,
  "T0.2": runPhaseT02,
  "T1.1": runPhaseT11,
  "T1.2": runPhaseT12,
  "T1.3": runPhaseT13,
  "T1.4": runPhaseT14,
  "T1.5": runPhaseT15,
  "T1.6": runPhaseT16,
  "T1.7": runPhaseT17,
  "T1.8": runPhaseT18,
  "T1.9": runPhaseT19,
  "T2.1": runPhaseT21,
  "T2.2": runPhaseT22,
  "T2.3": runPhaseT23,
};

function phasesForStopTier(stopAfterTier) {
  const all = Object.keys(PHASE_RUNNERS);
  if (stopAfterTier <= 0) return all.filter((id) => id.startsWith("T0."));
  if (stopAfterTier === 1) return all.filter((id) => !id.startsWith("T2."));
  return all;
}

function buildWaves(phaseIds) {
  const remaining = new Set(phaseIds);
  const waves = [];
  while (remaining.size) {
    const wave = [];
    for (const id of remaining) {
      const deps = PHASE_DEPS[id] || [];
      if (deps.every((d) => !remaining.has(d))) wave.push(id);
    }
    if (!wave.length) break;
    waves.push(wave);
    for (const id of wave) remaining.delete(id);
  }
  return waves;
}

async function executePhase(doc, phaseId, ctx) {
  const runner = PHASE_RUNNERS[phaseId];
  if (!runner) throw new Error(`Unknown phase ${phaseId}`);
  return runner(doc, ctx);
}

/**
 * @param {object} doc
 * @param {object} [options]
 */
export async function runDocumentPreparationPipeline(doc, options = {}) {
  if (!doc?.docId) throw new Error("DPP requires docId");
  const stopAfterTier = options.stopAfterTier ?? 2;
  const fingerprint = computePreparationFingerprint(doc, options);
  const prep = ensurePreparation(doc);
  prep.fingerprint = fingerprint;
  prep.status = "running";
  prep.startedAt = prep.startedAt || Date.now();
  prep.errors = prep.errors || [];

  const ctx = {
    llmModel: options.llmModel,
    language: options.language || "English",
    studyNotes: options.studyNotes || "",
    signal: options.signal,
    onProgress: options.onProgress,
  };

  if (isOfflineMode()) {
    prep.status = "partial";
    prep.completedAt = Date.now();
    persistDoc(doc);
    return { doc, status: prep.status, phaseResults: prep.phaseResults, errors: prep.errors };
  }

  try {
    assertLlmKeyPresent();
  } catch (err) {
    prep.status = "partial";
    prep.errors.push({ phaseId: "T1.1", message: err?.message || "API key required", at: Date.now() });
    persistDoc(doc);
    return { doc, status: prep.status, phaseResults: prep.phaseResults, errors: prep.errors };
  }

  const phaseIds = phasesForStopTier(stopAfterTier);
  const waves = buildWaves(phaseIds);
  prep.waves = waves.map((phaseIdsInWave, i) => ({ wave: i + 1, phaseIds: phaseIdsInWave }));

  for (let wi = 0; wi < waves.length; wi += 1) {
    const wave = waves[wi];
    prep.currentWave = wi + 1;
    const runnable = options.resume !== false
      ? wave.filter((id) => !phaseSucceeded(prep, id, fingerprint))
      : wave;

    const results = await Promise.allSettled(
      runnable.map(async (phaseId) => {
        options.onProgress?.({
          phaseId,
          wave: wi + 1,
          label: PHASE_LABELS[phaseId] || phaseId,
          status: "running",
        });
        try {
          const output = await executePhase(doc, phaseId, ctx);
          if (output && typeof output === "object" && output.skipped) {
            markPhase(prep, phaseId, "skipped", output.hash || "skipped");
          } else {
            markPhase(prep, phaseId, "success", output);
          }
          persistDoc(doc);
          options.onProgress?.({
            phaseId,
            wave: wi + 1,
            label: PHASE_LABELS[phaseId] || phaseId,
            status: output?.skipped ? "skipped" : "success",
          });
          return { phaseId, ok: true };
        } catch (err) {
          const message = err?.message || String(err);
          markPhase(prep, phaseId, "failed", null, message);
          prep.errors.push({ phaseId, message, at: Date.now() });
          persistDoc(doc);
          options.onProgress?.({
            phaseId,
            wave: wi + 1,
            label: PHASE_LABELS[phaseId] || phaseId,
            status: "failed",
            error: message,
          });
          return { phaseId, ok: false, error: message };
        }
      }),
    );
    void results;
  }

  for (const id of phaseIds) {
    if (!prep.phaseResults[id] && phaseSucceeded(prep, id, fingerprint)) {
      markPhase(prep, id, "skipped", prep.phaseResults[id]?.outputHash);
    }
  }

  prep.completedAt = Date.now();
  prep.currentPhase = null;
  resolveFinalStatus(prep, tier1Complete(doc), stopAfterTier);
  persistDoc(doc);
  return { doc, status: prep.status, phaseResults: prep.phaseResults, errors: prep.errors };
}

/**
 * @param {string} docId
 * @param {object} [options]
 */
export async function runDocumentPreparationForDocId(docId, options = {}) {
  const doc = await getSession(docId);
  if (!doc) throw new Error("session not found");
  return runDocumentPreparationPipeline(doc, options);
}

/**
 * @param {object} doc
 * @param {object} [options]
 */
export async function retryFailedPreparationPhases(doc, options = {}) {
  const prep = ensurePreparation(doc);
  const failed = Object.entries(prep.phaseResults || {})
    .filter(([, r]) => r?.status === "failed")
    .map(([id]) => id);
  if (!failed.length) return runDocumentPreparationPipeline(doc, { ...options, resume: true });
  const dependents = new Set(failed);
  for (const [id, deps] of Object.entries(PHASE_DEPS)) {
    if (deps.some((d) => failed.includes(d))) dependents.add(id);
  }
  for (const id of dependents) {
    if (prep.phaseResults[id]) delete prep.phaseResults[id];
  }
  return runDocumentPreparationPipeline(doc, { ...options, resume: false });
}

export function getPreparationBadgeLabel(doc) {
  const status = normalizePreparationState(doc?.shared?.preparation).status;
  if (status === "ready") return "Ready";
  if (status === "running") return "Preparing";
  if (status === "partial") return "Partial";
  if (status === "failed") return "Failed";
  if (status === "legacy") return "";
  if (status === "pending") return "Preparing";
  return "";
}

const TIER2_PHASE_IDS = ["T2.1", "T2.2", "T2.3"];
/** @type {Map<string, Promise<{ doc?: object } | object>>} */
const tier1InFlight = new Map();

function tier2PhasesPending(doc, fingerprint) {
  const prep = ensurePreparation(doc);
  return TIER2_PHASE_IDS.some((id) => !phaseSucceeded(prep, id, fingerprint));
}

/**
 * Await Tier 1 DPP; dedupes concurrent runs per docId.
 * @param {object} doc
 * @param {object} [options]
 */
export async function ensureTier1Preparation(doc, options = {}) {
  if (!doc?.docId) return null;
  if (isTier1PreparationComplete(doc)) return doc;

  const docId = doc.docId;
  let flight = tier1InFlight.get(docId);
  if (!flight) {
    flight = runDocumentPreparationPipeline(doc, {
      ...options,
      stopAfterTier: 1,
    }).finally(() => {
      tier1InFlight.delete(docId);
    });
    tier1InFlight.set(docId, flight);
  }
  const result = await flight;
  return result?.doc ?? doc;
}

/**
 * Run Tier 2 phases without blocking UI when Tier 1 is complete.
 * @param {object} doc
 * @param {object} [options]
 */
export function kickoffTier2PreparationInBackground(doc, options = {}) {
  if (!doc?.docId || !isTier1PreparationComplete(doc)) return;
  const fingerprint = computePreparationFingerprint(doc, options);
  if (!tier2PhasesPending(doc, fingerprint)) return;
  void runDocumentPreparationPipeline(doc, { ...options, stopAfterTier: 2 });
}

export function hasPendingTier2Preparation(doc, options = {}) {
  if (!doc?.docId || !isTier1PreparationComplete(doc)) return false;
  const fingerprint = computePreparationFingerprint(doc, options);
  return tier2PhasesPending(doc, fingerprint);
}

export { TIER1_PHASES, PHASE_LABELS };
