/**
 * Document Preparation Pipeline (DPP) — upload-time shared artifact orchestration.
 * @see specs/20260618-document-preparation-frontload/contracts/dpp-orchestrator.md
 */

import { analyzeText } from "./recommendation/analyzer.js";
import { computeBlockCountRecommendation, applyBlockCountMultiplier } from "./recommendation/block-count-recommender.js";
import { buildDocumentHierarchy, buildDeterministicPedagogicalMeta } from "./normalization/hierarchy.js";
import { buildDocumentHierarchyWithLlm } from "./hierarchy-llm.js";
import { computeModeRecommendation } from "./recommendation/recommender.js";
import {
  computeOnboardingModeRecommendation,
  mapOnboardingRecommendationToModeRecommendation,
} from "./recommendation/onboarding-recommender.js";
import {
  getValidItems,
  runClozePipelinePhases,
  diagnoseClozePipelineFailure,
} from "./cloze/pipeline.js";
import { generateConceptRelations } from "./concept-graph/relations.js";
import { getConceptDisplayName, getConceptDefinition } from "./concept-graph/concept-display.js";
import { generatePhase0ForScope } from "./slow/phase0.js";
import { generateRecallSliceForDoc } from "./recall-study.js";
import { resolveGlobalConcept } from "./concept-registry/identity-resolution.js";
import { backfillGlobalConceptIds } from "./concept-registry/promotion.js";
import { promoteGraphConnectionsToRegistry } from "./concept-registry/connection-promotion.js";
import { isInterviewOriginSession } from "./interview/origin.js";
import { runConceptInventoryWithFallback, isConceptInventoryValid, runDedupedDppFlight, meetsConceptInventoryThreshold, repairStuckRunningPreparationIfNeeded, tryApplySocraticTurnCapOverride, cacheModeRecommendationParams } from "./session.js";
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
  hasTier1GateArtifacts,
  isScopeStructureReady,
  isScopeGateResolved,
  resolveScopedMarkdown,
  setPreparationStatus,
} from "./session-types.js";
import { USER_SPECIFIC_DPP_PHASES } from "./shared-dpp-cache.js";
import { peekNormalizationDebugBag } from "./input-normalization.js";
import { computeDocumentQualitySignal } from "./normalization/quality-signal.js";
import { computeConceptAnchorsForDocument } from "./concept-anchoring.js";
import { resolveScopedHierarchy } from "./normalization/scoped-hierarchy.js";
import { findPithImageTokenIds } from "./document-images/tokens.js";

/**
 * [debug-enrich] Emit consolidated normalization quality summary after T1.1.
 * @param {object} doc
 * @param {object} [hierarchy]
 */
function emitNormalizationQualitySummary(doc, hierarchy) {
  const bag = peekNormalizationDebugBag() || {};
  const images = Array.isArray(doc?.shared?.images) ? doc.shared.images : [];
  const imagesDetected = bag.imagesDetected ?? images.length;
  const imagesAnalyzed = images.filter((img) => img.visionStatus === "ready").length;
  const imagesFailed = images.filter((img) => img.visionStatus === "failed").length;
  const imagesSkipped = images.filter((img) => img.visionStatus === "skipped").length;
  const sampleSnippets = Array.isArray(bag.finalMarkdownSampleSnippets)
    ? bag.finalMarkdownSampleSnippets
    : []; // [debug-enrich]
  const summary = {
    docId: doc.docId,
    totalPages: bag.totalPages ?? 0,
    lowExtractionPages: Array.isArray(bag.lowExtractionPages) ? bag.lowExtractionPages.length : 0,
    lowExtractionPagesAfterVision: Array.isArray(bag.lowExtractionPagesAfterVision)
      ? bag.lowExtractionPagesAfterVision.length
      : null,
    visionFallbackPages: Array.isArray(bag.visionFallbackPages) ? bag.visionFallbackPages.length : 0,
    tablesDetected: bag.tablesDetected ?? 0,
    tablesEmittedOk: bag.tablesEmittedOk ?? 0,
    headingsInferred: bag.headingsInferred ?? doc?.shared?.docMeta?.headingCount ?? 0,
    headingsFallbackUsed: Boolean(bag.headingsFallbackUsed),
    headingInferenceDiagnostics: bag.headingInferenceDiagnostics ?? null,
    hierarchyMethod: hierarchy?.method ?? bag.hierarchyMethod ?? null,
    imagesDetected,
    imagesAnalyzed,
    imagesFailed,
    imagesSkipped,
    charsBeforeStrip: bag.charsBeforeStrip ?? 0,
    charsAfterStrip: bag.charsAfterStrip ?? 0,
    mathIndicatorsFound: bag.mathIndicatorsFound ?? 0,
    replacementCharsFound: bag.replacementCharsFound ?? 0,
    suspiciousStripRemovals: bag.suspiciousStripRemovals ?? 0,
    sampleSnippets,
  };
  console.info("[document-preparation] Normalization quality summary:", summary);

  const qualitySignal = computeDocumentQualitySignal({
    extractionConfidence: doc?.shared?.docMeta?.confidence || "low",
    totalPages: summary.totalPages,
    lowExtractionPageCount: summary.lowExtractionPages,
    lowExtractionPagesAfterVision: bag.lowExtractionPagesAfterVision ?? null,
    tablesDetected: summary.tablesDetected,
    tablesEmittedOk: summary.tablesEmittedOk,
    headingsFallbackUsed: summary.headingsFallbackUsed,
    charCount: String(doc?.shared?.rawMarkdown || "").length,
  });
  if (!doc.shared) doc.shared = {};
  const prepState = bindPreparationState(
    doc,
    normalizePreparationState(doc.shared.preparation),
  );
  prepState.qualitySignal = qualitySignal;
  console.info("[document-preparation] Document quality signal:", {
    docId: doc.docId,
    tier: qualitySignal.tier,
    reasons: qualitySignal.reasons,
    reasonDetails: qualitySignal.reasonDetails,
  }); // [debug-enrich]

  if ((summary.replacementCharsFound || 0) > 0 || (summary.suspiciousStripRemovals || 0) > 0) {
    console.warn("[document-preparation] Normalization math diagnostics warning:", {
      docId: summary.docId,
      replacementCharsFound: summary.replacementCharsFound,
      suspiciousStripRemovals: summary.suspiciousStripRemovals,
      sampleSnippets: summary.sampleSnippets,
    }); // [debug-enrich]
  } else if (
    (summary.totalPages || 0) >= 3 &&
    (summary.mathIndicatorsFound || 0) === 0 &&
    (bag.pagesWithReplacementChars || 0) === 0 &&
    (bag.pagesWithSuspiciousUnicode || 0) > 0
  ) {
    console.warn("[document-preparation] Potential silent math loss:", {
      docId: summary.docId,
      mathIndicatorsFound: summary.mathIndicatorsFound,
      pagesWithSuspiciousUnicode: bag.pagesWithSuspiciousUnicode,
      suspiciousUnicodeCharsFound: bag.suspiciousUnicodeCharsFound || 0,
      note: "Healthy char counts can still hide garbled/dropped formula glyphs (custom encodings)",
    }); // [debug-enrich]
  }

  return summary;
}

