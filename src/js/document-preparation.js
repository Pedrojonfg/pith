/**
 * Document Preparation Pipeline (DPP) — upload-time shared artifact orchestration.
 * @see specs/20260618-document-preparation-frontload/contracts/dpp-orchestrator.md
 */

import { analyzeText } from "./recommendation/analyzer.js";
import { computeBlockCountRecommendation } from "./recommendation/block-count-recommender.js";
import { buildDocumentHierarchy, buildDeterministicPedagogicalMeta } from "./normalization/hierarchy.js";
import { buildDocumentHierarchyWithLlm } from "./hierarchy-llm.js";
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
import { runConceptInventoryWithFallback, isConceptInventoryValid, runDedupedDppFlight, meetsConceptInventoryThreshold, repairStuckRunningPreparationIfNeeded } from "./session.js";
import { getSupabaseAuthToken } from "./llm.js?v=20260625_02";
import { isOfflineMode } from "./offline.js";
import { isVaultEmbeddingsEnabled } from "./vault/embeddings.js";
import { scoreConceptNovelty } from "./vault/novelty-scoring.js";
import {
  classifyInventoryHeuristic,
  applyBatchClassification,
} from "./pedagogy/factual-classifier.js";
import { tagThresholdConceptsInInventory } from "./pedagogy/threshold-concepts.js";
import { isDeterministicFactualQuestionsEnabled, getPedagogicalFlags, minViableConcepts, MIN_CONCEPTS_ABSOLUTE, isThresholdConceptsEnabled } from "./config/flags.js";
import { runDedupForDocument } from "./concept-registry/dedup-gates.js";
import {
  filterProposalsWithContradictionCheck,
  resetContradictionCheckBudget,
} from "./vault/contradiction-check.js";
import { runDocumentSimilarityForProject } from "./vault/doc-similarity.js";
import { getSession } from "./session-store.js";
import {
  clearDppRun,
  deepCloneSession,
  generateRunId,
  persistCheckpoint,
  persistFinal,
  registerDppRun,
  commitPreparedDocToStore,
  hydrateCallerDocFromPrepared,
} from "./dpp-persistence.js";
import {
  createEmptyPreparationState,
  normalizePreparationState,
  normalizeMarkdownForHash,
  isTier1PreparationComplete,
  hasTier1Artifacts,
  setPreparationStatus,
} from "./session-types.js";
import { USER_SPECIFIC_DPP_PHASES } from "./shared-dpp-cache.js";

const TIER1_PHASES = new Set(["T1.1", "T1.2", "T1.3", "T1.4", "T1.5", "T1.6", "T1.7", "T1.8", "T1.9"]);
/** Gate-critical Tier 1 — unlocks mode select (matches hasTier1Artifacts). */
const TIER1_GATE_PHASE_IDS = ["T0.1", "T0.2", "T1.1", "T1.2", "T1.4", "T1.5"];
const TIER1_GATE_PHASES = new Set(TIER1_GATE_PHASE_IDS);
/** Deferred Tier 1 — vault, graph, novelty; background after gate. */
const TIER1_DEFERRED_PHASE_IDS = ["T1.3", "T1.6", "T1.7", "T1.8", "T1.9"];
const TIER1_DEFERRED_PHASES = new Set(TIER1_DEFERRED_PHASE_IDS);
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
  "T2.3": ["T1.2", "T1.4", "T1.5"],
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

/** Finalize preparation status and persist — sole exit write for a DPP run. */
async function finalizeAndPersist(doc, prep, stopAfterTier) {
  prep.completedAt = prep.completedAt || Date.now();
  prep.currentPhase = null;
  prep.currentWave = null;
  resolveFinalStatus(prep, doc, stopAfterTier);
  await persistFinal(doc);
  return doc;
}

const CHECKPOINT_PHASES = new Set(["T1.1", "T1.2"]);

function ensurePreparation(doc) {
  if (!doc.shared) doc.shared = {};
  doc.shared.preparation = normalizePreparationState(doc.shared.preparation);
  return doc.shared.preparation;
}