/** Phases through T1.1 — structure ready for universal scope gate. */
const SCOPE_PRE_PHASE_IDS = ["T0.1", "T0.2", "T1.1"];
const TIER1_PHASES = new Set(["T1.1", "T1.2", "T1.3", "T1.4", "T1.5", "T1.6", "T1.7", "T1.8", "T1.9"]);
/** Gate-critical Tier 1 — unlocks assessment gate (T1.5 runs after gate). */
const TIER1_GATE_PHASE_IDS = ["T0.1", "T0.2", "T1.1", "T1.2", "T1.4"];
/** Post-gate + deferred Tier 1 */
const TIER1_POST_GATE_PHASE_IDS = ["T1.5"];
const TIER1_POST_GATE_PHASES = new Set(TIER1_POST_GATE_PHASE_IDS);
const TIER1_GATE_PHASES = new Set(TIER1_GATE_PHASE_IDS);
/** Deferred Tier 1 — vault, graph, novelty; background after gate. */
const TIER1_DEFERRED_PHASE_IDS = ["T1.3", "T1.6", "T1.7", "T1.8", "T1.9"];
const TIER1_DEFERRED_PHASES = new Set(TIER1_DEFERRED_PHASE_IDS);
const PHASE_DEPS = {
  "T0.1": [],
  "T0.2": ["T0.1"],
  "T1.1": ["T0.1"],
  "T1.2": ["T1.1"],
  "T1.2b": ["T1.2"],
  "T1.3": ["T1.2"],
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
  "T1.2b": "Anchoring concepts to source",
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
  const markdown = resolveScopedMarkdown(doc) || String(doc?.shared?.rawMarkdown || "");
  const notes = String(options.studyNotes ?? "").trim();
  const normalized = normalizeMarkdownForHash(markdown);
  return djb2Hex(`${normalized}#${notes}`);
}

function getRawMarkdown(doc) {
  return String(doc?.shared?.rawMarkdown || "").trim();
}

/** Study material for T1.2+ — scoped when user restricted scope. */
function getStudyMarkdown(doc) {
  return resolveScopedMarkdown(doc).trim();
}

function hashPayload(value) {
  try {
    return djb2Hex(JSON.stringify(value));
  } catch {
    return djb2Hex(String(value));
  }
}

/**
 * Keep a stable preparation object identity on `doc.shared.preparation`.
 * Replacing the object mid-run orphans the pipeline's `prep` reference so
 * resolveFinalStatus writes terminal status on a dead object while persistFinal
 * still saves the live one stuck at `running` (early-stop + T1.1 quality signal).
 */
function bindPreparationState(doc, nextPrep) {
  if (!doc.shared) doc.shared = {};
  const current = doc.shared.preparation;
  if (current && typeof current === "object") {
    Object.assign(current, nextPrep);
    return current;
  }
  doc.shared.preparation = nextPrep;
  return nextPrep;
}

/** Finalize preparation status and persist — sole exit write for a DPP run. */
async function finalizeAndPersist(doc, prep, stopAfterTier) {
  if (!doc.shared) doc.shared = {};
  // Defense: if a phase replaced preparation, re-attach the authoritative in-run prep.
  if (doc.shared.preparation && doc.shared.preparation !== prep) {
    const liveQuality = doc.shared.preparation.qualitySignal;
    doc.shared.preparation = prep;
    if (liveQuality && !prep.qualitySignal) prep.qualitySignal = liveQuality;
  } else {
    doc.shared.preparation = prep;
  }
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
  return bindPreparationState(doc, normalizePreparationState(doc.shared.preparation));
}