function phaseSucceeded(prep, phaseId, fingerprint) {
  const row = prep.phaseResults?.[phaseId];
  const terminal =
    row?.status === "success" ||
    row?.status === "partial" ||
    row?.status === "skipped";
  return terminal && row?.outputHash && prep.fingerprint === fingerprint;
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

function allTier1PhasesComplete(prep, fingerprint, stopAfterTier) {
  const tier1Ids = phasesForStopTier(Math.min(stopAfterTier, 1));
  return tier1Ids.every((id) => {
    const row = prep.phaseResults?.[id];
    return (
      row?.status === "success" ||
      row?.status === "partial" ||
      row?.status === "skipped" ||
      phaseSucceeded(prep, id, fingerprint)
    );
  });
}

function resolveFinalStatus(prep, doc, stopAfterTier) {
  const results = prep.phaseResults || {};
  const failed = Object.values(results).filter((r) => r?.status === "failed");
  const tier1Ok = hasTier1Artifacts(doc);
  if (!tier1Ok) {
    setPreparationStatus(prep, failed.length ? "failed" : "partial");
    return;
  }
  if (stopAfterTier === 1) {
    setPreparationStatus(prep, failed.length ? "partial" : "ready");
    return;
  }
  const tier2Ids = ["T2.1", "T2.2", "T2.3"];
  const tier2Failed = tier2Ids.some((id) => results[id]?.status === "failed");
  setPreparationStatus(prep, tier2Failed || failed.length ? "partial" : "ready");
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
  const hierarchy = await buildDocumentHierarchyWithLlm(text, {
    useCache: true,
    llmModel: ctx.llmModel,
    signal: ctx.signal,
  });
  doc.shared.docHierarchy = hierarchy;
  doc.shared.docTopics = Array.isArray(hierarchy?.topics) ? hierarchy.topics : [];
  return hashPayload(hierarchy);
}

async function ensureThresholdTagsOnInventory(doc, ctx) {
  if (!isThresholdConceptsEnabled() || !doc?.shared?.conceptInventory?.length) return;
  doc.shared.conceptInventory = await tagThresholdConceptsInInventory(
    doc.shared.conceptInventory,
    { llmModel: ctx.llmModel, lang: ctx.language || "English" },
  );
}

async function runPhaseT12(doc, ctx) {
  if (
    doc.shared?.interviewSynthesisComplete === true &&
    Array.isArray(doc.shared.conceptInventory) &&
    doc.shared.conceptInventory.length > 0
  ) {
    await ensureThresholdTagsOnInventory(doc, ctx);
    return hashPayload(doc.shared.conceptInventory.length);
  }
  if (!ctx.forceRerun && isConceptInventoryValid(doc)) {
    const inv = doc.shared.conceptInventory;
    const charCount = doc.shared?.docMeta?.charCount ?? 0;
    console.log(
      `[DPP-GUARD] isConceptInventoryValid → TRUE (${inv.length} concepts, charCount ${charCount}). Skipping recalculation.`,
    );
    await ensureThresholdTagsOnInventory(doc, ctx);
    return hashPayload(inv.length);
  }
  const text = getMarkdown(doc);
  const charCount =
    Number(doc.shared?.docMeta?.charCount) ||
    Number(doc.shared?.textMetrics?.charCount) ||
    text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const prep = ensurePreparation(doc);
  const invResult = await runConceptInventoryWithFallback(text, {
    llmModel: ctx.llmModel,
    language: ctx.language,
    studyNotes: ctx.studyNotes,
    docHierarchy: doc.shared.docHierarchy,
    wordCount,
    charCount,
    onProgress: (msg) => ctx.onProgress?.({ phaseId: "T1.2", label: msg, status: "running" }),
  });
  console.debug("[document-preparation.runPhaseT12] Inventory result:", {
    docId: doc.docId,
    kind: invResult.kind,
    conceptCount: invResult.kind === "inventory" ? invResult.inventory?.length : 0,
    inventoryMode: invResult.inventoryMode,
    chunkCount: invResult.chunkCount,
    failedChunks: invResult.failedChunks,
  }); // [debug-enrich]
  if (invResult.kind === "fallback_mono") {
    doc.shared.conceptInventory = [];
    prep.failReason = "INVENTORY_MERGE_FAILED";
    throw new Error("Concept inventory unavailable");
  }
  const inventory = invResult.inventory || [];
  const minRequired = minViableConcepts(charCount);
  if (inventory.length < minRequired) {
    doc.shared.conceptInventory = inventory;
    if (inventory.length >= MIN_CONCEPTS_ABSOLUTE) {
      prep.failReason = "INVENTORY_TOO_SPARSE";
      setPreparationStatus(prep, "partial");
      console.warn("[document-preparation.runPhaseT12] Degraded inventory:", {
        docId: doc.docId,
        conceptCount: inventory.length,
        minRequired,
      });
    } else {
      prep.failReason = inventory.length === 0 ? "INVENTORY_MERGE_FAILED" : "INVENTORY_TOO_SPARSE";
      throw new Error(
        `Concept inventory too sparse: ${inventory.length} concepts (minimum ${minRequired})`,
      );
    }
  } else {
    doc.shared.conceptInventory = inventory;
    prep.failReason = null;
  }
  if (inventory.length && isDeterministicFactualQuestionsEnabled()) {
    const sourceText = getMarkdown(doc);
    const flags = getPedagogicalFlags();
    const { inventory: classified, ambiguous } = classifyInventoryHeuristic(
      inventory,
      sourceText,
      { threshold: flags.FACTUAL_CLASSIFIER_LLM_THRESHOLD },
    );
    doc.shared.conceptInventory = applyBatchClassification(classified, {});
    for (const entry of doc.shared.conceptInventory) {
      if (!entry.questionClass) entry.questionClass = "conceptual";
    }
    void ambiguous;
  }
  if (isThresholdConceptsEnabled() && doc.shared.conceptInventory?.length) {
    await ensureThresholdTagsOnInventory(doc, ctx);
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
      await backfillGlobalConceptIds(doc, conceptId, entryId, { persist: false });
    } catch (err) {
      console.warn("[dpp] vault link failed", name, err?.message || err);
    }
  }
  return hashPayload(inventory.map((c) => c.globalConceptId || c.canonicalId));
}

async function runPhaseT17(doc, ctx) {
  const images = doc.shared?.images;
  if (!Array.isArray(images) || !images.length) {
    return hashPayload(0);
  }
  if (!meetsConceptInventoryThreshold(doc)) {
    console.log("[vision] Skipping T1.7 — concept inventory below viability threshold.");
    for (const image of images) {
      if (image.visionStatus === "pending") {
        image.visionStatus = "skipped";
        image.visionDescription = null;
      }
    }
    return hashPayload("skipped-no-inventory");
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
  const allItems = result.items || [];
  const validItems = getValidItems(allItems);
  const pipelineStatus = validItems.length ? "ready" : "degraded";
  console.info("[document-preparation.runPhaseT21] Cloze pipeline counts:", {
    docId: doc.docId,
    baseItems: result.diagnostics?.baseCount ?? allItems.length,
    postDistractor: result.diagnostics?.postDistractorCount ?? allItems.length,
    postQa: result.diagnostics?.postQaCount ?? allItems.length,
    valid: validItems.length,
    pipelineStatus,
  });
  if (!doc.modes) doc.modes = {};
  doc.modes.cloze = {
    studyMode: "cloze",
    llmModel: ctx.llmModel,
    language: ctx.language,
    materialMeta: meta,
    cloze: {
      normalizedText: text,
      normalizedFormat: "markdown",
      pipelineStatus,
      epistemicGraph: result.epistemicGraph,
      analysis: result.analysis,
      items: allItems,
      studyIndex: 0,
      studyStats: { correct: 0, shown: 0 },
    },
  };
  if (!validItems.length) {
    const prep = ensurePreparation(doc);
    prep.failReason = prep.failReason || "CLOZE_NO_VALID_ITEMS";
    return { partial: true, hash: hashPayload("cloze_degraded") };
  }
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
  if (stopAfterTier === 1) return [...TIER1_GATE_PHASE_IDS];
  return all;
}

export function buildWaves(phaseIds) {
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
  return runDedupedDppFlight(
    doc.docId,
    () => runDocumentPreparationPipelineInner(doc, options),
    { force: options.forceRerun === true },
  );
}

async function runDocumentPreparationPipelineInner(doc, options = {}) {
  if (!doc?.docId) throw new Error("DPP requires docId");
  const workingDoc = deepCloneSession(doc);
  const stopAfterTier = options.stopAfterTier ?? 2;
  const fingerprint = computePreparationFingerprint(workingDoc, options);
  console.info("[document-preparation.runDocumentPreparationPipeline] Start:", {
    docId: workingDoc.docId,
    stopAfterTier,
    forceRerun: options.forceRerun === true,
    fingerprint: fingerprint.slice(0, 12),
    charCount: String(workingDoc?.shared?.rawMarkdown || "").length,
    priorStatus: workingDoc?.shared?.preparation?.status,
  }); // [debug-enrich]
  const prep = ensurePreparation(workingDoc);
  prep.fingerprint = fingerprint;
  prep.runId = generateRunId();
  setPreparationStatus(prep, "running");
  prep.startedAt = Date.now();
  prep.errors = prep.errors || [];
  registerDppRun(workingDoc.docId, prep.runId);

  try {
    await persistCheckpoint(workingDoc);
  } catch (err) {
    clearDppRun(workingDoc.docId);
    throw err;
  }

  const ctx = {
    llmModel: options.llmModel,
    language: options.language || "English",
    studyNotes: options.studyNotes || "",
    signal: options.signal,
    onProgress: options.onProgress,
    forceRerun: options.forceRerun === true,
  };

  if (isOfflineMode()) {
    console.warn("[document-preparation.runDocumentPreparationPipeline] Offline — stopping after Tier 0", {
      docId: workingDoc.docId,
    }); // [debug-enrich]
    await finalizeAndPersist(workingDoc, prep, stopAfterTier);
    return {
      doc: workingDoc,
      status: prep.status,
      phaseResults: prep.phaseResults,
      errors: prep.errors,
    };
  }

  try {
    const token = await getSupabaseAuthToken();
    if (!token) throw new Error("Sign in to use AI features.");
  } catch (err) {
    console.warn("[document-preparation.runDocumentPreparationPipeline] Auth unavailable — partial prep only:", {
      docId: workingDoc.docId,
      message: err?.message || String(err),
    }); // [debug-enrich]
    setPreparationStatus(prep, "partial");
    prep.errors.push({ phaseId: "T1.1", message: err?.message || "Sign in required", at: Date.now() });
    await finalizeAndPersist(workingDoc, prep, stopAfterTier);
    return {
      doc: workingDoc,
      status: prep.status,
      phaseResults: prep.phaseResults,
      errors: prep.errors,
    };
  }

  const phaseIds = phasesForStopTier(stopAfterTier);
  const waves = buildWaves(phaseIds);
  prep.waves = waves.map((phaseIdsInWave, i) => ({ wave: i + 1, phaseIds: phaseIdsInWave }));
  let tier1CheckpointDone = false;

  try {
    for (let wi = 0; wi < waves.length; wi += 1) {
      const wave = waves[wi];
      prep.currentWave = wi + 1;
      const runnable = options.resume !== false
        ? wave.filter((id) => !phaseSucceeded(prep, id, fingerprint))
        : wave;
      console.debug("[document-preparation.runDocumentPreparationPipeline] Wave start:", {
        docId: workingDoc.docId,
        wave: wi + 1,
        totalWaves: waves.length,
        runnablePhases: runnable,
        skippedPhases: wave.filter((id) => !runnable.includes(id)),
      }); // [debug-enrich]

      const results = await Promise.allSettled(
        runnable.map(async (phaseId) => {
          console.debug("[document-preparation.executePhase] Start:", { docId: workingDoc.docId, phaseId }); // [debug-enrich]
          options.onProgress?.({
            phaseId,
            wave: wi + 1,
            label: PHASE_LABELS[phaseId] || phaseId,
            status: "running",
          });
          try {
            const output = await executePhase(workingDoc, phaseId, ctx);
            if (output && typeof output === "object" && output.skipped) {
              markPhase(prep, phaseId, "skipped", output.hash || "skipped");
              console.info("[document-preparation.executePhase] Skipped:", { docId: workingDoc.docId, phaseId }); // [debug-enrich]
            } else if (output && typeof output === "object" && output.partial) {
              markPhase(prep, phaseId, "partial", output.hash || "partial");
              console.warn("[document-preparation.executePhase] Partial:", { docId: workingDoc.docId, phaseId }); // [debug-enrich]
            } else {
              markPhase(prep, phaseId, "success", output);
              console.info("[document-preparation.executePhase] Success:", {
                docId: workingDoc.docId,
                phaseId,
                outputHash: typeof output === "string" ? output.slice(0, 12) : null,
              }); // [debug-enrich]
            }
            options.onProgress?.({
              phaseId,
              wave: wi + 1,
              label: PHASE_LABELS[phaseId] || phaseId,
              status: output?.skipped ? "skipped" : output?.partial ? "partial" : "success",
            });
            return { phaseId, ok: true };
          } catch (err) {
            const message = err?.message || String(err);
            console.error("[document-preparation.executePhase] Failed:", {
              docId: workingDoc.docId,
              phaseId,
              message,
              stack: err?.stack,
            }); // [debug-enrich]
            markPhase(prep, phaseId, "failed", null, message);
            prep.errors.push({ phaseId, message, at: Date.now() });
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
      prep.updatedAt = Date.now();

      for (let ri = 0; ri < runnable.length; ri += 1) {
        const settled = results[ri];
        const phaseId = runnable[ri];
        if (settled.status === "fulfilled" && settled.value?.ok && CHECKPOINT_PHASES.has(phaseId)) {
          await persistCheckpoint(workingDoc);
        }
      }

      if (!tier1CheckpointDone && allTier1PhasesComplete(prep, fingerprint, stopAfterTier)) {
        await persistCheckpoint(workingDoc);
        tier1CheckpointDone = true;
      }

      void results;
    }

    for (const id of phaseIds) {
      if (!prep.phaseResults[id] && phaseSucceeded(prep, id, fingerprint)) {
        markPhase(prep, id, "skipped", prep.phaseResults[id]?.outputHash);
      }
    }
  } catch (err) {
    const message = err?.message || String(err);
    prep.errors.push({ phaseId: "pipeline", message, at: Date.now() });
    console.error("[document-preparation.runDocumentPreparationPipeline] Pipeline error before final status:", {
      docId: workingDoc.docId,
      message,
      stack: err?.stack,
    }); // [debug-enrich]
  } finally {
    await finalizeAndPersist(workingDoc, prep, stopAfterTier);
    console.info("[document-preparation.runDocumentPreparationPipeline] Finished:", {
      docId: workingDoc.docId,
      status: prep.status,
      failReason: prep.failReason || null,
      errorCount: prep.errors?.length || 0,
      conceptCount: workingDoc?.shared?.conceptInventory?.length ?? 0,
      phaseSummary: Object.fromEntries(
        Object.entries(prep.phaseResults || {}).map(([id, r]) => [id, r?.status]),
      ),
    }); // [debug-enrich]
  }

  return {
    doc: workingDoc,
    status: prep.status,
    phaseResults: prep.phaseResults,
    errors: prep.errors,
  };
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

function deferredTier1PhasesPending(doc, fingerprint) {
  const prep = ensurePreparation(doc);
  return TIER1_DEFERRED_PHASE_IDS.some((id) => !phaseSucceeded(prep, id, fingerprint));
}

/**
 * Await Tier 1 DPP; dedupes concurrent runs per docId.
 * @param {object} doc
 * @param {object} [options]
 */
export async function ensureTier1Preparation(doc, options = {}) {
  if (!doc?.docId) return null;
  if (!options.forceRerun && isTier1PreparationComplete(doc)) return doc;

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
  const prepared = result?.doc ?? doc;
  let reconciled = (await commitPreparedDocToStore(prepared)) ?? prepared;
  reconciled = (await repairStuckRunningPreparationIfNeeded(reconciled)) ?? reconciled;
  hydrateCallerDocFromPrepared(doc, reconciled);
  return reconciled;
}

/**
 * Run Tier 2 phases without blocking UI when Tier 1 is complete.
 * @param {object} doc
 * @param {object} [options]
 */
export function kickoffTier2PreparationInBackground(doc, options = {}) {
  if (!doc?.docId || !isTier1PreparationComplete(doc)) return;
  const fingerprint = computePreparationFingerprint(doc, options);
  const tier2Pending = tier2PhasesPending(doc, fingerprint);
  const deferredPending = deferredTier1PhasesPending(doc, fingerprint);
  if (!tier2Pending && !deferredPending) return;
  void runDocumentPreparationPipeline(doc, {
    ...options,
    stopAfterTier: 2,
    resume: options.resume !== false,
  }).catch((err) => {
    console.warn("[DPP] Background deferred/Tier-2 preparation failed:", err?.message || err);
  });
}

export function hasPendingTier2Preparation(doc, options = {}) {
  if (!doc?.docId || !isTier1PreparationComplete(doc)) return false;
  const fingerprint = computePreparationFingerprint(doc, options);
  return tier2PhasesPending(doc, fingerprint) || deferredTier1PhasesPending(doc, fingerprint);
}

/**
 * Run user/project-specific tier-1 phases after shared cache hydrate.
 * @param {object} doc
 * @param {object} [options]
 */
export async function runPostCacheUserPhases(doc, options = {}) {
  if (!doc?.docId || !isTier1PreparationComplete(doc)) return doc;
  const ctx = {
    llmModel: options.llmModel,
    language: options.language || "English",
    studyNotes: options.studyNotes || "",
    onProgress: options.onProgress,
    forceRerun: false,
  };
  const prep = ensurePreparation(doc);
  const fingerprint = computePreparationFingerprint(doc, options);
  for (const phaseId of USER_SPECIFIC_DPP_PHASES) {
    if (phaseSucceeded(prep, phaseId, fingerprint)) continue;
    const runner = PHASE_RUNNERS[phaseId];
    if (!runner) continue;
    ctx.onProgress?.({
      phaseId,
      label: PHASE_LABELS[phaseId] || phaseId,
      status: "running",
    });
    try {
      const output = await runner(doc, ctx);
      if (output && typeof output === "object" && output.skipped) {
        markPhase(prep, phaseId, "skipped", output.hash || "skipped");
      } else {
        markPhase(prep, phaseId, "success", output);
      }
      ctx.onProgress?.({
        phaseId,
        label: PHASE_LABELS[phaseId] || phaseId,
        status: "success",
      });
    } catch (err) {
      const message = err?.message || String(err);
      markPhase(prep, phaseId, "failed", null, message);
      prep.errors = prep.errors || [];
      prep.errors.push({ phaseId, message, at: Date.now() });
      ctx.onProgress?.({
        phaseId,
        label: PHASE_LABELS[phaseId] || phaseId,
        status: "failed",
        error: message,
      });
    }
  }
  await persistFinal(doc);
  return doc;
}

export {
  TIER1_PHASES,
  TIER1_GATE_PHASES,
  TIER1_DEFERRED_PHASES,
  PHASE_DEPS,
  PHASE_LABELS,
  buildWaves as buildDppWaves,
};