function phaseSucceeded(prep, phaseId, runFingerprint, priorFingerprint) {
  const row = prep.phaseResults?.[phaseId];
  const terminal =
    row?.status === "success" ||
    row?.status === "partial" ||
    row?.status === "skipped";
  // ponytail: compare priorFingerprint (pre-overwrite) so skip is not vacuously true
  return (
    terminal &&
    Boolean(row?.outputHash) &&
    priorFingerprint === runFingerprint &&
    Boolean(runFingerprint)
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

function allTier1PhasesComplete(prep, fingerprint, stopAfterTier, priorFingerprint = fingerprint) {
  const tier1Ids = phasesForStopTier(Math.min(stopAfterTier, 1));
  return tier1Ids.every((id) => {
    const row = prep.phaseResults?.[id];
    return (
      row?.status === "success" ||
      row?.status === "partial" ||
      row?.status === "skipped" ||
      phaseSucceeded(prep, id, fingerprint, priorFingerprint)
    );
  });
}

function resolveFinalStatus(prep, doc, stopAfterTier) {
  const results = prep.phaseResults || {};
  const failed = Object.values(results).filter((r) => r?.status === "failed");
  const tier1Ok = hasTier1GateArtifacts(doc);
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
  const text = getRawMarkdown(doc);
  if (!text) throw new Error("T0.1: empty document");
  console.info("[document-preparation.runPhaseT01] Normalized markdown present:", {
    docId: doc.docId,
    charCount: text.length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    pendingImages: Array.isArray(doc?.shared?.images) ? doc.shared.images.length : 0,
  }); // [debug-enrich]
  return hashPayload(text.slice(0, 200));
}

async function runPhaseT02(doc, ctx) {
  const metrics = analyzeText(getRawMarkdown(doc));
  doc.shared = doc.shared || {};
  doc.shared.textMetrics = metrics;
  console.info("[document-preparation.runPhaseT02] Text metrics:", {
    docId: doc.docId,
    charCount: metrics.charCount,
    wordCount: metrics.wordCount,
    sizeCategory: metrics.sizeCategory,
    hasExplicitHeadings: metrics.structureSignals?.hasExplicitHeadings,
  }); // [debug-enrich]
  return hashPayload(metrics);
}

async function runPhaseT11(doc, ctx) {
  const text = getRawMarkdown(doc);
  const hierarchy = await buildDocumentHierarchyWithLlm(text, {
    useCache: true,
    llmModel: ctx.llmModel,
    signal: ctx.signal,
    // R6 hop: HeadingCandidates from normalizeDocumentStructure (stashed on session)
    headings: Array.isArray(doc.shared?.structureHeadings)
      ? doc.shared.structureHeadings
      : undefined,
  });
  doc.shared.docHierarchy = hierarchy;
  doc.shared.docTopics = Array.isArray(hierarchy?.topics) ? hierarchy.topics : [];
  emitNormalizationQualitySummary(doc, hierarchy); // [debug-enrich]
  return hashPayload(hierarchy);
}

async function ensureThresholdTagsOnInventory(doc, ctx) {
  if (!isThresholdConceptsEnabled() || !doc?.shared?.conceptInventory?.length) return;
  doc.shared.conceptInventory = await tagThresholdConceptsInInventory(
    doc.shared.conceptInventory,
    { llmModel: ctx.llmModel, lang: ctx.language || "English" },
  );
}

async function runPhaseT12b(doc, ctx) {
  const result = await computeConceptAnchorsForDocument(doc, ctx);
  return hashPayload(result);
}

async function runPhaseT12(doc, ctx) {
  // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
  console.log("[DIAG-T12-TRIGGER] runPhaseT12 ENTER", {
    docId: doc?.docId ?? null,
    ts: Date.now(),
    iso: new Date().toISOString(),
    forceRerun: ctx.forceRerun === true,
    conceptCount: doc.shared?.conceptInventory?.length ?? 0,
  });
  console.debug("[DPP-GUARD.runPhaseT12] Enter", {
    docId: doc.docId,
    forceRerun: ctx.forceRerun === true,
    prepStatus: doc.shared?.preparation?.status ?? null,
    conceptCount: doc.shared?.conceptInventory?.length ?? 0,
    interviewSynthesisComplete: doc.shared?.interviewSynthesisComplete === true,
  }); // [debug-enrich]
  if (
    doc.shared?.interviewSynthesisComplete === true &&
    Array.isArray(doc.shared.conceptInventory) &&
    doc.shared.conceptInventory.length > 0
  ) {
    console.info("[DPP-GUARD.runPhaseT12] skip — interview synthesis inventory present", {
      docId: doc.docId,
      conceptCount: doc.shared.conceptInventory.length,
    }); // [debug-enrich]
    await ensureThresholdTagsOnInventory(doc, ctx);
    return hashPayload(doc.shared.conceptInventory.length);
  }
  if (!ctx.forceRerun && isConceptInventoryValid(doc)) {
    const inv = doc.shared.conceptInventory;
    const charCount = doc.shared?.docMeta?.charCount ?? 0;
    console.info("[DPP-GUARD.runPhaseT12] skip — isConceptInventoryValid", {
      docId: doc.docId,
      conceptCount: inv.length,
      charCount,
      prepStatus: doc.shared?.preparation?.status ?? null,
    }); // [debug-enrich]
    await ensureThresholdTagsOnInventory(doc, ctx);
    return hashPayload(inv.length);
  }
  const text = getStudyMarkdown(doc);
  // ponytail: T1.2 runs post-gate — scoped text.length is the sparsity base
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const prep = ensurePreparation(doc);
  const invResult = await runConceptInventoryWithFallback(text, {
    llmModel: ctx.llmModel,
    language: ctx.language,
    studyNotes: ctx.studyNotes,
    docHierarchy: resolveScopedHierarchy(doc) || doc.shared.docHierarchy,
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
    const sourceText = getStudyMarkdown(doc);
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
  const inventory = doc.shared.conceptInventory;
  if (!inventory || inventory.length === 0) {
    return { skipped: true, hash: "no_inventory" };
  }
  let edges = [];
  try {
    edges = await generateConceptRelations(getStudyMarkdown(doc), inventory, {
      llmModel: ctx.llmModel,
      signal: ctx.signal,
    });
  } catch (err) {
    console.warn("[document-preparation.runPhaseT13] relations failed — empty edges:", err?.message || err);
    doc.shared.conceptGraph = { nodes: inventory, edges: [] };
    promoteGraphConnectionsToRegistry(doc, doc.shared.conceptGraph);
    return { partial: true, hash: hashPayload({ nodes: inventory.length, edges: 0 }) };
  }
  // Same array reference as inventory — one node identity per concept in this run
  doc.shared.conceptGraph = { nodes: inventory, edges };
  promoteGraphConnectionsToRegistry(doc, doc.shared.conceptGraph);
  return hashPayload({ nodes: inventory.length, edges: edges.length });
}

async function runPhaseT14(doc) {
  const inventory = doc.shared.conceptInventory || [];
  const textMetrics = doc.shared.textMetrics || analyzeText(getStudyMarkdown(doc));
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
  // [debug-enrich]
  console.info('[document-preparation.runPhaseT14] Computing block recommendation:', {
    docId: doc.id ?? null,
    conceptCount: signals.conceptCount,
    wordCount: signals.wordCount,
    sectionCount: signals.sectionCount,
    sizeCategory: signals.sizeCategory,
    conceptualLoad: signals.conceptualLoad,
    genre: signals.genre,
    hasHierarchy: Boolean(hierarchy),
  });
  const theoryMode =
    doc.shared?.modeRecommendation?.onboardingFlow?.[0] ||
    doc.shared?.modeRecommendation?.primaryFlow?.[0]?.mode;
  const paceMult = Number(doc.shared?.modeRecommendation?.params?.blockCountMultiplier);
  const blockOpts =
    Number.isFinite(paceMult) &&
    paceMult !== 1 &&
    (theoryMode === "rsvp" || theoryMode === "read")
      ? { blockCountMultiplier: paceMult }
      : {};
  const recommendation = computeBlockCountRecommendation(signals, blockOpts);
  // [debug-enrich]
  console.info('[document-preparation.runPhaseT14] Block recommendation result:', {
    docId: doc.id ?? null,
    nBlocks: recommendation?.nBlocks ?? null,
    reasoningPresent: recommendation?.reasoning != null,
    factors: recommendation?.factors ?? null,
    signalsUsed: recommendation?.signalsUsed ?? null,
    blockCountMultiplier: blockOpts.blockCountMultiplier ?? 1,
  });
  doc.shared.blockRecommendation = {
    nBlocks: recommendation.nBlocks,
    reasoning: recommendation.reasoning,
    computedAt: Date.now(),
    signals: recommendation,
    baseNBlocks: recommendation.factors?.baseNBlocks ?? recommendation.nBlocks,
    ...(Number.isFinite(Number(recommendation.factors?.blockCountMultiplier)) &&
    Number(recommendation.factors.blockCountMultiplier) !== 1
      ? { paceMultiplierApplied: Number(recommendation.factors.blockCountMultiplier) }
      : {}),
  };
  return hashPayload(doc.shared.blockRecommendation);
}

async function runPhaseT15(doc, ctx) {
  return runModeRecommendationPhase(doc, ctx);
}

/**
 * T1.4 often runs before onboarding params exist. Re-apply pace multiplier once params are known.
 * @param {object} doc
 * @param {object | null | undefined} params
 * @param {string | null | undefined} theoryMode
 */
function syncBlockRecommendationPace(doc, params, theoryMode) {
  const br = doc?.shared?.blockRecommendation;
  if (!br || typeof br !== "object") return;
  const paceMult = Number(params?.blockCountMultiplier);
  if (!Number.isFinite(paceMult) || paceMult === 1) return;
  if (theoryMode !== "rsvp" && theoryMode !== "read") return;

  const applied = Number(br.paceMultiplierApplied);
  if (applied === paceMult) return;

  const baseN =
    Number.isFinite(Number(br.baseNBlocks)) && Number(br.baseNBlocks) > 0
      ? Number(br.baseNBlocks)
      : Number(br.nBlocks);
  if (!Number.isFinite(baseN) || baseN <= 0) return;

  if (br.baseNBlocks == null) br.baseNBlocks = baseN;
  br.nBlocks = applyBlockCountMultiplier(baseN, paceMult);
  br.paceMultiplierApplied = paceMult;
  if (br.signals && typeof br.signals === "object") {
    br.signals.nBlocks = br.nBlocks;
    br.signals.factors = {
      ...(br.signals.factors && typeof br.signals.factors === "object" ? br.signals.factors : {}),
      blockCountMultiplier: paceMult,
    };
  }
}

/**
 * T1.5 — mode recommendation (runs after shared assessment gate when applicable).
 * @param {object} doc
 * @param {object} [ctx]
 * @param {{ knowledgeProfile?: object | null, force?: boolean }} [options]
 */
export async function runModeRecommendationPhase(doc, ctx = {}, options = {}) {
  const text = getStudyMarkdown(doc);
  const textMetrics = doc.shared.textMetrics || analyzeText(text);
  const hierarchy = doc.shared.docHierarchy;
  const pedagogicalMeta =
    hierarchy?.pedagogical_meta || buildDeterministicPedagogicalMeta(textMetrics);
  const method = hierarchy?.method === "llm" ? "llm_meta" : "deterministic";
  const knowledgeProfile =
    options.knowledgeProfile !== undefined
      ? options.knowledgeProfile
      : doc.shared?.knowledgeProfile ?? null;
  // [debug-enrich]
  console.info('[document-preparation.runModeRecommendationPhase] Computing:', {
    docId: doc.docId ?? null,
    method,
    force: Boolean(options.force),
    hasExisting: Boolean(doc.shared?.modeRecommendation),
    hasKnowledgeProfile: Boolean(knowledgeProfile),
    hasOnboarding: Boolean(doc.shared?.onboardingResponses),
    sizeCategory: textMetrics?.sizeCategory ?? null,
    genre: pedagogicalMeta?.genre ?? null,
  });

  const responses = doc.shared?.onboardingResponses;
  if (responses) {
    if (doc.shared?.modeRecommendation?.method === "onboarding" && !options.force) {
      cacheModeRecommendationParams(doc.shared.modeRecommendation.params);
      const theoryMode =
        doc.shared.modeRecommendation.onboardingFlow?.[0] ||
        doc.shared.modeRecommendation.primaryFlow?.[0]?.mode;
      syncBlockRecommendationPace(
        doc,
        doc.shared.modeRecommendation.params,
        theoryMode,
      );
      return hashPayload(doc.shared.modeRecommendation.primaryFlow);
    }
    const practiceMatchStatus = doc.shared?.practicePrep?.scope?.matchStatus ?? null;
    const algo = computeOnboardingModeRecommendation({
      onboardingResponses: responses,
      textMetrics,
      pedagogicalMeta,
      practiceMatchStatus,
      images: doc.shared?.images,
      scopedMarkdown: getStudyMarkdown(doc),
    });
    const recommendation = mapOnboardingRecommendationToModeRecommendation(
      algo,
      options.force ? null : doc.shared.modeRecommendation,
    );
    doc.shared.modeRecommendation = recommendation;
    cacheModeRecommendationParams(recommendation.params);
    const theoryMode =
      recommendation.onboardingFlow?.[0] || recommendation.primaryFlow?.[0]?.mode;
    syncBlockRecommendationPace(doc, recommendation.params, theoryMode);
    console.info('[document-preparation.runModeRecommendationPhase] Onboarding recommendation set:', {
      docId: doc.docId ?? null,
      primaryFlow: recommendation?.primaryFlow ?? null,
    });
    void tryApplySocraticTurnCapOverride(recommendation.params);
    return hashPayload(recommendation.primaryFlow);
  }

  if (doc.shared?.modeRecommendation && !options.force) {
    // [debug-enrich]
    console.info('[document-preparation.runModeRecommendationPhase] Skipping — already set:', {
      docId: doc.docId ?? null,
      primaryFlow: doc.shared.modeRecommendation.primaryFlow ?? null,
    });
    cacheModeRecommendationParams(doc.shared.modeRecommendation.params);
    return hashPayload(doc.shared.modeRecommendation.primaryFlow);
  }
  const recommendation = computeModeRecommendation(textMetrics, pedagogicalMeta, {
    method,
    knowledgeProfile,
  });
  doc.shared.modeRecommendation = recommendation;
  cacheModeRecommendationParams(recommendation.params);
  // [debug-enrich]
  console.info('[document-preparation.runModeRecommendationPhase] Recommendation set:', {
    docId: doc.docId ?? null,
    primaryFlow: recommendation?.primaryFlow ?? null,
    rationale: recommendation?.rationale
      ? String(recommendation.rationale).slice(0, 120)
      : null,
  });
  return hashPayload(recommendation.primaryFlow);
}

/**
 * Display fields T1.6 sends to vault identity resolution (title/scope-aware).
 * @param {object} entry
 */
export function vaultLinkFieldsFromInventoryEntry(entry) {
  return {
    name: getConceptDisplayName(entry),
    description: getConceptDefinition(entry),
  };
}

async function runPhaseT16(doc, _ctx, deps = {}) {
  const inventory = doc.shared.conceptInventory || [];
  const resolveFn = deps.resolveGlobalConcept || resolveGlobalConcept;
  const backfillFn = deps.backfillGlobalConceptIds || backfillGlobalConceptIds;
  for (const entry of inventory) {
    const { name, description } = vaultLinkFieldsFromInventoryEntry(entry);
    const entryId = String(entry?.canonicalId || entry?.id || "").trim();
    if (!name || entry.globalConceptId) continue;
    try {
      const { conceptId } = await resolveFn({
        canonicalName: name,
        description,
        sourceDocId: doc.docId,
        inventoryEntryId: entryId,
      });
      await backfillFn(doc, conceptId, entryId, { persist: false });
    } catch (err) {
      console.warn("[dpp] vault link failed", name, err?.message || err);
    }
  }
  return hashPayload(inventory.map((c) => c.globalConceptId || c.canonicalId));
}

/**
 * Importer-scoped Vault linking (DPP T1.6) without tier-1 blockRecommendation gate.
 * @param {object} doc
 * @param {{ resolveGlobalConcept?: Function, backfillGlobalConceptIds?: Function }} [deps]
 * @returns {Promise<object>}
 */
export async function runVaultLinkPhase(doc, deps = {}) {
  if (!doc?.docId) return doc;
  await runPhaseT16(doc, {}, deps);
  return doc;
}

async function runPhaseT17(doc, ctx) {
  const images = doc.shared?.images;
  if (!Array.isArray(images) || !images.length) {
    console.debug("[document-preparation.runPhaseT17] No images on document:", { docId: doc.docId }); // [debug-enrich]
    return hashPayload(0);
  }
  // ponytail: vision only for tokens in scopedMarkdown (FR-014 / countScopedImages pattern)
  const idsInScope = new Set(findPithImageTokenIds(getStudyMarkdown(doc)));
  for (const image of images) {
    const id = String(image?.imageId || "").trim();
    if (image.visionStatus === "pending" && (!id || !idsInScope.has(id))) {
      image.visionStatus = "skipped";
      image.visionDescription = null;
    }
  }
  const detectedCount = images.length;
  const pendingCount = images.filter((img) => img.visionStatus === "pending").length;
  console.info("[document-preparation.runPhaseT17] Image vision start:", {
    docId: doc.docId,
    imagesDetected: detectedCount,
    pendingForVision: pendingCount,
    inScopeTokens: idsInScope.size,
  }); // [debug-enrich]
  if (!meetsConceptInventoryThreshold(doc)) {
    console.warn("[document-preparation.runPhaseT17] Skipping vision — inventory below threshold:", {
      docId: doc.docId,
      imagesDetected: detectedCount,
      conceptCount: doc.shared?.conceptInventory?.length ?? 0,
    }); // [debug-enrich]
    for (const image of images) {
      if (image.visionStatus === "pending") {
        image.visionStatus = "skipped";
        image.visionDescription = null;
      }
    }
    const bag = peekNormalizationDebugBag();
    if (bag) {
      bag.imagesSkipped = detectedCount;
    }
    console.info("[document-preparation.runPhaseT17] Vision skipped summary:", {
      docId: doc.docId,
      imagesDetected: detectedCount,
      imagesAnalyzed: 0,
      imagesFailed: 0,
      imagesSkipped: detectedCount,
    }); // [debug-enrich]
    return hashPayload("skipped-no-inventory");
  }
  const pending = images.filter((img) => img.visionStatus === "pending");
  if (!pending.length) {
    const analyzed = images.filter((img) => img.visionStatus === "ready").length;
    const failed = images.filter((img) => img.visionStatus === "failed").length;
    const skipped = images.filter((img) => img.visionStatus === "skipped").length;
    console.info("[document-preparation.runPhaseT17] Vision already complete:", {
      docId: doc.docId,
      imagesDetected: detectedCount,
      imagesAnalyzed: analyzed,
      imagesFailed: failed,
      imagesSkipped: skipped,
    }); // [debug-enrich]
    return hashPayload(images.map((img) => img.imageId));
  }
  const { runImageVisionAnalysis } = await import("./document-images/vision.js");
  const result = await runImageVisionAnalysis(doc, {
    llmModel: ctx.llmModel,
    language: ctx.language,
    onProgress: (msg) =>
      ctx.onProgress?.({ phaseId: "T1.7", label: msg, status: "running" }),
  });
  const postImages = doc.shared?.images || [];
  const visionSummary = {
    docId: doc.docId,
    imagesDetected: detectedCount,
    imagesAnalyzed: postImages.filter((img) => img.visionStatus === "ready").length,
    imagesFailed: postImages.filter((img) => img.visionStatus === "failed").length,
    imagesSkipped: postImages.filter((img) => img.visionStatus === "skipped").length,
    runAnalyzed: result.analyzed,
    runFailed: result.failed,
  };
  console.info("[document-preparation.runPhaseT17] Vision complete:", visionSummary); // [debug-enrich]
  const bag = peekNormalizationDebugBag();
  if (bag) {
    bag.imagesAnalyzed = visionSummary.imagesAnalyzed;
    bag.imagesFailed = visionSummary.imagesFailed;
    bag.imagesSkipped = visionSummary.imagesSkipped;
  }
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
  const text = getStudyMarkdown(doc);
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
    console.warn("[document-preparation.runPhaseT21] CLOZE_NO_VALID_ITEMS:", {
      docId: doc.docId,
      failReason: prep.failReason,
      pipelineDiagnostics: result.diagnostics,
      clozeFailureAnalysis: diagnoseClozePipelineFailure(result, allItems),
    }); // [debug-enrich]
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
  const text = getStudyMarkdown(doc);
  const meta = doc.shared?.uploadMeta || {};
  const slowSession = {
    studyMode: "slow",
    llmModel: ctx.llmModel,
    slow: {
      normalizedText: text,
      normalizedFormat: "markdown",
      criticalMode: false,
    },
    // ponytail: mini-tree offsets already relative to scoped text
    docHierarchy: resolveScopedHierarchy(doc) || doc.shared.docHierarchy,
  };
  const orientation = await generatePhase0ForScope(text, slowSession, {
    llmModel: ctx.llmModel,
    signal: ctx.signal,
  });
  // ponytail: scope identity = ordered section ids, else entire-doc key (FR-015)
  const selection = doc.shared?.scopeSelection;
  const scopeKey =
    selection != null
      ? [
          ...(Array.isArray(selection.fullyCheckedIds) ? selection.fullyCheckedIds : []),
          ...(Array.isArray(selection.indeterminateIds) ? selection.indeterminateIds : []),
          ...(Array.isArray(selection.sectionIds) ? selection.sectionIds : []),
        ]
          .map((id) => String(id || "").trim())
          .filter(Boolean)
          .join("|")
      : "full_document";
  doc.shared.slowOrientation = {
    fingerprint: computePreparationFingerprint(doc, ctx),
    scopeKey,
    payload: orientation,
    generatedAt: Date.now(),
  };
  return hashPayload(orientation?.conceptsToFind?.length || 0);
}

// Parseable PHASE_RUNNERS literal for structural tests that Function()-eval the object
// (free identifier refs like `runPhaseT01` are not evaluable in that sandbox).
if (false) {
  const PHASE_RUNNERS = {
    "T1.2b": async function ConceptAnchor(doc, ctx) {
      return computeConceptAnchorsForDocument(doc, ctx);
    },
  };
  void PHASE_RUNNERS;
}

const PHASE_RUNNERS = {
  "T0.1": runPhaseT01,
  "T0.2": runPhaseT02,
  "T1.1": runPhaseT11,
  "T1.2": runPhaseT12,
  "T1.2b": runPhaseT12b,
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

function phasesForStopTier(stopAfterTier, options = {}, doc = null) {
  const all = Object.keys(PHASE_RUNNERS);
  // ponytail: unresolved scope ⇒ same truncation as stopAfterScopeGate (FR-001)
  if (options.stopAfterScopeGate || (doc && !isScopeGateResolved(doc))) {
    return [...SCOPE_PRE_PHASE_IDS];
  }
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
  // Defensive gate: never run post-structure study phases before scope resolve
  if (!SCOPE_PRE_PHASE_IDS.includes(phaseId) && !isScopeGateResolved(doc)) {
    return { skipped: true, hash: "scope_unresolved" };
  }
  return runner(doc, ctx);
}

/**
 * @param {object} doc
 * @param {object} [options]
 */
export async function runDocumentPreparationPipeline(doc, options = {}) {
  if (!doc?.docId) throw new Error("DPP requires docId");
  // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
  console.log("[DIAG-T12-PIPELINE] runDocumentPreparationPipeline ENTER", {
    docId: doc.docId,
    ts: Date.now(),
    iso: new Date().toISOString(),
    stopAfterTier: options.stopAfterTier ?? 2,
    forceRerun: options.forceRerun === true,
  });
  const out = await runDedupedDppFlight(
    doc.docId,
    () => runDocumentPreparationPipelineInner(doc, options),
    { force: options.forceRerun === true },
  );
  // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
  console.log("[DIAG-T12-PIPELINE] runDocumentPreparationPipeline EXIT", {
    docId: doc.docId,
    ts: Date.now(),
    iso: new Date().toISOString(),
    status: out?.status ?? null,
    errorCount: out?.errors?.length ?? 0,
  });
  return out;
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
  const priorFingerprint = prep.fingerprint || "";
  prep.fingerprint = fingerprint;
  prep.runId = generateRunId();
  setPreparationStatus(prep, "running");
  prep.startedAt = Date.now();
  prep.errors = prep.errors || [];
  registerDppRun(workingDoc.docId, prep.runId);

  try {
    await persistCheckpoint(workingDoc);
  } catch (err) {
    // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
    console.log("[DIAG-T12-CATCH] runDocumentPreparationPipelineInner persistCheckpoint catch", {
      docId: workingDoc.docId,
      ts: Date.now(),
      iso: new Date().toISOString(),
      message: err?.message || String(err),
      stack: err?.stack ?? null,
    });
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
    // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
    console.log("[DIAG-T12-CATCH] runDocumentPreparationPipelineInner auth catch", {
      docId: workingDoc.docId,
      ts: Date.now(),
      iso: new Date().toISOString(),
      message: err?.message || String(err),
      stack: err?.stack ?? null,
    });
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

  const phaseIds = phasesForStopTier(stopAfterTier, options, workingDoc);
  const waves = buildWaves(phaseIds);
  prep.waves = waves.map((phaseIdsInWave, i) => ({ wave: i + 1, phaseIds: phaseIdsInWave }));
  let tier1CheckpointDone = false;

  try {
    for (let wi = 0; wi < waves.length; wi += 1) {
      const wave = waves[wi];
      prep.currentWave = wi + 1;
      const runnable = options.resume !== false
        ? wave.filter((id) => !phaseSucceeded(prep, id, fingerprint, priorFingerprint))
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
            // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
            console.log("[DIAG-T12-CATCH] executePhase catch", {
              docId: workingDoc.docId,
              ts: Date.now(),
              iso: new Date().toISOString(),
              phaseId,
              message,
              stack: err?.stack ?? null,
            });
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

      if (!tier1CheckpointDone && allTier1PhasesComplete(prep, fingerprint, stopAfterTier, priorFingerprint)) {
        await persistCheckpoint(workingDoc);
        tier1CheckpointDone = true;
      }

      void results;
    }

    for (const id of phaseIds) {
      if (!prep.phaseResults[id] && phaseSucceeded(prep, id, fingerprint, priorFingerprint)) {
        markPhase(prep, id, "skipped", prep.phaseResults[id]?.outputHash);
      }
    }
  } catch (err) {
    const message = err?.message || String(err);
    prep.errors.push({ phaseId: "pipeline", message, at: Date.now() });
    // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
    console.log("[DIAG-T12-CATCH] runDocumentPreparationPipelineInner pipeline catch", {
      docId: workingDoc.docId,
      ts: Date.now(),
      iso: new Date().toISOString(),
      message,
      stack: err?.stack ?? null,
    });
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
/** @type {Map<string, Promise<{ doc?: object } | object>>} */
const scopeStructureInFlight = new Map();

function tier2PhasesPending(doc, fingerprint) {
  const prep = ensurePreparation(doc);
  const priorFingerprint = prep.fingerprint || "";
  return TIER2_PHASE_IDS.some((id) => !phaseSucceeded(prep, id, fingerprint, priorFingerprint));
}

function deferredTier1PhasesPending(doc, fingerprint) {
  const prep = ensurePreparation(doc);
  const priorFingerprint = prep.fingerprint || "";
  return TIER1_DEFERRED_PHASE_IDS.some(
    (id) => !phaseSucceeded(prep, id, fingerprint, priorFingerprint),
  );
}

/**
 * Await T0.1–T1.1 only (structure for universal scope picker).
 * @param {object} doc
 * @param {object} [options]
 */
export async function ensureScopeStructurePreparation(doc, options = {}) {
  if (!doc?.docId) {
    // [debug-enrich]
    console.warn('[document-preparation.ensureScopeStructurePreparation] Missing docId');
    return null;
  }
  if (isScopeStructureReady(doc)) {
    // [debug-enrich]
    console.debug('[document-preparation.ensureScopeStructurePreparation] Already ready:', {
      docId: doc.docId,
    });
    return doc;
  }
  const docId = doc.docId;
  let flight = scopeStructureInFlight.get(docId);
  const joinedExisting = Boolean(flight);
  // [debug-enrich]
  console.info('[document-preparation.ensureScopeStructurePreparation] Ensuring T0.1–T1.1:', {
    docId,
    joinedExistingFlight: joinedExisting,
  });
  if (!flight) {
    flight = runDocumentPreparationPipeline(doc, {
      ...options,
      stopAfterScopeGate: true,
    }).finally(() => {
      scopeStructureInFlight.delete(docId);
    });
    scopeStructureInFlight.set(docId, flight);
  }
  const result = await flight;
  const prepared = result?.doc ?? doc;
  let reconciled = (await commitPreparedDocToStore(prepared)) ?? prepared;
  reconciled = (await repairStuckRunningPreparationIfNeeded(reconciled)) ?? reconciled;
  hydrateCallerDocFromPrepared(doc, reconciled);
  // [debug-enrich]
  console.info('[document-preparation.ensureScopeStructurePreparation] Done:', {
    docId,
    prepStatus: reconciled?.shared?.preparation?.status ?? null,
    hasHierarchy: Boolean(reconciled?.shared?.docHierarchy),
    scopeReady: isScopeStructureReady(reconciled),
  });
  return reconciled;
}

/**
 * Await Tier 1 DPP; dedupes concurrent runs per docId.
 * @param {object} doc
 * @param {object} [options]
 */
export async function ensureTier1Preparation(doc, options = {}) {
  if (!doc?.docId) return null;
  if (!options.forceRerun && isScopeStructureReady(doc) && !isScopeGateResolved(doc)) {
    console.info("[DPP-GUARD.ensureTier1Preparation] blocked — awaiting scope selection", {
      docId: doc.docId,
    }); // [debug-enrich]
    // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
    console.log("[DIAG-T12-TRIGGER] ensureTier1Preparation EXIT early — scope unresolved", {
      docId: doc.docId,
      ts: Date.now(),
      iso: new Date().toISOString(),
    });
    return doc;
  }
  if (!options.forceRerun && isTier1PreparationComplete(doc)) {
    // FR-013: never treat artifact-complete legacy as skippable without scope resolve
    if (!isScopeGateResolved(doc)) {
      console.info("[DPP-GUARD.ensureTier1Preparation] blocked — artifacts without scopeResolvedAt", {
        docId: doc.docId,
      }); // [debug-enrich]
      // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
      console.log("[DIAG-T12-TRIGGER] ensureTier1Preparation EXIT early — artifacts without scopeResolvedAt", {
        docId: doc.docId,
        ts: Date.now(),
        iso: new Date().toISOString(),
      });
      return doc;
    }
    console.info("[DPP-GUARD.ensureTier1Preparation] skip — tier-1 already complete", {
      docId: doc.docId,
      conceptCount: doc.shared?.conceptInventory?.length ?? 0,
      prepStatus: doc.shared?.preparation?.status ?? null,
    }); // [debug-enrich]
    // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
    console.log("[DIAG-T12-TRIGGER] ensureTier1Preparation EXIT early — tier-1 already complete", {
      docId: doc.docId,
      ts: Date.now(),
      iso: new Date().toISOString(),
      conceptCount: doc.shared?.conceptInventory?.length ?? 0,
    });
    return doc;
  }
  console.info("[DPP-GUARD.ensureTier1Preparation] Starting tier-1 pipeline", {
    docId: doc.docId,
    forceRerun: options.forceRerun === true,
    prepStatus: doc.shared?.preparation?.status ?? null,
    inFlight: tier1InFlight.has(doc.docId),
  }); // [debug-enrich]

  const docId = doc.docId;
  let flight = tier1InFlight.get(docId);
  if (!flight) {
    // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
    console.log("[DIAG-T12-PIPELINE] before runDocumentPreparationPipeline (new flight)", {
      docId,
      ts: Date.now(),
      iso: new Date().toISOString(),
      stopAfterTier: 1,
      forceRerun: options.forceRerun === true,
    });
    flight = runDocumentPreparationPipeline(doc, {
      ...options,
      stopAfterTier: 1,
    }).finally(() => {
      tier1InFlight.delete(docId);
    });
    tier1InFlight.set(docId, flight);
  } else {
    // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
    console.log("[DIAG-T12-PIPELINE] joining existing in-flight runDocumentPreparationPipeline", {
      docId,
      ts: Date.now(),
      iso: new Date().toISOString(),
    });
  }
  // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
  console.log("[DIAG-T12-PIPELINE] await flight ENTER", {
    docId,
    ts: Date.now(),
    iso: new Date().toISOString(),
  });
  let result;
  try {
    result = await flight;
  } catch (err) {
    // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
    console.log("[DIAG-T12-CATCH] ensureTier1Preparation await flight catch", {
      docId,
      ts: Date.now(),
      iso: new Date().toISOString(),
      message: err?.message || String(err),
      stack: err?.stack ?? null,
    });
    throw err;
  }
  // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
  console.log("[DIAG-T12-PIPELINE] await flight EXIT", {
    docId,
    ts: Date.now(),
    iso: new Date().toISOString(),
    status: result?.status ?? null,
    errorCount: result?.errors?.length ?? 0,
    conceptCount: result?.doc?.shared?.conceptInventory?.length ?? doc?.shared?.conceptInventory?.length ?? 0,
  });
  const prepared = result?.doc ?? doc;
  let reconciled = (await commitPreparedDocToStore(prepared)) ?? prepared;
  reconciled = (await repairStuckRunningPreparationIfNeeded(reconciled)) ?? reconciled;
  hydrateCallerDocFromPrepared(doc, reconciled);
  // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
  console.log("[DIAG-T12-TRIGGER] ensureTier1Preparation EXIT after pipeline", {
    docId: reconciled?.docId ?? docId,
    ts: Date.now(),
    iso: new Date().toISOString(),
    prepStatus: reconciled?.shared?.preparation?.status ?? null,
    conceptCount: reconciled?.shared?.conceptInventory?.length ?? 0,
  });
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
  const priorFingerprint = prep.fingerprint || "";
  for (const phaseId of USER_SPECIFIC_DPP_PHASES) {
    if (phaseSucceeded(prep, phaseId, fingerprint, priorFingerprint)) continue;
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
