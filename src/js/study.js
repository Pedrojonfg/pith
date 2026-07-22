import {
  deepSeekAuditBlockOverlap,
  deepSeekGenerateBlockJson,
  deepSeekRegenerateBlockQuestions,
  buildQuestionCountRetryInstruction,
  deepSeekSocraticTutor,
  deepSeekSummarySoFar,
  GapSynthesisError,
  generateAssessmentSynthesis,
  synthesizeAssessmentGaps,
  generatePrePackingAssessmentItems,
  generateHolisticPrePackingAssessmentItems,
  generateScopeContext,
  buildInventoryChunks,
  evaluatePrePackingAssessmentResponses,
  extractVaultCandidates,
  normalizeConceptsToVault,
  PREPACKING_DONT_KNOW_ANSWER,
  PREPACKING_ALREADY_KNOW_ANSWER,
} from "./api.js?v=20260625_02";
import {
  ASSESSMENT_FLAGS,
  INTERVIEW_MAX_FOLLOWUP_ROUNDS,
  INTERVIEW_MIN_ANSWERED_TURNS,
  isAssessmentQuestionsUiEnabled,
  isHolisticAssessmentEnabled,
  isSharedPreModeAssessmentEnabled,
  isAdaptiveProbingEnabled,
  isBookLookupEnabled,
  saveAssessmentBeforePackingPreference,
  saveSourceFidelityStrictPreference,
} from "./config/flags.js";
import {
  buildAdaptiveCoveragePlan,
  applyAdaptiveBeliefUpdate,
  filterInventoryForAdaptiveProbing,
  resolveAdaptiveCandidateConcepts,
  shouldEarlyStopAdaptiveAssessment,
  enrichKnowledgeProfileWithAdaptiveStatuses,
} from "./adaptive-probing/assessment-integration.js";
import { mergeSessionBeliefs, loadProjectBeliefs } from "./adaptive-probing/belief-persist.js";
import { buildProbeGraph } from "./adaptive-probing/probe-graph.js";
import { computeFringes, labelConcepts } from "./adaptive-probing/knowledge-fringe.js";
import {
  buildAssessmentCoveragePlan,
  computeHolisticAssessmentBudget,
  deriveInventoryEdges,
  getConceptId,
  hashCoveragePlan,
} from "./assessment-coverage.js?v=20260625_02";
import {
  assertLlmKeyPresent,
  getApiKeyForLlmModel,
  getDefaultLlmModel,
  getLlmCallingLabel,
  getSessionLlmModel,
  llmChatCompletions,
  LLM_MODEL_DEEPSEEK,
  normalizeLlmModel,
} from "./llm.js?v=20260625_02";
import {
  buildDocumentHierarchy,
  buildDeterministicPedagogicalMeta,
  hasMarkdownHeadings,
} from "./normalization/hierarchy.js?v=20260625_02";
import { analyzeText } from "./recommendation/analyzer.js?v=20260625_02";
import {
  computeBlockCountRecommendation,
  formatBlockCountReasoning,
} from "./recommendation/block-count-recommender.js?v=20260625_02";
import { computeModeRecommendation } from "./recommendation/recommender.js?v=20260625_02";
import {
  computeOnboardingModeRecommendation,
  mapOnboardingRecommendationToModeRecommendation,
} from "./recommendation/onboarding-recommender.js";
import {
  buildBlockSplitFingerprint,
  getBlockSplitCache,
  invalidateBlockSplitCache,
  isBlockSplitCacheValid,
  setBlockSplitCache,
} from "./block-split-cache.js";
import {
  runDocumentPreparationPipeline,
  PHASE_LABELS,
  ensureTier1Preparation,
  ensureScopeStructurePreparation,
  kickoffTier2PreparationInBackground,
  hasPendingTier2Preparation,
  runPostCacheUserPhases,
  runModeRecommendationPhase,
} from "./document-preparation.js";
import {
  migrateKnowledgeProfileToShared,
  persistSharedKnowledgeProfile,
  isAssessmentGateResolved,
  resetSessionForAssessmentRedo,
  resolvePackKnowledgeProfile,
} from "./knowledge-profile-shared.js";
import { hydrateSessionFromSharedCache } from "./shared-dpp-cache.js";
import { fetchSharedDppCache } from "./shared-dpp-cache-persist.js";
import { commitPreparedDocToStore, healFreshSharedFieldsAfterStoreReload, hydrateCallerDocFromPrepared } from "./dpp-persistence.js";
import { computeAverageNovelty } from "./vault/novelty-scoring.js";
import {
  DOC_SIMILARITY_DUPLICATE_THRESHOLD,
  DOC_SIMILARITY_RELATED_THRESHOLD,
} from "./vault/embedding-thresholds.js";
import { getOpeningQuestions } from "./interview/opening-questions.js";
import { lookupBook } from "./book-lookup.js";
import {
  appendTurn,
  canProceedToSynthesis,
  countAnsweredTurns,
  createTurn,
  dynamicFollowUpsUsed,
  normalizeInterviewTranscript,
} from "./interview/transcript.js";
import {
  getDefaultModesForSession,
  INTERVIEW_PLACEHOLDER_MARKDOWN,
  isInterviewOriginSession,
  isModeAvailableForSession,
} from "./interview/origin.js";
import { generateInterviewFollowUp } from "./interview/interview-api.js";
import { applyInterviewSynthesis } from "./interview/synthesis.js";
import { normalizePreparationState, isTier1PreparationComplete, hasTier1Artifacts, isScopeGateResolved, isScopeStructureReady, resolveChatScopeFields, resolveScopedMarkdown, setPreparationStatus } from "./session-types.js";
import { setGuideScopeFromDocument } from "./guide-chat.js";
import {
  SCOPE_TREE_DEFAULT_EXPANDED_LEVEL,
  buildScopedMarkdown,
  buildScopeSelection,
  defaultExpandedScopeIds,
  listSelectableHierarchyNodes,
  listSelectableHierarchyTree,
  scopeSelectionToUiState,
  toggleScopeNode,
  uiStateToScopeSelectionIds,
} from "./scope-selection.js";
import { resolveScopedHierarchy } from "./normalization/scoped-hierarchy.js";
import { MAX_SOURCE_FILES } from "./source-provenance.js";
import {
  resolveRsvpInventoryForPack,
  shouldSkipRsvpInventoryLlm,
} from "./rsvp-shared-consumption.js";
import { isMcTypingTarget, letterFromMcKey } from "./mc-keyboard.js?v=20260625_02";
import {
  recordUserOverride,
  updateFlowProgress,
} from "./recommendation/tracker.js?v=20260625_02";
import {
  normalizeTestQuestion,
  shuffleTestQuestionOptions,
  shuffleTestQuestionsInList,
} from "./shuffle-options.js";
import {
  clearSessionConceptStorage,
  commitSessionConceptsForBlock,
  renderDictionary,
  getConceptHighlightsForBlock,
  getSortedSessionConcepts,
  restoreSessionConceptStorage,
  registerDictionaryChromeSyncHook,
  syncConceptsFromBlock,
  updateDictionaryButtonVisibility,
} from "./dictionary.js?v=20260625_02";
import { extractSneakPeek } from "./sneakPeek.js?v=20260625_02";
import { DEFAULT_N_SOCRATIC, DEFAULT_N_TEST, MAX_N_SOCRATIC, MAX_N_TEST } from "./config.js?v=20260625_02";
import {
  exportOfflinePack,
  exportSessionMarkdown,
  exportClozeItemsMarkdown,
  downloadTextFile,
  resolveSessionForExport,
} from "./export.js?v=20260625_02";
import { computePersistenceHealth, tryRecoverBlocksFromV1Backup } from "./block-store.js";
import {
  clearGuideChatStorage,
  refreshGuideContext,
  triggerCommentReply,
} from "./guide-chat.js?v=20260625_02";
import {
  clearMarkdownContainer,
  hasMathInHtml,
  renderMarkdown,
  renderMcOptionHtml,
} from "./markdown.js?v=20260625_02";
import { cancelRsvpTimer, finishRsvp, loadRsvpDefaultsFromStorage, persistRsvpDefaults, rsvpState, setRsvpBlockTitle, setRsvpOverlayActive, setRsvpPlayState, setRsvpWpmCap, setWordsPerFlash, startRsvpForText, wireRsvpHandlers } from "./rsvp.js?v=20260625_02";
import {
  applySessionWpmCalibration,
  ensureSessionStartWpm,
  recordBlockRsvpWpm,
  shouldCalibrateStudyMode,
} from "./rsvp/wpm-calibration.js?v=20260625_02";
import {
  finishPacedRead,
  isPacedReaderActive,
  isPacedReaderPreferred,
  pacedReaderState,
  setReadingModePref,
  startPacedReadForText,
  wirePacedReaderHandlers,
} from "./paced-reader.js?v=20260625_02";
import { extractResumePayloadFromMarkdown } from "./resume.js?v=20260625_02";
import { isOfflineMode } from "./offline.js?v=20260625_02";
import {
  blocksListTextFromBlockIndex,
  clampInt,
  buildBlockIndexFromResumePayload,
  buildSessionFromResumePayload,
  formatBlockIndexForConfirmation,
  getBlockChunkFromIndex,
  getBlockIndexEntry,
  getBlock,
  getBlockTitleFromList,
  getBlockTitleSafe,
  getBlocksSafe,
  getTotalBlocksSafe,
  initActiveSessionFromBlocksList,
  loadDefaultQuestionConfig,
  loadActiveSession,
  loadSessionForMode,
  normalizeStudyMode,
  normalizeBlockIndexArray,
  parseImportedIndexText,
  parseOfflinePackMarkdown,
  prefetchState,
  bridgePrefetchState,
  buildBlockConfigKey,
  generateQuestionsOnlyForIndex,
  generateQuestionsBlockForIndex,
  recordResponse,
  resolveBlockQuestionConfig,
  tryApplySocraticTurnCapOverride,
  resolveRegenMode,
  buildQuestionScopeContext,
  ensureSessionPipelineLevers,
  ensureSessionCoverageManifest,
  updateCoverageManifestAfterBlock,
  loadBlockIndex,
  warnBlockGenerationProfileMismatch,
  safeParseJson,
  shouldTriggerCommentReply,
  describeSplitRunMetaForUi,
  storeDefaultQuestionConfig,
  runConceptInventory,
  runConceptInventoryWithFallback,
  packInventoryToBlocks,
  isConceptInventoryValid,
  evaluateConceptInventoryGuard,
  pollUntilConceptInventoryReady,
  reloadSessionForGuard,
  repairStuckRunningPreparationIfNeeded,
  resolveCreateSessionPrepStatus,
  markStalePreparationSession,
  applyKnowledgeProfileToBlockIndex,
  twoPhaseConceptSplit,
  state,
  storeActiveSession,
  triggerPrefetch,
  setOnPrefetchReady,
  setOnBridgeReady,
  setOnPersistFailure,
  triggerBridgePrefetch,
  getPrefetchedBlock,
  hasGeneratedBlockContent,
  isQuestionsStudyMode,
  isReadStudyMode,
  normalizeBlockJson,
  ensureSessionResponseState,
  gapLabelsForBlock,
  generateOfflinePack,
  mergeGapLists,
  setKnowledgeProfile,
  setAssessmentSkipped,
  setPackingIgnoredProfile,
} from "./session.js?v=20260625_02";
import { isBoldHeaderLine, warnStructuredHeaderCount } from "./rsvp-section-headers.js";
import {
  isZeroQuestionBlockTitle,
  isKeyTermsBlockTitle,
  overlapAuditNeedsRetry,
  overlapAuditOverlappingConcepts,
  resolveNextStudyBlockIndex,
} from "./pipeline-levers.js";
import {
  els,
  enableUnifiedMaterialUpload,
  getStudyLanguage,
  getCurrentScreenId,
  hideSidebar,
  setBlockReadContentProvider,
  registerChromeHasConceptsResolver,
  registerChromeStudyModeResolver,
  syncFloatingChrome,
  setBlockReadSidebarAvailable,
  setFullPackEntryCta,
  setOfflinePackButtonVisibility,
  setPrefetchIndicator,
  showScreen,
  showSidebar,
  showInventoryStatusBanner,
  syncSourceFidelityStrictUi,
  wireSourceFidelityStrictUi,
  syncStudyLanguage,
  typesetMath,
  updateFullPackProgressUi,
  updateSessionCompleteSummary,
} from "./ui.js?v=20260625_02";
import { LS_BLOCK_INDEX_KEY, LS_STUDY_NOTES_KEY } from "./config.js?v=20260625_02";
import { formatCharCount } from "./slow/headings.js?v=20260625_02";
import {
  applyFillableMapMode,
  ensurePhase0UserFields,
  getPhase0SeenKeyForSession,
  isPhase0Reread,
  loadPhase0Cache,
  markPhase0Seen,
  savePhase0Cache,
  slugGraphTermId,
  generatePhase0ForScope,
  syncPhase0ConceptsToShared,
} from "./slow/phase0.js?v=20260625_02";
import { initSlowReader, navigateSlowByPhase, setSlowSessionGetter } from "./slow/reader.js?v=20260625_02";
import { clearPhase3ScreenContent, initPhase3Screen } from "./slow/phase3.js?v=20260625_02";
import { computeDepthScore } from "./slow/gamification.js?v=20260625_02";
import { decideSlowReadingModifiers } from "./slow/reading-modifiers.js";
import {
  buildGraphSubgraphMarkdown,
  buildRsvpMaterialGraph,
  buildSessionGraph,
  mountMaterialGraphScreen,
  renderGraphUnlockButtonHtml,
  wireMaterialGraphScreen,
} from "./graph/view.js?v=20260625_02";
import {
  addConcept,
  addEdge,
  createDebouncedPackSaver,
  deleteConcept,
  PACK_EDITOR_EDGE_LABELS,
  PACK_EDITOR_EDGE_TYPES,
  removeEdge,
  renameConcept,
  toCanvasGraph,
} from "./pack-concept-editor.js";
import { createPackDraft, finalizePack, updatePackDraftSnapshot } from "./pack-export.js";
import { lookupPublishedPackByCode, importPackAsSession } from "./pack-import.js";
import { getAuthUserId } from "./session-persist-supabase.js";
import { supabase } from "./supabase-client.js";
import { jumpToAnnotation } from "./slow/sidebar.js?v=20260625_02";
import { getValidItems, getPhaseLabel, runClozePipelinePhases } from "./cloze/pipeline.js?v=20260625_02";
import {
  applyAssessmentPrioritizedOrder,
  enterClozeStudyScreen,
  getActiveClozeConceptIds,
  setClozeStudyCompleteExitHandler,
  wireClozeStudyHandlers,
} from "./cloze/study.js?v=20260625_02";
import { startReviewFromSessionBlocks, runVaultSm2ReviewSession, getCurrentSm2ReviewConceptIds } from "./review.js?v=20260625_02";
import { getActiveRecallConceptIds } from "./recall-study.js";
import {
  initMnemonicChrome,
  syncMnemonicButtonBadge,
} from "./mnemonic.js?v=20260625_02";
import {
  enterProjectLibrary,
  getUploadDefaultProjectId,
  mountModeSelectBreadcrumb,
  populateReviewScopeSelect,
  projectLibraryCallbacks,
  renderProjectLibraryView,
  setUploadProjectContext,
  wireProjectLibraryHandlers,
} from "./project-library.js";
import { prioritizeByAssessmentSignals } from "./assessment-signals.js?v=20260625_02";
import { getDocumentRetrievalModes } from "./mode-taxonomy.js";
import { finalizeBlockQuestionAnswer } from "./block-answer-signals.js";
import { createRecallStudyController } from "./recall-study.js";
import {
  buildModeSliceFromShared,
  resolveModeEntryState,
} from "./mode-bootstrap.js?v=20260625_02";
import {
  addConceptsToShared,
  computeDocId,
  createSession,
  getActiveSession,
  getAllSessions,
  getSession,
  getSmItemsDueToday,
  getVaultReviewDueCount,
  loadProjectStore,
  saveActiveSession as saveDocumentSession,
  setActiveSession,
  setUploadMeta,
  syncAssessmentSignalsToShared,
  updateRecommendation,
  setOnboardingAnswers,
} from "./session-store.js?v=20260625_02";
import {
  findVaultEntryForConceptId,
  getVaultContextForDoc,
} from "./vault/prompt-injection.js";
import { getCurrentMastery, PRESUMED_KNOWN_THRESHOLD } from "./vault/mastery-model.js";
import { importFromDocument } from "./vault/import.js";
import {
  renderVaultGraphTopicPicker,
  renderVaultGraphMode,
  listProjectsForVaultGraphFilter,
  buildSessionsByDocIdMap,
  VAULT_GRAPH_MIN_ENTRIES,
  VAULT_GRAPH_TOPIC_FILTER_THRESHOLD,
  VAULT_GRAPH_MODES,
} from "./vault/vault-graph.js";
import { mountConceptRegistryGraph } from "./concept-registry/graph-mount.js";
import { getConceptById } from "./concept-registry/registry-store.js";
import { renderDetail } from "./vault/debug-ui.js";
import { getEntryById, loadVault } from "./vault/vault-store.js";
import {
  buildBatchContext,
  buildVaultCandidateContext,
  getSiblingRelatedCandidates,
  getStudiedConcepts,
  hasDefinitionFromDoc,
} from "./vault/vault-curation.js";
import {
  createUploadQueue,
  getPendingQueueCount,
  loadUploadQueue,
  processUploadQueue,
  resetStaleProcessingItems,
} from "./vault/vault-upload-queue.js";
import { isAutoDraftNotesEnabled, loadVaultSettings, saveVaultSettings } from "./vault/vault-settings.js";
import { FACET_LABELS } from "./session-types.js";
import { renderReadBlockContent } from "./read-mode.js";
import { setOnReadVisualResolved, triggerReadVisualPrefetch } from "./read-visuals.js";
import { findPithImageTokenIds } from "./document-images/tokens.js";

let blocksListJsonCache = "";

function getBlocksListJsonCache() {
  return blocksListJsonCache;
}

function setBlocksListJsonCache(v) {
  blocksListJsonCache = String(v ?? "");
}

/**
 * Resolve or create DocumentSession for uploaded markdown; set active doc pointer.
 * @param {string} markdown
 */
/** Mirror slow slice docHierarchy onto active DocumentSession.shared. */
export async function syncSlowDocHierarchyToShared(slowSession) {
  const doc = await getActiveSession();
  if (!doc) return;
  doc.shared.docHierarchy = slowSession?.docHierarchy ?? null;
  const hierarchy = slowSession?.docHierarchy;
  doc.shared.docTopics = Array.isArray(hierarchy?.topics) ? hierarchy.topics : [];
  await saveDocumentSession(doc);
}

function needsPreparationResetForReuse(doc) {
  if (isTier1PreparationComplete(doc)) return false;
  const prep = normalizePreparationState(doc?.shared?.preparation);
  const inv = doc?.shared?.conceptInventory?.length ?? 0;
  if (prep.status === "failed") return true;
  if (prep.failReason === "STALE_RUN") return true;
  if ((prep.status === "pending" || prep.status === "running") && inv === 0) return true;
  if (prep.status === "partial" && inv === 0) return true;
  return false;
}

function resetPreparationForFreshRun(doc) {
  if (!doc.shared) doc.shared = {};
  const prep = normalizePreparationState(null);
  setPreparationStatus(prep, "pending");
  doc.shared.preparation = prep;
  doc.shared.conceptInventory = [];
  doc.shared.blockRecommendation = null;
  doc.shared.modeRecommendation = null;
}

export async function ensureDocumentSessionForUpload(markdown, options = {}) {
  const text = String(markdown || "");
  const docId = await computeDocId(text);
  let doc = await getSession(docId);
  if (!doc) {
    doc = await createSession(text, {
      docId,
      projectId: getUploadDefaultProjectId(),
      pendingImages: options.pendingImages,
    });
  } else if (doc.shared.rawMarkdown !== text) {
    doc.shared.rawMarkdown = text;
    doc.shared.docMeta = {
      ...doc.shared.docMeta,
      charCount: text.length,
    };
    if (Array.isArray(options.pendingImages) && options.pendingImages.length) {
      const { persistPendingImages } = await import("./document-images/storage.js");
      try {
        doc.shared.images = await persistPendingImages(docId, options.pendingImages);
      } catch (err) {
        console.warn("[study] image persist failed", err?.message || err);
      }
    }
    await saveDocumentSession(doc);
  }
  // R6: stash structure HeadingCandidates for T1.1 HierarchyNode.source tagging
  if (Array.isArray(options.structureHeadings)) {
    doc.shared.structureHeadings = options.structureHeadings.map((h) => ({
      label: String(h?.label || ""),
      source: String(h?.source || "heuristic"),
      level: Number(h?.level) || 1,
    }));
    await saveDocumentSession(doc);
  }
  if (needsPreparationResetForReuse(doc)) {
    resetPreparationForFreshRun(doc);
    await saveDocumentSession(doc);
  }
  await setActiveSession(docId);
  return doc;
}

let documentPreparationRunId = 0;

/**
 * Run DPP after upload; updates shared preparation state.
 * @param {import("./session-store.js").DocumentSession} doc
 * @param {{ onProgress?: (msg: object) => void, studyNotes?: string, stopAfterTier?: number, forceRerun?: boolean }} [options]
 */
export async function startDocumentPreparation(doc, options = {}) {
  if (!doc?.docId) return null;
  console.debug("[study.startDocumentPreparation] Called:", {
    docId: doc.docId,
    stopAfterTier: options.stopAfterTier ?? 2,
    forceRerun: options.forceRerun === true,
    prepStatus: doc?.shared?.preparation?.status,
    conceptCount: doc?.shared?.conceptInventory?.length ?? 0,
  }); // [debug-enrich]
  const forceRerun = options.forceRerun === true;
  if (forceRerun) {
    console.info("[DPP-GUARD.startDocumentPreparation] Force rerun — bypassing guard", {
      docId: doc.docId,
      priorStatus: doc?.shared?.preparation?.status ?? null,
      conceptCount: doc?.shared?.conceptInventory?.length ?? 0,
    }); // [debug-enrich]
    if (!doc.shared) doc.shared = {};
    doc.shared.preparation = normalizePreparationState(doc.shared.preparation);
    setPreparationStatus(doc.shared.preparation, "pending");
    doc.shared.preparation.failReason = null;
    await saveDocumentSession(doc);
  }
  const stopAfterTier = options.stopAfterTier ?? 2;
  if (!forceRerun && stopAfterTier <= 1) {
    const cached = await fetchSharedDppCache(doc.docId);
    if (cached) {
      hydrateSessionFromSharedCache(doc, cached);
      if (isTier1PreparationComplete(doc)) {
        console.info("[study.startDocumentPreparation] Shared cache hit:", doc.docId);
        await runPostCacheUserPhases(doc, {
          llmModel: getSessionLlmModel(),
          language: getStudyLanguage(),
          studyNotes: options.studyNotes ?? state.studyNotes ?? "",
          onProgress: options.onProgress,
        });
        return doc;
      }
    }
  }
  if (!forceRerun && stopAfterTier <= 1 && isTier1PreparationComplete(doc)) return doc;
  const prep = normalizePreparationState(doc.shared?.preparation);
  if (!forceRerun && prep.status === "ready" && stopAfterTier >= 2) {
    if (!hasPendingTier2Preparation(doc, options)) return doc;
  } else if (!forceRerun && prep.status === "ready" && stopAfterTier <= 1 && isTier1PreparationComplete(doc)) {
    return doc;
  }
  const runId = ++documentPreparationRunId;
  const result = await runDocumentPreparationPipeline(doc, {
    llmModel: getSessionLlmModel(),
    language: getStudyLanguage(),
    studyNotes: options.studyNotes ?? state.studyNotes ?? "",
    stopAfterTier: options.stopAfterTier,
    // ponytail: reuse existing option — create-session already passes stopAfterScopeGate: true
    stopAfterScopeGate: options.stopAfterScopeGate,
    forceRerun,
    onProgress: (msg) => {
      if (runId !== documentPreparationRunId) return;
      options.onProgress?.(msg);
    },
  });
  const prepared = result?.doc ?? doc;
  let reconciled = (await commitPreparedDocToStore(prepared)) ?? prepared;
  const preparedStatus = prepared?.shared?.preparation?.status;
  let reconciledStatus = reconciled?.shared?.preparation?.status;
  const terminalPrepared =
    preparedStatus === "ready" ||
    preparedStatus === "partial" ||
    preparedStatus === "failed" ||
    preparedStatus === "legacy";
  const inProgressReconciled =
    reconciledStatus === "running" || reconciledStatus === "pending";
  if (terminalPrepared && inProgressReconciled) {
    console.warn("[study.startDocumentPreparation] Reconcile returned stale in-progress status — force persist.", {
      docId: prepared.docId,
      preparedStatus,
      reconciledStatus,
    });
    await saveDocumentSession(prepared);
    reconciled = (await getSession(prepared.docId)) ?? prepared;
    reconciledStatus = reconciled?.shared?.preparation?.status;
  }
  reconciled = (await repairStuckRunningPreparationIfNeeded(reconciled)) ?? reconciled;
  if (
    (reconciled?.shared?.preparation?.status === "running" ||
      reconciled?.shared?.preparation?.status === "pending") &&
    terminalPrepared
  ) {
    reconciled = prepared;
    await saveDocumentSession(prepared);
    reconciled = (await getSession(prepared.docId)) ?? prepared;
  }
  hydrateCallerDocFromPrepared(doc, reconciled);
  console.info("[study.startDocumentPreparation] Finished:", {
    docId: doc.docId,
    runId,
    status: reconciled?.shared?.preparation?.status ?? result?.status,
    conceptCount: reconciled?.shared?.conceptInventory?.length ?? 0,
    errorCount: result?.errors?.length ?? 0,
  }); // [debug-enrich]
  return reconciled;
}

function notifyPreparationSparseIfNeeded(doc) {
  const prep = doc?.shared?.preparation;
  if (prep?.failReason === "INVENTORY_TOO_SPARSE") {
    showInventoryStatusBanner(
      "Concept inventory is smaller than ideal for this document length. Study will continue with reduced coverage.",
    );
  }
}

const DOCUMENT_QUALITY_POOR_MSG =
  "This document may not have processed correctly — review before studying.";

function notifyDocumentQualityIfNeeded(doc) {
  const tier = doc?.shared?.preparation?.qualitySignal?.tier;
  if (tier === "poor") {
    showInventoryStatusBanner(DOCUMENT_QUALITY_POOR_MSG, {
      id: "document-quality-warning-banner",
    });
  }
}

function formatPreparationProgressMessage(msg) {
  const label = msg?.label || PHASE_LABELS[msg?.phaseId] || msg?.phaseId || "Preparing";
  const wave = msg?.wave ? ` (wave ${msg.wave})` : "";
  return `${label}${wave}?`;
}

const PREPARATION_FAILED_MSG =
  "Document preparation failed. The concept analysis could not complete. You can retry preparation or continue with limited functionality.";

function renderPreparationFailedUi(doc, message = PREPARATION_FAILED_MSG) {
  if (els.modeSelectPreparationFailed) {
    els.modeSelectPreparationFailed.hidden = false;
    const textEl = els.modeSelectPreparationFailed.querySelector(".preparation-failed-text");
    if (textEl) textEl.textContent = message;
  }
  if (els.generateBlocksError) {
    els.generateBlocksError.hidden = false;
    els.generateBlocksError.textContent = message;
  }
  if (els.generateBlocksRetryPreparationBtn) {
    els.generateBlocksRetryPreparationBtn.hidden = false;
  }
  void doc;
}

function clearPreparationFailedUi() {
  if (els.modeSelectPreparationFailed) els.modeSelectPreparationFailed.hidden = true;
  if (els.generateBlocksRetryPreparationBtn) els.generateBlocksRetryPreparationBtn.hidden = true;
}

async function handleRetryPreparationClick() {
  const doc = await getActiveSession();
  if (!doc?.docId) return;
  clearPreparationFailedUi();
  if (els.generateBlocksError) {
    els.generateBlocksError.hidden = true;
    els.generateBlocksError.textContent = "";
  }
  showDocumentPreparingScreen("Retrying document preparation…");
  const prepared = await startDocumentPreparation(doc, {
    forceRerun: true,
    ...preparationGateOptions((msg) => {
      if (els.reviewGeneratingLabel) {
        els.reviewGeneratingLabel.textContent = formatPreparationProgressMessage(msg);
      }
    }),
  });
  const guard = evaluateConceptInventoryGuard(prepared);
  console.info("[DPP-GUARD.retryPreparation] Post-rerun guard", {
    docId: prepared?.docId,
    decision: guard.decision,
    prepStatus: prepared?.shared?.preparation?.status ?? null,
    conceptCount: prepared?.shared?.conceptInventory?.length ?? 0,
  }); // [debug-enrich]
  if (guard.decision === "failed") {
    renderPreparationFailedUi(prepared);
    enterModeSelectScreen();
    return;
  }
  await enterModeSelectAfterTier1Gate(prepared);
}

async function resolveInventoryForBlockFlow(doc, cleanedText, wordCount, splitOpts, statusEl) {
  doc = await repairStuckRunningPreparationIfNeeded(doc);
  const guard = evaluateConceptInventoryGuard(doc);
  console.debug("[study.resolveInventoryForBlockFlow] Guard:", {
    docId: doc?.docId,
    decision: guard.decision,
    conceptCount: doc?.shared?.conceptInventory?.length ?? 0,
    prepStatus: doc?.shared?.preparation?.status,
    wordCount,
  }); // [debug-enrich]
  if (guard.decision === "failed") {
    renderPreparationFailedUi(doc);
    throw new Error(PREPARATION_FAILED_MSG);
  }
  if (guard.decision === "waiting") {
    if (statusEl) statusEl.textContent = "Document preparation in progress…";
    const polled = await pollUntilConceptInventoryReady(() =>
      doc?.docId ? reloadSessionForGuard(doc.docId) : getActiveSession(),
    );
    doc = polled.session || doc;
    if (polled.decision === "stale_retry" || polled.decision === "run") {
      doc = await ensureTier1Preparation(doc, {
        ...splitOpts,
        ...preparationGateOptions((msg) => {
          if (statusEl) statusEl.textContent = formatPreparationProgressMessage(msg);
        }),
      });
    }
    const after = evaluateConceptInventoryGuard(doc);
    if (after.decision === "failed") {
      renderPreparationFailedUi(doc);
      throw new Error(PREPARATION_FAILED_MSG);
    }
    if (after.decision === "waiting") {
      throw new Error("Document preparation is still in progress. Try again shortly.");
    }
  }
  if (guard.decision === "run") {
    if (statusEl) statusEl.textContent = "Preparing document…";
    doc = await ensureTier1Preparation(doc, {
      ...splitOpts,
      ...preparationGateOptions((msg) => {
        if (statusEl) statusEl.textContent = formatPreparationProgressMessage(msg);
      }),
    });
    const afterRun = evaluateConceptInventoryGuard(doc);
    if (afterRun.decision === "failed") {
      renderPreparationFailedUi(doc);
      throw new Error(PREPARATION_FAILED_MSG);
    }
  }
  if (isConceptInventoryValid(doc)) {
    console.debug("[DPP-GUARD.resolveInventoryForBlockFlow] Using valid shared inventory", {
      docId: doc?.docId,
      conceptCount: doc.shared.conceptInventory?.length ?? 0,
    }); // [debug-enrich]
    return { inventory: doc.shared.conceptInventory, doc };
  }
  if (guard.decision === "degraded" || evaluateConceptInventoryGuard(doc).decision === "degraded") {
    const inv = doc?.shared?.conceptInventory;
    if (Array.isArray(inv) && inv.length > 0) {
      return { inventory: inv, doc };
    }
  }
  const docHierarchy = await ensureDocHierarchyForInventory(
    doc,
    cleanedText,
    wordCount,
    (msg) => {
      if (statusEl) statusEl.textContent = msg;
    },
  );
  const invResult = await runConceptInventoryWithFallback(cleanedText, {
    ...splitOpts,
    docHierarchy,
    wordCount,
  });
  notifyInventoryRunStatus(invResult);
  if (invResult.kind === "fallback_mono") {
    throw new Error(
      "Concept inventory could not be generated. Try a shorter section or chapter scope.",
    );
  }
  persistInventoryRunMeta(doc, invResult);
  return { inventory: invResult.inventory, doc };
}

function refreshCreateSessionInsights(doc) {
  const el = els.createSessionStartInsight;
  if (!el) return;
  if (!doc?.shared) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  const parts = [];
  const avgNew = computeAverageNovelty(doc.shared.conceptInventory);
  if (avgNew != null) {
    parts.push(`~${avgNew}% of this material looks new to you`);
  }
  const related = Array.isArray(doc.shared.relatedDocuments) ? doc.shared.relatedDocuments : [];
  const dupe = related.find((r) => (r?.score ?? 0) >= DOC_SIMILARITY_DUPLICATE_THRESHOLD);
  if (dupe) {
    parts.push(
      `This looks very similar to "${dupe.title || dupe.docId}" — did you mean to re-upload?`,
    );
  }
  if (!parts.length) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = parts.join(" · ");
}

function preparationGateOptions(onProgress) {
  return {
    llmModel: getSessionLlmModel(),
    language: getStudyLanguage(),
    studyNotes: state.studyNotes,
    onProgress,
  };
}

function showDocumentPreparingScreen(initialLabel = "Processing document…") {
  if (els.reviewGeneratingLabel) {
    els.reviewGeneratingLabel.textContent = initialLabel;
  }
  if (els.reviewGeneratingCancelBtn) {
    els.reviewGeneratingCancelBtn.hidden = true;
  }
  if (els.reviewGeneratingError) {
    els.reviewGeneratingError.hidden = true;
    els.reviewGeneratingError.textContent = "";
  }
  showScreen("reviewGenerating");
}

/** @type {Map<string, import("./scope-selection.js").ScopeUiNodeState>} */
let scopePickerNodeState = new Map();
let scopePickerFullDocument = true;
/** @type {Set<string>} */
let scopePickerExpandedIds = new Set();
/** @type {import("./scope-selection.js").SelectableHierarchyNode[]|null} */
let scopePickerTree = null;

function renderScopeSelectionScreen(doc, { resetState = true } = {}) {
  const sh = doc?.shared;
  if (!sh) return;
  const raw = String(sh.rawMarkdown || "");
  const tree = sh.docHierarchy?.tree || [];
  // R5: no level cap on scope picker
  scopePickerTree = listSelectableHierarchyTree(tree, null);
  const listEl = els.scopeSelectionList;
  if (!listEl) return;
  listEl.innerHTML = "";

  if (resetState) {
    scopePickerFullDocument = sh.scopeSelection == null;
    scopePickerExpandedIds = defaultExpandedScopeIds(
      scopePickerTree,
      SCOPE_TREE_DEFAULT_EXPANDED_LEVEL,
    );
    scopePickerNodeState = scopePickerFullDocument
      ? new Map()
      : scopeSelectionToUiState(scopePickerTree, sh.scopeSelection);
  }

  const appendRows = (nodes, parentUl) => {
    for (const entry of nodes) {
      const { node, id, children } = entry;
      const hasKids = children.length > 0;
      const expanded = scopePickerExpandedIds.has(id);
      const li = document.createElement("li");
      li.className = "scope-selection-row";
      li.dataset.scopeId = id;

      const row = document.createElement("div");
      row.className = `scope-selection-item scope-selection-item--level-${node.level}`;
      row.style.paddingInlineStart = `${Math.max(0, (node.level - 1) * 16)}px`;

      if (hasKids) {
        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "scope-selection-expand";
        toggleBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
        toggleBtn.setAttribute(
          "aria-label",
          expanded ? "Collapse section" : "Expand section",
        );
        toggleBtn.textContent = expanded ? "▼" : "▶";
        toggleBtn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (scopePickerExpandedIds.has(id)) scopePickerExpandedIds.delete(id);
          else scopePickerExpandedIds.add(id);
          renderScopeSelectionScreen(doc, { resetState: false });
        });
        row.appendChild(toggleBtn);
      } else {
        const spacer = document.createElement("span");
        spacer.className = "scope-selection-expand-spacer";
        spacer.setAttribute("aria-hidden", "true");
        row.appendChild(spacer);
      }

      const label = document.createElement("label");
      label.className = "scope-selection-item-label";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = id;
      const s = scopePickerFullDocument
        ? "checked"
        : scopePickerNodeState.get(id) || "unchecked";
      cb.checked = s === "checked";
      cb.indeterminate = s === "indeterminate";
      cb.setAttribute(
        "aria-checked",
        s === "indeterminate" ? "mixed" : s === "checked" ? "true" : "false",
      );
      cb.addEventListener("change", () => {
        if (scopePickerFullDocument) {
          scopePickerFullDocument = false;
          scopePickerNodeState = scopeSelectionToUiState(scopePickerTree, {
            fullyCheckedIds: listSelectableHierarchyNodes(tree, null).map((e) => e.id),
            indeterminateIds: [],
          });
        }
        toggleScopeNode(entry, scopePickerNodeState, scopePickerTree || []);
        maybePromoteScopePickerToFullDocument(tree);
        updateScopeSelectionUi(doc, raw);
      });
      const span = document.createElement("span");
      span.textContent = `${node.title} (${formatCharCount(node.endOffset - node.startOffset)})`;
      label.append(cb, span);
      row.appendChild(label);
      li.appendChild(row);
      if (hasKids && expanded) {
        const childUl = document.createElement("ul");
        childUl.className = "scope-selection-list scope-selection-list--nested";
        appendRows(children, childUl);
        li.appendChild(childUl);
      }
      parentUl.appendChild(li);
    }
  };

  appendRows(scopePickerTree, listEl);
  updateScopeSelectionUi(doc, raw);
}

function maybePromoteScopePickerToFullDocument(tree) {
  const entries = listSelectableHierarchyNodes(tree || [], null);
  if (!entries.length) return;
  if (entries.every((e) => (scopePickerNodeState.get(e.id) || "unchecked") === "checked")) {
    scopePickerFullDocument = true;
    scopePickerNodeState = new Map();
  }
}

function updateScopeSelectionUi(doc, rawMarkdown) {
  const raw = rawMarkdown || String(doc?.shared?.rawMarkdown || "");
  let charCount = raw.length;
  let canConfirm = scopePickerFullDocument;

  if (!scopePickerFullDocument) {
    const ids = uiStateToScopeSelectionIds(scopePickerTree || [], scopePickerNodeState);
    const built = buildScopedMarkdown(raw, doc?.shared?.docHierarchy, ids);
    charCount = built.scopedMarkdown.length;
    canConfirm =
      (ids.fullyCheckedIds.length > 0 || ids.indeterminateIds.length > 0) && charCount > 0;
  }

  for (const cb of els.scopeSelectionList?.querySelectorAll("input[type=checkbox]") || []) {
    const id = cb.value;
    if (scopePickerFullDocument) {
      cb.checked = true;
      cb.indeterminate = false;
      cb.setAttribute("aria-checked", "true");
      continue;
    }
    const s = scopePickerNodeState.get(id) || "unchecked";
    cb.checked = s === "checked";
    cb.indeterminate = s === "indeterminate";
    cb.setAttribute(
      "aria-checked",
      s === "indeterminate" ? "mixed" : s === "checked" ? "true" : "false",
    );
  }

  if (els.scopeSelectionCharCount) {
    els.scopeSelectionCharCount.textContent = scopePickerFullDocument
      ? `Entire document (${formatCharCount(charCount)} characters)`
      : `Selected scope: ${formatCharCount(charCount)} characters`;
  }
  if (els.scopeSelectionConfirmBtn) els.scopeSelectionConfirmBtn.disabled = !canConfirm;
}

async function applyScopeSelectionToDoc(doc, { fullDocument, fullyCheckedIds, indeterminateIds }) {
  const raw = String(doc.shared?.rawMarkdown || "");
  console.info("[study.applyScopeSelectionToDoc] Applying scope:", {
    docId: doc.docId ?? null,
    fullDocument: Boolean(fullDocument),
    fullyCheckedCount: Array.isArray(fullyCheckedIds) ? fullyCheckedIds.length : 0,
    indeterminateCount: Array.isArray(indeterminateIds) ? indeterminateIds.length : 0,
    rawLen: raw.length,
    hasHierarchy: Boolean(doc.shared?.docHierarchy),
  });
  if (fullDocument) {
    doc.shared.scopeSelection = null;
    doc.shared.scopedMarkdown = raw;
    doc.shared.scopeContext = null;
  } else {
    const selection = {
      fullyCheckedIds: fullyCheckedIds || [],
      indeterminateIds: indeterminateIds || [],
    };
    const { scopedMarkdown } = buildScopedMarkdown(raw, doc.shared.docHierarchy, selection);
    doc.shared.scopedMarkdown = scopedMarkdown;
    doc.shared.scopeSelection = buildScopeSelection(raw, doc.shared.docHierarchy, selection);
    const titleById = new Map(
      listSelectableHierarchyNodes(doc.shared.docHierarchy?.tree || [], null).map((e) => [
        e.id,
        e.node.title,
      ]),
    );
    const selectedTitles = [
      ...(selection.fullyCheckedIds || []),
      ...(selection.indeterminateIds || []),
    ]
      .map((id) => titleById.get(id))
      .filter(Boolean);
    try {
      doc.shared.scopeContext = await generateScopeContext({
        llmModel: getSessionLlmModel(),
        docHierarchy: doc.shared.docHierarchy,
        selectedTitles,
        language: getStudyLanguage(),
      });
    } catch (err) {
      console.warn("[scope] scopeContext generation failed:", err?.message || err);
      doc.shared.scopeContext = null;
    }
  }
  doc.shared.scopeResolvedAt = Date.now();
  doc.updatedAt = Date.now();
  setGuideScopeFromDocument(doc);
  await saveDocumentSession(doc);
  console.info("[study.applyScopeSelectionToDoc] Scope persisted:", {
    docId: doc.docId ?? null,
    scopedLen: doc.shared?.scopedMarkdown?.length ?? 0,
    hasScopeContext: Boolean(doc.shared?.scopeContext),
  });
}


async function autoResolveScopeWhenNoHeadings(doc) {
  if (isScopeGateResolved(doc) || isScopeStructureReady(doc)) return doc;
  // [debug-enrich]
  console.info('[study.autoResolveScopeWhenNoHeadings] Auto full-document scope:', {
    docId: doc.docId ?? null,
  });
  const raw = String(doc.shared?.rawMarkdown || "");
  doc.shared.scopeSelection = null;
  doc.shared.scopedMarkdown = raw;
  doc.shared.scopeContext = null;
  doc.shared.scopeResolvedAt = Date.now();
  setGuideScopeFromDocument(doc);
  await saveDocumentSession(doc);
  return doc;
}

async function maybeEnterScopeSelectionGate(doc) {
  if (isScopeGateResolved(doc)) {
    // [debug-enrich]
    console.debug('[study.maybeEnterScopeSelectionGate] Already resolved — skip');
    return false;
  }
  doc = await autoResolveScopeWhenNoHeadings(doc);
  if (isScopeGateResolved(doc)) {
    // [debug-enrich]
    console.debug('[study.maybeEnterScopeSelectionGate] Resolved after auto — skip UI');
    return false;
  }
  if (!isScopeStructureReady(doc)) {
    // [debug-enrich]
    console.debug('[study.maybeEnterScopeSelectionGate] Structure not ready — skip UI');
    return false;
  }
  // [debug-enrich]
  console.info('[study.maybeEnterScopeSelectionGate] Entering scope selection UI:', {
    docId: doc.docId ?? null,
  });
  // [BUG-AUDIT] temporary — remove after confirm-hang diagnosis
  console.log("[BUG-AUDIT.maybeEnterScopeSelectionGate] RE-SHOWING scope UI (stay on scopeSelection)", {
    docId: doc.docId ?? null,
    scopeResolvedAt: doc?.shared?.scopeResolvedAt ?? null,
  });
  renderScopeSelectionScreen(doc);
  showScreen("scopeSelection");
  return true;
}

function wireScopeSelectionHandlers() {
  if (els.scopeSelectionFullBtn?._wired) return;
  if (els.scopeSelectionFullBtn) els.scopeSelectionFullBtn._wired = true;
  // [BUG-AUDIT] temporary — remove after confirm-hang diagnosis
  console.log("[BUG-AUDIT.wireScopeSelectionHandlers] wiring", {
    hasFullBtn: Boolean(els.scopeSelectionFullBtn),
    hasConfirmBtn: Boolean(els.scopeSelectionConfirmBtn),
    confirmBtnId: els.scopeSelectionConfirmBtn?.id ?? null,
  });

  els.scopeSelectionFullBtn?.addEventListener("click", async () => {
    const doc = await getActiveSession();
    if (!doc) return;
    scopePickerFullDocument = true;
    scopePickerNodeState = new Map();
    updateScopeSelectionUi(doc, doc.shared?.rawMarkdown);
  });

  els.scopeSelectionConfirmBtn?.addEventListener("click", async () => {
    // [BUG-AUDIT] temporary — remove after confirm-hang diagnosis
    console.log("[BUG-AUDIT.scopeConfirm] click fired", {
      btnDisabled: els.scopeSelectionConfirmBtn?.disabled ?? null,
      fullDocument: scopePickerFullDocument,
      nodeStateSize: scopePickerNodeState.size,
      activeDocIdLs: localStorage.getItem("pith_active_doc_id"),
    });
    const doc = await getActiveSession();
    // [BUG-AUDIT] temporary — remove after confirm-hang diagnosis
    console.log("[BUG-AUDIT.scopeConfirm] getActiveSession resolved", {
      hasDoc: Boolean(doc),
      docId: doc?.docId ?? null,
      scopeResolvedAt: doc?.shared?.scopeResolvedAt ?? null,
      prepStatus: doc?.shared?.preparation?.status ?? null,
    });
    if (!doc) {
      // [BUG-AUDIT] temporary — remove after confirm-hang diagnosis
      console.warn("[BUG-AUDIT.scopeConfirm] ABORT — getActiveSession() returned null (silent early-return was here)");
      return;
    }
    if (els.scopeSelectionConfirmBtn) els.scopeSelectionConfirmBtn.disabled = true;
    try {
      const ids = uiStateToScopeSelectionIds(scopePickerTree || [], scopePickerNodeState);
      await applyScopeSelectionToDoc(doc, {
        fullDocument: scopePickerFullDocument,
        fullyCheckedIds: ids.fullyCheckedIds,
        indeterminateIds: ids.indeterminateIds,
      });
      // [BUG-AUDIT] temporary — remove after confirm-hang diagnosis
      console.log("[BUG-AUDIT.scopeConfirm] applyScopeSelectionToDoc done", {
        scopeResolvedAt: doc?.shared?.scopeResolvedAt ?? null,
        scopedLen: doc?.shared?.scopedMarkdown?.length ?? 0,
      });
      // Pass the mutated in-memory doc — do not re-read store/row-cache here (can be stale
      // vs the just-persisted scopeResolvedAt if a concurrent write superseded the cache update).
      // [BUG-AUDIT] temporary — remove after confirm-hang diagnosis
      console.log("[BUG-AUDIT.scopeConfirm] calling enterModeSelectAfterTier1Gate", {
        refreshedDocId: doc?.docId ?? null,
        refreshedScopeResolvedAt: doc?.shared?.scopeResolvedAt ?? null,
      });
      await enterModeSelectAfterTier1Gate(doc);
      // [BUG-AUDIT] temporary — remove after confirm-hang diagnosis
      console.log("[BUG-AUDIT.scopeConfirm] enterModeSelectAfterTier1Gate returned");
    } catch (err) {
      console.error("[scope] confirm failed:", err);
      if (els.scopeSelectionConfirmBtn) els.scopeSelectionConfirmBtn.disabled = false;
    }
  });
}

function wireOnboardingQuestionnaireHandlers() {
  if (els.onboardingQuestionnaireSubmitBtn?._wired) return;
  if (els.onboardingQuestionnaireSubmitBtn) els.onboardingQuestionnaireSubmitBtn._wired = true;
  els.onboardingQuestionnaireSubmitBtn?.addEventListener("click", () => {
    void submitOnboardingQuestionnaire();
  });
}

async function enterModeSelectAfterTier1Gate(preparedDoc = null) {
  let doc = null;
  if (preparedDoc?.docId) {
    doc = (await commitPreparedDocToStore(preparedDoc)) ?? preparedDoc;
    const reloaded = await reloadSessionForGuard(preparedDoc.docId);
    const beforeHeal = reloaded ?? doc;
    doc = await healFreshSharedFieldsAfterStoreReload(preparedDoc, beforeHeal, {
      save: saveDocumentSession,
    });
    if (
      isScopeGateResolved(preparedDoc) &&
      beforeHeal &&
      !isScopeGateResolved(beforeHeal) &&
      doc === preparedDoc
    ) {
      console.warn(
        "[study.enterModeSelectAfterTier1Gate] Store re-read lost scopeResolvedAt — keeping prepared doc",
        {
          docId: preparedDoc.docId,
          preparedScopeResolvedAt: preparedDoc.shared?.scopeResolvedAt ?? null,
          reloadedScopeResolvedAt: beforeHeal.shared?.scopeResolvedAt ?? null,
        },
      );
    }
    if (
      preparedDoc.shared?.onboardingResponses != null &&
      beforeHeal &&
      (beforeHeal.shared?.onboardingResponses == null ||
        (Number(preparedDoc.shared.onboardingResponses.answeredAt) || 0) >
          (Number(beforeHeal.shared?.onboardingResponses?.answeredAt) || 0)) &&
      doc === preparedDoc
    ) {
      console.warn(
        "[study.enterModeSelectAfterTier1Gate] Store re-read lost onboardingResponses — keeping prepared doc",
        {
          docId: preparedDoc.docId,
          preparedAnsweredAt: preparedDoc.shared?.onboardingResponses?.answeredAt ?? null,
          reloadedAnsweredAt: beforeHeal.shared?.onboardingResponses?.answeredAt ?? null,
        },
      );
    }
  } else {
    const active = await getActiveSession();
    doc = active?.docId ? (await reloadSessionForGuard(active.docId)) ?? active : active;
  }
  console.info("[study.enterModeSelectAfterTier1Gate] Start:", {
    docId: doc?.docId || null,
    hasPreparedDoc: Boolean(preparedDoc?.docId),
    prepStatus: doc?.shared?.preparation?.status || null,
    scopeResolvedAt: doc?.shared?.scopeResolvedAt ?? null,
    hasGateResolved: Boolean(doc?.shared?.assessmentGate?.resolvedAt),
    isOffline: isOfflineMode(),
  }); // [debug-enrich]
  if (!doc?.docId) {
    enterModeSelectScreen();
    return;
  }

  doc = await repairStuckRunningPreparationIfNeeded(doc);
  clearPreparationFailedUi();
  let guard = evaluateConceptInventoryGuard(doc);
  console.info("[DPP-GUARD.enterModeSelectAfterTier1Gate] Initial guard", {
    docId: doc.docId,
    decision: guard.decision,
    prepStatus: doc?.shared?.preparation?.status ?? null,
    conceptCount: doc?.shared?.conceptInventory?.length ?? 0,
    tier1Complete: isTier1PreparationComplete(doc),
  }); // [debug-enrich]
  if (guard.decision === "failed") {
    renderPreparationFailedUi(doc);
    enterModeSelectScreen();
    return;
  }

  if (!isScopeStructureReady(doc)) {
    showDocumentPreparingScreen("Analyzing document structure…");
    doc = await ensureScopeStructurePreparation(doc, {
      ...preparationGateOptions((msg) => {
        if (els.reviewGeneratingLabel) {
          els.reviewGeneratingLabel.textContent = formatPreparationProgressMessage(msg);
        }
      }),
    });
  }

  if (await maybeEnterScopeSelectionGate(doc)) return;
  if (await maybeEnterOnboardingQuestionnaireGate(doc)) return;

  if (guard.decision === "waiting") {
    showDocumentPreparingScreen("Document preparation in progress…");
    const docId = doc.docId;
    const polled = await pollUntilConceptInventoryReady(() => reloadSessionForGuard(docId));
    doc = polled.session || doc;
    if (polled.decision === "stale_retry" || polled.decision === "run") {
      // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
      console.log("[DIAG-T12-TRIGGER] before ensureTier1Preparation (after poll run/stale_retry)", {
        docId: doc?.docId ?? null,
        ts: Date.now(),
        iso: new Date().toISOString(),
        polledDecision: polled.decision,
        prepStatus: doc?.shared?.preparation?.status ?? null,
      });
      doc = await ensureTier1Preparation(doc, {
        ...preparationGateOptions((msg) => {
          if (els.reviewGeneratingLabel) {
            els.reviewGeneratingLabel.textContent = formatPreparationProgressMessage(msg);
          }
        }),
      });
      // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
      console.log("[DIAG-T12-TRIGGER] after ensureTier1Preparation (after poll run/stale_retry)", {
        docId: doc?.docId ?? null,
        ts: Date.now(),
        iso: new Date().toISOString(),
        prepStatus: doc?.shared?.preparation?.status ?? null,
        conceptCount: doc?.shared?.conceptInventory?.length ?? 0,
      });
    }
    guard = evaluateConceptInventoryGuard(doc);
    console.info("[DPP-GUARD.enterModeSelectAfterTier1Gate] Guard after poll/run", {
      docId: doc?.docId,
      decision: guard.decision,
      prepStatus: doc?.shared?.preparation?.status ?? null,
      conceptCount: doc?.shared?.conceptInventory?.length ?? 0,
    }); // [debug-enrich]
    if (guard.decision === "failed") {
      renderPreparationFailedUi(doc);
      enterModeSelectScreen();
      return;
    }
    if (guard.decision === "waiting") {
      renderPreparationFailedUi(
        doc,
        "Document preparation timed out. Check your connection and retry, or reload the page.",
      );
      enterModeSelectScreen();
      return;
    }
  }

  if (guard.decision === "run") {
    showDocumentPreparingScreen();
    // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
    console.log("[DIAG-T12-TRIGGER] before ensureTier1Preparation (guard decision=run)", {
      docId: doc?.docId ?? null,
      ts: Date.now(),
      iso: new Date().toISOString(),
      prepStatus: doc?.shared?.preparation?.status ?? null,
      conceptCount: doc?.shared?.conceptInventory?.length ?? 0,
      scopeResolvedAt: doc?.shared?.scopeResolvedAt ?? null,
    });
    doc = await ensureTier1Preparation(doc, {
      ...preparationGateOptions((msg) => {
        if (els.reviewGeneratingLabel) {
          els.reviewGeneratingLabel.textContent = formatPreparationProgressMessage(msg);
        }
      }),
    });
    // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
    console.log("[DIAG-T12-TRIGGER] after ensureTier1Preparation (guard decision=run)", {
      docId: doc?.docId ?? null,
      ts: Date.now(),
      iso: new Date().toISOString(),
      prepStatus: doc?.shared?.preparation?.status ?? null,
      conceptCount: doc?.shared?.conceptInventory?.length ?? 0,
    });
    guard = evaluateConceptInventoryGuard(doc);
    console.info("[DPP-GUARD.enterModeSelectAfterTier1Gate] Guard after poll/run", {
      docId: doc?.docId,
      decision: guard.decision,
      prepStatus: doc?.shared?.preparation?.status ?? null,
      conceptCount: doc?.shared?.conceptInventory?.length ?? 0,
    }); // [debug-enrich]
    if (guard.decision === "failed") {
      renderPreparationFailedUi(doc);
      enterModeSelectScreen();
      return;
    }
  }

  if (!isTier1PreparationComplete(doc)) {
    showDocumentPreparingScreen();
    doc = await ensureTier1Preparation(doc, {
      ...preparationGateOptions((msg) => {
        if (els.reviewGeneratingLabel) {
          els.reviewGeneratingLabel.textContent = formatPreparationProgressMessage(msg);
        }
      }),
    });
    if (!isTier1PreparationComplete(doc)) {
      const afterGuard = evaluateConceptInventoryGuard(doc);
      if (afterGuard.decision === "failed") {
        renderPreparationFailedUi(doc);
        enterModeSelectScreen();
        return;
      }
      showScreen("createSessionStart");
      if (els.createSessionStartStatus) {
        els.createSessionStartStatus.textContent =
          "Document preparation incomplete. Add an API key in Settings or retry.";
      }
      return;
    }
  }
  if (await maybeEnterSharedAssessmentGate(doc)) return;
  await finalizeModeSelectEntry(doc);
}

function shouldOfferSharedAssessmentGate(doc) {
  console.debug("[study.shouldOfferSharedAssessmentGate] Evaluate:", {
    docId: doc?.docId || null,
    enabled: isSharedPreModeAssessmentEnabled(),
    offline: isOfflineMode(),
    interview: isInterviewOriginSession(doc),
    tier1Ready: isTier1PreparationComplete(doc),
    alreadyResolved: isAssessmentGateResolved(doc),
  }); // [debug-enrich]
  if (!isSharedPreModeAssessmentEnabled()) return false;
  if (isOfflineMode()) return false;
  if (isInterviewOriginSession(doc)) return false;
  if (!isTier1PreparationComplete(doc)) return false;
  if (isAssessmentGateResolved(doc)) return false;
  return true;
}

/** @type {object | null} Known-fresh doc while assessment gate is open (Round-3 stale re-read). */
let assessmentGateFreshDoc = null;

async function finalizeModeSelectEntry(doc) {
  setGuideScopeFromDocument(doc);
  console.info("[study.finalizeModeSelectEntry] Start:", {
    docId: doc?.docId || null,
    hasModeRec: Boolean(doc?.shared?.modeRecommendation),
    hasSharedProfile: Boolean(doc?.shared?.knowledgeProfile),
    hasOnboarding: Boolean(doc?.shared?.onboardingResponses),
  }); // [debug-enrich]
  migrateKnowledgeProfileToShared(doc);
  const needsOnboardingRec =
    Boolean(doc?.shared?.onboardingResponses) &&
    doc?.shared?.modeRecommendation?.method !== "onboarding";
  if (!doc?.shared?.modeRecommendation || needsOnboardingRec) {
    await runModeRecommendationPhase(doc, preparationGateOptions(), {
      knowledgeProfile: doc?.shared?.knowledgeProfile ?? null,
      force: true,
    });
    await saveDocumentSession(doc);
    if (doc.docId && doc.shared?.modeRecommendation) {
      await updateRecommendation(doc.docId, doc.shared.modeRecommendation);
    }
  }
  kickoffTier2PreparationInBackground(doc, preparationGateOptions());
  console.info("[study.finalizeModeSelectEntry] Done:", {
    docId: doc?.docId || null,
    hasModeRec: Boolean(doc?.shared?.modeRecommendation),
  }); // [debug-enrich]
  enterModeSelectScreen();
}

/**
 * @param {import("./session-store.js").DocumentSession | null | undefined} doc
 * @returns {Promise<boolean>} true if questionnaire screen shown
 */
async function maybeEnterOnboardingQuestionnaireGate(doc) {
  if (!doc?.docId) return false;
  const hasOnboarding = doc.shared?.onboardingResponses != null;
  console.info("[DPP-GUARD.maybeEnterOnboardingQuestionnaireGate]", {
    docId: doc.docId,
    hasOnboardingResponses: hasOnboarding,
    answeredAt: doc.shared?.onboardingResponses?.answeredAt ?? null,
    willShow: !hasOnboarding && !isInterviewOriginSession(doc),
  });
  if (hasOnboarding) return false;
  if (isInterviewOriginSession(doc)) return false;
  showScreen("onboardingQuestionnaire");
  return true;
}

/**
 * @returns {{
 *   socraticModality: string,
 *   pace: string,
 *   memorizationVsUnderstanding: string,
 *   sourceVsExplained: string,
 * } | null}
 */
function readOnboardingQuestionnaireForm() {
  const screen = els.screenOnboardingQuestionnaire;
  if (!screen) return null;
  const pick = (name) => screen.querySelector(`input[name="${name}"]:checked`)?.value;
  const socraticModality = pick("onboardingRq1");
  const pace = pick("onboardingRq2");
  const memorizationVsUnderstanding = pick("onboardingRq3");
  const sourceVsExplained = pick("onboardingRq4");
  if (!socraticModality || !pace || !memorizationVsUnderstanding || !sourceVsExplained) return null;
  return { socraticModality, pace, memorizationVsUnderstanding, sourceVsExplained };
}

async function submitOnboardingQuestionnaire() {
  // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
  // Note: docId is null here until getActiveSession resolves (see audit); not a race cause.
  console.log("[DIAG-T12-ONBOARD] submitOnboardingQuestionnaire ENTER", {
    docId: null,
    ts: Date.now(),
    iso: new Date().toISOString(),
  });
  const doc = await getActiveSession();
  // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
  console.log("[DIAG-T12-ONBOARD] submitOnboardingQuestionnaire after getActiveSession", {
    docId: doc?.docId ?? null,
    ts: Date.now(),
    iso: new Date().toISOString(),
  });
  if (!doc?.docId) {
    // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
    console.log("[DIAG-T12-ONBOARD] submitOnboardingQuestionnaire EXIT early — no doc", {
      docId: null,
      ts: Date.now(),
      iso: new Date().toISOString(),
    });
    return;
  }
  const answers = readOnboardingQuestionnaireForm();
  if (!answers) {
    // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
    console.log("[DIAG-T12-ONBOARD] submitOnboardingQuestionnaire EXIT early — incomplete form", {
      docId: doc.docId,
      ts: Date.now(),
      iso: new Date().toISOString(),
    });
    return;
  }
  const intentEl = els.onboardingStudentIntent;
  const studentIntent = intentEl ? String(intentEl.value || "").trim() : "";
  els.onboardingQuestionnaireSubmitBtn && (els.onboardingQuestionnaireSubmitBtn.disabled = true);
  try {
    const saved = await setOnboardingAnswers(doc.docId, {
      onboardingResponses: { ...answers, answeredAt: Date.now() },
      studentIntent,
    });
    // Retain the known-fresh session from setOnboardingAnswers — do not re-read store
    // (same Round-3 class: superseded write can leave row cache without answers).
    // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
    console.log("[DIAG-T12-ONBOARD] before enterModeSelectAfterTier1Gate", {
      docId: (saved || doc)?.docId ?? doc.docId,
      ts: Date.now(),
      iso: new Date().toISOString(),
    });
    await enterModeSelectAfterTier1Gate(saved || doc);
    // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
    console.log("[DIAG-T12-ONBOARD] after enterModeSelectAfterTier1Gate", {
      docId: (saved || doc)?.docId ?? doc.docId,
      ts: Date.now(),
      iso: new Date().toISOString(),
    });
  } catch (err) {
    // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
    console.log("[DIAG-T12-CATCH] submitOnboardingQuestionnaire catch", {
      docId: doc?.docId ?? null,
      ts: Date.now(),
      iso: new Date().toISOString(),
      message: err?.message || String(err),
      stack: err?.stack ?? null,
    });
    console.warn("[study.submitOnboardingQuestionnaire] failed", err);
    // ponytail: local re-enable; avoid importing ui sync (circular study↔ui under ?v=)
    if (els.onboardingQuestionnaireSubmitBtn && els.screenOnboardingQuestionnaire) {
      const screen = els.screenOnboardingQuestionnaire;
      const names = ["onboardingRq1", "onboardingRq2", "onboardingRq3", "onboardingRq4"];
      els.onboardingQuestionnaireSubmitBtn.disabled = !names.every(
        (name) => !!screen.querySelector(`input[name="${name}"]:checked`),
      );
    }
  }
  // [DIAG-T12] temporary — remove after T1.2 hang diagnosis
  console.log("[DIAG-T12-ONBOARD] submitOnboardingQuestionnaire EXIT", {
    docId: doc?.docId ?? null,
    ts: Date.now(),
    iso: new Date().toISOString(),
  });
}

async function maybeEnterSharedAssessmentGate(doc) {
  if (!shouldOfferSharedAssessmentGate(doc)) return false;
  console.info("[study.maybeEnterSharedAssessmentGate] Enter gate:", {
    docId: doc?.docId || null,
    conceptCount: doc?.shared?.conceptInventory?.length || 0,
  }); // [debug-enrich]
  // Retain known-fresh doc for Accept — do not re-read store (superseded DPP
  // checkpoint can leave row cache with conceptInventory: []).
  assessmentGateFreshDoc = doc;
  showScreen("assessmentGate");
  return true;
}

async function completeSharedAssessmentGate({ outcome, profile }) {
  assessmentGateFreshDoc = null;
  let doc = await getActiveSession();
  console.info("[study.completeSharedAssessmentGate] Start:", {
    docId: doc?.docId || null,
    outcome,
    hasProfile: Boolean(profile),
  }); // [debug-enrich]
  if (!doc?.docId) {
    resetPrePackingFlow();
    enterModeSelectScreen();
    return;
  }
  persistSharedKnowledgeProfile(doc, profile, outcome);
  doc.shared.modeRecommendation = null;
  await runModeRecommendationPhase(doc, preparationGateOptions(), {
    knowledgeProfile: doc.shared?.knowledgeProfile ?? null,
    force: true,
  });
  await saveDocumentSession(doc);
  if (doc.shared?.modeRecommendation) {
    await updateRecommendation(doc.docId, doc.shared.modeRecommendation);
  }
  resetPrePackingFlow();
  kickoffTier2PreparationInBackground(doc, preparationGateOptions());
  console.info("[study.completeSharedAssessmentGate] Done:", {
    docId: doc?.docId || null,
    hasModeRec: Boolean(doc?.shared?.modeRecommendation),
    gateOutcome: doc?.shared?.assessmentGate?.outcome || null,
  }); // [debug-enrich]
  enterModeSelectScreen();
}

async function startSharedAssessmentFromGate() {
  const stashed = assessmentGateFreshDoc;
  assessmentGateFreshDoc = null;
  const active = await getActiveSession();
  // Prefer known-fresh doc stashed at gate show (Round-3: no blind store re-read).
  const doc =
    stashed?.docId && (!active?.docId || stashed.docId === active.docId) ? stashed : active;
  console.info("[study.startSharedAssessmentFromGate] Start:", {
    docId: doc?.docId || null,
    inventorySize: doc?.shared?.conceptInventory?.length || 0,
    usedStash: Boolean(stashed && doc === stashed),
  }); // [debug-enrich]
  if (!doc?.shared?.conceptInventory?.length) {
    console.warn(
      "[study.startSharedAssessmentFromGate] assessment gate accepted with empty inventory — possible stale read",
      {
        docId: doc?.docId ?? null,
        hadStash: Boolean(stashed),
        activeInventorySize: active?.shared?.conceptInventory?.length || 0,
      },
    );
    await completeSharedAssessmentGate({ outcome: "skipped", profile: null });
    return;
  }
  // ponytail: shared assessment uses scoped study text (FR-004)
  const cleanedText = String(resolveScopedMarkdown(doc) || "");
  const conceptInventory = doc.shared.conceptInventory;
  const prepEdges = deriveInventoryEdges(conceptInventory, doc.shared.conceptGraph);
  resetPrePackingFlow();
  prePackingFlow = {
    runnerMode: "shared_gate",
    fromSharedGate: true,
    phase: "assessment",
    conceptInventory,
    edges: prepEdges,
    docHierarchy: resolveScopedHierarchy(doc) ?? doc.shared.docHierarchy ?? null,
    conceptGraph: doc.shared.conceptGraph ?? null,
    cleanedText,
    splitOpts: {
      llmModel: getDefaultLlmModel(),
      language: getStudyLanguage(),
    },
    assessmentItems: [],
    itemsPromise: null,
    responses: [],
    knowledgeProfile: null,
    questionIndex: 0,
  };
  console.debug("[study.startSharedAssessmentFromGate] Flow initialized:", {
    docId: doc?.docId || null,
    runnerMode: prePackingFlow.runnerMode,
    inventorySize: conceptInventory.length,
    edgeCount: prepEdges.length,
  }); // [debug-enrich]
  if (els.prePackingAssessmentSkip) {
    els.prePackingAssessmentSkip.textContent = "Skip for now";
  }
  const intro = document.querySelector(".pre-packing-assessment-intro");
  if (intro) {
    intro.textContent =
      "Answer a few questions so we can tailor mode recommendations and RSVP blocks to what you already know.";
  }
  await enterPrePackingAssessmentScreen();
}

async function handleAssessmentGateAccept() {
  console.info("[study.handleAssessmentGateAccept] User accepted gate"); // [debug-enrich]
  await startSharedAssessmentFromGate();
}

async function handleAssessmentGateSkip() {
  console.info("[study.handleAssessmentGateSkip] User skipped gate"); // [debug-enrich]
  await completeSharedAssessmentGate({ outcome: "skipped", profile: null });
}

async function handleRedoAssessmentRequest() {
  const doc = await getActiveSession();
  if (!doc?.docId) return;
  console.warn("[study.handleRedoAssessmentRequest] Confirm redo requested:", {
    docId: doc.docId,
  }); // [debug-enrich]
  const ok = window.confirm(
    "Retaking the knowledge check will reset your study progress for this document (modes, spaced repetition, annotations, and assessment signals). Document content and your mnemonics will be kept. Continue?",
  );
  if (!ok) return;
  console.warn("[study.handleRedoAssessmentRequest] Redo confirmed:", {
    docId: doc.docId,
  }); // [debug-enrich]
  resetSessionForAssessmentRedo(doc);
  await saveDocumentSession(doc);
  await maybeEnterSharedAssessmentGate(doc);
  if (!shouldOfferSharedAssessmentGate(doc)) {
    await finalizeModeSelectEntry(doc);
  }
}

function syncModeSelectAssessmentRedoButton(doc) {
  const btn = els.modeSelectRedoAssessmentBtn;
  if (!btn) return;
  const show =
    isSharedPreModeAssessmentEnabled() &&
    !isOfflineMode() &&
    !isInterviewOriginSession(doc) &&
    isAssessmentGateResolved(doc);
  btn.hidden = !show;
}

function applySharedBlockRecommendationToUi(doc) {
  const rec = doc?.shared?.blockRecommendation;
  if (!rec?.nBlocks) return false;
  if (els.blocksInput) els.blocksInput.value = String(rec.nBlocks);
  const signals = rec.signals || rec;
  if (els.recommendBlocksWhy) {
    els.recommendBlocksWhy.textContent =
      (rec.reasoning ?? rec.rationale) || formatBlockCountReasoning(signals);
    els.recommendBlocksWhy.hidden = false;
  }
  if (els.recommendBlocksStatus) {
    els.recommendBlocksStatus.textContent = `Recommended ${rec.nBlocks} blocks`;
  }
  const text = String(doc?.shared?.rawMarkdown || state.lastCleanedMaterialText || "");
  const fingerprint = buildBlockSplitFingerprint({
    file: buildBootstrapFileStub(doc, text),
    studyNotes: state.studyNotes,
    wordCount: countWords(text),
  });
  if (Array.isArray(doc?.shared?.conceptInventory) && doc.shared.conceptInventory.length) {
    setBlockSplitCache({
      fingerprint,
      conceptInventory: doc.shared.conceptInventory,
      recommendation: signals,
    });
  }
  return true;
}

function isDocumentPreparationReady(doc) {
  const status = normalizePreparationState(doc?.shared?.preparation).status;
  return status === "ready" || status === "partial";
}

/**
 * @param {Record<string, unknown> | null | undefined} recommendation
 * @returns {Record<string, unknown> | null}
 */
export function getRecommendedStep(recommendation) {
  if (!recommendation || typeof recommendation !== "object") return null;
  const flow = recommendation.primaryFlow;
  if (!Array.isArray(flow) || !flow.length) return null;
  const idx = recommendation.currentStepIndex;
  if (typeof idx !== "number" || idx < 0 || idx >= flow.length) return null;
  return flow[idx] ?? null;
}

/**
 * @param {import("./session-store.js").DocumentSession | null | undefined} doc
 * @param {string} cleanedText
 * @param {{ pedagogicalMeta?: unknown, method?: string } | null} [hierarchyResult]
 */
export async function computeAndPersistModeRecommendation(
  doc,
  cleanedText,
  hierarchyResult = null,
  options = {},
) {
  if (!doc?.docId) return;
  const responses = doc.shared?.onboardingResponses;
  if (responses) {
    if (doc.shared?.modeRecommendation?.method === "onboarding" && !options.force) return;
    try {
      const textMetrics = analyzeText(String(cleanedText || ""));
      const pedagogicalMeta =
        hierarchyResult?.pedagogicalMeta ?? buildDeterministicPedagogicalMeta(textMetrics);
      const practiceMatchStatus = doc.shared?.practicePrep?.scope?.matchStatus ?? null;
      const algo = computeOnboardingModeRecommendation({
        onboardingResponses: responses,
        textMetrics,
        pedagogicalMeta,
        practiceMatchStatus,
        images: doc.shared?.images,
        scopedMarkdown:
          typeof doc.shared?.scopedMarkdown === "string"
            ? doc.shared.scopedMarkdown
            : String(cleanedText || ""),
      });
      const recommendation = mapOnboardingRecommendationToModeRecommendation(
        algo,
        options.force ? null : doc.shared.modeRecommendation,
      );
      doc.shared.modeRecommendation = recommendation;
      await updateRecommendation(doc.docId, recommendation);
      void tryApplySocraticTurnCapOverride(recommendation.params);
    } catch (err) {
      console.warn("mode recommendation compute failed", err);
    }
    return;
  }
  if (doc.shared?.modeRecommendation && !options.force) return;
  try {
    const textMetrics = analyzeText(String(cleanedText || ""));
    const pedagogicalMeta =
      hierarchyResult?.pedagogicalMeta ?? buildDeterministicPedagogicalMeta(textMetrics);
    const method = hierarchyResult?.method === "llm" ? "llm_meta" : "deterministic";
    const recommendation = computeModeRecommendation(textMetrics, pedagogicalMeta, { method });
    doc.shared.modeRecommendation = recommendation;
    await updateRecommendation(doc.docId, recommendation);
  } catch (err) {
    console.warn("mode recommendation compute failed", err);
  }
}

/**
 * @param {import("./session-store.js").DocumentSession | null | undefined} [doc]
 */
export async function persistFlowRecommendationProgress(doc = null) {
  if (doc == null) doc = await getActiveSession();
  if (!doc?.shared?.modeRecommendation) return;
  try {
    const updated = await updateFlowProgress(doc.shared.modeRecommendation, doc);
    doc.shared.modeRecommendation = updated;
    await updateRecommendation(doc.docId, updated);
  } catch (err) {
    console.warn("flow recommendation progress sync failed", err);
  }
}

/**
 * @param {string} chosenMode
 * @param {import("./session-store.js").DocumentSession | null | undefined} [doc]
 */
export async function applyFlowRecommendationOnEnterMode(chosenMode, doc = null) {
  if (doc == null) doc = await getActiveSession();
  if (!doc?.shared?.modeRecommendation) return;
  try {
    const slot = normalizeStudyMode(chosenMode);
    const recommendedStep = getRecommendedStep(doc.shared.modeRecommendation);
    if (recommendedStep && slot !== normalizeStudyMode(recommendedStep.mode)) {
      const updated = recordUserOverride(doc.shared.modeRecommendation, slot);
      doc.shared.modeRecommendation = updated;
      await updateRecommendation(doc.docId, updated);
    }
  } catch (err) {
    console.warn("flow recommendation enter mode failed", err);
  }
}

/** @type {Record<string, string>} */
const FLOW_MODE_SHORT_LABELS = {
  slow: "Slow",
  cloze: "Cloze",
  review: "Review",
  rsvp: "RSVP",
  read: "Read",
  questions: "Questions",
  practice: "Practice",
};

/**
 * @param {string} mode
 * @returns {string}
 */
export function getFlowModeShortLabel(mode) {
  const raw = String(mode || "").trim();
  if (FLOW_MODE_SHORT_LABELS[raw]) return FLOW_MODE_SHORT_LABELS[raw];
  const slot = normalizeStudyMode(raw);
  return FLOW_MODE_SHORT_LABELS[slot] || getStudyModeLabel(slot);
}

/**
 * @param {Array<{ estimatedTimeMin?: number }> | null | undefined} steps
 * @returns {number}
 */
export function sumFlowTimeMin(steps) {
  if (!Array.isArray(steps)) return 0;
  return steps.reduce((sum, step) => sum + (Number(step?.estimatedTimeMin) || 0), 0);
}

/**
 * @param {Record<string, unknown> | null | undefined} recommendation
 * @returns {boolean}
 */
function hasValidModeRecommendation(recommendation) {
  if (!recommendation || typeof recommendation !== "object") return false;
  const flow = recommendation.primaryFlow;
  return Array.isArray(flow) && flow.length > 0;
}

/**
 * @param {import("./session-store.js").DocumentSession | null | undefined} doc
 * @returns {'intro'|'progress'|'hidden'}
 */
export function resolveFlowPanelViewState(doc) {
  const recommendation = doc?.shared?.modeRecommendation;
  if (recommendation && typeof recommendation === "object" && recommendation.userOverride) {
    return "hidden";
  }
  if (hasValidModeRecommendation(recommendation)) {
    const completed = Array.isArray(recommendation.completedSteps)
      ? recommendation.completedSteps
      : [];
    if (completed.length > 0) return "progress";
    return "intro";
  }
  return "hidden";
}

/**
 * @param {Array<{ mode?: string }>} steps
 * @returns {string}
 */
export function formatIntroFlowLine(steps) {
  if (!Array.isArray(steps) || !steps.length) return "";
  return steps.map((step) => getFlowModeShortLabel(String(step?.mode || ""))).join(" → ");
}

/**
 * @param {Record<string, unknown> | null | undefined} recommendation
 * @param {import("./session-store.js").DocumentSession | null | undefined} [doc]
 * @returns {string}
 */
async function resolveFlowWhyText(recommendation, doc = null) {
  if (doc == null) doc = await getActiveSession();
  // Onboarding reasoning is authoritative when method is onboarding.
  if (recommendation?.method === "onboarding") {
    return String(recommendation?.reasoning || "").trim();
  }
  const hierarchy = doc?.shared?.docHierarchy;
  const pedagogical =
    hierarchy && typeof hierarchy === "object" && hierarchy.pedagogicalMeta
      ? hierarchy.pedagogicalMeta
      : null;
  const genreReasoning =
    pedagogical && typeof pedagogical === "object"
      ? String(pedagogical.genreReasoning || "").trim()
      : "";
  if (genreReasoning) return genreReasoning;
  return String(recommendation?.reasoning || "").trim();
}

/**
 * @param {Record<string, unknown> | null | undefined} recommendation
 * @param {import("./session-store.js").DocumentSession | null | undefined} [doc]
 * @returns {string}
 */
async function buildRecommendationSubtitle(recommendation, doc = null) {
  if (doc == null) doc = await getActiveSession();
  if (recommendation?.method === "onboarding") {
    return String(recommendation?.reasoning || "").trim();
  }
  const reasoning = String(recommendation?.reasoning || "").trim();
  const whyText = await resolveFlowWhyText(recommendation, doc);
  const parts = [];
  if (reasoning) parts.push(reasoning);
  if (whyText && whyText !== reasoning) parts.push(whyText);
  return parts.join(" · ");
}

/**
 * @param {import("./session-store.js").DocumentSession | null | undefined} doc
 * @returns {boolean}
 */
function hasModeSelectRecommendation(doc) {
  const viewState = resolveFlowPanelViewState(doc);
  return (
    (viewState === "intro" || viewState === "progress") &&
    hasValidModeRecommendation(doc?.shared?.modeRecommendation)
  );
}

let modeSelectManualOpen = false;

/**
 * @param {import("./session-store.js").DocumentSession | null | undefined} [doc]
 */
async function syncModeSelectView(doc = null) {
  if (doc == null) doc = await getActiveSession();
  const showRecommended = hasModeSelectRecommendation(doc) && !modeSelectManualOpen;
  const showManual = modeSelectManualOpen || !hasModeSelectRecommendation(doc);
  const canReturnToRecommended = hasModeSelectRecommendation(doc) && modeSelectManualOpen;

  const modeSelectCard = els.screenModeSelect?.querySelector(".mode-select-card");
  const titleEl = modeSelectCard?.querySelector("h1");
  const leadEl = modeSelectCard?.querySelector(".mode-select-lead");
  if (titleEl) titleEl.hidden = showRecommended;
  if (leadEl) leadEl.hidden = showRecommended;

  if (els.recommendationPanel) els.recommendationPanel.hidden = !showRecommended;
  if (els.modeSelectManual) els.modeSelectManual.hidden = !showManual;
  if (els.modeSelectChooseManualBtn) els.modeSelectChooseManualBtn.hidden = !showRecommended;
  if (els.modeSelectUseRecommendedBtn) {
    els.modeSelectUseRecommendedBtn.hidden = !canReturnToRecommended;
  }
  els.modeSelectContinuity?.classList.toggle("mode-select-continuity--separated", showRecommended);
  syncInterviewModeGate(doc);
}

function syncInterviewModeGate(doc) {
  const hidden = [];
  if (isInterviewOriginSession(doc)) hidden.push("rsvp", "slow", "questions");
  // No-source pack imports: Slow/Cloze require the original document.
  if (!isModeAvailableForSession(doc, "slow")) hidden.push("slow");
  if (!isModeAvailableForSession(doc, "cloze")) hidden.push("cloze");
  for (const mode of ["rsvp", "slow", "cloze", "questions", "recall"]) {
    const input = document.querySelector(`input[name="studyMode"][value="${mode}"]`);
    const label = input?.closest(".study-mode-option");
    if (label) label.hidden = hidden.includes(mode);
    if (input && hidden.includes(mode) && input.checked) {
      input.checked = false;
    }
  }
}

async function openModeSelectManualView() {
  modeSelectManualOpen = true;
  await syncModeSelectView(await getActiveSession());
}

async function closeModeSelectManualView() {
  modeSelectManualOpen = false;
  await syncModeSelectView(await getActiveSession());
}

function clearFlowRecommendFeedback() {
  if (els.flowRecommendStatus) els.flowRecommendStatus.textContent = "";
  if (els.flowRecommendError) {
    els.flowRecommendError.hidden = true;
    els.flowRecommendError.textContent = "";
  }
}

function setFlowRecommendLoading(isLoading) {
  if (els.flowRecommendStatus) {
    els.flowRecommendStatus.textContent = isLoading ? "Computing your study flow…" : "";
  }
}

function setFlowRecommendError(message) {
  if (!els.flowRecommendError) return;
  const text = String(message || "").trim();
  if (!text) {
    els.flowRecommendError.hidden = true;
    els.flowRecommendError.textContent = "";
    return;
  }
  els.flowRecommendError.hidden = false;
  els.flowRecommendError.textContent = text;
}

/**
 * Build document hierarchy for flow recommendation (no slow session required).
 * @param {string} markdownText
 * @param {string} [llmModel]
 */
async function buildHierarchyForFlowRecommendation(markdownText, llmModel) {
  const text = String(markdownText || "");
  const needsLlm = text.length >= 3000 && !hasMarkdownHeadings(text);
  let llmFn = null;
  const model = normalizeLlmModel(llmModel || getSessionLlmModel());
  if (needsLlm && getApiKeyForLlmModel(model)) {
    llmFn = async ({ systemPrompt, userPrompt, temperature, maxTokens, signal }) =>
      llmChatCompletions({
        llmModel: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
        signal,
      });
  }
  return buildDocumentHierarchy(text, llmFn, { useCache: true });
}

/**
 * Upload material from mode-select and compute a fresh study-flow recommendation.
 * @param {File} file
 */
export async function recommendFlowFromUploadedFile(file) {
  const { cleanedText, originalFormat, pendingImages, structureHeadings } =
    await readAndCleanMaterialText(file);
  if (!cleanedText.trim()) {
    throw new Error("The file appears to be empty.");
  }
  const doc = await ensureDocumentSessionForUpload(cleanedText, {
    pendingImages,
    structureHeadings,
  });
  await setUploadMeta(doc.docId, {
    fileName: String(file.name || ""),
    originalFormat: String(originalFormat || ""),
    uploadedAt: new Date().toISOString(),
  });
  state.lastCleanedMaterialText = cleanedText;
  state.lastCleanedMaterialWordCount = countWords(cleanedText);
  state.lastUploadedFileNames = [String(file.name || "")].filter(Boolean);
  state.materialBootstrapActive = false;

  showDocumentPreparingScreen();
  const prepared = await ensureScopeStructurePreparation(doc, {
    ...preparationGateOptions((msg) => {
      if (els.reviewGeneratingLabel) {
        els.reviewGeneratingLabel.textContent = formatPreparationProgressMessage(msg);
      }
    }),
  });
  await enterModeSelectAfterTier1Gate(prepared);
  const after = await getActiveSession();
  return after?.shared?.modeRecommendation ?? null;
}

function startReviewFromRecommendation() {
  runVaultSm2ReviewSession();
}

/**
 * @param {string} mode
 */
function startModeFromRecommendation(mode) {
  void enterModeWithContinuity(mode);
}

let flowPanelWired = false;

async function wireFlowPanelHandlers() {
  if (flowPanelWired) return;
  flowPanelWired = true;

  els.recommendationStartBtn?.addEventListener("click", async () => {
    const doc = await getActiveSession();
    const recommendation = doc?.shared?.modeRecommendation;
    const viewState = resolveFlowPanelViewState(doc);
    const step =
      viewState === "progress"
        ? getRecommendedStep(recommendation)
        : Array.isArray(recommendation?.primaryFlow)
          ? recommendation.primaryFlow[0]
          : null;
    if (step?.mode) startModeFromRecommendation(String(step.mode));
  });

  els.modeSelectChooseManualBtn?.addEventListener("click", () => {
    openModeSelectManualView();
  });

  els.modeSelectUseRecommendedBtn?.addEventListener("click", () => {
    closeModeSelectManualView();
  });
}

/**
 * @param {import("./session-store.js").DocumentSession | null | undefined} [doc]
 */
export async function renderFlowPanel(doc = null) {
  if (doc == null) doc = await getActiveSession();
  const viewState = resolveFlowPanelViewState(doc);
  const panel = els.recommendationPanel;
  const recommendation = doc?.shared?.modeRecommendation;

  if (viewState === "hidden") {
    syncModeSelectView(doc);
    return;
  }
  if (!hasValidModeRecommendation(recommendation) || !panel) {
    syncModeSelectView(doc);
    return;
  }

  const primaryFlow = Array.isArray(recommendation.primaryFlow) ? recommendation.primaryFlow : [];
  const totalMin = sumFlowTimeMin(primaryFlow);
  const subtitle = await buildRecommendationSubtitle(recommendation, doc);

  if (els.recommendationFlowTitle) {
    els.recommendationFlowTitle.textContent = formatIntroFlowLine(primaryFlow);
  }
  if (els.recommendationReasoning) {
    els.recommendationReasoning.textContent = subtitle;
  }
  if (els.recommendationTime) {
    els.recommendationTime.textContent = totalMin > 0 ? `~${totalMin} min` : "";
  }

  const nextStep =
    viewState === "progress" ? getRecommendedStep(recommendation) : primaryFlow[0];
  if (els.recommendationStartBtn) {
    if (nextStep?.mode) {
      els.recommendationStartBtn.textContent = viewState === "progress" ? "Continue" : "Start";
      els.recommendationStartBtn.hidden = false;
    } else {
      els.recommendationStartBtn.hidden = true;
    }
  }

  syncModeSelectView(doc);
}

export async function persistModeSliceToDocument(doc, mode, slice) {
  if (!doc?.modes) return;
  const slot = normalizeStudyMode(mode);
  doc.modes[slot] = slice;
  await saveDocumentSession(doc);
}

/** Persist cloze mode slice to the active document session (items + study progress). */
export async function persistClozeModeSlice(session) {
  if (!session || session.studyMode !== "cloze") return;
  state.activeSession = session;
  state.studyMode = "cloze";
  await storeActiveSession(session);
  const doc = await getActiveSession();
  if (doc?.docId && doc.modes) {
    doc.modes.cloze = session;
    await saveDocumentSession(doc);
  }
}

export function createClozeSession({
  normalizedText,
  normalizedFormat,
  fileName,
  originalFormat,
  llmModel,
  language,
}) {
  const lang = String(language || getStudyLanguage()).trim() || "English";
  return {
    studyMode: "cloze",
    rev: 0,
    language: lang,
    llmModel: normalizeLlmModel(llmModel),
    materialMeta: {
      fileName: String(fileName || "").trim(),
      originalFormat: String(originalFormat || "").trim(),
      uploadedAt: new Date().toISOString(),
    },
    cloze: {
      normalizedText: String(normalizedText || ""),
      normalizedFormat: normalizedFormat === "html_min" ? "html_min" : "markdown",
      pipelineStatus: "normalized",
      pipelinePhase: null,
      pipelineError: null,
      epistemicGraph: null,
      analysis: null,
      items: [],
      studyIndex: 0,
      studyStats: { correct: 0, shown: 0 },
      studyOrder: null,
      generationMeta: null,
    },
  };
}

export function createSlowSession({
  normalizedText,
  normalizedFormat,
  fileName,
  originalFormat,
  llmModel,
  language,
  textMetrics = null,
  pedagogicalMeta = null,
} = {}) {
  const lang = String(language || getStudyLanguage()).trim() || "English";
  const text = String(normalizedText || "");
  const metrics =
    textMetrics && typeof textMetrics === "object"
      ? textMetrics
      : analyzeText(text);
  const pedagogy =
    pedagogicalMeta && typeof pedagogicalMeta === "object"
      ? pedagogicalMeta
      : buildDeterministicPedagogicalMeta(metrics);
  const modifiers = decideSlowReadingModifiers(metrics, pedagogy);
  return {
    studyMode: "slow",
    rev: 0,
    language: lang,
    llmModel: normalizeLlmModel(llmModel),
    docHierarchy: null,
    materialMeta: {
      fileName: String(fileName || "").trim(),
      originalFormat: String(originalFormat || "").trim(),
      uploadedAt: new Date().toISOString(),
    },
    slow: {
      normalizedTextFull: text,
      normalizedFormat: normalizedFormat === "html_min" ? "html_min" : "markdown",
      phase: "phase0",
      criticalMode: Boolean(modifiers.criticalMode),
      fillableMapMode: Boolean(modifiers.fillableMap),
      checkpointsEnabled: Boolean(modifiers.checkpoints),
      phase0SeenKey: null,
      phase0SeenReread: false,
      phase0Collapsed: false,
      phase0: null,
      phase0Status: "idle",
      currentPageIndex: 0,
      maxReadCharEnd: 0,
      typography: { fontSizePx: 15, lineHeight: 1.4, fontFamily: '"DM Sans", sans-serif' },
      annotations: [],
      findings: [],
      checkpointsDismissed: [],
      depthScore: null,
      graphEnrichedUnlocked: false,
      graphNodes: [],
      sidebarOpen: true,
      headingOverrides: [],
      structureWarnings: [],
      fallbackSections: null,
      scopeEditMode: false,
      scopeCollapsedParents: {},
    },
  };
}

function getSelectedStudyModeRadio() {
  const checked = document.querySelector('input[name="studyMode"]:checked');
  return checked ? normalizeStudyMode(checked.value) : null;
}

function getStudyModeLabel(mode) {
  if (mode === "slow") return "Slow Mode";
  if (mode === "cloze") return "Cloze Detection";
  if (mode === "questions") return "Questions";
  if (mode === "recall") return "Recall";
  if (mode === "read") return "Read";
  return "RSVP";
}

/** QA stub ? delegates to recall controller when document session exists. */
export async function showRecallStudyStub() {
  const doc = await getActiveSession();
  if (doc) {
    void getRecallController().enterRecall({
      action: "recall_bootstrap",
      slice: doc.modes?.recall,
    });
    return;
  }
  if (els.recallQuestionText) {
    els.recallQuestionText.textContent =
      "What is the central thesis of the argument, and how does the author support it?";
  }
  if (els.recallTypeBadge) {
    els.recallTypeBadge.textContent = "Synthesis";
    els.recallTypeBadge.hidden = false;
  }
  if (els.recallProgress) els.recallProgress.textContent = "1 / 3";
  if (els.recallAnswer) els.recallAnswer.value = "";
  if (els.recallFeedbackPanel) els.recallFeedbackPanel.hidden = true;
  if (els.recallNextBtn) els.recallNextBtn.hidden = true;
  if (els.recallSubmitBtn) els.recallSubmitBtn.hidden = false;
  if (els.recallConceptPeek) els.recallConceptPeek.hidden = true;
  if (els.recallError) {
    els.recallError.hidden = true;
    els.recallError.textContent = "";
  }
  if (els.recallStatus) els.recallStatus.textContent = "";
  state.studyMode = "recall";
  showScreen("recall");
}

let recallStudyController = null;

async function getRecallController() {
  if (!recallStudyController) {
    recallStudyController = createRecallStudyController({
      els,
      getDoc: async () => await getActiveSession(),
      persistSlice: persistModeSliceToDocument,
      showScreen,
      setStudyMode: (mode) => {
        state.studyMode = mode;
      },
      runConceptInventoryForDoc: async () => {
        const doc = await getActiveSession();
        const guard = evaluateConceptInventoryGuard(doc);
        console.debug("[DPP-GUARD.recall.runConceptInventoryForDoc] Guard", {
          docId: doc?.docId,
          decision: guard.decision,
          conceptCount: doc?.shared?.conceptInventory?.length ?? 0,
        }); // [debug-enrich]
        if (guard.decision === "skip" || guard.decision === "degraded") return;
        if (guard.decision === "failed") {
          throw new Error(PREPARATION_FAILED_MSG);
        }
        const text = String(doc?.shared?.rawMarkdown || "").trim();
        if (!text) throw new Error("No document text for concept inventory.");
        const wc = text.split(/\s+/).filter(Boolean).length;
        const invResult = await runConceptInventoryWithFallback(text, {
          llmModel: getSessionLlmModel(),
          language: getStudyLanguage(),
          docHierarchy: doc?.shared?.docHierarchy,
          wordCount: wc,
        });
        if (invResult.kind === "fallback_mono") {
          notifyInventoryRunStatus(invResult);
          throw new Error("Concept inventory unavailable for recall.");
        }
        promoteConceptInventoryToShared(invResult.inventory, "recall");
        persistInventoryRunMeta(doc, invResult);
        notifyInventoryRunStatus(invResult);
      },
      getLanguage: getStudyLanguage,
      getLlmModel: getSessionLlmModel,
      updateFlowProgress: async (doc) => {
        if (!doc?.shared?.modeRecommendation) return;
        const updated = await updateFlowProgress(doc.shared.modeRecommendation, doc);
        await updateRecommendation(doc.docId, updated);
        renderFlowPanel(doc);
      },
      onComplete: () => enterModeSelectScreen(),
      onBack: () => enterModeSelectScreen(),
      getFocusGlobalConceptId: () => recallFocusGlobalConceptId,
    });
    recallStudyController.wireHandlers();
  }
  return recallStudyController;
}

function setStudyModeRadio(mode) {
  document.querySelectorAll('input[name="studyMode"]').forEach((r) => {
    r.checked = r.value === mode;
  });
}

async function resetModeSelectUi() {
  document.querySelectorAll('input[name="studyMode"]').forEach((r) => {
    r.checked = false;
  });
  modeSelectManualOpen = false;
  clearFlowRecommendFeedback();
  const doc = await getActiveSession();
  syncInterviewModeGate(doc);
  const modes = getDefaultModesForSession(doc);
  for (const mode of modes) {
    if (await loadSessionForMode(mode)) {
      setStudyModeRadio(mode);
      break;
    }
  }
}

async function triggerVaultUpdateOnSessionExit() {
  const doc = await getActiveSession();
  if (!doc?.docId) return;
  const mode = String(state.studyMode || "rsvp").trim() || "rsvp";
  const sessionForVault = {
    ...doc,
    modes: {
      rsvp: await loadSessionForMode("rsvp"),
      slow: await loadSessionForMode("slow"),
      cloze: await loadSessionForMode("cloze"),
      questions: await loadSessionForMode("questions"),
    },
  };
  void import("./vault/session-close.js")
    .then(async (m) => {
      await m.updateVaultFromSession(sessionForVault, mode);
      const { syncVaultToReviewPool } = await import("./vault/spaced-review.js");
      const fresh = await getActiveSession();
      if (fresh) syncVaultToReviewPool(fresh);
    })
    .catch((err) => {
      console.warn("[vault] session-close failed", err);
    });
}

function buildVaultPresumedKnownMap(conceptInventory, docOrTopics) {
  const doc =
    docOrTopics && typeof docOrTopics === "object" && !Array.isArray(docOrTopics)
      ? docOrTopics
      : { shared: { docTopics: Array.isArray(docOrTopics) ? docOrTopics : [] } };
  const scored = getVaultContextForDoc(doc);
  const entries = scored.map((s) => s.entry);
  if (!entries.length) return {};
  const map = /** @type {Record<string, boolean>} */ ({});
  for (const c of Array.isArray(conceptInventory) ? conceptInventory : []) {
    const id = String(c?.id || c?.canonicalId || "").trim();
    if (!id) continue;
    const entry = findVaultEntryForConceptId(id, entries);
    if (entry && getCurrentMastery(entry) >= PRESUMED_KNOWN_THRESHOLD) {
      map[id] = true;
    }
  }
  return map;
}

async function recordVaultAssessmentContradictions(items, responses, presumedMap) {
  const doc = await getActiveSession();
  if (!doc?.shared) return;
  const list = Array.isArray(items) ? items : [];
  const rows = Array.isArray(responses) ? responses : [];
  const pending = [];
  const now = Date.now();
  for (const item of list) {
    const conceptId = String(item?.concept_id || "").trim();
    if (!conceptId || !presumedMap[conceptId]) continue;
    const row = rows.find((r) => String(r?.item_id || "") === String(item?.item_id || ""));
    const answer = String(row?.answer || row?.userAnswer || "").trim();
    if (!answer) continue;
    if (answer === PREPACKING_ALREADY_KNOW_ANSWER) {
      pending.push({ conceptId, type: "assessment_mastered", timestamp: now, docId: doc.docId });
    } else if (answer === PREPACKING_DONT_KNOW_ANSWER) {
      pending.push({ conceptId, type: "assessment_unknown", timestamp: now, docId: doc.docId });
    } else {
      pending.push({ conceptId, type: "assessment_partial", timestamp: now, docId: doc.docId });
    }
  }
  if (!pending.length) return;
  if (!Array.isArray(doc.shared._vaultPendingObservations)) {
    doc.shared._vaultPendingObservations = [];
  }
  doc.shared._vaultPendingObservations.push(...pending);
  await saveDocumentSession(doc);
}

export async function enterModeSelectScreen() {
  triggerVaultUpdateOnSessionExit();
  syncFlowExitState();
  persistFlowRecommendationProgress();
  resetModeSelectUi();
  resetCreateScreenModeUi();
  const active = await getActiveSession();
  if (active) {
    await markStalePreparationSession(active);
    migrateKnowledgeProfileToShared(active);
    syncModeSelectAssessmentRedoButton(active);
  }
  renderFlowPanel(await getActiveSession());
  mountModeSelectBreadcrumb(await getActiveSession());
  syncSessionHubActions();
  notifyDocumentQualityIfNeeded(active);
  showScreen("modeSelect");
  syncExportButtonsEnabled();
  syncPersistenceHealthBanner();
}

let createSessionStartRunId = 0;
/** @type {File[]} */
let createSessionStagedFiles = [];
let createSessionNameManuallyEdited = false;
let createSessionUploadInProgress = false;
/** @type {object|null} */
let packImportPreview = null;

/** @type {{ currentQuestion: string, questionSource: 'fixed'|'generated', runId: number }} */
const interviewCaptureState = {
  currentQuestion: "",
  questionSource: "fixed",
  runId: 0,
};

/** @type {{ panel: 'search'|'confirm'|'levelC', pendingBookMeta: import('./session-types.js').BookMeta|null, searching: boolean }} */
const bookSearchState = {
  panel: "search",
  pendingBookMeta: null,
  searching: false,
};

function resetBookSearchState() {
  bookSearchState.panel = "search";
  bookSearchState.pendingBookMeta = null;
  bookSearchState.searching = false;
}

function setBookSearchError(message) {
  if (!els.bookSearchError) return;
  const text = String(message || "").trim();
  if (!text) {
    els.bookSearchError.hidden = true;
    els.bookSearchError.textContent = "";
    return;
  }
  els.bookSearchError.hidden = false;
  els.bookSearchError.textContent = text;
}

function renderBookSearchPanel() {
  const panel = bookSearchState.panel;
  if (els.bookSearchPanelSearch) els.bookSearchPanelSearch.hidden = panel !== "search";
  if (els.bookSearchPanelConfirm) els.bookSearchPanelConfirm.hidden = panel !== "confirm";
  if (els.bookSearchPanelLevelC) els.bookSearchPanelLevelC.hidden = panel !== "levelC";

  const meta = bookSearchState.pendingBookMeta;
  if (panel === "confirm" && meta) {
    if (els.bookSearchConfirmTitle) els.bookSearchConfirmTitle.textContent = meta.title;
    if (els.bookSearchConfirmAuthor) {
      els.bookSearchConfirmAuthor.textContent = meta.author || "";
      els.bookSearchConfirmAuthor.hidden = !meta.author;
    }
    if (els.bookSearchTocBadge) {
      els.bookSearchTocBadge.hidden = meta.level !== "A";
    }
    if (els.bookSearchCoverImg) {
      const showCover =
        meta.coverUrl &&
        meta.coverUrlVerified &&
        meta.coverFormatSupported &&
        meta.coverSizeOk &&
        !meta.coverLoadFailed;
      if (showCover) {
        els.bookSearchCoverImg.hidden = false;
        els.bookSearchCoverImg.src = meta.coverUrl;
      } else {
        els.bookSearchCoverImg.hidden = true;
        els.bookSearchCoverImg.removeAttribute("src");
      }
    }
  }

  if (els.bookSearchLookupBtn) {
    els.bookSearchLookupBtn.disabled = bookSearchState.searching;
    els.bookSearchLookupBtn.textContent = bookSearchState.searching ? "Searching…" : "Look up book";
  }
}

export function enterBookSearchScreen() {
  resetBookSearchState();
  setBookSearchError("");
  if (els.bookSearchTitleInput) els.bookSearchTitleInput.value = "";
  if (els.bookSearchAuthorInput) els.bookSearchAuthorInput.value = "";
  renderBookSearchPanel();
  showScreen("bookSearch");
}

async function handleBookSearchLookup() {
  setBookSearchError("");
  const title = String(els.bookSearchTitleInput?.value || "").trim();
  const author = String(els.bookSearchAuthorInput?.value || "").trim();
  if (!title) {
    setBookSearchError("Enter a book title.");
    return;
  }
  bookSearchState.searching = true;
  renderBookSearchPanel();
  try {
    const meta = await lookupBook(title, author);
    bookSearchState.pendingBookMeta = meta;
    if (meta.level === "C") {
      bookSearchState.panel = "levelC";
    } else {
      bookSearchState.panel = "confirm";
    }
  } catch (err) {
    setBookSearchError(err?.message || "Book lookup failed. Try again or continue without search.");
  } finally {
    bookSearchState.searching = false;
    renderBookSearchPanel();
  }
}

async function proceedToInterviewWithBookMeta(bookMeta) {
  const sessionTitle =
    bookMeta?.title ||
    String(els.interviewSessionNameInput?.value || "").trim() ||
    "Interview session";
  if (els.interviewSessionNameInput) {
    els.interviewSessionNameInput.value = sessionTitle;
  }
  const doc = await ensureInterviewSession(sessionTitle, bookMeta);
  resetBookSearchState();
  await enterInterviewCaptureScreen(doc);
}

async function handleBookSearchSkip() {
  resetBookSearchState();
  await enterInterviewCaptureScreen();
}

function handleBookSearchCoverError() {
  if (bookSearchState.pendingBookMeta) {
    bookSearchState.pendingBookMeta.coverLoadFailed = true;
  }
  if (els.bookSearchCoverImg) {
    els.bookSearchCoverImg.hidden = true;
    els.bookSearchCoverImg.removeAttribute("src");
  }
}

function setInterviewCaptureError(message) {
  if (!els.interviewCaptureError) return;
  const text = String(message || "").trim();
  if (!text) {
    els.interviewCaptureError.hidden = true;
    els.interviewCaptureError.textContent = "";
    return;
  }
  els.interviewCaptureError.hidden = false;
  els.interviewCaptureError.textContent = text;
}

function interviewFollowUpErrorMessage(err) {
  const code = String(err?.code || "").trim();
  if (code.includes("TRUNCATED")) {
    return "The follow-up response was cut off. Try again.";
  }
  if (code.includes("SCHEMA")) {
    return "The follow-up response had an unexpected shape. Try again.";
  }
  if (code.includes("PARSE")) {
    return "Could not read the follow-up response. Try again.";
  }
  return err?.message || "Could not generate a follow-up question.";
}

function showInterviewGeneratingScreen(label) {
  if (els.reviewGeneratingLabel) {
    els.reviewGeneratingLabel.textContent = String(label || "Working…");
  }
  showScreen("reviewGenerating");
}

async function ensureInterviewSession(sessionTitle, bookMeta = null) {
  const title = String(sessionTitle || "").trim() || "Interview session";
  const doc = await createSession(INTERVIEW_PLACEHOLDER_MARKDOWN, {
    projectId: getUploadDefaultProjectId(),
  });
  await setUploadMeta(doc.docId, {
    fileName: title,
    originalFormat: "interview",
    uploadedAt: new Date().toISOString(),
    ...(bookMeta != null ? { bookMeta } : {}),
  });
  if (bookMeta != null) {
    doc.shared.uploadMeta = {
      ...(doc.shared.uploadMeta || {}),
      bookMeta,
    };
  }
  doc.shared.docMeta = {
    ...(doc.shared.docMeta || {}),
    titleInferred: title,
  };
  doc.shared.interviewTranscript = [];
  doc.shared.interviewSynthesisComplete = false;
  await saveDocumentSession(doc);
  await setActiveSession(doc.docId);
  return doc;
}

function renderInterviewCaptureUi(doc) {
  const transcript = normalizeInterviewTranscript(doc?.shared?.interviewTranscript);
  const answered = countAnsweredTurns(transcript);
  const followUps = dynamicFollowUpsUsed(transcript);
  const atCap = followUps >= INTERVIEW_MAX_FOLLOWUP_ROUNDS;
  const canFinish = canProceedToSynthesis(transcript, INTERVIEW_MIN_ANSWERED_TURNS);

  if (els.interviewQuestionText) {
    els.interviewQuestionText.textContent = interviewCaptureState.currentQuestion || "";
  }
  if (els.interviewTurnMeta) {
    els.interviewTurnMeta.textContent =
      answered > 0
        ? `Answered ${answered} ? Follow-ups ${followUps}/${INTERVIEW_MAX_FOLLOWUP_ROUNDS}`
        : "Opening question ? no network needed";
  }
  if (els.interviewFinishBtn) {
    els.interviewFinishBtn.hidden = !canFinish;
  }
  if (els.interviewSubmitAnswerBtn) {
    els.interviewSubmitAnswerBtn.textContent = atCap ? "Submit final answer" : "Submit answer";
    els.interviewSubmitAnswerBtn.disabled = !interviewCaptureState.currentQuestion;
  }
  if (els.interviewCaptureStatus && atCap && !canFinish) {
    els.interviewCaptureStatus.textContent =
      "Round cap reached ? answer this question to reach the minimum for synthesis.";
  } else if (els.interviewCaptureStatus && !canFinish && answered > 0) {
    els.interviewCaptureStatus.textContent = `Answer at least ${INTERVIEW_MIN_ANSWERED_TURNS} questions before finishing.`;
  } else if (els.interviewCaptureStatus) {
    els.interviewCaptureStatus.textContent = "";
  }
}

async function loadNextInterviewQuestion(doc) {
  const transcript = normalizeInterviewTranscript(doc?.shared?.interviewTranscript);
  const followUps = dynamicFollowUpsUsed(transcript);
  if (followUps >= INTERVIEW_MAX_FOLLOWUP_ROUNDS) {
    interviewCaptureState.currentQuestion = "";
    interviewCaptureState.questionSource = "generated";
    return doc;
  }
  const lang = getStudyLanguage();
  if (transcript.length === 0) {
    const bookMeta = doc?.shared?.uploadMeta?.bookMeta || null;
    const bank = getOpeningQuestions(lang, bookMeta);
    interviewCaptureState.currentQuestion = bank.questions[bank.defaultIndex] || bank.questions[0] || "";
    interviewCaptureState.questionSource = "fixed";
    return doc;
  }
  const runId = ++interviewCaptureState.runId;
  showInterviewGeneratingScreen("Generating follow-up question…");
  try {
    assertLlmKeyPresent(getSessionLlmModel());
    const { question } = await generateInterviewFollowUp({
      transcript,
      studyLang: lang,
      llmModel: getSessionLlmModel(),
      bookMeta: doc?.shared?.uploadMeta?.bookMeta || null,
    });
    if (runId !== interviewCaptureState.runId) return doc;
    interviewCaptureState.currentQuestion = question;
    interviewCaptureState.questionSource = "generated";
    setInterviewCaptureError("");
    showScreen("interviewCapture");
    return doc;
  } catch (err) {
    if (runId !== interviewCaptureState.runId) return doc;
    showScreen("interviewCapture");
    setInterviewCaptureError(interviewFollowUpErrorMessage(err));
    throw err;
  }
}

export async function enterInterviewCaptureScreen(existingDoc = null) {
  interviewCaptureState.runId += 1;
  setInterviewCaptureError("");
  const existing = existingDoc || (await getActiveSession());
  let doc = existing;
  if (!isInterviewOriginSession(existing) || existing?.shared?.interviewSynthesisComplete) {
    doc = await ensureInterviewSession(els.interviewSessionNameInput?.value || "Interview session");
  }
  const title =
    doc?.shared?.docMeta?.titleInferred ||
    doc?.shared?.uploadMeta?.fileName ||
    "Interview session";
  if (els.interviewSessionNameInput) {
    els.interviewSessionNameInput.value = title;
  }
  if (els.interviewAnswerInput) els.interviewAnswerInput.value = "";
  const transcript = normalizeInterviewTranscript(doc?.shared?.interviewTranscript);
  const bookMeta = doc?.shared?.uploadMeta?.bookMeta || null;
  if (!transcript.length) {
    const bank = getOpeningQuestions(getStudyLanguage(), bookMeta);
    interviewCaptureState.currentQuestion = bank.questions[bank.defaultIndex] || bank.questions[0] || "";
    interviewCaptureState.questionSource = "fixed";
  } else if (!interviewCaptureState.currentQuestion) {
    await loadNextInterviewQuestion(doc);
  }
  renderInterviewCaptureUi(doc);
  mountModeSelectBreadcrumb(doc);
  showScreen("interviewCapture");
}

async function handleInterviewSubmitAnswer() {
  setInterviewCaptureError("");
  const doc = await getActiveSession();
  if (!doc || !isInterviewOriginSession(doc) || doc.shared?.interviewSynthesisComplete) {
    setInterviewCaptureError("Start a new interview session first.");
    return;
  }
  const answer = String(els.interviewAnswerInput?.value || "").trim();
  if (!answer) {
    setInterviewCaptureError("Write an answer before submitting.");
    return;
  }
  if (!interviewCaptureState.currentQuestion) {
    setInterviewCaptureError("No question to answer.");
    return;
  }
  const transcript = normalizeInterviewTranscript(doc.shared.interviewTranscript);
  const turn = createTurn({
    turn: transcript.length + 1,
    question: interviewCaptureState.currentQuestion,
    questionSource: interviewCaptureState.questionSource,
    answer,
  });
  doc.shared.interviewTranscript = appendTurn(transcript, turn);
  await saveDocumentSession(doc);
  if (els.interviewAnswerInput) els.interviewAnswerInput.value = "";

  const followUpsAfter = dynamicFollowUpsUsed(doc.shared.interviewTranscript);
  if (followUpsAfter >= INTERVIEW_MAX_FOLLOWUP_ROUNDS) {
    renderInterviewCaptureUi(doc);
    await handleInterviewFinish(true);
    return;
  }

  try {
    await loadNextInterviewQuestion(doc);
  } catch {
    renderInterviewCaptureUi(doc);
    return;
  }
  renderInterviewCaptureUi(doc);
}

async function handleInterviewFinish(fromCap = false) {
  setInterviewCaptureError("");
  const doc = await getActiveSession();
  if (!doc?.shared) return;
  const transcript = normalizeInterviewTranscript(doc.shared.interviewTranscript);
  if (!canProceedToSynthesis(transcript, INTERVIEW_MIN_ANSWERED_TURNS)) {
    setInterviewCaptureError(
      `Answer at least ${INTERVIEW_MIN_ANSWERED_TURNS} questions before finishing the interview.`,
    );
    return;
  }
  if (doc.shared.interviewSynthesisComplete) {
    await enterModeSelectAfterTier1Gate();
    return;
  }

  const sessionTitle =
    String(els.interviewSessionNameInput?.value || "").trim() ||
    doc.shared.docMeta?.titleInferred ||
    "Interview session";
  doc.shared.docMeta = { ...(doc.shared.docMeta || {}), titleInferred: sessionTitle };
  await saveDocumentSession(doc);

  const runId = ++interviewCaptureState.runId;
  showInterviewGeneratingScreen("Structuring your answers…");
  try {
    assertLlmKeyPresent(getSessionLlmModel());
    const { doc: updated } = await applyInterviewSynthesis(doc, {
      transcript,
      studyLang: getStudyLanguage(),
      sessionTitle,
      llmModel: getSessionLlmModel(),
    });
    if (runId !== interviewCaptureState.runId) return;
    await saveDocumentSession(updated);
    if (els.reviewGeneratingLabel) {
      els.reviewGeneratingLabel.textContent = "Processing document…";
    }
    const prepared = await ensureTier1Preparation(updated, {
      ...preparationGateOptions((msg) => {
        if (els.reviewGeneratingLabel) {
          els.reviewGeneratingLabel.textContent = formatPreparationProgressMessage(msg);
        }
      }),
    });
    if (!isTier1PreparationComplete(prepared)) {
      showScreen("interviewCapture");
      setInterviewCaptureError(
        "Document preparation incomplete. Add an API key in Settings or retry.",
      );
      return;
    }
    if (fromCap && els.interviewCaptureStatus) {
      els.interviewCaptureStatus.textContent = "Interview complete — round cap reached.";
    }
    await enterModeSelectAfterTier1Gate(prepared);
  } catch (err) {
    if (runId !== interviewCaptureState.runId) return;
    showScreen("interviewCapture");
    const code = String(err?.code || "");
    if (code.includes("FIDELITY")) {
      setInterviewCaptureError("Synthesis introduced content not in your answers. Try again.");
    } else if (code.includes("TRUNCATED")) {
      setInterviewCaptureError("Synthesis was cut off. Try again.");
    } else if (code.includes("SCHEMA") || code.includes("PARSE")) {
      setInterviewCaptureError("Could not read the synthesis response. Try again.");
    } else {
      setInterviewCaptureError(err?.message || "Synthesis failed. Try again.");
    }
  }
}

function guessSessionNameFromFileName(fileName) {
  const raw = String(fileName || "").trim();
  if (!raw) return "Untitled session";
  return raw.replace(/\.[^/.]+$/, "").trim() || "Untitled session";
}

function formatStagingFileSize(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function updateCreateSessionContinueState(doc = null) {
  const title = String(els.createSessionStartNameInput?.value || "").trim();
  const hasName = title.length > 0;
  const btn = els.createSessionStartContinueBtn;
  if (!btn) return;
  if (createSessionUploadInProgress) {
    btn.disabled = true;
    return;
  }
  if (createSessionStagedFiles.length > 0) {
    btn.disabled = !hasName;
    return;
  }
  if (doc?.docId) {
    btn.disabled = !hasName || !isTier1PreparationComplete(doc);
    return;
  }
  btn.disabled = !hasName || createSessionStagedFiles.length < 1;
}

function renderCreateSessionStagingUi() {
  const listEl = els.createSessionStartFileList;
  const addBtn = els.createSessionStartAddFileBtn;
  if (!listEl || !addBtn) return;

  const files = createSessionStagedFiles;
  listEl.innerHTML = "";
  listEl.hidden = files.length === 0;

  files.forEach((file, index) => {
    const li = document.createElement("li");
    li.className = "create-session-file-row";

    const icon = document.createElement("span");
    icon.className = "create-session-file-icon";
    icon.textContent = "📄";
    icon.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "create-session-file-name";
    name.textContent = String(file?.name || "file");

    const size = document.createElement("span");
    size.className = "create-session-file-size";
    size.textContent = formatStagingFileSize(file?.size);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "create-session-file-remove";
    removeBtn.textContent = "✕";
    removeBtn.setAttribute("aria-label", `Remove ${file?.name || "file"}`);
    removeBtn.addEventListener("click", () => {
      createSessionStagedFiles.splice(index, 1);
      renderCreateSessionStagingUi();
      void getActiveSession().then((doc) => updateCreateSessionContinueState(doc));
    });

    li.append(icon, name, size, removeBtn);
    listEl.appendChild(li);
  });

  const atMax = files.length >= MAX_SOURCE_FILES;
  addBtn.hidden = atMax;
  addBtn.textContent = files.length ? "+ Add another file" : "+ Add file";
  if (atMax) {
    addBtn.setAttribute("aria-disabled", "true");
  } else {
    addBtn.removeAttribute("aria-disabled");
  }

  void getActiveSession().then((doc) => updateCreateSessionContinueState(doc));
}

function handleCreateSessionStartFilePicked() {
  const input = els.createSessionStartFileInput;
  const file = input?.files?.[0];
  if (!file) return;
  if (createSessionStagedFiles.length >= MAX_SOURCE_FILES) return;

  createSessionStagedFiles.push(file);
  if (input) input.value = "";

  if (!createSessionNameManuallyEdited) {
    const suggested = guessSessionNameFromFileName(
      createSessionStagedFiles[0]?.name || file.name,
    );
    if (els.createSessionStartNameInput) {
      els.createSessionStartNameInput.disabled = false;
      els.createSessionStartNameInput.value = suggested;
    }
  }

  if (els.createSessionStartStatus) {
    els.createSessionStartStatus.textContent =
      createSessionStagedFiles.length === 1
        ? "1 file staged. Add more or continue."
        : `${createSessionStagedFiles.length} files staged.`;
  }

  renderCreateSessionStagingUi();
}

async function processCreateSessionStagedUpload(title) {
  const files = [...createSessionStagedFiles];
  if (!files.length) return;

  const runId = ++createSessionStartRunId;
  // Commit upload intent: staged files are consumed; user stays on processing screen until done.
  createSessionStagedFiles = [];
  renderCreateSessionStagingUi();
  createSessionUploadInProgress = true;
  updateCreateSessionContinueState();
  showDocumentPreparingScreen("Extracting text…");

  try {
    const { normalizeMultipleFiles } = await import("./input-normalization.js?v=20260625_02");
    const result = await normalizeMultipleFiles(files);
    const cleanedText = result.markdown;
    if (!String(cleanedText || "").trim()) {
      throw new Error("The files appear to be empty.");
    }

    if (runId !== createSessionStartRunId) return;

    const doc = await ensureDocumentSessionForUpload(cleanedText, {
      pendingImages: result.pendingImages,
      structureHeadings: result.headings,
    });
    await setUploadMeta(doc.docId, {
      fileName: result.files[0]?.fileName || files[0]?.name || "",
      originalFormat: result.files[0]?.originalFormat || "",
      uploadedAt: new Date().toISOString(),
      files: result.files,
      sourceMap: result.sourceMap,
    });
    doc.shared.docMeta = {
      ...(doc.shared.docMeta || {}),
      titleInferred: title,
    };
    await saveDocumentSession(doc);
    state.lastCleanedMaterialText = cleanedText;
    state.lastCleanedMaterialWordCount = countWords(cleanedText);
    state.lastUploadedFileNames = result.files.map((f) => f.fileName).filter(Boolean);

    mountModeSelectBreadcrumb(doc);
    showDocumentPreparingScreen("Preparing document…");
    const prepared = await startDocumentPreparation(doc, {
      stopAfterScopeGate: true,
      ...preparationGateOptions((msg) => {
        if (runId !== createSessionStartRunId) return;
        if (els.reviewGeneratingLabel) {
          els.reviewGeneratingLabel.textContent = formatPreparationProgressMessage(msg);
        }
      }),
    });

    if (runId !== createSessionStartRunId) return;

    notifyPreparationSparseIfNeeded(prepared);
    await applySessionTitleToActiveDoc(title, prepared);
    await enterModeSelectAfterTier1Gate(prepared);
  } catch (err) {
    if (runId !== createSessionStartRunId) return;
    console.error("[DPP] Upload preparation failed:", err);
    if (els.reviewGeneratingError) {
      els.reviewGeneratingError.hidden = false;
      els.reviewGeneratingError.textContent = err?.message
        ? String(err.message)
        : "Could not process these files.";
    }
  } finally {
    createSessionUploadInProgress = false;
  }
}

async function applySessionTitleToActiveDoc(title, doc = null) {
  const target = doc ?? (await getActiveSession());
  const safeTitle = String(title || "").trim();
  if (!target || !safeTitle) return;
  target.shared.docMeta = {
    ...(target.shared.docMeta || {}),
    titleInferred: safeTitle,
  };
  await saveDocumentSession(target);
}

async function handleCreateSessionStartContinue() {
  const title = String(els.createSessionStartNameInput?.value || "").trim();
  if (!title) {
    if (els.createSessionStartStatus) {
      els.createSessionStartStatus.textContent = "Enter a session name before continuing.";
    }
    return;
  }

  if (createSessionStagedFiles.length > 0) {
    await processCreateSessionStagedUpload(title);
    return;
  }

  const doc = await getActiveSession();
  if (doc?.docId) {
    await applySessionTitleToActiveDoc(title);
    if (!isTier1PreparationComplete(doc)) {
      showDocumentPreparingScreen("Preparing document…");
    }
    await enterModeSelectAfterTier1Gate();
    return;
  }

  if (els.createSessionStartStatus) {
    els.createSessionStartStatus.textContent = "Add at least one file before continuing.";
  }
}

async function resolveOwnerDisplayName() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const meta = user?.user_metadata || {};
    const named = String(meta.full_name || meta.name || "").trim();
    if (named) return named;
    const email = String(user?.email || "").trim();
    if (email.includes("@")) return email.split("@")[0];
  } catch {
    // fall through
  }
  return "Pack creator";
}

function setCreateSessionPackError(message) {
  if (!els.createSessionPackError) return;
  const text = String(message || "").trim();
  els.createSessionPackError.textContent = text;
  els.createSessionPackError.hidden = !text;
}

async function handleCreateSessionPackLookup() {
  setCreateSessionPackError("");
  packImportPreview = null;
  if (els.createSessionPackPreview) els.createSessionPackPreview.hidden = true;
  const code = String(els.createSessionPackCodeInput?.value || "").trim();
  if (!code) {
    setCreateSessionPackError("Enter a pack code.");
    return;
  }
  try {
    const pack = await lookupPublishedPackByCode(code);
    if (!pack) {
      setCreateSessionPackError("Invalid pack code");
      return;
    }
    packImportPreview = pack;
    const title = String(pack.title || "Untitled pack").trim() || "Untitled pack";
    const owner = String(pack.owner_display_name || "").trim() || "Pack creator";
    if (els.createSessionPackPreviewMeta) {
      els.createSessionPackPreviewMeta.textContent = `${title} — shared by ${owner}`;
    }
    if (els.createSessionPackPreview) els.createSessionPackPreview.hidden = false;
  } catch (err) {
    setCreateSessionPackError(String(err?.message || err || "Lookup failed"));
  }
}

async function handleCreateSessionPackImport() {
  setCreateSessionPackError("");
  if (!packImportPreview?.code) {
    setCreateSessionPackError("Look up a valid pack code first.");
    return;
  }
  try {
    const userId = await getAuthUserId();
    const projectId = getUploadDefaultProjectId();
    if (!projectId) {
      setCreateSessionPackError("Select a project before importing.");
      return;
    }
    if (els.createSessionPackImportBtn) els.createSessionPackImportBtn.disabled = true;
    const session = await importPackAsSession(packImportPreview.code, userId, projectId);
    await setActiveSession(session.docId);
    state.activeSession = session;
    hydrateMaterialStateFromDoc(session);
    packImportPreview = null;
    enterModeSelectScreen();
  } catch (err) {
    const msg = String(err?.message || err || "Import failed");
    setCreateSessionPackError(/invalid pack code/i.test(msg) ? "Invalid pack code" : msg);
  } finally {
    if (els.createSessionPackImportBtn) els.createSessionPackImportBtn.disabled = false;
  }
}

export async function enterCreateSessionStartScreen() {
  createSessionStartRunId += 1;
  createSessionStagedFiles = [];
  createSessionNameManuallyEdited = false;
  createSessionUploadInProgress = false;
  packImportPreview = null;
  if (els.createSessionStartFileInput) {
    els.createSessionStartFileInput.value = "";
  }
  if (els.createSessionPackCodeInput) els.createSessionPackCodeInput.value = "";
  if (els.createSessionPackPreview) els.createSessionPackPreview.hidden = true;
  if (els.createSessionPackError) {
    els.createSessionPackError.hidden = true;
    els.createSessionPackError.textContent = "";
  }
  const doc = await getActiveSession();
  const defaultName = doc?.shared?.docMeta?.titleInferred || "";
  if (els.createSessionStartNameInput) {
    els.createSessionStartNameInput.value = defaultName;
    els.createSessionStartNameInput.disabled = false;
  }
  renderCreateSessionStagingUi();
  updateCreateSessionContinueState(doc || null);
  if (els.createSessionStartStatus) {
    els.createSessionStartStatus.textContent = doc
      ? resolveCreateSessionPrepStatus(doc)
      : "Add your study files, name the session, then continue.";
  }
  refreshCreateSessionInsights(doc || null);
  mountModeSelectBreadcrumb(doc || null);
  showScreen("createSessionStart");
}

export function enterAppHome() {
  refreshVaultReviewBadge();
  showScreen("appHome");
}

export function enterVaultBranch() {
  showScreen("vaultBranch");
  renderVaultKnowledgeFringe().catch((err) => {
    console.warn("[adaptive-probing] fringe render failed", err?.message || err);
  });
}

async function renderVaultKnowledgeFringe() {
  const host = els.vaultKnowledgeFringe;
  if (!host) return;
  const projectId = getUploadDefaultProjectId();
  const beliefs = await loadProjectBeliefs(projectId);
  const conceptIds = Object.keys(beliefs);
  if (!conceptIds.length) {
    host.hidden = true;
    return;
  }
  const graph = buildProbeGraph({
    conceptInventory: conceptIds.map((id) => ({ id, label: id })),
    conceptGraph: null,
  });
  /** @type {Record<string, object>} */
  const state = {};
  for (const id of conceptIds) {
    state[id] = { ...beliefs[id] };
  }
  const { outerFringe, innerFringe } = computeFringes(graph, state);
  const outerLabels = labelConcepts(outerFringe, conceptIds.map((id) => ({ id, label: id })));
  const innerLabels = labelConcepts(innerFringe, conceptIds.map((id) => ({ id, label: id })));
  const outerList = els.vaultOuterFringeList;
  const innerList = els.vaultInnerFringeList;
  if (outerList) {
    outerList.innerHTML = "";
    if (!outerLabels.length) {
      const li = document.createElement("li");
      li.className = "hint";
      li.textContent = "None identified yet.";
      outerList.appendChild(li);
    } else {
      for (const row of outerLabels) {
        const li = document.createElement("li");
        li.textContent = row.label;
        outerList.appendChild(li);
      }
    }
  }
  if (innerList) {
    innerList.innerHTML = "";
    if (!innerLabels.length) {
      const li = document.createElement("li");
      li.className = "hint";
      li.textContent = "None identified yet.";
      innerList.appendChild(li);
    } else {
      for (const row of innerLabels) {
        const li = document.createElement("li");
        li.textContent = row.label;
        innerList.appendChild(li);
      }
    }
  }
  host.hidden = false;
}

/**
 * Inventory-only ingest ? creates DocumentSession with gray concepts, no mode slices.
 * @param {object} params
 */
export async function runIngestOnlyPipeline({
  cleanedText,
  fileName = "document",
  originalFormat = "md",
  projectId,
}) {
  const text = String(cleanedText || "").trim();
  if (!text) throw new Error("Ingest requires non-empty material.");
  const doc = await createSession(text, {
    projectId: projectId || getUploadDefaultProjectId(),
  });
  await setUploadMeta(doc.docId, {
    fileName,
    originalFormat,
    uploadedAt: new Date().toISOString(),
  });
  await setActiveSession(doc.docId);
  // startDocumentPreparation already returns the reconciled prepared doc — do not discard
  // it for a getSession re-read (Round-3 class: superseded persist can leave row cache stale).
  const prepared = await startDocumentPreparation(doc, { stopAfterTier: 1 });
  return prepared ?? (await getSession(doc.docId));
}

async function handleIngestOnlyFileSelected() {
  const file = els.ingestOnlyFileInput?.files?.[0];
  if (!file) return;
  try {
    assertLlmKeyPresent(getSessionLlmModel());
    const material = await readAndCleanMaterialText(file);
    if (!String(material.cleanedText || "").trim()) {
      alert("File appears to be empty.");
      return;
    }
    await runIngestOnlyPipeline({
      cleanedText: material.cleanedText,
      fileName: file.name,
      originalFormat: material.originalFormat,
    });
    if (els.ingestOnlyFileInput) els.ingestOnlyFileInput.value = "";
    enterDocLibraryScreen();
  } catch (err) {
    alert(String(err?.message || err || "Ingest failed."));
  }
}

async function syncSessionHubActions() {
  const doc = await getActiveSession();
  const hasDoc = Boolean(doc?.docId);
  if (els.sessionHubActions) {
    els.sessionHubActions.hidden = !hasDoc;
  }
  if (els.modeSelectHub) {
    els.modeSelectHub.hidden = true;
  }
  if (els.btnUploadToVault) {
    els.btnUploadToVault.hidden = true;
    els.btnUploadToVault.disabled = true;
  }
}

/** @type {object[]} */
let uploadVaultCandidateState = [];

function escapeUploadVaultHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function renderUploadVaultCandidates() {
  const list = els.uploadVaultCandidateList;
  if (!list) return;
  const doc = await getActiveSession();
  if (!uploadVaultCandidateState.length) {
    list.innerHTML = '<p class="hint">No studied concepts to upload yet.</p>';
    if (els.btnUploadVaultCommit) els.btnUploadVaultCommit.disabled = true;
    return;
  }
  const settings = loadVaultSettings();
  list.innerHTML = uploadVaultCandidateState
    .map((row, idx) => {
      const label = escapeUploadVaultHtml(row.label || row.conceptId);
      const defChecked = row.definitionAccepted ? "checked" : "";
      const reviewCards = (row.reviewItems || [])
        .map((ri, riIdx) => {
          const facetLabel = FACET_LABELS[ri.facet] || ri.facet;
          const checked = ri.accepted ? "checked" : "";
          return `<label class="upload-vault-review-card">
            <input type="checkbox" data-candidate-idx="${idx}" data-review-idx="${riIdx}" class="upload-vault-review-check" ${checked} />
            <span class="facet-badge facet-${escapeUploadVaultHtml(ri.facet)}">${escapeUploadVaultHtml(facetLabel)}</span>
            <textarea class="upload-vault-prompt" data-candidate-idx="${idx}" data-review-idx="${riIdx}" rows="2">${escapeUploadVaultHtml(ri.prompt)}</textarea>
            <textarea class="upload-vault-answer hint" data-candidate-idx="${idx}" data-review-idx="${riIdx}" data-field="answer" rows="2">${escapeUploadVaultHtml(ri.answer)}</textarea>
          </label>`;
        })
        .join("");
      const areaOptions = (row.areaOptions || [])
        .map(
          (a) =>
            `<option value="${escapeUploadVaultHtml(a)}" ${row.areaSelected?.includes(a) ? "selected" : ""}>${escapeUploadVaultHtml(a)}</option>`,
        )
        .join("");
      const tagsValue = escapeUploadVaultHtml((row.tagsSelected || row.tags || []).join(", "));
      const relatedChecks = (row.relatedCandidates || [])
        .map((rel, relIdx) => {
          const checked = rel.accepted ? "checked" : "";
          return `<label class="upload-vault-related-chip">
            <input type="checkbox" data-candidate-idx="${idx}" data-related-idx="${relIdx}" class="upload-vault-related-check" ${checked} />
            ${escapeUploadVaultHtml(rel.label || rel.id)}
          </label>`;
        })
        .join("");
      return `<article class="upload-vault-concept" data-candidate-idx="${idx}">
        <h3>${label}</h3>
        <label class="upload-vault-def-label">
          <input type="checkbox" data-candidate-idx="${idx}" class="upload-vault-def-check" ${defChecked} />
          Definition
        </label>
        <textarea class="upload-vault-definition" data-candidate-idx="${idx}" rows="3">${escapeUploadVaultHtml(row.definitionText)}</textarea>
        <label class="upload-vault-section-label">Notes</label>
        <textarea class="upload-vault-notes" data-candidate-idx="${idx}" rows="6">${escapeUploadVaultHtml(row.notesText || "")}</textarea>
        <label class="upload-vault-section-label">Area</label>
        <select class="upload-vault-area" data-candidate-idx="${idx}" multiple size="3">${areaOptions}</select>
        <label class="upload-vault-section-label">Tags (comma-separated)</label>
        <input type="text" class="upload-vault-tags" data-candidate-idx="${idx}" value="${tagsValue}" />
        <div class="upload-vault-related-list">${relatedChecks || '<span class="hint">No related candidates</span>'}</div>
        <div class="upload-vault-review-list">${reviewCards}</div>
      </article>`;
    })
    .join("");
  if (els.uploadVaultAutoNotes) {
    els.uploadVaultAutoNotes.checked = settings.autoDraftNotes;
  }
  if (els.btnUploadVaultCommit) els.btnUploadVaultCommit.disabled = false;
}

async function loadDedupSuggestionsForConcept(doc, batchContext, concept) {
  const conceptId = String(concept?.id || concept?.canonicalId || "").trim();
  const title = String(concept?.label || concept?.title || conceptId).trim();
  const vault = loadVault();
  const existingEntries = vault.entries.slice(0, 40).map((e) => ({
    id: e.id,
    canonicalTitle: e.canonicalTitle,
    aliases: e.aliases || [],
    area: e.area || [],
    topic: e.topic || "",
  }));
  const topic =
    batchContext.existingVaultAreas[0] ||
    doc?.shared?.docTopics?.[0] ||
    "general";
  const mappings = await normalizeConceptsToVault({
    existingEntries,
    newConcepts: [{ id: conceptId, title, type: "CONCEPT" }],
    topic: String(topic),
    batchContext,
  });
  return mappings[0] || { areaSuggestion: [], relatedCandidates: [] };
}

function buildRelatedCandidatesForRow(conceptId, batchContext, dedupRow, vault) {
  const siblings = getSiblingRelatedCandidates(batchContext, conceptId);
  const batchConcepts = batchContext?.concepts || [];
  const candidates = [];
  siblings.slice(0, 5).forEach((sibId, i) => {
    const sib = batchConcepts.find((c) => c.id === sibId);
    candidates.push({
      id: sibId,
      label: sib?.title || sibId,
      kind: "sibling",
      accepted: i < 2,
    });
  });
  for (const vaultId of dedupRow?.relatedCandidates || []) {
    const entry = vault.entries.find((e) => String(e.id) === String(vaultId));
    if (!entry) continue;
    if (candidates.some((c) => c.id === vaultId)) continue;
    candidates.push({
      id: vaultId,
      label: entry.canonicalTitle || vaultId,
      kind: "vault",
      accepted: false,
    });
  }
  return candidates;
}

async function loadUploadVaultCandidates() {
  const doc = await getActiveSession();
  if (!doc?.docId) {
    enterModeSelectScreen();
    return;
  }
  if (els.uploadVaultError) {
    els.uploadVaultError.hidden = true;
    els.uploadVaultError.textContent = "";
  }
  if (els.btnUploadVaultRetry) els.btnUploadVaultRetry.hidden = true;
  if (els.uploadVaultStatus) els.uploadVaultStatus.textContent = "Loading suggestions…";
  if (els.btnUploadVaultCommit) els.btnUploadVaultCommit.disabled = true;

  const studied = getStudiedConcepts(doc);
  if (!studied.length) {
    uploadVaultCandidateState = [];
    if (els.uploadVaultStatus) {
      els.uploadVaultStatus.textContent =
        "No studied concepts yet. Complete at least one block or recall question first.";
    }
    renderUploadVaultCandidates();
    return;
  }

  try {
    assertLlmKeyPresent();
    const contexts = buildVaultCandidateContext(doc, studied);
    const batchContext = buildBatchContext(doc, studied);
    const autoDraftNotes = isAutoDraftNotesEnabled();
    const vault = loadVault();
    const { candidates } = await extractVaultCandidates({
      concepts: studied,
      session: doc,
      contexts,
      batchContext,
      autoDraftNotes,
    });
    const docId = doc.docId;
    const dedupRows = await Promise.all(
      studied.map((concept) => loadDedupSuggestionsForConcept(doc, batchContext, concept)),
    );
    uploadVaultCandidateState = studied.map((concept, index) => {
      const conceptId = String(concept.id || concept.canonicalId || "").trim();
      const ctx = contexts.find((c) => c.conceptId === conceptId);
      const extracted = (candidates || []).find((c) => c.conceptId === conceptId);
      const dedupRow = dedupRows[index] || {};
      const existingEntry = ctx?.existingEntry;
      const hasDef = existingEntry ? hasDefinitionFromDoc(existingEntry, docId) : false;
      const areaSuggested = [
        ...(extracted?.area || []),
        ...(dedupRow.areaSuggestion || []),
        ...batchContext.existingVaultAreas.slice(0, 3),
      ];
      const areaOptions = [...new Set(areaSuggested.map((a) => String(a || "").trim()).filter(Boolean))];
      const areaSelected = (extracted?.area?.length ? extracted.area : dedupRow.areaSuggestion || areaOptions.slice(0, 1)).slice(0, 2);
      return {
        conceptId,
        label: String(concept.label || concept.title || conceptId).trim(),
        definitionText: String(extracted?.definition || concept.definition || "").trim(),
        definitionAccepted: !hasDef && Boolean(extracted?.definition || concept.definition),
        notesText: autoDraftNotes ? String(extracted?.notes || "").trim() : "",
        areaOptions,
        areaSelected,
        tags: extracted?.tags || [],
        tagsSelected: extracted?.tags || [],
        relatedCandidates: buildRelatedCandidatesForRow(conceptId, batchContext, dedupRow, vault),
        sourceChunk: String(concept.sourceChunk || "").trim(),
        reviewItems: (extracted?.suggestedReviewItems || []).map((ri) => ({
          facet: ri.facet,
          prompt: ri.prompt,
          answer: ri.answer,
          accepted: false,
        })),
      };
    });
    if (els.uploadVaultStatus) {
      els.uploadVaultStatus.textContent = `${uploadVaultCandidateState.length} concept(s) ready to curate.`;
    }
    renderUploadVaultCandidates();
  } catch (err) {
    if (els.uploadVaultStatus) els.uploadVaultStatus.textContent = "";
    if (els.uploadVaultError) {
      els.uploadVaultError.hidden = false;
      els.uploadVaultError.textContent =
        String(err?.message || err) || "Could not load vault suggestions.";
    }
    if (els.btnUploadVaultRetry) els.btnUploadVaultRetry.hidden = false;
  }
}

export function enterUploadToVaultCandidates() {
  showScreen("uploadToVaultCandidates");
  uploadVaultCandidateState = [];
  if (els.uploadVaultCandidateList) els.uploadVaultCandidateList.innerHTML = "";
  void loadUploadVaultCandidates();
}

function collectUploadVaultSelectionsFromDom() {
  return uploadVaultCandidateState.map((row, idx) => {
    const defCheck = document.querySelector(
      `.upload-vault-def-check[data-candidate-idx="${idx}"]`,
    );
    const defArea = document.querySelector(
      `.upload-vault-definition[data-candidate-idx="${idx}"]`,
    );
    const notesArea = document.querySelector(`.upload-vault-notes[data-candidate-idx="${idx}"]`);
    const areaSelect = document.querySelector(`.upload-vault-area[data-candidate-idx="${idx}"]`);
    const tagsInput = document.querySelector(`.upload-vault-tags[data-candidate-idx="${idx}"]`);
    const area = areaSelect
      ? [...areaSelect.selectedOptions].map((o) => String(o.value || "").trim()).filter(Boolean)
      : row.areaSelected || [];
    const tags = String(tagsInput?.value || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const relatedAccepted = (row.relatedCandidates || [])
      .map((rel, relIdx) => {
        const check = document.querySelector(
          `.upload-vault-related-check[data-candidate-idx="${idx}"][data-related-idx="${relIdx}"]`,
        );
        return check?.checked ? rel.id : null;
      })
      .filter(Boolean);
    const reviewItems = (row.reviewItems || []).map((ri, riIdx) => {
      const check = document.querySelector(
        `.upload-vault-review-check[data-candidate-idx="${idx}"][data-review-idx="${riIdx}"]`,
      );
      const promptEl = document.querySelector(
        `.upload-vault-prompt[data-candidate-idx="${idx}"][data-review-idx="${riIdx}"]`,
      );
      const answerEl = document.querySelector(
        `.upload-vault-answer[data-candidate-idx="${idx}"][data-review-idx="${riIdx}"]`,
      );
      return {
        facet: ri.facet,
        prompt: String(promptEl?.value || ri.prompt || "").trim(),
        answer: String(answerEl?.value || ri.answer || "").trim(),
        accepted: Boolean(check?.checked),
      };
    });
    return {
      conceptId: row.conceptId,
      definition: {
        text: String(defArea?.value || row.definitionText || "").trim(),
        sourceChunk: row.sourceChunk,
        accepted: Boolean(defCheck?.checked),
      },
      notes: String(notesArea?.value || row.notesText || "").trim(),
      area,
      tags,
      relatedAccepted,
      reviewItems,
    };
  });
}

async function commitUploadVaultSelections() {
  const doc = await getActiveSession();
  if (!doc?.docId) return;
  const selections = collectUploadVaultSelectionsFromDom().filter(
    (sel) =>
      (sel.definition?.accepted && sel.definition?.text) ||
      (sel.reviewItems || []).some((ri) => ri.accepted) ||
      String(sel.notes || "").trim(),
  );
  if (!selections.length) {
    window.alert("Select at least one definition, review item, or note.");
    return;
  }
  const emptyRelated = selections.filter((sel) => !(sel.relatedAccepted || []).length);
  if (emptyRelated.length) {
    const proceed = window.confirm(
      `${emptyRelated.length} concept(s) have no connections. Continue anyway?`,
    );
    if (!proceed) return;
  }
  if (els.uploadVaultStatus) els.uploadVaultStatus.textContent = "Queuing vault upload…";
  if (els.btnUploadVaultCommit) els.btnUploadVaultCommit.disabled = true;
  try {
    const queueRows = selections.map((sel) => ({
      conceptId: sel.conceptId,
      payload: {
        definition: sel.definition,
        reviewItems: sel.reviewItems,
        notes: sel.notes,
        area: sel.area,
        tags: sel.tags,
        relatedAccepted: sel.relatedAccepted,
      },
    }));
    createUploadQueue(doc.docId, queueRows);
    if (els.uploadVaultStatus) {
      els.uploadVaultStatus.textContent = "Uploading to vault in background…";
    }
    const sessionForQueue = doc;
    void processUploadQueue(sessionForQueue, ({ done, total, error }) => {
      if (els.uploadVaultStatus) {
        if (error) {
          els.uploadVaultStatus.textContent = `Vault upload: ${done}/${total} (${error})`;
        } else {
          els.uploadVaultStatus.textContent = `Vault upload: ${done}/${total} complete`;
        }
      }
      syncVaultUploadResumeBanner();
    }).then(() => {
      syncVaultUploadResumeBanner();
      setTimeout(() => enterModeSelectScreen(), 600);
    });
  } catch (err) {
    if (els.uploadVaultError) {
      els.uploadVaultError.hidden = false;
      els.uploadVaultError.textContent = String(err?.message || err) || "Commit failed.";
    }
    if (els.btnUploadVaultCommit) els.btnUploadVaultCommit.disabled = false;
  }
}

export function syncVaultUploadResumeBanner() {
  let queue = loadUploadQueue();
  if (queue) queue = resetStaleProcessingItems(queue);
  const pending = getPendingQueueCount(queue);
  const banner = els.vaultUploadResumeBanner;
  const label = els.vaultUploadResumeLabel;
  const btn = els.btnVaultUploadResume;
  if (!banner || !label || !btn) return;
  if (pending > 0) {
    banner.hidden = false;
    label.textContent = `Vault upload pending (${pending} item${pending === 1 ? "" : "s"})`;
  } else {
    banner.hidden = true;
  }
}

export async function resumeVaultUploadQueue() {
  const queue = loadUploadQueue();
  if (!queue || !getPendingQueueCount(queue)) return;
  const docId = String(queue.docId || "").trim();
  if (!docId) return;
  let session = (await getActiveSession()) || (await getSession(docId));
  if (!session || session.docId !== docId) {
    session = await getSession(docId) || { docId, shared: { conceptInventory: [], docTopics: [] } };
  }
  await processUploadQueue(session, () => syncVaultUploadResumeBanner());
  syncVaultUploadResumeBanner();
}

async function refreshVaultReviewBadge() {
  const badge = els.vaultReviewBadge;
  if (!badge) return;
  const due = await getVaultReviewDueCount();
  if (due > 0) {
    badge.textContent = String(due);
    badge.setAttribute("aria-label", `${due} items due today across all documents`);
    badge.classList.remove("hidden");
  } else {
    badge.textContent = "";
    badge.setAttribute("aria-label", "Items due today across all documents");
    badge.classList.add("hidden");
  }
}

function escapeRetrievalHubHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** @type {{ docId: string, entrySource: string, returnScreen: string }} */
let retrievalHubContext = {
  docId: "",
  entrySource: "mode_select",
  returnScreen: "modeSelect",
};

function renderRetrievalHubOptions() {
  const container = els.retrievalHubOptions;
  if (!container) return;
  const modes = getDocumentRetrievalModes();
  if (!modes.length) {
    container.innerHTML =
      '<p class="hint" role="alert">No retrieval modes configured.</p>';
    return;
  }
  container.innerHTML = modes
    .map(
      ({ key, label, hint }) => `<button type="button" class="retrieval-hub-option" data-retrieval-mode="${escapeRetrievalHubHtml(key)}" role="listitem">
        <strong>${escapeRetrievalHubHtml(label)}</strong>
        <span class="hint">${escapeRetrievalHubHtml(hint)}</span>
      </button>`,
    )
    .join("");
}

function resetRetrievalHubVaultSummary() {
  const panel = els.retrievalHubVaultSummary;
  if (!panel) return;
  panel.innerHTML = "";
  panel.hidden = true;
}

async function renderRetrievalHubVaultSummary(doc) {
  const panel = els.retrievalHubVaultSummary;
  if (!panel) return;
  panel.innerHTML = "";
  panel.hidden = true;
  if (retrievalHubContext.entrySource !== "exposure_complete" || !doc?.docId) return;

  panel.hidden = false;
  try {
    const [{ collectObservations }, { getSessionVaultChanges }, { resolveStudyVisitStartedAt, renderVaultSummaryHtml }] =
      await Promise.all([
        import("./vault/session-close.js"),
        import("./vault/vault-store.js"),
        import("./vault/session-vault-summary.js"),
      ]);

    const docId = String(doc.docId);
    const [rsvp, questions, cloze, slow] = await Promise.all([
      loadSessionForMode("rsvp"),
      loadSessionForMode("questions"),
      loadSessionForMode("cloze"),
      loadSessionForMode("slow"),
    ]);

    const sessionForVault = {
      ...doc,
      modes: { rsvp, questions, cloze, slow },
    };

    const visitStartedAt = resolveStudyVisitStartedAt(sessionForVault, [rsvp, questions, cloze, slow].filter(Boolean));
    const observations = await collectObservations(sessionForVault, "rsvp", docId);
    const summary = getSessionVaultChanges({
      session: doc,
      observations,
      docId,
      visitStartedAt,
    });
    panel.innerHTML = renderVaultSummaryHtml(summary);
  } catch (err) {
    console.warn("[retrieval-hub] vault summary failed", err);
    panel.innerHTML = "";
    panel.hidden = true;
  }
}

/**
 * @param {{ docId?: string, entrySource?: string, returnScreen?: string }} [options]
 */
export async function enterRetrievalHub(options = {}) {
  const docId = String(options.docId || await getActiveSession()?.docId || "").trim();
  const doc = docId ? await getSession(docId) : null;
  if (!doc) {
    enterDocLibraryScreen();
    return;
  }
  if (docId !== (await getActiveSession())?.docId) {
    await setActiveSession(docId);
    hydrateMaterialStateFromDoc(doc);
  }
  const material = String(doc.shared?.rawMarkdown || "").trim();
  if (!material) {
    retrievalHubContext = {
      docId,
      entrySource: options.entrySource || "mode_select",
      returnScreen: options.returnScreen || "modeSelect",
    };
    if (els.retrievalHubLead) {
      els.retrievalHubLead.textContent =
        "Upload your material first, then return here to practice retrieval.";
    }
    renderRetrievalHubOptions();
    resetRetrievalHubVaultSummary();
    showScreen("retrievalHub");
    return;
  }
  retrievalHubContext = {
    docId,
    entrySource: options.entrySource || "mode_select",
    returnScreen: options.returnScreen || "modeSelect",
  };
  if (els.retrievalHubLead) {
    els.retrievalHubLead.textContent =
      "Choose how you want to practice retrieval. All options use your loaded material.";
  }
  renderRetrievalHubOptions();
  resetRetrievalHubVaultSummary();
  showScreen("retrievalHub");
  void renderRetrievalHubVaultSummary(doc);
}

function exitRetrievalHub() {
  if (retrievalHubContext.returnScreen === "docLibrary") {
    enterDocLibraryScreen();
    return;
  }
  enterModeSelectScreen();
}

function onRetrievalHubPick(modeKey) {
  const mode = normalizeStudyMode(modeKey);
  if (!mode || mode === "review") return;
  void enterModeWithContinuity(mode);
}

/** Active concept ids for mnemonic panel prefill (mode-specific).
 * @returns {Promise<string[]>}
 */
export async function resolveMnemonicActiveConceptIds() {
  const screenId = getCurrentScreenId();
  const doc = await getActiveSession();
  if (!doc) return [];

  if (screenId === "test" || screenId === "socratic") {
    const block = getBlock(state.activeBlockIndex);
    if (Array.isArray(block?.concept_ids)) {
      return block.concept_ids.map((id) => String(id).trim()).filter(Boolean);
    }
    if (Array.isArray(block?.concepts)) {
      return block.concepts
        .map((c) => String(c?.canonicalId || c?.id || c).trim())
        .filter(Boolean);
    }
    return [];
  }
  if (screenId === "clozeStudy") return getActiveClozeConceptIds();
  if (screenId === "recall") return getActiveRecallConceptIds(doc);
  if (screenId === "review") return getCurrentSm2ReviewConceptIds();
  return [];
}

async function promoteConceptInventoryToShared(inventory, detectedBy = "rsvp") {
  const doc = await getActiveSession();
  if (!doc?.docId || !Array.isArray(inventory) || !inventory.length) return;
  const concepts = inventory
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const label = String(raw.label || raw.term || raw.name || "").trim();
      if (!label) return null;
      return {
        label,
        definition: String(raw.definition || raw.authorUsage || "").trim(),
        canonicalId: raw.canonicalId || raw.id,
        detectedBy,
      };
    })
    .filter(Boolean);
  if (concepts.length) {
    addConceptsToShared(doc, concepts);
    await saveDocumentSession(doc);
  }
}

async function persistInventoryRunMeta(doc, invResult) {
  if (!doc?.docId || invResult?.kind !== "inventory") return;
  if (!doc.modes) doc.modes = {};
  if (!doc.modes.rsvp) doc.modes.rsvp = {};
  if (!doc.modes.rsvp._meta) doc.modes.rsvp._meta = {};
  const meta = doc.modes.rsvp._meta;
  if (invResult.inventoryMode) meta.inventoryMode = invResult.inventoryMode;
  if (invResult.chunkCount != null) meta.inventoryChunkCount = invResult.chunkCount;
  if (Array.isArray(invResult.failedChunks) && invResult.failedChunks.length) {
    meta.inventoryFailedChunks = invResult.failedChunks;
  }
  await saveDocumentSession(doc);
}

function notifyInventoryRunStatus(invResult) {
  if (!invResult || typeof invResult !== "object") return;
  if (invResult.kind === "fallback_mono") {
    showInventoryStatusBanner(
      "Concept inventory could not be generated. Using a simplified block split instead. Concept-level features (assessment, vault tagging) will not be available for this session.",
    );
    return;
  }
  if (Array.isArray(invResult.failedChunks) && invResult.failedChunks.length) {
    showInventoryStatusBanner(
      "Concept inventory partially recovered ? some sections could not be processed. Results may be incomplete.",
    );
  }
}

async function ensureDocHierarchyForInventory(doc, cleanedText, wordCount, onProgress) {
  let docHierarchy = doc?.shared?.docHierarchy;
  if (docHierarchy?.tree?.length || wordCount <= 8000) return docHierarchy;
  if (typeof onProgress === "function") onProgress("Building document structure…");
  docHierarchy = await buildDocumentHierarchy(cleanedText, null, {
    useCache: true,
    headings: Array.isArray(doc?.shared?.structureHeadings)
      ? doc.shared.structureHeadings
      : undefined,
  });
  if (doc?.shared && docHierarchy) {
    doc.shared.docHierarchy = docHierarchy;
    await saveDocumentSession(doc);
  }
  return docHierarchy;
}

async function syncActiveSessionAssessmentSignals() {
  const doc = await getActiveSession();
  const session = state.activeSession;
  if (!doc?.docId || !session?._responses) return;
  const mode = normalizeStudyMode(session.studyMode || state.studyMode);
  if (mode !== "rsvp" && mode !== "questions") return;
  try {
    await syncAssessmentSignalsToShared(doc.docId, session, mode);
  } catch (err) {
    console.warn("[study] assessment signal sync failed", err);
  }
}

/** Batch sync responses + refresh flow panel state when leaving a mode. */
export function syncFlowExitState() {
  syncActiveSessionAssessmentSignals();
}

function escapeDocLibraryHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDocLibraryDate(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return "?";
  return new Date(n).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDocLibraryModes(modes) {
  if (!modes.length) return "No modes yet";
  return modes.map((mode) => getStudyModeLabel(mode)).join(", ");
}

/** @returns {Promise<{ docId: string, title: string, modes: string[], smDue: number, updatedAt: number }[]>} */
export async function buildDocLibraryRows() {
  const sessions = await getAllSessions();
  const rows = [];
  for (const doc of sessions) {
    const related = Array.isArray(doc.shared?.relatedDocuments) ? doc.shared.relatedDocuments : [];
    const hasRelated = related.some((r) => (r?.score ?? 0) >= DOC_SIMILARITY_RELATED_THRESHOLD);
    rows.push({
      docId: doc.docId,
      title: doc.shared?.docMeta?.titleInferred || "Untitled document",
      modes: Object.entries(doc.modes || {})
        .filter(([, value]) => value != null)
        .map(([key]) => key),
      smDue: (await getSmItemsDueToday(doc.docId)).length,
      updatedAt: doc.updatedAt || 0,
      relatedBadge: hasRelated,
    });
  }
  return rows;
}

export async function renderDocLibrary() {
  const container = els.docLibraryList;
  if (!container) return;

  const rows = await buildDocLibraryRows();
  if (!rows.length) {
    container.innerHTML = '<p class="doc-library-empty hint">No documents studied yet.</p>';
    return;
  }

  container.innerHTML = rows
    .map((row) => {
      const smDueHtml =
        row.smDue > 0
          ? `<span class="doc-library-sm-due">${row.smDue} due today</span>`
          : "";
      const relatedHtml = row.relatedBadge
        ? `<span class="doc-library-related">Related document</span>`
        : "";
      return `<button type="button" class="doc-library-item" data-doc-id="${escapeDocLibraryHtml(row.docId)}" role="listitem">
        <span class="doc-library-title">${escapeDocLibraryHtml(row.title)}</span>
        <span class="doc-library-meta">
          <span class="doc-library-modes">${escapeDocLibraryHtml(formatDocLibraryModes(row.modes))}</span>
          ${relatedHtml}
          ${smDueHtml}
          <span class="doc-library-date">${escapeDocLibraryHtml(formatDocLibraryDate(row.updatedAt))}</span>
        </span>
      </button>`;
    })
    .join("");
}

export function enterDocLibraryScreen() {
  refreshVaultReviewBadge();
  enterProjectLibrary({ reset: true });
  showScreen("docLibrary");
}

async function reopenDocumentFromLibrary(docId) {
  const id = String(docId || "").trim();
  const session = id ? await getSession(id) : null;
  if (!session) return;
  await setActiveSession(id);
  if (
    !isScopeGateResolved(session) ||
    shouldOfferSharedAssessmentGate(session) ||
    !isTier1PreparationComplete(session)
  ) {
    await enterModeSelectAfterTier1Gate(session);
    return;
  }
  enterModeSelectScreen();
}

function hydrateMaterialStateFromDoc(doc) {
  const text = String(doc?.shared?.rawMarkdown || "");
  state.lastCleanedMaterialText = text;
  state.lastCleanedMaterialWordCount = countWords(text);
  const fileName = String(doc?.shared?.uploadMeta?.fileName || "").trim();
  state.lastUploadedFileNames = fileName ? [fileName] : [];
}

function clearMaterialBootstrapUi() {
  state.materialBootstrapActive = false;
  if (els.studyFileInputRow) els.studyFileInputRow.hidden = false;
  if (els.fileInput) els.fileInput.required = true;
}

function setMaterialBootstrapUi(active, doc) {
  state.materialBootstrapActive = Boolean(active);
  if (els.studyFileInputRow) els.studyFileInputRow.hidden = active;
  if (els.fileInput) {
    els.fileInput.required = !active;
    if (active) els.fileInput.value = "";
  }
  if (active && els.fileExtractHint) {
    const words = Number(state.lastCleanedMaterialWordCount) || 0;
    els.fileExtractHint.textContent = words > 0 ? `(~${words} words loaded from document)` : "";
  }
}

/**
 * @param {import("./session-store.js").DocumentSession | null} doc
 * @param {string} mode
 * @param {{ llmModel?: string, language?: string }} [options]
 */
export async function applyModeEntry(doc, mode, options = {}) {
  const resolution = resolveModeEntryState(doc, mode);
  const normalized = normalizeStudyMode(mode);
  if (resolution.kind === "resume") {
    return { action: "resume", mode: normalized, slice: resolution.existingSlice };
  }
  if (normalized === "recall") {
    if (resolution.kind === "bootstrap") {
      return {
        action: "recall_bootstrap",
        mode: normalized,
        slice: resolution.existingSlice,
      };
    }
    if (resolution.kind === "generate_fresh") {
      return {
        action: "recall_generate_fresh",
        mode: normalized,
        slice: resolution.existingSlice,
      };
    }
    return { action: "upload_required", mode: normalized, slice: null };
  }
  if (resolution.kind === "bootstrap" && doc) {
    const slice = buildModeSliceFromShared(doc, mode, options);
    await persistModeSliceToDocument(doc, mode, slice);
    return { action: "bootstrap", mode: normalized, slice };
  }
  return { action: "upload_required", mode: normalized, slice: null };
}

async function showBootstrappedCreateScreen(mode, slice, doc) {
  hydrateMaterialStateFromDoc(doc);
  state.studyMode = mode;
  state.activeSession = slice;
  await storeActiveSession(slice);
  setStudyModeRadio(mode);
  if (els.createModeLabel) {
    els.createModeLabel.textContent = getStudyModeLabel(mode);
  }

  if (mode === "slow") {
    slice.docHierarchy = resolveScopedHierarchy(doc) ?? doc.shared?.docHierarchy ?? null;
    slice.slow.phase = "phase0";
    prepareSlowPhase0Entry(slice);
    setGenerateBlocksFormHidden(true);
    clearMaterialBootstrapUi();
    updateCreateScreenModeVisibility(mode);
    enterSlowPhase0(slice);
    return;
  }

  if (mode === "cloze") {
    setGenerateBlocksFormHidden(true);
    setMaterialBootstrapUi(true, doc);
    updateCreateScreenModeVisibility(mode);
    updateClozeSessionPanel(slice);
    showCreateScreen();
    return;
  }

  setGenerateBlocksFormHidden(false);
  setMaterialBootstrapUi(true, doc);
  applySharedBlockRecommendationToUi(doc);
  updateCreateScreenModeVisibility(mode);
  showCreateScreen();
}

/**
 * @param {string} mode
 */
export async function enterModeWithContinuity(mode) {
  const raw = String(mode || "").trim();
  if (raw === "review") {
    runVaultSm2ReviewSession();
    return;
  }
  const normalized = normalizeStudyMode(raw);
  const docGate = await getActiveSession();
  if (docGate && !isModeAvailableForSession(docGate, normalized)) {
    if (els.modeSelectManual) els.modeSelectManual.hidden = false;
    alert("This mode is not available for this session.");
    return;
  }

  applyFlowRecommendationOnEnterMode(normalized);
  const doc = await getActiveSession();
  const entry = await applyModeEntry(doc, normalized, {
    llmModel: getSessionLlmModel(),
    language: getStudyLanguage(),
  });

  if (entry.action === "resume" && entry.slice) {
    if (normalized === "slow") resumeSlowSession(entry.slice);
    else if (normalized === "cloze") resumeClozeSession(entry.slice);
    else if (normalized === "questions") resumeQuestionsSession(entry.slice);
    else if (normalized === "read") resumeReadSession(entry.slice);
    else if (normalized === "recall") void getRecallController().enterRecall(entry);
    else resumeRsvpSession(entry.slice);
    return;
  }

  if (entry.action === "recall_bootstrap" || entry.action === "recall_generate_fresh") {
    if (doc) void getRecallController().enterRecall(entry);
    return;
  }

  if (entry.action === "bootstrap" && entry.slice && doc) {
    showBootstrappedCreateScreen(normalized, entry.slice, doc);
    return;
  }

  clearMaterialBootstrapUi();
  enterCreateScreenForMode(normalized);
}

function enterCreateScreenForMode(mode) {
  const normalized = normalizeStudyMode(mode);
  clearMaterialBootstrapUi();
  applyFlowRecommendationOnEnterMode(normalized);
  state.studyMode = normalized;
  setStudyModeRadio(normalized);
  if (els.createModeLabel) {
    els.createModeLabel.textContent = getStudyModeLabel(normalized);
  }
  showModeResumeOrUpload(normalized);
  showCreateScreen();
}

function returnToCreateScreen() {
  const mode = state.studyMode || getSelectedStudyModeRadio();
  if (mode) enterCreateScreenForMode(mode);
  else enterModeSelectScreen();
}

function resolveActiveCreateMode() {
  return normalizeStudyMode(state.studyMode || getSelectedStudyModeRadio());
}

function showCreateScreen() {
  updateCreateScreenModeVisibility(resolveActiveCreateMode());
  syncExportButtonsEnabled();
  syncPersistenceHealthBanner();
  showScreen("create");
  void maybeAutoRecommendBlockCount();
}

function setGenerateBlocksFormHidden(hidden) {
  if (els.generateBlocksForm) els.generateBlocksForm.hidden = hidden;
  if (els.generateBlocksFooter) els.generateBlocksFooter.hidden = hidden;
  if (!hidden) updateCreateScreenModeVisibility(resolveActiveCreateMode());
}

function syncRsvpAssessmentToggleFromPreference() {
  // Legacy RSVP toggle removed; shared gate preference is controlled in Settings.
}

function updateCreateScreenModeVisibility(mode) {
  const isSlow = mode === "slow";
  const isRsvp = mode === "rsvp";
  const isRead = mode === "read";
  const isBlockPackMode = isRsvp || isRead;
  const isCloze = mode === "cloze";
  const isQuestions = mode === "questions";
  const showComments = isBlockPackMode || isQuestions;
  if (els.generateBlocksForm) {
    els.generateBlocksForm.classList.toggle("create-form--slow", isSlow);
  }
  if (els.rsvpOfflinePackRow) els.rsvpOfflinePackRow.hidden = !isRsvp;
  if (els.rsvpBlocksCountGroup) els.rsvpBlocksCountGroup.hidden = !isBlockPackMode;
  if (els.rsvpCommentsGroup) els.rsvpCommentsGroup.hidden = !showComments;
  if (els.rsvpAssessmentOption) {
    els.rsvpAssessmentOption.hidden = true;
  }
  if (els.blocksInput) els.blocksInput.required = isBlockPackMode;
  if (!isRsvp) invalidateBlockSplitCacheAndRecommendUi();
  else void maybeAutoRecommendBlockCount();
  if (els.generateBlocksBtn) {
    const bootstrapped = Boolean(state.materialBootstrapActive);
    if (bootstrapped && (isSlow || isCloze)) {
      els.generateBlocksBtn.textContent = "Continue with loaded material…";
    } else if (isQuestions) {
      els.generateBlocksBtn.textContent = "Generate questions";
    } else {
      els.generateBlocksBtn.textContent =
        isSlow || isCloze ? "Upload and continue…" : isRead ? "Generate blocks" : "Generate blocks";
    }
  }
  setOfflinePackButtonVisibility(isRsvp && !isOfflineMode());
}

function resetCreateScreenModeUi() {
  clearMaterialBootstrapUi();
  setGenerateBlocksFormHidden(true);
  if (els.clozeSessionPanel) els.clozeSessionPanel.hidden = true;
  if (els.createModeLabel) els.createModeLabel.textContent = "";
  updateCreateScreenModeVisibility(null);
}

function updateClozeSessionPanel(session) {
  const cloze = session?.cloze;
  const isCloze = session?.studyMode === "cloze" && cloze;
  if (els.clozeSessionPanel) els.clozeSessionPanel.hidden = !isCloze;
  if (!isCloze) return;

  const status = String(cloze.pipelineStatus || "normalized");
  const validCount = getValidItems(cloze.items || []).length;
  const hasGraph = Boolean(cloze.epistemicGraph?.nodes?.length);
  const generating = status === "generating" || /^phase\d$/.test(status);
  const ready = status === "ready";
  const failed = status === "failed";

  if (els.clozePipelineProgress) {
    if (generating && cloze.pipelinePhase != null) {
      const phaseNum = Number(cloze.pipelinePhase);
      els.clozePipelineProgress.textContent = `Generating items — Phase ${phaseNum + 1}/5: ${getPhaseLabel(phaseNum)}`;
    } else if (ready) {
      els.clozePipelineProgress.textContent = "Items ready.";
    } else if (failed) {
      els.clozePipelineProgress.textContent = "";
    } else {
      els.clozePipelineProgress.textContent = "Material normalized. Press Generate items to start the pipeline.";
    }
  }

  if (els.clozeReadySummary) {
    if (ready && validCount > 0) {
      els.clozeReadySummary.hidden = false;
      els.clozeReadySummary.textContent = `${validCount} validated items ready to study.`;
    } else {
      els.clozeReadySummary.hidden = true;
      els.clozeReadySummary.textContent = "";
    }
  }

  if (els.clozeGenerateBtn) {
    els.clozeGenerateBtn.hidden = ready;
    els.clozeGenerateBtn.disabled = generating;
    els.clozeGenerateBtn.textContent = failed ? "Retry" : "Generate items";
  }
  if (els.clozeStudyBtn) {
    els.clozeStudyBtn.hidden = !(ready && validCount > 0);
  }
  if (els.clozeExportBtn) {
    els.clozeExportBtn.hidden = !(ready && validCount > 0);
  }
  if (els.clozeViewGraphBtn) {
    els.clozeViewGraphBtn.hidden = !hasGraph;
  }
  if (els.clozePipelineError) {
    els.clozePipelineError.hidden = !failed || !cloze.pipelineError;
    els.clozePipelineError.textContent = failed ? String(cloze.pipelineError || "Pipeline error.") : "";
  }
}

async function resumeClozeSession(session) {
  if (session?.language) syncStudyLanguage(session.language);
  state.activeSession = session;
  state.studyMode = "cloze";
  await storeActiveSession(session);
  setGenerateBlocksFormHidden(true);
  updateClozeSessionPanel(session);
  showCreateScreen();
  if (session?.cloze?.pipelineStatus === "ready" && getValidItems(session.cloze.items || []).length > 0) {
    // User can tap Estudiar; optional auto-navigate deferred.
  }
}

let clozePipelineRunning = false;

async function runClozeGeneration(session) {
  if (!session?.cloze || clozePipelineRunning) return;
  const llmModel = normalizeLlmModel(session.llmModel || getDefaultLlmModel());
  try {
    assertLlmKeyPresent(llmModel);
  } catch (err) {
    if (els.clozePipelineError) {
      els.clozePipelineError.hidden = false;
      els.clozePipelineError.textContent = err?.message ? String(err.message) : String(err);
    }
    return;
  }

  clozePipelineRunning = true;
  session.llmModel = llmModel;
  session.cloze.pipelineStatus = "generating";
  session.cloze.pipelineError = null;
  session.cloze.pipelinePhase = 0;
  updateClozeSessionPanel(session);
  await persistClozeModeSlice(session);

  try {
    const result = await runClozePipelinePhases(session.cloze.normalizedText, session, {
      async onPhase(phaseIndex, statusKey, partial = {}) {
        session.cloze.pipelinePhase = phaseIndex;
        session.cloze.pipelineStatus = statusKey;
        if (partial.epistemicGraph) session.cloze.epistemicGraph = partial.epistemicGraph;
        if (partial.analysis) session.cloze.analysis = partial.analysis;
        if (partial.items) session.cloze.items = partial.items;
        updateClozeSessionPanel(session);
        await persistClozeModeSlice(session);
      },
    });

    session.cloze.epistemicGraph = result.epistemicGraph;
    session.cloze.analysis = result.analysis;
    session.cloze.items = result.items;
    session.cloze.pipelineStatus = "ready";
    session.cloze.pipelinePhase = null;
    session.cloze.pipelineError = null;
    session.cloze.generationMeta = {
      completedAt: new Date().toISOString(),
      itemCounts: {
        total: result.items.length,
        valid: result.validItems.length,
      },
    };
    applyAssessmentPrioritizedOrder(session, await getActiveSession());
    updateClozeSessionPanel(session);
    await persistClozeModeSlice(session);
  } catch (err) {
    session.cloze.pipelineStatus = "failed";
    session.cloze.pipelineError = err?.message ? String(err.message) : String(err);
    updateClozeSessionPanel(session);
    await persistClozeModeSlice(session);
  } finally {
    clozePipelineRunning = false;
  }
}

function mountClozeGraph(session) {
  if (!els.clozeGraphMount || !session?.cloze?.epistemicGraph) return;
  els.clozeGraphMount.hidden = false;
  void mountMaterialGraphScreen(session, els.clozeGraphMount, {
    mode: "cloze",
    shared: session?.shared,
  });
}

function showModeResumeOrUpload(mode) {
  state.studyMode = mode;
  updateCreateScreenModeVisibility(mode);
  setGenerateBlocksFormHidden(false);
}

async function resumeSlowSession(session) {
  if (session?.language) syncStudyLanguage(session.language);
  state.activeSession = session;
  state.studyMode = "slow";
  await storeActiveSession(session);
  // Safety net: legacy phase:"scope" → Phase 0 (new sessions never write "scope")
  if (String(session?.slow?.phase || "") === "scope") {
    session.slow.phase = "phase0";
    prepareSlowPhase0Entry(session);
    enterSlowPhase0(session);
    return;
  }
  if (String(session?.slow?.phase || "") === "phase0") {
    enterSlowPhase0(session);
    return;
  }
  navigateSlowByPhase(session);
  if (String(session?.slow?.phase || "") === "phase1" || String(session?.slow?.phase || "") === "phase2") {
    initSlowReader(session);
  }
}

async function resumeRsvpSession(session) {
  state.activeSession = session;
  state.studyMode = "rsvp";
  await storeActiveSession(session);
  const n = Math.max(1, Number(session?.n_blocks) || 1);
  if (els.sessionReadyMeta) {
    els.sessionReadyMeta.textContent = `Session ready. Blocks: ${n}`;
  }
  setFullPackEntryCta(n);
  showScreen("ready");
}

async function resumeReadSession(session) {
  state.activeSession = session;
  state.studyMode = "read";
  await storeActiveSession(session);
  const n = Math.max(1, Number(session?.n_blocks) || 1);
  if (els.sessionReadyMeta) {
    els.sessionReadyMeta.textContent = `Read session ready. Blocks: ${n}`;
  }
  setFullPackEntryCta(n);
  showScreen("ready");
}

async function resumeQuestionsSession(session) {
  state.activeSession = session;
  state.studyMode = "questions";
  await storeActiveSession(session);
  const n = Math.max(1, Number(session?.n_blocks) || 1);
  if (els.sessionReadyMeta) {
    els.sessionReadyMeta.textContent = "Questions session ready.";
  }
  setFullPackEntryCta(n);
  showScreen("ready");
}

function setSlowPhase0Controls({ showRetry = false, showSkip = false, showContinue = false } = {}) {
  if (els.slowPhase0RetryBtn) els.slowPhase0RetryBtn.hidden = !showRetry;
  if (els.slowPhase0SkipBtn) els.slowPhase0SkipBtn.hidden = !showSkip;
  if (els.slowPhase0ContinueBtn) els.slowPhase0ContinueBtn.hidden = !showContinue;
}

const PHASE0_MAX_CONCEPTS = 5;

async function persistPhase0Edits(session) {
  if (!session?.slow?.phase0) return;
  await storeActiveSession(session);
}

function renderPhase0ReadonlyBlock(parent, title, body) {
  const section = document.createElement("section");
  section.className = "slow-phase0-block";
  const h2 = document.createElement("h2");
  h2.textContent = title;
  const pre = document.createElement("pre");
  pre.className = "slow-phase0-block-body";
  pre.textContent = body;
  section.appendChild(h2);
  section.appendChild(pre);
  parent.appendChild(section);
}

function renderSlowPhase0Prequestions(session, parent) {
  const slow = session.slow;
  const phase0 = slow.phase0;
  if (!phase0) return;
  ensurePhase0UserFields(phase0);

  const section = document.createElement("section");
  section.className = "slow-phase0-block slow-phase0-editable";
  const h2 = document.createElement("h2");
  h2.textContent = "Your questions";
  section.appendChild(h2);

  const list = document.createElement("ul");
  list.className = "slow-phase0-prequestions";
  const renderRow = (text, index) => {
    const li = document.createElement("li");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "slow-phase0-input";
    input.value = text;
    input.placeholder = "Pregunta antes de leer?";
    input.addEventListener("input", () => {
      phase0.prequestions[index] = input.value.trim();
      persistPhase0Edits(session);
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "slow-phase0-icon-btn";
    del.textContent = "×";
    del.title = "Eliminar pregunta";
    del.addEventListener("click", () => {
      phase0.prequestions.splice(index, 1);
      renderSlowPhase0Content(session);
      persistPhase0Edits(session);
    });
    li.appendChild(input);
    li.appendChild(del);
    list.appendChild(li);
  };

  for (let i = 0; i < phase0.prequestions.length; i += 1) {
    renderRow(phase0.prequestions[i], i);
  }
  section.appendChild(list);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "slow-phase0-add-btn";
  addBtn.textContent = "+ Add question";
  addBtn.addEventListener("click", () => {
    phase0.prequestions.push("");
    renderSlowPhase0Content(session);
    persistPhase0Edits(session);
  });
  section.appendChild(addBtn);
  parent.appendChild(section);
}

function renderSlowPhase0ArgumentMap(session, parent) {
  const slow = session.slow;
  const phase0 = slow.phase0;
  if (!phase0) return;

  const section = document.createElement("section");
  section.className = "slow-phase0-block slow-phase0-editable";
  const h2 = document.createElement("h2");
  h2.textContent = slow.fillableMapMode ? "Argument map (fill while reading)" : "Argument map";
  section.appendChild(h2);

  const list = document.createElement("ul");
  list.className = "slow-phase0-argument-map";

  if (slow.fillableMapMode) {
    const blanks = phase0.fillableBlanks || [];
    for (const blank of blanks) {
      const li = document.createElement("li");
      li.className = "slow-phase0-fillable-row";
      const id = document.createElement("span");
      id.className = "slow-phase0-node-id";
      id.textContent = `${blank.nodeId}:`;
      const slot = document.createElement("span");
      slot.className = "slow-phase0-blank";
      slot.textContent = blank.userText || "___";
      li.appendChild(id);
      li.appendChild(slot);
      if (blank.pageIndex != null) {
        const page = document.createElement("span");
        page.className = "hint";
        page.textContent = `(p. ${Number(blank.pageIndex) + 1})`;
        li.appendChild(page);
      }
      list.appendChild(li);
    }
  } else {
    for (let i = 0; i < (phase0.argumentMap || []).length; i += 1) {
      const node = phase0.argumentMap[i];
      const li = document.createElement("li");
      li.className = "slow-phase0-map-node";
      const idLabel = document.createElement("span");
      idLabel.className = "slow-phase0-node-id";
      idLabel.textContent = `${node.id}:`;
      const textInput = document.createElement("textarea");
      textInput.className = "slow-phase0-textarea";
      textInput.rows = 2;
      textInput.value = node.text || "";
      textInput.addEventListener("input", () => {
        node.text = textInput.value.trim();
        persistPhase0Edits(session);
      });
      const statusInput = document.createElement("input");
      statusInput.type = "text";
      statusInput.className = "slow-phase0-input slow-phase0-status-input";
      statusInput.placeholder = "Status (optional)";
      statusInput.value = node.status || "";
      statusInput.addEventListener("input", () => {
        node.status = statusInput.value.trim() || undefined;
        persistPhase0Edits(session);
      });
      li.appendChild(idLabel);
      li.appendChild(textInput);
      li.appendChild(statusInput);
      list.appendChild(li);
    }
  }
  section.appendChild(list);
  parent.appendChild(section);
}

function renderSlowPhase0Concepts(session, parent) {
  const slow = session.slow;
  const phase0 = slow.phase0;
  if (!phase0) return;

  const section = document.createElement("section");
  section.className = "slow-phase0-block slow-phase0-editable";
  const h2 = document.createElement("h2");
  h2.textContent = "Concepts to find";
  section.appendChild(h2);

  const list = document.createElement("ul");
  list.className = "slow-phase0-concepts";
  for (let i = 0; i < (phase0.conceptsToFind || []).length; i += 1) {
    const concept = phase0.conceptsToFind[i];
    const li = document.createElement("li");
    const termInput = document.createElement("input");
    termInput.type = "text";
    termInput.className = "slow-phase0-input";
    termInput.value = concept.term || "";
    termInput.addEventListener("input", () => {
      concept.term = termInput.value.trim();
      if (concept.graphTermId) concept.graphTermId = slugGraphTermId(concept.term);
      persistPhase0Edits(session);
    });
    const usageInput = document.createElement("input");
    usageInput.type = "text";
    usageInput.className = "slow-phase0-input";
    usageInput.placeholder = "How the author uses it";
    usageInput.value = concept.authorUsage || "";
    usageInput.addEventListener("input", () => {
      concept.authorUsage = usageInput.value.trim();
      persistPhase0Edits(session);
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "slow-phase0-icon-btn";
    del.textContent = "×";
    del.addEventListener("click", () => {
      phase0.conceptsToFind.splice(i, 1);
      renderSlowPhase0Content(session);
      persistPhase0Edits(session);
    });
    li.appendChild(termInput);
    li.appendChild(usageInput);
    li.appendChild(del);
    list.appendChild(li);
  }
  section.appendChild(list);

  const row = document.createElement("div");
  row.className = "row slow-phase0-concept-actions";
  const dictSelect = document.createElement("select");
  dictSelect.className = "slow-phase0-select";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Add from dictionary…";
  dictSelect.appendChild(placeholder);
  const dictConcepts = getSortedSessionConcepts();
  for (const c of dictConcepts) {
    const opt = document.createElement("option");
    opt.value = c.term;
    opt.textContent = c.term;
    opt.dataset.definition = c.definition || "";
    dictSelect.appendChild(opt);
  }
  const addDictBtn = document.createElement("button");
  addDictBtn.type = "button";
  addDictBtn.textContent = "Add concept";
  addDictBtn.disabled = (phase0.conceptsToFind || []).length >= PHASE0_MAX_CONCEPTS;
  addDictBtn.addEventListener("click", () => {
    const term = dictSelect.value.trim();
    if (!term) return;
    const def = dictSelect.selectedOptions[0]?.dataset?.definition || "";
    const exists = (phase0.conceptsToFind || []).some(
      (c) => String(c.term || "").toLowerCase() === term.toLowerCase(),
    );
    if (exists || (phase0.conceptsToFind || []).length >= PHASE0_MAX_CONCEPTS) return;
    phase0.conceptsToFind.push({
      term,
      authorUsage: def || "From session dictionary",
      graphTermId: slugGraphTermId(term),
    });
    renderSlowPhase0Content(session);
    persistPhase0Edits(session);
  });
  row.appendChild(dictSelect);
  row.appendChild(addDictBtn);
  section.appendChild(row);
  parent.appendChild(section);
}

function renderSlowPhase0Content(session) {
  const slow = session?.slow;
  const host = els.slowPhase0Content;
  if (!host || !slow?.phase0) return;
  const phase0 = ensurePhase0UserFields(slow.phase0);
  const criticalMode = Boolean(slow.criticalMode);
  const collapsed = Boolean(slow.phase0Collapsed);

  host.innerHTML = "";
  host.hidden = collapsed;

  if (els.slowPhase0CollapseBtn) {
    els.slowPhase0CollapseBtn.hidden = false;
    els.slowPhase0CollapseBtn.textContent = collapsed
      ? "Expand orientation"
      : "Collapse orientation";
  }

  if (collapsed) return;

  renderPhase0ReadonlyBlock(host, "Thesis", phase0.thesis);
  renderSlowPhase0Prequestions(session, host);
  renderSlowPhase0ArgumentMap(session, host);
  renderSlowPhase0Concepts(session, host);
  renderPhase0ReadonlyBlock(host, "Guide question", phase0.guideQuestion);

  if (criticalMode && phase0.criticalExaminePoints?.length) {
    renderPhase0ReadonlyBlock(
      host,
      "Examine critically",
      phase0.criticalExaminePoints.map((p) => `• ${p}`).join("\n"),
    );
  }
}

function updatePhase0CollapseUi(session) {
  const slow = session?.slow;
  if (!slow || !els.slowPhase0CollapseBtn) return;
  const collapsed = Boolean(slow.phase0Collapsed);
  els.slowPhase0CollapseBtn.hidden = slow.phase0Status !== "ready" || !slow.phase0;
  els.slowPhase0CollapseBtn.textContent = collapsed ? "Expand orientation" : "Collapse orientation";
  if (els.slowPhase0Content) els.slowPhase0Content.hidden = collapsed;
}

function renderSlowPhase0Screen(session) {
  const slow = session?.slow;
  if (!slow) return;

  if (els.slowPhase0Error) {
    els.slowPhase0Error.hidden = true;
    els.slowPhase0Error.textContent = "";
  }

  const status = String(slow.phase0Status || "idle");

  if (status === "generating") {
    setSlowPhase0Controls();
    if (els.slowPhase0CollapseBtn) els.slowPhase0CollapseBtn.hidden = true;
    if (els.slowPhase0Content) els.slowPhase0Content.innerHTML = "";
    if (els.slowPhase0Progress) {
      els.slowPhase0Progress.hidden = false;
      if (!els.slowPhase0Progress.textContent) {
        els.slowPhase0Progress.textContent = "Generating orientation…";
      }
    }
    return;
  }

  if (els.slowPhase0Progress) els.slowPhase0Progress.hidden = true;

  if (status === "failed") {
    if (els.slowPhase0Content) els.slowPhase0Content.innerHTML = "";
    if (els.slowPhase0CollapseBtn) els.slowPhase0CollapseBtn.hidden = true;
    if (els.slowPhase0Error) {
      els.slowPhase0Error.hidden = false;
      els.slowPhase0Error.textContent =
        slow.phase0Error || "Could not generate orientation. Check your connection and try again.";
    }
    const allowSkipOnFail = Boolean(slow.phase0SeenReread);
    setSlowPhase0Controls({ showRetry: true, showSkip: allowSkipOnFail });
    return;
  }

  if (status === "ready" && slow.phase0) {
    renderSlowPhase0Content(session);
    void renderSlowPhase0GraphActions(session);
    updatePhase0CollapseUi(session);
    setSlowPhase0Controls({ showContinue: true });
    return;
  }

  if (status === "skipped") {
    if (els.slowPhase0Content) {
      els.slowPhase0Content.innerHTML =
        '<p class="hint">Continuing without AI orientation. You can still annotate during reading.</p>';
    }
    setSlowPhase0Controls({ showContinue: true });
    return;
  }

  setSlowPhase0Controls();
  if (els.slowPhase0Content) els.slowPhase0Content.innerHTML = "";
}

let phase0GenerationToken = 0;

async function runPhase0Generation(session) {
  const slow = session?.slow;
  if (!slow || slow.phase0Status === "generating") return;
  if (slow.phase0Status === "ready" && slow.phase0) {
    renderSlowPhase0Screen(session);
    return;
  }

  const doc = await getActiveSession();
  const cachedOrientation = doc?.shared?.slowOrientation?.payload;
  if (cachedOrientation && typeof cachedOrientation === "object") {
    slow.phase0 = applyFillableMapMode(
      ensurePhase0UserFields(cachedOrientation),
      slow.fillableMapMode,
    );
    slow.phase0Status = "ready";
    slow.phase0Error = null;
    await storeActiveSession(session);
    renderSlowPhase0Screen(session);
    return;
  }

  const token = ++phase0GenerationToken;
  slow.phase0Status = "generating";
  slow.phase0Error = null;
  if (els.slowPhase0Progress) {
    els.slowPhase0Progress.hidden = false;
    els.slowPhase0Progress.textContent = "Generating orientation…";
  }
  renderSlowPhase0Screen(session);
  await storeActiveSession(session);

  const scopeText = String(session?.slow?.normalizedTextFull || "");
  try {
    const orientation = await generatePhase0ForScope(scopeText, session, {
      language: String(session?.language || getStudyLanguage()).trim() || "English",
      onProgress: ({ phase, current, total, label }) => {
        if (token !== phase0GenerationToken) return;
        if (!els.slowPhase0Progress) return;
        els.slowPhase0Progress.hidden = false;
        if (phase === "chunk") {
          els.slowPhase0Progress.textContent = `Phase 0: section ${current}/${total} — ${label}`;
        } else {
          els.slowPhase0Progress.textContent = "Phase 0: synthesizing global orientation…";
        }
      },
    });
    if (token !== phase0GenerationToken) return;
    slow.phase0 = applyFillableMapMode(ensurePhase0UserFields(orientation), slow.fillableMapMode);
    slow.phase0Status = "ready";
    slow.phase0Error = null;
    await storeActiveSession(session);
    renderSlowPhase0Screen(session);
  } catch (err) {
    if (token !== phase0GenerationToken) return;
    slow.phase0Status = "failed";
    slow.phase0Error = err?.message ? String(err.message) : "Phase 0 generation failed.";
    await storeActiveSession(session);
    renderSlowPhase0Screen(session);
  }
}

async function skipSlowPhase0(session) {
  if (!session?.slow) return;
  if (!session.slow.phase0SeenReread) return;
  session.slow.phase0Status = "skipped";
  session.slow.phase0 = null;
  session.slow.phase0Error = null;
  session.slow.phase = "phase1";
  await storeActiveSession(session);
  navigateSlowByPhase(session);
  initSlowReader(session);
}

async function continueSlowPhase0(session) {
  if (!session?.slow) return;
  const seenKey = session.slow.phase0SeenKey || getPhase0SeenKeyForSession(session);
  if (seenKey) {
    session.slow.phase0SeenKey = seenKey;
    if (session.slow.phase0) {
      savePhase0Cache(seenKey, session.slow.phase0);
    }
    markPhase0Seen(seenKey);
  }
  session.slow.phase = "phase1";
  await storeActiveSession(session);
  navigateSlowByPhase(session);
  initSlowReader(session);
}

function enterSlowPhase0(session) {
  showScreen("slowPhase0");
  renderSlowPhase0Screen(session);
  if (String(session?.slow?.phase0Status || "idle") === "idle") {
    void runPhase0Generation(session);
  }
}

async function wireSlowPhase0Handlers() {
  els.slowPhase0RetryBtn?.addEventListener("click", async () => {
    const session = state.activeSession;
    if (!session?.slow) return;
    session.slow.phase0Status = "idle";
    session.slow.phase0Error = null;
    await storeActiveSession(session);
    void runPhase0Generation(session);
  });

  els.slowPhase0SkipBtn?.addEventListener("click", () => {
    phase0GenerationToken += 1;
    skipSlowPhase0(state.activeSession);
  });

  els.slowPhase0ContinueBtn?.addEventListener("click", () => {
    continueSlowPhase0(state.activeSession);
  });

  els.slowPhase0CollapseBtn?.addEventListener("click", async () => {
    const session = state.activeSession;
    if (!session?.slow) return;
    session.slow.phase0Collapsed = !session.slow.phase0Collapsed;
    renderSlowPhase0Content(session);
    updatePhase0CollapseUi(session);
    await storeActiveSession(session);
  });
}

function prepareSlowPhase0Entry(session) {
  const slow = session?.slow;
  if (!slow) return;
  // fillableMapMode / checkpointsEnabled / criticalMode set once via
  // decideSlowReadingModifiers at createSlowSession (FR-010).
  const seenKey = getPhase0SeenKeyForSession(session);
  slow.phase0SeenKey = seenKey;
  slow.phase0SeenReread = isPhase0Reread(seenKey);
  slow.phase0Collapsed = slow.phase0SeenReread;
  const cached = loadPhase0Cache(seenKey, { criticalMode: slow.criticalMode });
  if (cached) {
    slow.phase0 = applyFillableMapMode(ensurePhase0UserFields(cached), slow.fillableMapMode);
    slow.phase0Status = "ready";
    slow.phase0Error = null;
    syncPhase0ConceptsToShared(slow.phase0);
  } else {
    slow.phase0Status = "idle";
    slow.phase0 = null;
    slow.phase0Error = null;
  }
}

function wireDocLibraryHandlers() {
  projectLibraryCallbacks.onDocumentOpen = (docId) => reopenDocumentFromLibrary(docId);
  projectLibraryCallbacks.onBack = () => enterAppHome();
  projectLibraryCallbacks.onCreateSessionInProject = (projectId) => {
    setUploadProjectContext(projectId);
    enterCreateSessionStartScreen();
  };
  projectLibraryCallbacks.onCreatePack = (docId) => {
    void enterPackConceptEditorFromDoc(docId);
  };

  els.btnAppHomeVault?.addEventListener("click", () => enterVaultBranch());
  els.btnAppHomeSessions?.addEventListener("click", () => enterDocLibraryScreen());
  els.vaultBranchBackBtn?.addEventListener("click", () => enterAppHome());
  els.btnVaultBranchKnowledge?.addEventListener("click", () => {
    els.knowledgeVaultLink?.click();
  });
  els.btnVaultBranchReview?.addEventListener("click", () => {
    populateReviewScopeSelect();
    showScreen("reviewConfig");
  });
  els.btnVaultBranchConceptGraph?.addEventListener("click", () => openConceptRegistryGraphScreen());
  els.btnVaultIngestOnly?.addEventListener("click", () => els.ingestOnlyFileInput?.click());
  els.ingestOnlyFileInput?.addEventListener("change", () => void handleIngestOnlyFileSelected());
  els.btnUploadToVault?.addEventListener("click", () => enterUploadToVaultCandidates());
  els.uploadVaultBackBtn?.addEventListener("click", () => enterModeSelectScreen());
  els.btnUploadVaultRetry?.addEventListener("click", () => void loadUploadVaultCandidates());
  els.btnUploadVaultCommit?.addEventListener("click", () => void commitUploadVaultSelections());
  els.uploadVaultAutoNotes?.addEventListener("change", (e) => {
    saveVaultSettings({ autoDraftNotes: Boolean(e.target?.checked) });
  });
  els.btnVaultUploadResume?.addEventListener("click", () => void resumeVaultUploadQueue());
  syncVaultUploadResumeBanner();
  wireProjectLibraryHandlers();

  els.btnVaultReview?.addEventListener("click", () => {
    runVaultSm2ReviewSession();
  });

  document.getElementById("btnVaultReviewMnemonics")?.addEventListener("click", () => {
    runVaultSm2ReviewSession(undefined, { mnemonicsOnly: true });
  });

  els.retrievalHubBackBtn?.addEventListener("click", () => {
    exitRetrievalHub();
  });

  els.retrievalHubOptions?.addEventListener("click", (event) => {
    const btn = event.target.closest?.("[data-retrieval-mode]");
    if (!btn) return;
    const mode = btn.getAttribute("data-retrieval-mode");
    if (mode) onRetrievalHubPick(mode);
  });

  els.btnPracticeRetrieval?.addEventListener("click", () => {
    enterRetrievalHub({ entrySource: "exposure_complete" });
  });

  els.createSessionStartBackBtn?.addEventListener("click", () => enterDocLibraryScreen());
  els.createSessionPackLookupBtn?.addEventListener("click", () => {
    void handleCreateSessionPackLookup();
  });
  els.createSessionPackImportBtn?.addEventListener("click", () => {
    void handleCreateSessionPackImport();
  });
  els.createSessionPackCodeInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleCreateSessionPackLookup();
    }
  });
  els.createSessionNoFileBtn?.addEventListener("click", () => {
    if (isBookLookupEnabled()) {
      enterBookSearchScreen();
    } else {
      void enterInterviewCaptureScreen();
    }
  });
  els.bookSearchBackBtn?.addEventListener("click", () => enterCreateSessionStartScreen());
  els.bookSearchSkipBtn?.addEventListener("click", () => {
    void handleBookSearchSkip();
  });
  els.bookSearchLookupBtn?.addEventListener("click", () => {
    void handleBookSearchLookup();
  });
  els.bookSearchConfirmBtn?.addEventListener("click", () => {
    if (bookSearchState.pendingBookMeta) {
      void proceedToInterviewWithBookMeta(bookSearchState.pendingBookMeta);
    }
  });
  els.bookSearchRetryBtn?.addEventListener("click", () => {
    resetBookSearchState();
    renderBookSearchPanel();
  });
  els.bookSearchLevelCContinueBtn?.addEventListener("click", () => {
    if (bookSearchState.pendingBookMeta) {
      void proceedToInterviewWithBookMeta(bookSearchState.pendingBookMeta);
    }
  });
  els.bookSearchLevelCRetryBtn?.addEventListener("click", () => {
    resetBookSearchState();
    renderBookSearchPanel();
  });
  els.bookSearchCoverImg?.addEventListener("error", handleBookSearchCoverError);
  els.createSessionStartFileInput?.addEventListener("change", () => {
    handleCreateSessionStartFilePicked();
  });
  els.createSessionStartAddFileBtn?.addEventListener("click", () => {
    els.createSessionStartFileInput?.click();
  });
  els.createSessionStartNameInput?.addEventListener("input", () => {
    createSessionNameManuallyEdited = true;
    void getActiveSession().then((doc) => updateCreateSessionContinueState(doc));
  });
  els.createSessionStartContinueBtn?.addEventListener("click", () => {
    void handleCreateSessionStartContinue();
  });
  els.interviewCaptureBackBtn?.addEventListener("click", () => enterCreateSessionStartScreen());
  els.interviewSubmitAnswerBtn?.addEventListener("click", () => {
    void handleInterviewSubmitAnswer();
  });
  els.interviewFinishBtn?.addEventListener("click", () => {
    void handleInterviewFinish(false);
  });
}

function wireStudyModeSelector() {
  wireFlowPanelHandlers();
  wireDocLibraryHandlers();

  document.querySelectorAll('input[name="studyMode"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const mode = getSelectedStudyModeRadio();
      if (!mode) return;
      void enterModeWithContinuity(mode);
    });
  });

  els.createBackToModesBtn?.addEventListener("click", () => {
    enterModeSelectScreen();
  });

  // RSVP create-screen assessment toggle removed (shared gate is controlled in Settings).
}

let splitMergeSummaryEls = null;

function ensureSplitMergeSummaryEls() {
  if (splitMergeSummaryEls) return splitMergeSummaryEls;
  const host =
    els.screenBlocksList?.querySelector(".blocks-screen-inner") || els.screenBlocksList;
  if (!host) return null;

  const wrap = document.createElement("div");
  wrap.id = "splitMergeSummary";
  wrap.className = "card";
  wrap.style.marginBottom = "14px";
  wrap.hidden = true;

  const title = document.createElement("div");
  title.style.fontWeight = "600";
  title.textContent = "Split summary";

  const meta = document.createElement("div");
  meta.className = "hint";
  meta.style.marginTop = "6px";

  const detailsWrap = document.createElement("div");
  detailsWrap.style.marginTop = "10px";

  wrap.appendChild(title);
  wrap.appendChild(meta);
  wrap.appendChild(detailsWrap);

  // Insert near top of blocks screen, above the editor controls.
  host.prepend(wrap);

  splitMergeSummaryEls = { wrap, meta, detailsWrap };
  return splitMergeSummaryEls;
}

function renderSplitMergeSummary(splitRunMeta) {
  const o = ensureSplitMergeSummaryEls();
  if (!o) return;

  const view = describeSplitRunMetaForUi(splitRunMeta);
  if (view.hidden) {
    o.wrap.hidden = true;
    o.meta.textContent = "";
    o.detailsWrap.innerHTML = "";
    return;
  }

  o.wrap.hidden = false;
  const metaParts = [view.headline, view.dedupLine].filter(Boolean);
  o.meta.textContent = metaParts.join(" ");

  o.detailsWrap.innerHTML = "";
  if (!view.detailRows.length) return;

  const details = document.createElement("details");
  details.open = false;

  const summary = document.createElement("summary");
  summary.textContent = `Merged groups (${view.detailRows.length})`;
  details.appendChild(summary);

  const list = document.createElement("div");
  list.style.marginTop = "10px";
  list.style.display = "grid";
  list.style.gap = "10px";

  for (const row of view.detailRows) {
    const keepId = Number(row?.keep_id);
    const absorbIds = Array.isArray(row?.absorb_ids) ? row.absorb_ids : [];
    const reason = String(row?.reason || "").trim();
    const overlapTerms = Array.isArray(row?.overlap_terms) ? row.overlap_terms.filter(Boolean) : [];

    const card = document.createElement("div");
    card.style.border = "1px solid rgba(148, 163, 184, 0.25)";
    card.style.borderRadius = "12px";
    card.style.padding = "10px";
    card.style.background = "rgba(148, 163, 184, 0.06)";

    const top = document.createElement("div");
    top.style.fontWeight = "600";
    if (row.legacy) {
      const keepBefore = String(row?.keep_title_before || "").trim();
      const keepAfter = String(row?.keep_title_after || "").trim();
      const absorbTitles = Array.isArray(row?.absorb_titles) ? row.absorb_titles : [];
      top.textContent = `Keep #${keepId}: ${keepAfter || keepBefore || "Untitled"} — absorb ${absorbIds
        .map((x) => `#${x}`)
        .join(", ")}`;
      const sub = document.createElement("div");
      sub.className = "hint";
      sub.style.marginTop = "6px";
      sub.textContent =
        absorbTitles.length || keepBefore
          ? `${keepBefore ? `Before: ${keepBefore}. ` : ""}${
              absorbTitles.length ? `Absorbed: ${absorbTitles.filter(Boolean).join(" · ")}` : ""
            }`
          : "";
      if (sub.textContent) card.appendChild(sub);
    } else {
      top.textContent = `Keep #${keepId} — absorb ${absorbIds.map((x) => `#${x}`).join(", ")}`;
    }

    const why = document.createElement("div");
    why.className = "hint";
    why.style.marginTop = "6px";
    const reasonLabel = reason ? `Reason: ${reason}` : "";
    const overlapLabel =
      overlapTerms.length && reason === "signature_overlap"
        ? ` (${overlapTerms.join(", ")})`
        : "";
    why.textContent = `${reasonLabel}${overlapLabel}`.trim();

    card.appendChild(top);
    if (why.textContent) card.appendChild(why);
    list.appendChild(card);
  }

  details.appendChild(list);
  o.detailsWrap.appendChild(details);
}

function normalizeWhitespace(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function syncHiddenBlocksJsonFromEditor() {
  if (!els.blocksListEditor) return;
  const items = Array.from(els.blocksListEditor.querySelectorAll("[data-block-id]"));
  const arr = [];
  for (const item of items) {
    const id = Number(item.getAttribute("data-block-id"));
    const title = normalizeWhitespace(
      item.querySelector('input[name="blockTitle"]')?.value || "",
    );
    const summary = normalizeWhitespace(
      item.querySelector('textarea[name="blockSummary"]')?.value || "",
    );
    arr.push({ id, title, summary });
  }
  setBlocksListJsonCache(JSON.stringify(arr, null, 2));
}

function getBlockFilterQuery() {
  return normalizeWhitespace(els.blocksFilterInput?.value || "").toLowerCase();
}

function applyBlockFilterToEditor() {
  if (!els.blocksListEditor) return;
  const q = getBlockFilterQuery();
  const items = Array.from(els.blocksListEditor.querySelectorAll("[data-block-id]"));
  for (const item of items) {
    const title = String(item.querySelector('input[name="blockTitle"]')?.value || "");
    const summary = String(
      item.querySelector('textarea[name="blockSummary"]')?.value || "",
    );
    const hay = `${title} ${summary}`.toLowerCase();
    const show = !q || hay.includes(q);
    item.hidden = !show;
    if (show && q) item.open = true;
  }
}

function setBlocksReadonlyMode({ enabled, bannerText = "" } = {}) {
  if (els.blocksReadonlyBanner) {
    const text = String(bannerText || "").trim();
    els.blocksReadonlyBanner.hidden = !enabled;
    els.blocksReadonlyBanner.textContent = enabled ? text : "";
  }
}

function renderBlockIndexEditor(blocks, { readOnly = false } = {}) {
  if (!els.blocksListEditor) return;
  const safe = Array.isArray(blocks) ? blocks : [];
  els.blocksListEditor.innerHTML = "";

  for (let i = 0; i < safe.length; i += 1) {
    const b = safe[i] || {};
    const id = Number(b.id);
    const title = String(b.title || "").trim();
    const summary = String(b.summary || "").trim();

    const details = document.createElement("details");
    details.className = "block-item";
    details.open = i === 0;
    details.setAttribute("data-block-id", String(id));

    const summaryEl = document.createElement("summary");
    summaryEl.className = "block-summary";
    const badge = document.createElement("span");
    badge.className = "block-badge";
    badge.textContent = String(id);
    const titlePreview = document.createElement("span");
    titlePreview.className = "block-title-preview";
    titlePreview.textContent = title || `Block ${id}`;
    summaryEl.appendChild(badge);
    summaryEl.appendChild(titlePreview);
    details.appendChild(summaryEl);

    const body = document.createElement("div");
    body.className = "block-body";

    const titleLabel = document.createElement("label");
    titleLabel.textContent = "Title";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.name = "blockTitle";
    titleInput.value = title;
    titleInput.autocapitalize = "sentences";
    titleInput.readOnly = readOnly;
    if (!readOnly) {
      titleInput.addEventListener("input", () => {
        titlePreview.textContent = normalizeWhitespace(titleInput.value) || `Block ${id}`;
        syncHiddenBlocksJsonFromEditor();
        applyBlockFilterToEditor();
      });
    }

    const summaryLabel = document.createElement("label");
    summaryLabel.textContent = "Summary";
    const summaryTa = document.createElement("textarea");
    summaryTa.name = "blockSummary";
    summaryTa.rows = 3;
    summaryTa.value = summary;
    summaryTa.readOnly = readOnly;
    if (!readOnly) {
      summaryTa.addEventListener("input", () => {
        syncHiddenBlocksJsonFromEditor();
        applyBlockFilterToEditor();
      });
    }

    body.appendChild(titleLabel);
    body.appendChild(titleInput);
    body.appendChild(summaryLabel);
    body.appendChild(summaryTa);
    details.appendChild(body);

    els.blocksListEditor.appendChild(details);
  }

  syncHiddenBlocksJsonFromEditor();
  applyBlockFilterToEditor();
  const first = els.blocksListEditor.querySelector(readOnly ? "details.block-item summary" : 'input[name="blockTitle"]');
  if (first) setTimeout(() => first.focus(), 0);
}

function renderQuestionConfigUi() {
  if (els.nTestValue) els.nTestValue.textContent = String(state.nTest);
  if (els.nSocraticValue) els.nSocraticValue.textContent = String(state.nSocratic);
}

function bumpQuestionCount(kind, delta) {
  if (kind === "test") {
    state.nTest = clampInt(state.nTest + delta, 0, MAX_N_TEST, DEFAULT_N_TEST);
  } else {
    state.nSocratic = clampInt(state.nSocratic + delta, 0, MAX_N_SOCRATIC, DEFAULT_N_SOCRATIC);
  }
  renderQuestionConfigUi();
}

function setGenerateLoading(isLoading) {
  els.generateBlocksBtn.disabled = isLoading;
  els.generateBlocksBtn.textContent = isLoading ? "Generating…" : "Generate blocks";
}
function setGenerateError(message) {
  els.generateBlocksError.hidden = false;
  els.generateBlocksError.textContent = message;
}
function clearGenerateError() {
  els.generateBlocksError.hidden = true;
  els.generateBlocksError.textContent = "";
}

function clearRecommendBlocksUi() {
  if (els.recommendBlocksStatus) els.recommendBlocksStatus.textContent = "";
  if (els.recommendBlocksWhy) {
    els.recommendBlocksWhy.textContent = "";
    els.recommendBlocksWhy.hidden = true;
  }
}

function invalidateBlockSplitCacheAndRecommendUi() {
  invalidateBlockSplitCache();
  clearRecommendBlocksUi();
}

function autoGrowStudyNotesInput() {
  const el = els.studyNotesInput;
  if (!el) return;
  const style = getComputedStyle(el);
  const lineHeight = parseFloat(style.lineHeight) || 22.5;
  const pad =
    parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) || 20;
  const minHeight = lineHeight * 2 + pad;
  el.style.height = "auto";
  el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
}

let recommendBlockCountRunId = 0;

function setRecommendLoading(isLoading) {
  if (els.blocksInput) els.blocksInput.disabled = isLoading;
}

async function hasMaterialForBlockRecommend() {
  const hasFile = Boolean(els.fileInput?.files?.length);
  const doc = await getActiveSession();
  const hasBootstrap =
    Boolean(state.materialBootstrapActive) && Boolean(String(doc?.shared?.rawMarkdown || "").trim());
  return hasFile || hasBootstrap;
}

async function maybeAutoRecommendBlockCount() {
  const mode = resolveActiveCreateMode();
  if (mode !== "rsvp") return;
  if (!els.generateBlocksForm || els.generateBlocksForm.hidden) return;
  if (!(await hasMaterialForBlockRecommend())) return;
  const doc = await getActiveSession();
  if (doc && shouldSkipRsvpInventoryLlm(doc) && applySharedBlockRecommendationToUi(doc)) return;
  if (doc && applySharedBlockRecommendationToUi(doc)) return;
  if (doc && isDocumentPreparationReady(doc) && doc.shared?.blockRecommendation) {
    applySharedBlockRecommendationToUi(doc);
    return;
  }
  const runId = ++recommendBlockCountRunId;
  await handleRecommendBlockCount(runId);
}

function resolveSectionCountFromText(cleanedText) {
  const headings = String(cleanedText || "").match(/^#{1,6}\s+.+$/gm) || [];
  return headings.length;
}

function assembleBlockCountSignals(cleanedText, inventory, textMetrics, pedagogicalMeta) {
  const content = textMetrics?.contentSignals ?? {};
  const meta = pedagogicalMeta ?? {};
  return {
    conceptCount: Array.isArray(inventory) ? inventory.length : 0,
    wordCount: textMetrics?.wordCount ?? 0,
    sectionCount: resolveSectionCountFromText(cleanedText),
    conceptualLoad: meta.conceptualLoad,
    argumentativeDensity: meta.argumentativeDensity,
    genre: meta.genre,
    firstPersonRatio: content.firstPersonRatio ?? 0,
    sizeCategory: textMetrics?.sizeCategory,
  };
}

function buildBootstrapFileStub(doc, cleanedText) {
  const meta = doc?.shared?.uploadMeta;
  const fileName =
    String(meta?.fileName || doc?.shared?.docMeta?.titleInferred || "loaded-material.md").trim() ||
    "loaded-material.md";
  return {
    name: fileName,
    size: String(cleanedText || "").length,
    lastModified: Number(doc?.updatedAt) || Date.now(),
  };
}

/**
 * @returns {Promise<{
 *   file: File | object,
 *   cleanedText: string,
 *   wordCount: number,
 *   originalFormat: string,
 *   normalizedFormat: string,
 *   fromBootstrap: boolean,
 *   warnings?: string[],
 *   fallbackSections?: object | null,
 * } | null>}
 */
async function resolveMaterialForGenerate() {
  const doc = await getActiveSession();
  const fileList = els.fileInput?.files ? Array.from(els.fileInput.files) : [];
  let file = fileList[0];

  if (!file && state.materialBootstrapActive && doc?.shared?.rawMarkdown) {
    const cleanedText = String(state.lastCleanedMaterialText || doc.shared.rawMarkdown || "");
    const wordCount = Number(state.lastCleanedMaterialWordCount) || countWords(cleanedText);
    const meta = doc.shared.uploadMeta;
    return {
      file: buildBootstrapFileStub(doc, cleanedText),
      cleanedText,
      wordCount,
      originalFormat: String(meta?.originalFormat || "md"),
      normalizedFormat: "markdown",
      fromBootstrap: true,
      warnings: [],
      fallbackSections: null,
      structureHeadings: Array.isArray(doc.shared?.structureHeadings)
        ? doc.shared.structureHeadings
        : [],
    };
  }

  if (!file) return null;
  const material = await readAndCleanMaterialText(file);
  return { file, ...material, fromBootstrap: false };
}

async function handleRecommendBlockCount(runId = ++recommendBlockCountRunId) {
  const selectedMode = getSelectedStudyModeRadio() || normalizeStudyMode(state.studyMode);
  if (selectedMode !== "rsvp") return;

  if (isOfflineMode()) {
    if (els.recommendBlocksStatus) {
      els.recommendBlocksStatus.textContent =
        "Offline mode is active. Block count recommendation is unavailable.";
    }
    return;
  }

  clearRecommendBlocksUi();

  const docEarly = await getActiveSession();
  if (docEarly && shouldSkipRsvpInventoryLlm(docEarly) && applySharedBlockRecommendationToUi(docEarly)) {
    return;
  }
  if (docEarly && applySharedBlockRecommendationToUi(docEarly)) {
    return;
  }

  const llmModel = getDefaultLlmModel();
  try {
    assertLlmKeyPresent(llmModel);
  } catch (err) {
    if (els.recommendBlocksStatus) {
      els.recommendBlocksStatus.textContent = err?.message ? String(err.message) : String(err);
    }
    if (String(err?.message || "").includes("DeepSeek")) showScreen("settings");
    return;
  }

  state.studyNotes = els.studyNotesInput ? String(els.studyNotesInput.value || "") : "";
  state.pendingLlmModel = llmModel;

  setRecommendLoading(true);
  try {
    const resolved = await resolveMaterialForGenerate();
    if (runId !== recommendBlockCountRunId) return;
    if (!resolved) {
      if (els.recommendBlocksStatus) {
        els.recommendBlocksStatus.textContent =
          "Please choose a file (.pdf, .html, .txt, or .md).";
      }
      return;
    }
    const { file, cleanedText, wordCount } = resolved;
    if (!cleanedText.trim()) throw new Error("File appears to be empty.");
    if (!resolved.fromBootstrap) {
      state.lastCleanedMaterialText = cleanedText;
      state.lastCleanedMaterialWordCount = wordCount;
      if (els.fileExtractHint) {
        els.fileExtractHint.textContent = `(~${wordCount} words extracted)`;
      }
    }
    if (!cleanedText.trim()) throw new Error("File appears to be empty.");
    if (runId !== recommendBlockCountRunId) return;

    const fingerprint = buildBlockSplitFingerprint({
      file,
      studyNotes: String(state.studyNotes || ""),
      wordCount,
    });
    const cache = getBlockSplitCache();
    let inventory;
    const doc = await getActiveSession();
    const preparedPack = resolveRsvpInventoryForPack(doc, { fingerprint });

    if (preparedPack) {
      console.debug("[DPP-GUARD.recommendBlockCount] Inventory path: preparedPack", {
        conceptCount: preparedPack.inventory?.length ?? 0,
      }); // [debug-enrich]
      inventory = preparedPack.inventory;
    } else if (isBlockSplitCacheValid(cache, fingerprint)) {
      console.debug("[DPP-GUARD.recommendBlockCount] Inventory path: blockSplitCache", {
        conceptCount: cache.conceptInventory?.length ?? 0,
      }); // [debug-enrich]
      inventory = cache.conceptInventory;
    } else if (isConceptInventoryValid(doc)) {
      console.debug("[DPP-GUARD.recommendBlockCount] Inventory path: shared.conceptInventory", {
        docId: doc?.docId,
        conceptCount: doc.shared.conceptInventory?.length ?? 0,
      }); // [debug-enrich]
      inventory = doc.shared.conceptInventory;
      setBlockSplitCache({ fingerprint, conceptInventory: inventory, recommendation: null });
    } else {
      console.info("[DPP-GUARD.recommendBlockCount] Inventory path: resolveInventoryForBlockFlow", {
        docId: doc?.docId,
        prepStatus: doc?.shared?.preparation?.status ?? null,
      }); // [debug-enrich]
      const resolved = await resolveInventoryForBlockFlow(
        doc,
        cleanedText,
        wordCount,
        {
          llmModel,
          studyNotes: String(state.studyNotes || ""),
          language: getStudyLanguage(),
          nBlocks: Number(els.blocksInput?.value) || 12,
          onProgress: (msg) => {
            if (els.recommendBlocksStatus) els.recommendBlocksStatus.textContent = msg;
          },
        },
        els.recommendBlocksStatus,
      );
      inventory = resolved.inventory;
      doc = resolved.doc;
      setBlockSplitCache({ fingerprint, conceptInventory: inventory, recommendation: null });
    }

    const textMetrics = analyzeText(cleanedText);
    const pedagogicalMeta = buildDeterministicPedagogicalMeta(textMetrics);
    const signals = assembleBlockCountSignals(
      cleanedText,
      inventory,
      textMetrics,
      pedagogicalMeta,
    );
    const paceMult = Number(
      state.activeSession?.shared?.modeRecommendation?.params?.blockCountMultiplier ??
        doc?.shared?.modeRecommendation?.params?.blockCountMultiplier,
    );
    const recommendation = computeBlockCountRecommendation(
      signals,
      Number.isFinite(paceMult) && paceMult !== 1
        ? { blockCountMultiplier: paceMult }
        : {},
    );
    if (runId !== recommendBlockCountRunId) return;

    setBlockSplitCache({
      fingerprint,
      conceptInventory: inventory,
      recommendation,
    });

    if (els.blocksInput) els.blocksInput.value = String(recommendation.nBlocks);
    if (els.recommendBlocksWhy) {
      els.recommendBlocksWhy.textContent = formatBlockCountReasoning(recommendation);
      els.recommendBlocksWhy.hidden = false;
    }
    if (els.recommendBlocksStatus) {
      els.recommendBlocksStatus.textContent = `Recommended ${recommendation.nBlocks} blocks`;
    }
  } catch (err) {
    invalidateBlockSplitCache();
    if (els.recommendBlocksStatus) {
      els.recommendBlocksStatus.textContent =
        err?.message && !String(err.message).includes("API key")
          ? String(err.message)
          : "Could not recommend block count. Try again or set blocks manually.";
    }
  } finally {
    if (runId === recommendBlockCountRunId) setRecommendLoading(false);
  }
}

function clearOfflinePackError() {
  if (!els.offlinePackError) return;
  els.offlinePackError.hidden = true;
  els.offlinePackError.textContent = "";
}

function setOfflinePackError(message) {
  if (!els.offlinePackError) return;
  els.offlinePackError.hidden = false;
  els.offlinePackError.textContent = message;
}

function setOfflinePackLoading(isLoading) {
  if (els.offlinePackStatus) {
    els.offlinePackStatus.textContent = isLoading ? "Reading…" : "";
  }
}

function formatOfflineGeneratedDate(rawDate) {
  const d = new Date(String(rawDate || ""));
  if (Number.isNaN(d.getTime())) return "unknown date";
  return d.toLocaleDateString();
}

function summarizeExplanation(explanation) {
  const t = normalizeWhitespace(explanation);
  if (!t) return "";
  if (t.length <= 140) return t;
  return `${t.slice(0, 137).trim()}...`;
}

function normalizeOfflineBlocks(blocks) {
  const safe = Array.isArray(blocks) ? blocks : [];
  return safe.map((b, i) => {
    const obj = b && typeof b === "object" ? b : {};
    const questions = Array.isArray(obj.questions) ? obj.questions : [];
    return {
      id: Number(obj.id) || i + 1,
      title: String(obj.title || "").trim() || `Block ${i + 1}`,
      explanation: String(obj.explanation || ""),
      questions: shuffleTestQuestionsInList(
        questions.filter((q) => q && typeof q === "object"),
      ),
      concepts: Array.isArray(obj.concepts) ? obj.concepts : [],
      _config: { n_test: Math.max(0, questions.length), n_socratic: 0 },
    };
  });
}

function blockIndexFromOfflineBlocks(blocks) {
  const safe = Array.isArray(blocks) ? blocks : [];
  return safe.map((b, i) => ({
    id: i + 1,
    title: String(b?.title || "").trim() || `Block ${i + 1}`,
    summary: summarizeExplanation(b?.explanation),
    chunk: "",
  }));
}

async function loadOfflinePack(text, filename = "") {
  const parsed = parseOfflinePackMarkdown(text);
  if (!parsed.ok) {
    if (parsed.reason === "not_offline_pack") {
      throw new Error("This file is not an offline pack.");
    }
    throw new Error("Invalid or corrupted offline pack");
  }

  const pack = parsed.value;
  const blocks = normalizeOfflineBlocks(pack.blocks);
  if (!blocks.length) {
    throw new Error("Invalid or corrupted offline pack");
  }

  const strictMetaOk = pack?.meta?.offline_pack === true;
  const strictBlocksOk = Array.isArray(pack?.blocks)
    && pack.blocks.every((b) => b && typeof b === "object" && b._offline === true);
  if (!strictMetaOk || !strictBlocksOk) {
    if (els.offlinePackStatus) {
      els.offlinePackStatus.textContent = "This pack may be incomplete";
    }
  }

  window.offlineMode = true;
  window.offlinePack = pack;
  state.lastUploadedFileNames = [String(filename || "offline-pack.md")];
  state.lastNBlocks = blocks.length;
  state.lastBlockIndex = blockIndexFromOfflineBlocks(blocks);
  state.originalMaterialText = "";
  state.lastRawMaterialText = "";
  state.lastCleanedMaterialText = "";
  state.lastCleanedMaterialWordCount = 0;
  if (els.fileInput) els.fileInput.value = "";
  if (els.fileExtractHint) els.fileExtractHint.textContent = "";

  const generatedAt = formatOfflineGeneratedDate(pack?.meta?.generated_at);
  const totalBlocks = Math.max(0, Number(pack?.meta?.total_blocks) || blocks.length);
  const failedBlocks = Math.max(0, Number(pack?.meta?.failed_blocks) || 0);
  setBlocksReadonlyMode({
    enabled: true,
    bannerText:
      `${totalBlocks} blocks · Generated ${generatedAt}`
      + (failedBlocks > 0 ? ` · ${failedBlocks} blocks have no content` : ""),
  });
  if (els.confirmBlocksStatus) {
    els.confirmBlocksStatus.textContent = `${totalBlocks} blocks · Generated ${generatedAt}`;
  }
  if (els.confirmBlocksError) {
    els.confirmBlocksError.hidden = failedBlocks <= 0;
    els.confirmBlocksError.textContent =
      failedBlocks > 0 ? `Warning: ${failedBlocks} blocks have no content` : "";
  }
  renderBlockIndexEditor(state.lastBlockIndex, { readOnly: true });
  setBlocksListJsonCache(formatBlockIndexForConfirmation(state.lastBlockIndex));
  showScreen("blocks");
}

function setConfirmLoading(isLoading) {
  els.confirmBlocksBtn.disabled = isLoading;
  els.confirmBlocksBtn.textContent = isLoading ? "Saving…" : "Looks good, start session";
}
function setConfirmError(message) {
  els.confirmBlocksError.hidden = false;
  els.confirmBlocksError.textContent = message;
}
function clearConfirmError() {
  els.confirmBlocksError.hidden = true;
  els.confirmBlocksError.textContent = "";
}

function clearResumeError() {
  if (!els.resumeSessionError) return;
  els.resumeSessionError.hidden = true;
  els.resumeSessionError.textContent = "";
}
function setResumeError(message) {
  if (!els.resumeSessionError) return;
  els.resumeSessionError.hidden = false;
  els.resumeSessionError.textContent = message;
}

let exportToastTimer = null;

function showExportToast(message, { variant = "success", durationMs = 3000 } = {}) {
  const text = String(message || "").trim();
  if (!text) return;
  let toast = document.getElementById("exportToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "exportToast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.className = `export-toast export-toast--${variant === "error" ? "error" : "success"}`;
  toast.textContent = text;
  if (exportToastTimer) clearTimeout(exportToastTimer);
  exportToastTimer = setTimeout(() => {
    toast.remove();
    exportToastTimer = null;
  }, durationMs);
}

async function handleOfflinePackClick() {
  const result = await exportOfflinePack();
  if (result.ok) {
    showExportToast("Offline pack downloaded");
    return;
  }
  const messages = {
    no_session: "No session to export.",
    no_block_content: "Generate block content before downloading offline pack.",
    offline: "Offline pack is not available in offline mode.",
    download_blocked: "Download blocked ? try again or check browser settings.",
  };
  const msg = messages[result.error] || "Could not download offline pack.";
  setResumeError(msg);
  showExportToast(msg, { variant: "error", durationMs: 5000 });
}

function syncExportButtonsEnabled() {
  const exportable = Boolean(resolveSessionForExport());
  if (els.downloadOfflinePackBtn) els.downloadOfflinePackBtn.disabled = !exportable;
}

let persistHealthDismissed = false;

async function syncPersistenceHealthBanner() {
  const doc = await getActiveSession();
  const health = await computePersistenceHealth(doc);
  const banners = [
    {
      el: document.getElementById("persistHealthBanner"),
      textEl: document.getElementById("persistHealthBannerText"),
      dismissBtn: document.getElementById("persistHealthDismissBtn"),
      recoverBtn: document.getElementById("persistHealthRecoverBtn"),
    },
  ];

  const showPartial =
    !persistHealthDismissed && health.status === "partial" && (health.hasDictionary || health.hasGuideChat);

  const backupBlocks = showPartial ? tryRecoverBlocksFromV1Backup(doc?.modes?.rsvp) : null;
  const message =
    health.lastWriteError === "quota"
      ? "Study progress may not be fully saved ? browser storage is full."
      : "Study progress may not be fully saved ? block content is missing but dictionary or chat data exists.";

  for (const { el, textEl, dismissBtn, recoverBtn } of banners) {
    if (!el || !textEl) continue;
    if (!showPartial) {
      el.classList.add("hidden");
      el.hidden = true;
      continue;
    }
    textEl.textContent = message;
    el.classList.remove("hidden");
    el.hidden = false;
    if (recoverBtn) recoverBtn.hidden = !backupBlocks;
    if (dismissBtn && !dismissBtn.dataset.wired) {
      dismissBtn.dataset.wired = "1";
      dismissBtn.addEventListener("click", () => {
        persistHealthDismissed = true;
        syncPersistenceHealthBanner();
      });
    }
    if (recoverBtn && !recoverBtn.dataset.wired) {
      recoverBtn.dataset.wired = "1";
      recoverBtn.addEventListener("click", async () => {
        const recovered = tryRecoverBlocksFromV1Backup(doc?.modes?.rsvp);
        if (!recovered || !doc) return;
        if (!doc.modes) doc.modes = {};
        const slice = doc.modes.rsvp || { studyMode: "rsvp", blocks: [], n_blocks: recovered.length };
        slice.blocks = recovered;
        slice.n_blocks = Math.max(Number(slice.n_blocks) || 0, recovered.length);
        doc.modes.rsvp = slice;
        await saveDocumentSession(doc);
        persistHealthDismissed = true;
        showExportToast("Imported blocks from backup ? review before continuing");
        syncPersistenceHealthBanner();
        syncExportButtonsEnabled();
      });
    }
  }
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => resolve(reader.result);
    reader.readAsArrayBuffer(file);
  });
}

function countWords(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return 0;
  return raw.split(" ").filter(Boolean).length;
}

function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function stripDataUriAttributes(html) {
  return String(html || "").replace(
    /\b([a-zA-Z0-9:_-]+)\s*=\s*(["'])\s*data:[\s\S]*?\2/gi,
    '$1=""',
  );
}

function stripScriptAndStyleBlocks(html) {
  const raw = String(html || "");
  const noScript = raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  return noScript.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

function stripAllAttributesExceptHrefAlt(doc) {
  const elsAll = doc.querySelectorAll("*");
  for (const el of elsAll) {
    const attrs = Array.from(el.attributes || []);
    for (const a of attrs) {
      const n = String(a.name || "").toLowerCase();
      if (n === "href" || n === "alt") continue;
      try {
        el.removeAttribute(a.name);
      } catch {
        // ignore
      }
    }
  }
}

function extractCleanTextFromHtml(html) {
  const pre = stripScriptAndStyleBlocks(stripDataUriAttributes(html));
  const parser = new DOMParser();
  const doc = parser.parseFromString(pre, "text/html");

  for (const node of Array.from(doc.querySelectorAll("script,style"))) {
    node.remove();
  }

  stripAllAttributesExceptHrefAlt(doc);

  const out = [];
  const pushText = (t) => {
    const s = String(t || "").replace(/\s+/g, " ").trim();
    if (s) out.push(s);
  };

  const walk = (node) => {
    if (!node) return;
    const type = node.nodeType;
    if (type === Node.TEXT_NODE) {
      pushText(node.nodeValue || "");
      return;
    }
    if (type !== Node.ELEMENT_NODE) return;

    const tag = String(node.tagName || "").toLowerCase();
    if (tag === "script" || tag === "style") return;

    if (tag === "img") {
      const alt = node.getAttribute("alt");
      if (alt) pushText(alt);
      return;
    }

    if (tag === "a") {
      const href = node.getAttribute("href");
      for (const child of Array.from(node.childNodes || [])) walk(child);
      if (href) pushText(`(${href})`);
      return;
    }

    for (const child of Array.from(node.childNodes || [])) walk(child);

    if (
      [
        "p",
        "div",
        "section",
        "article",
        "br",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
      ].includes(tag)
    ) {
      out.push("\n");
    }
  };

  walk(doc.body || doc.documentElement);

  return out
    .join(" ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function cleanMaterialText(rawText) {
  const raw = String(rawText || "");
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(raw);
  if (!looksLikeHtml) {
    const stripped = stripScriptAndStyleBlocks(stripDataUriAttributes(raw));
    return stripped.trim();
  }
  return extractCleanTextFromHtml(raw);
}

export async function readAndCleanMaterialText(file) {
  const {
    detectFormatFromFilename,
    normalizeStudyMaterial,
    UnsupportedFormatError,
  } = await import("./input-normalization.js?v=20260625_02");

  const detectedFormat = detectFormatFromFilename(file?.name || "");
  if (!detectedFormat) {
    throw new UnsupportedFormatError(
      "Unsupported file format. Supported: pdf, html, txt, md.",
      String(file?.name || "").split(".").pop() || "",
    );
  }

  const rawContent =
    detectedFormat === "pdf"
      ? await readFileAsArrayBuffer(file)
      : await readFileAsText(file);

  const { normalizedFormat, normalizedContent, warnings, fallbackSections, pendingImages, headings } =
    await normalizeStudyMaterial(rawContent, detectedFormat);

  const cleanedText = normalizedContent;
  console.info("[study.readAndCleanMaterialText] Done:", {
    fileName: file?.name || "",
    detectedFormat,
    normalizedFormat,
    wordCount: countWords(cleanedText),
    charCount: cleanedText.length,
    warningCount: (warnings || []).length,
    warnings: (warnings || []).slice(0, 5),
    pendingImages: (pendingImages || []).length,
    headingCount: Array.isArray(headings) ? headings.length : 0,
  }); // [debug-enrich]
  return {
    cleanedText,
    wordCount: countWords(cleanedText),
    originalFormat: detectedFormat,
    normalizedFormat,
    warnings: warnings || [],
    fallbackSections: fallbackSections || null,
    pendingImages: pendingImages || [],
    structureHeadings: Array.isArray(headings) ? headings : [],
  };
}

function updateStudyProgressUi() {
  const total = Math.max(1, getTotalBlocksSafe());
  const idx = Math.min(Math.max(0, state.activeBlockIndex), total - 1);
  const title = getBlockTitleSafe(idx);
  const labelText = `Block ${idx + 1} of ${total}`;
  if (els.studyProgressLabelText) els.studyProgressLabelText.textContent = labelText;
  else els.studyProgressLabel.textContent = labelText;
  els.studyProgressTitle.textContent = title;
  const pct = ((idx + 1) / total) * 100;
  els.studyProgressFill.style.width = `${pct}%`;
}

function computeSessionCompleteSummary() {
  const session = state.activeSession;
  const nBlocks = Math.max(1, Number(session?.n_blocks) || state.lastNBlocks || 1);
  const blocksCovered = Math.min(nBlocks, Math.max(1, Number(state.activeBlockIndex) + 1));
  const responses =
    session?._responses && typeof session._responses === "object"
      ? session._responses
      : { blocks: {} };
  const blockMap =
    responses.blocks && typeof responses.blocks === "object" ? responses.blocks : {};

  let answered = 0;
  let correct = 0;
  let gradable = 0;
  for (const blockResponses of Object.values(blockMap)) {
    if (!blockResponses || typeof blockResponses !== "object") continue;
    const questions =
      blockResponses.questions && typeof blockResponses.questions === "object"
        ? blockResponses.questions
        : blockResponses;
    for (const row of Object.values(questions)) {
      if (!row || typeof row !== "object") continue;
      const hasAnswer =
        row.user_answer != null && String(row.user_answer).trim().length > 0;
      if (!hasAnswer) continue;
      answered += 1;
      if (row.is_correct === true) {
        correct += 1;
        gradable += 1;
      } else if (row.is_correct === false) {
        gradable += 1;
      }
    }
  }

  const startedAt = Number(session?._meta?.study_started_at);
  let timeLabel = "?";
  if (Number.isFinite(startedAt) && startedAt > 0) {
    const mins = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    timeLabel = mins === 1 ? "1 min" : `${mins} min`;
  }

  return {
    timeLabel,
    blocksLabel: `${blocksCovered} / ${nBlocks}`,
    questionsLabel: String(answered),
    correctRatePct: gradable > 0 ? (correct / gradable) * 100 : null,
  };
}

function showSessionComplete() {
  // [debug-enrich]
  console.info('[study.showSessionComplete] Session complete:', {
    activeBlockIndex: state.activeBlockIndex,
    totalBlocks: getTotalBlocksSafe(),
    docId: state.activeSession?.docId ?? null,
    studyMode: state.activeSession?.studyMode ?? state.studyMode ?? null,
  });
  try {
    commitSessionConceptsForBlock(state.activeBlockIndex);
  } catch (err) {
    // [debug-enrich]
    console.warn('[study.showSessionComplete] commitSessionConceptsForBlock failed (ignored):', {
      blockIndex: state.activeBlockIndex,
      message: err?.message ?? String(err),
    });
  }
  void maybeApplyRsvpWpmCalibration();
  persistFlowRecommendationProgress();
  syncOfflinePackButtonVisibility();
  updateSessionCompleteSummary(computeSessionCompleteSummary());
  showScreen("complete");
}

function maybeApplyRsvpWpmCalibration() {
  const session = state.activeSession;
  if (!session || !shouldCalibrateStudyMode(session.studyMode || state.studyMode)) {
    // [debug-enrich]
    console.debug('[study.maybeApplyRsvpWpmCalibration] Skipped', {
      hasSession: Boolean(session),
      studyMode: session?.studyMode ?? state.studyMode ?? null,
    });
    return;
  }
  void (async () => {
    try {
      const doc = await getActiveSession();
      const inventory = Array.isArray(doc?.shared?.conceptInventory)
        ? doc.shared.conceptInventory
        : [];
      // [debug-enrich]
      console.info('[study.maybeApplyRsvpWpmCalibration] Applying calibration:', {
        docId: doc?.docId ?? session?.docId ?? null,
        inventoryCount: inventory.length,
      });
      applySessionWpmCalibration(session, inventory);
    } catch (err) {
      // [debug-enrich]
      console.warn('[study.maybeApplyRsvpWpmCalibration] Calibration failed (silent):', {
        message: err?.message ?? String(err),
      });
    }
  })();
}

function isBlockSkippedInStudySequence(entry) {
  if (entry?.study_sequence === false) return true;
  if (entry && isKeyTermsBlockTitle(entry.title) && entry.study_sequence !== true) return true;
  return false;
}

function buildQuestionsBlockProxies(blockIndexArr, total) {
  const proxies = [];
  for (let i = 0; i < total; i += 1) {
    const entry = blockIndexArr[i];
    if (isBlockSkippedInStudySequence(entry)) continue;
    const conceptIds = Array.isArray(entry?.concept_ids) ? entry.concept_ids : [];
    if (!conceptIds.length) {
      proxies.push({ blockIndex: i, canonicalId: `block-${i}` });
      continue;
    }
    for (const rawId of conceptIds) {
      const cid = String(rawId || "").trim();
      if (!cid) continue;
      proxies.push({ blockIndex: i, canonicalId: cid, concept_id: cid });
    }
  }
  return proxies;
}

function buildQuestionsStudyOrder(doc) {
  const total = Math.max(1, getTotalBlocksSafe());
  const blockIndexArr = loadBlockIndex() || state.lastBlockIndex || [];
  const signals = Array.isArray(doc?.shared?.assessmentSignals) ? doc.shared.assessmentSignals : [];
  if (!signals.length) return null;

  const proxies = buildQuestionsBlockProxies(blockIndexArr, total);
  if (!proxies.length) return null;

  const prioritized = prioritizeByAssessmentSignals(proxies, signals);
  const seen = new Set();
  const order = [];
  for (const row of prioritized) {
    const blockIdx = row.blockIndex;
    if (seen.has(blockIdx)) continue;
    seen.add(blockIdx);
    order.push(blockIdx);
  }
  for (let i = 0; i < total; i += 1) {
    if (seen.has(i)) continue;
    if (isBlockSkippedInStudySequence(blockIndexArr[i])) continue;
    order.push(i);
  }
  return order.length ? order : null;
}

function resolveNextQuestionsStudyBlockIndex(fromIndex, studyOrder) {
  if (!Array.isArray(studyOrder) || !studyOrder.length) return null;
  const pos = studyOrder.indexOf(fromIndex);
  if (pos < 0) return studyOrder.find((idx) => idx > fromIndex) ?? null;
  return pos < studyOrder.length - 1 ? studyOrder[pos + 1] : null;
}

function isLastQuestionsStudyBlock(blockIndex, studyOrder, total) {
  if (Array.isArray(studyOrder) && studyOrder.length) {
    return studyOrder.indexOf(blockIndex) === studyOrder.length - 1;
  }
  return blockIndex >= total - 1;
}

function applyQuestionsStudyOrderForSession(doc) {
  if (!isQuestionsStudyMode(state.activeSession)) {
    state.questionsStudyOrder = null;
    return;
  }
  state.questionsStudyOrder = buildQuestionsStudyOrder(doc);
}

function resolveNextStudyBlockForSession(fromIndex, total) {
  const blockIndexArr = loadBlockIndex() || state.lastBlockIndex || [];
  if (isQuestionsStudyMode(state.activeSession) && Array.isArray(state.questionsStudyOrder)) {
    const next = resolveNextQuestionsStudyBlockIndex(fromIndex, state.questionsStudyOrder);
    return next != null ? next : total;
  }
  return resolveNextStudyBlockIndex(fromIndex, blockIndexArr, total);
}

function areAllBlocksGenerated(sessionObj) {
  const safe = sessionObj && typeof sessionObj === "object" ? sessionObj : {};
  const blocks = Array.isArray(safe.blocks) ? safe.blocks : [];
  const total = Number(safe.n_blocks);
  const expected = Number.isFinite(total) && total > 0 ? total : blocks.length;
  if (!expected) return false;
  for (let i = 0; i < expected; i += 1) {
    if (!hasGeneratedBlockContent(blocks[i])) return false;
  }
  return true;
}

function syncOfflinePackButtonVisibility() {
  if (isOfflineMode()) {
    setOfflinePackButtonVisibility(false);
    return;
  }
  setOfflinePackButtonVisibility(areAllBlocksGenerated(state.activeSession));
}

function resetFullPackActions() {
  if (els.fullPackError) {
    els.fullPackError.hidden = true;
    els.fullPackError.textContent = "";
  }
  if (els.fullPackStudyNowBtn) els.fullPackStudyNowBtn.hidden = true;
  if (els.fullPackExitBtn) els.fullPackExitBtn.hidden = true;
  if (els.fullPackCancelBtn) {
    els.fullPackCancelBtn.hidden = false;
    els.fullPackCancelBtn.disabled = false;
  }
}

let transitionOverlayEls = null;
const prefetchStartedAtByIndex = new Map();
let fullPackRunActive = false;

function setTransitionOverlayView(view) {
  const o = getOrCreateTransitionOverlay();
  const v = view === "adjust" ? "adjust" : "default";
  o.view = v;
  if (o.defaultActions) o.defaultActions.hidden = v !== "default";
  if (o.adjustWrap) o.adjustWrap.hidden = v !== "adjust";
  if (o.nextQDetails) o.nextQDetails.open = v === "adjust";
}

function setTransitionOverlayOpen(isOpen) {
  const o = getOrCreateTransitionOverlay();
  o.wrap.setAttribute("aria-hidden", String(!isOpen));
  if (isOpen) {
    o.status.textContent = "";
    o.error.hidden = true;
    o.error.textContent = "";
    o.retryBtn.hidden = true;
    o.skipBtn.hidden = true;
    setTransitionOverlayView("default");
  }
}

function refreshUiOnPrefetchReady() {
  updateDictionaryButtonVisibility();
  const o = transitionOverlayEls;
  if (!o || o.wrap.getAttribute("aria-hidden") !== "false") return;
  const concepts = getSortedSessionConcepts();
  const finishedIdx =
    typeof o.finishedBlockIndex === "number" ? o.finishedBlockIndex : state.activeBlockIndex;
  const { newKeys, updatedKeys } = getConceptHighlightsForBlock(finishedIdx);
  renderDictionary({
    containerEl: o.dictionaryWrap,
    title: `Concepts so far (${concepts.length} terms)`,
    concepts,
    collapsedByDefault: true,
    newTermKeys: newKeys,
    updatedTermKeys: updatedKeys,
  });
  renderTransitionSneakPeek(o, finishedIdx);
}

function sneakPeekLabelText(nextIndex) {
  const name = String(getBlockTitleSafe(nextIndex) || "").trim();
  if (!name) return "What's next";
  return `What's next ? ${name}`;
}

function renderTransitionSneakPeek(o, finishedIdx) {
  if (!o?.sneakPeekWrap || !o?.sneakPeekText) return;
  if (!Number.isFinite(finishedIdx)) return;
  if (isQuestionsStudyMode(state.activeSession)) {
    o.sneakPeekWrap.hidden = true;
    o.sneakPeekText.textContent = "";
    return;
  }

  const nextIndex = finishedIdx + 1;
  if (o.sneakPeekLabel) {
    o.sneakPeekLabel.textContent = sneakPeekLabelText(nextIndex);
  }
  const expectedKey = String(o.expectedPrefetchConfigKey || "");
  const blockReady =
    prefetchState?.blockIndex === nextIndex &&
    prefetchState?.status === "ready" &&
    String(prefetchState?.configKey || "") === expectedKey;

  const bridgeText = String(bridgePrefetchState?.text || "").trim();
  const bridgeReady =
    bridgePrefetchState?.finishedBlockIndex === finishedIdx &&
    bridgePrefetchState?.nextBlockIndex === nextIndex &&
    bridgePrefetchState?.status === "ready" &&
    Boolean(bridgeText);
  const bridgeGenerating =
    bridgePrefetchState?.finishedBlockIndex === finishedIdx &&
    bridgePrefetchState?.nextBlockIndex === nextIndex &&
    bridgePrefetchState?.status === "generating";

  if (!blockReady) {
    o.sneakPeekWrap.hidden = false;
    o.sneakPeekText.className = "hint";
    o.sneakPeekText.textContent = "Preparing next block…";
    return;
  }

  if (bridgeReady) {
    o.sneakPeekWrap.hidden = false;
    o.sneakPeekText.className = "";
    o.sneakPeekText.textContent = bridgeText;
    return;
  }

  const bridgeMatchesPair =
    bridgePrefetchState?.finishedBlockIndex === finishedIdx &&
    bridgePrefetchState?.nextBlockIndex === nextIndex;
  if (
    !bridgeMatchesPair &&
    bridgePrefetchState?.status !== "generating" &&
    bridgePrefetchState?.status !== "ready"
  ) {
    const nextBlockData = prefetchState?.data || getBlock(nextIndex);
    if (hasGeneratedBlockContent(nextBlockData)) {
      triggerBridgePrefetch(
        finishedIdx,
        nextIndex,
        nextBlockData,
        String(prefetchState?.configKey || expectedKey),
      );
    }
  }

  if (bridgeGenerating) {
    o.sneakPeekWrap.hidden = false;
    o.sneakPeekText.className = "hint";
    o.sneakPeekText.textContent = "Writing transition preview…";
    return;
  }

  const nextBlock = getBlock(nextIndex);
  const explanation = String(prefetchState?.data?.explanation || nextBlock?.explanation || "").trim();
  const sneak = extractSneakPeek(explanation, 4);
  if (!sneak) {
    o.sneakPeekWrap.hidden = true;
    o.sneakPeekText.textContent = "";
    return;
  }

  o.sneakPeekWrap.hidden = false;
  o.sneakPeekText.className = "";
  o.sneakPeekText.textContent = sneak;
}

function getOrCreateTransitionOverlay() {
  if (transitionOverlayEls) return transitionOverlayEls;

  const wrap = document.createElement("div");
  wrap.id = "transitionOverlay";
  wrap.className = "dict-overlay";
  wrap.setAttribute("aria-hidden", "true");
  wrap.setAttribute("aria-label", "Continue to next block");

  const card = document.createElement("div");
  card.className = "card";

  const header = document.createElement("div");
  header.className = "rowline";
  header.style.justifyContent = "space-between";
  header.style.gap = "10px";

  const title = document.createElement("span");
  title.style.fontWeight = "600";
  title.textContent = "Continue";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => setTransitionOverlayOpen(false));

  header.appendChild(title);
  header.appendChild(closeBtn);

  const divider = document.createElement("div");
  divider.className = "divider";

  const sneakPeekWrap = document.createElement("div");
  sneakPeekWrap.id = "sneakPeekWrap";

  const sneakPeekLabel = document.createElement("div");
  sneakPeekLabel.className = "hint";
  sneakPeekLabel.textContent = "What's next";

  const sneakPeekText = document.createElement("div");
  sneakPeekText.className = "hint";
  sneakPeekText.style.lineHeight = "1.5";
  sneakPeekText.style.marginBottom = "10px";
  sneakPeekText.textContent = "Preparing next block…";

  sneakPeekWrap.appendChild(sneakPeekLabel);
  sneakPeekWrap.appendChild(sneakPeekText);

  const dictionaryWrap = document.createElement("div");

  const nextQDetails = document.createElement("details");
  nextQDetails.style.marginTop = "8px";
  nextQDetails.open = false;

  const nextQSummary = document.createElement("summary");
  nextQSummary.textContent = "Next block questions";
  nextQSummary.className = "hint";
  nextQSummary.style.cursor = "pointer";

  const nextQStatus = document.createElement("div");
  nextQStatus.className = "hint";
  nextQStatus.style.marginTop = "6px";
  nextQStatus.textContent = "Using session defaults";

  const nextQRow1 = document.createElement("div");
  nextQRow1.className = "row";
  nextQRow1.style.marginTop = "10px";
  nextQRow1.style.gap = "10px";
  nextQRow1.style.alignItems = "center";

  const nextTestMinus = document.createElement("button");
  nextTestMinus.type = "button";
  nextTestMinus.textContent = "−";
  const nextTestValue = document.createElement("div");
  nextTestValue.style.minWidth = "22px";
  nextTestValue.style.textAlign = "center";
  nextTestValue.style.fontVariantNumeric = "tabular-nums";
  nextTestValue.textContent = "2";
  const nextTestPlus = document.createElement("button");
  nextTestPlus.type = "button";
  nextTestPlus.textContent = "+";
  const nextTestLabel = document.createElement("span");
  nextTestLabel.className = "hint";
  nextTestLabel.textContent = "Test";
  nextQRow1.appendChild(nextTestMinus);
  nextQRow1.appendChild(nextTestValue);
  nextQRow1.appendChild(nextTestPlus);
  nextQRow1.appendChild(nextTestLabel);

  const nextQRow2 = document.createElement("div");
  nextQRow2.className = "row";
  nextQRow2.style.marginTop = "0";
  nextQRow2.style.gap = "10px";
  nextQRow2.style.alignItems = "center";

  const nextSocMinus = document.createElement("button");
  nextSocMinus.type = "button";
  nextSocMinus.textContent = "−";
  const nextSocValue = document.createElement("div");
  nextSocValue.style.minWidth = "22px";
  nextSocValue.style.textAlign = "center";
  nextSocValue.style.fontVariantNumeric = "tabular-nums";
  nextSocValue.textContent = "1";
  const nextSocPlus = document.createElement("button");
  nextSocPlus.type = "button";
  nextSocPlus.textContent = "+";
  const nextSocLabel = document.createElement("span");
  nextSocLabel.className = "hint";
  nextSocLabel.textContent = "Socratic";
  nextQRow2.appendChild(nextSocMinus);
  nextQRow2.appendChild(nextSocValue);
  nextQRow2.appendChild(nextSocPlus);
  nextQRow2.appendChild(nextSocLabel);

  nextQDetails.appendChild(nextQSummary);
  nextQDetails.appendChild(nextQStatus);
  nextQDetails.appendChild(nextQRow1);
  nextQDetails.appendChild(nextQRow2);

  const adjustWrap = document.createElement("div");
  adjustWrap.hidden = true;
  adjustWrap.appendChild(nextQDetails);

  const adjustActions = document.createElement("div");
  adjustActions.className = "row";
  adjustActions.style.marginTop = "10px";
  adjustActions.style.gap = "10px";

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.textContent = "Confirm";
  confirmBtn.className = "btn-primary";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.textContent = "Back";
  backBtn.className = "btn-secondary";

  adjustActions.appendChild(confirmBtn);
  adjustActions.appendChild(backBtn);
  adjustWrap.appendChild(adjustActions);

  const defaultActions = document.createElement("div");
  defaultActions.className = "row";
  defaultActions.style.marginTop = "12px";
  defaultActions.style.gap = "10px";
  defaultActions.style.flexWrap = "wrap";

  const continueBtn = document.createElement("button");
  continueBtn.type = "button";
  continueBtn.textContent = "Next block";
  continueBtn.className = "btn-primary";

  const adjustBtn = document.createElement("button");
  adjustBtn.type = "button";
  adjustBtn.textContent = "Adjust next block";
  adjustBtn.className = "btn-secondary";

  const reviewBlockBtn = document.createElement("button");
  reviewBlockBtn.type = "button";
  reviewBlockBtn.textContent = "Review block questions";
  reviewBlockBtn.className = "btn-secondary";
  reviewBlockBtn.hidden = true;

  defaultActions.appendChild(continueBtn);
  defaultActions.appendChild(adjustBtn);
  defaultActions.appendChild(reviewBlockBtn);

  const row = document.createElement("div");
  row.className = "row";

  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.textContent = "Retry";
  retryBtn.hidden = true;

  const skipBtn = document.createElement("button");
  skipBtn.type = "button";
  skipBtn.textContent = "Skip this block";
  skipBtn.hidden = true;

  const status = document.createElement("span");
  status.className = "hint";
  status.setAttribute("role", "status");

  const error = document.createElement("div");
  error.className = "error";
  error.hidden = true;

  const statusBar = document.createElement("div");
  statusBar.style.marginTop = "12px";
  statusBar.style.paddingTop = "10px";
  statusBar.style.borderTop = "1px solid rgba(148, 163, 184, 0.25)";

  const statusBarText = document.createElement("div");
  statusBarText.className = "hint";
  statusBarText.textContent = "";

  const statusBarTrack = document.createElement("div");
  statusBarTrack.style.height = "3px";
  statusBarTrack.style.marginTop = "8px";
  statusBarTrack.style.background = "rgba(148, 163, 184, 0.22)";
  statusBarTrack.style.borderRadius = "999px";
  statusBarTrack.style.overflow = "hidden";

  const statusBarFill = document.createElement("div");
  statusBarFill.style.height = "100%";
  statusBarFill.style.width = "40%";
  statusBarFill.style.background = "rgba(148, 163, 184, 0.75)";
  statusBarFill.style.borderRadius = "999px";
  statusBarFill.style.transform = "translateX(-120%)";
  statusBarFill.style.animation = "transitionBarSlide 1.2s ease-in-out infinite";

  // Add the keyframes once.
  if (!document.getElementById("transitionOverlayStyles")) {
    const style = document.createElement("style");
    style.id = "transitionOverlayStyles";
    style.textContent =
      "@keyframes transitionBarSlide { 0% { transform: translateX(-120%);} 50% { transform: translateX(140%);} 100% { transform: translateX(140%);} }";
    document.head.appendChild(style);
  }

  statusBarTrack.appendChild(statusBarFill);
  statusBar.appendChild(statusBarText);
  statusBar.appendChild(statusBarTrack);

  row.appendChild(retryBtn);
  row.appendChild(skipBtn);
  row.appendChild(status);

  card.appendChild(header);
  card.appendChild(divider);
  card.appendChild(sneakPeekWrap);
  card.appendChild(dictionaryWrap);
  card.appendChild(divider.cloneNode(true));
  card.appendChild(defaultActions);
  card.appendChild(adjustWrap);
  card.appendChild(row);
  card.appendChild(error);
  card.appendChild(statusBar);
  wrap.appendChild(card);
  document.body.appendChild(wrap);

  transitionOverlayEls = {
    wrap,
    title,
    dictionaryWrap,
    sneakPeekWrap,
    sneakPeekLabel,
    sneakPeekText,
    view: "default",
    defaultActions,
    adjustWrap,
    nextQDetails,
    nextQStatus,
    nextTestMinus,
    nextTestPlus,
    nextTestValue,
    nextSocMinus,
    nextSocPlus,
    nextSocValue,
    continueBtn,
    adjustBtn,
    reviewBlockBtn,
    confirmBtn,
    backBtn,
    retryBtn,
    skipBtn,
    status,
    error,
    statusBarText,
    statusBarFill,
    statusBarTrack,
  };
  return transitionOverlayEls;
}

function blockHasReadableExplanation(block) {
  const text = String(block?.explanation || "").trim();
  return Boolean(text) && !text.startsWith("[Generation failed");
}

function extractConnectionHookFromExplanation(explanation) {
  const parts = String(explanation || "")
    .split(/\n\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (isBoldHeaderLine(part)) continue;
    return part.slice(0, 220);
  }
  return "";
}

function countBlockQuestionsByType(questions) {
  const list = Array.isArray(questions) ? questions : [];
  return {
    test: list.filter((q) => q && typeof q === "object" && q.type === "test").length,
    socratic: list.filter((q) => q && typeof q === "object" && q.type === "socratic").length,
  };
}

function blockQuestionsNeedRetry(cleaned, cfg) {
  const counts = countBlockQuestionsByType(cleaned?.questions);
  if (counts.test < (cfg.n_test || 0) || counts.socratic < (cfg.n_socratic || 0)) return true;
  const gaps = Array.isArray(cfg.gap_focus) ? cfg.gap_focus : [];
  if (gaps.length > 0 && counts.test + counts.socratic < gaps.length) return true;
  return false;
}

function attachQuestionCountDiagnostics(block, cfg, counts) {
  const gaps = Array.isArray(cfg.gap_focus) ? cfg.gap_focus : [];
  const totalGot = counts.test + counts.socratic;
  const countOk = counts.test >= (cfg.n_test || 0) && counts.socratic >= (cfg.n_socratic || 0);
  const gapOk = gaps.length === 0 || totalGot >= gaps.length;
  if (countOk && gapOk) return block;
  return {
    ...block,
    question_count_status: "short",
    question_count_actual: { test: counts.test, socratic: counts.socratic },
    question_count_requested: { test: cfg.n_test || 0, socratic: cfg.n_socratic || 0 },
  };
}

async function ensureBlockGenerated(blockIndex) {
  const existing = getBlock(blockIndex);
  const needsReaderText = !isQuestionsStudyMode(state.activeSession);
  // [debug-enrich]
  console.debug('[study.ensureBlockGenerated] Check:', {
    blockIndex,
    needsReaderText,
    hasExisting: Boolean(existing),
    hasReadable: existing ? blockHasReadableExplanation(existing) : false,
    hasGenerated: existing ? hasGeneratedBlockContent(existing) : false,
  });
  if (needsReaderText) {
    if (blockHasReadableExplanation(existing) && hasGeneratedBlockContent(existing)) {
      // [debug-enrich]
      console.debug('[study.ensureBlockGenerated] Cache hit (with explanation)');
      return existing;
    }
  } else if (hasGeneratedBlockContent(existing)) {
    // [debug-enrich]
    console.debug('[study.ensureBlockGenerated] Cache hit (questions mode)');
    return existing;
  }
  if (isOfflineMode()) {
    throw new Error("Missing offline block data.");
  }

  const cfg = resolveBlockQuestionConfig(blockIndex);
  if ((cfg.n_test || 0) <= 0 && (cfg.n_socratic || 0) <= 0) {
    console.warn(`Block ${blockIndex + 1}: invalid question config (n_test=0 and n_socratic=0).`);
  }

  let cleaned = null;
  if (isQuestionsStudyMode(state.activeSession)) {
    cleaned = await generateQuestionsBlockForIndex(blockIndex, cfg);
  } else {
    const llmModel = getSessionLlmModel(state.activeSession);
    assertLlmKeyPresent(llmModel);

    const blocksListText = String(state.activeSession?.blocks_list_text || "").trim();
    if (!blocksListText) throw new Error("Missing confirmed blocks list.");

    const blockTitle = getBlockTitleFromList(blockIndex);
    const materialChunk = getBlockChunkFromIndex(blockIndex);
    if (!materialChunk) {
      throw new Error("Missing block chunk for this session. Please regenerate blocks.");
    }
    const indexEntry = getBlockIndexEntry(blockIndex);

    const strictMode = resolveSourceFidelityStrictForSession();
    ensureSessionPipelineLevers(state.activeSession, strictMode);
    const blockIndexArr = loadBlockIndex() || state.lastBlockIndex || [];
    const inventory = state.activeSession?._meta?.material_graph?.conceptInventory || [];
    const coverageManifest = ensureSessionCoverageManifest(state.activeSession);
    const questionScope = buildQuestionScopeContext(
      blockIndex,
      blockIndexArr,
      inventory,
      coverageManifest,
    );
    let prevBlockSummaryForConnection = "";
    if (blockIndex > 0) {
      const prev = state.activeSession?.blocks?.[blockIndex - 1];
      prevBlockSummaryForConnection = extractConnectionHookFromExplanation(prev?.explanation);
    }

    const docForImages = await getActiveSession();
    const imageIds = findPithImageTokenIds(materialChunk);
    const knownImages = new Set(
      (Array.isArray(docForImages?.shared?.images) ? docForImages.shared.images : []).map((img) =>
        String(img?.imageId || ""),
      ),
    );
    const sectionHasImages = imageIds.some((id) => knownImages.has(id));

    const blockRequest = {
      llmModel,
      blocksListText,
      materialText: materialChunk,
      blockIndex,
      blockTitle,
      language: getStudyLanguage(),
      n_test: cfg.n_test,
      n_socratic: cfg.n_socratic,
      explanation_profile: cfg.explanation_profile,
      gap_focus: cfg.gap_focus,
      include_connection_questions: cfg.include_connection_questions,
      strictMode,
      anchor_quality: String(indexEntry?.anchor_quality || "strong"),
      signature: indexEntry?.signature,
      coverageManifest: coverageManifest.slice(-20),
      questionScope,
      prevBlockSummaryForConnection,
      claimCoverageMin: state.activeSession?._meta?.pipelineLevers?.claimCoverageMin,
      sectionHasImages,
    };

    // [debug-enrich]
    console.info('[study.ensureBlockGenerated] Generating block via LLM:', {
      blockIndex,
      blockTitle: blockTitle ? String(blockTitle).slice(0, 80) : null,
      n_test: cfg.n_test,
      n_socratic: cfg.n_socratic,
      materialLen: materialChunk ? String(materialChunk).length : 0,
      strictMode,
      sectionHasImages,
    });

    let obj = null;
    try {
      obj = await deepSeekGenerateBlockJson(blockRequest);
    } catch (err) {
      const message = err?.message ? String(err.message) : String(err);
      // [debug-enrich]
      console.warn('[study.ensureBlockGenerated] First gen attempt failed:', {
        blockIndex,
        message,
        willRetryJson: message.includes("valid JSON"),
      });
      if (!message.includes("valid JSON")) throw err;
      obj = await deepSeekGenerateBlockJson(blockRequest);
    }

    if (
      blockIndex > 0 &&
      !isZeroQuestionBlockTitle(blockTitle) &&
      !isOfflineMode()
    ) {
      const priorBlocks = [];
      for (let i = Math.max(0, blockIndex - 2); i < blockIndex; i += 1) {
        const pb = state.activeSession?.blocks?.[i];
        if (pb?.explanation) {
          priorBlocks.push({
            title: getBlockTitleSafe(i),
            explanation_excerpt: String(pb.explanation).slice(0, 1200),
            signature: indexEntry?.signature,
          });
        }
      }
      if (priorBlocks.length) {
        try {
          const audit = await deepSeekAuditBlockOverlap({
            llmModel,
            blockTitle,
            candidateExplanation: obj.explanation,
            priorBlocks,
            language: getStudyLanguage(),
          });
          if (overlapAuditNeedsRetry(audit)) {
            const avoidOverlapWith = overlapAuditOverlappingConcepts(audit);
            obj = await deepSeekGenerateBlockJson({
              ...blockRequest,
              avoidOverlapWith,
            });
          }
        } catch (auditErr) {
          console.warn("Overlap audit failed; continuing without retry:", auditErr?.message || auditErr);
        }
      }
    }

    updateCoverageManifestAfterBlock(blockIndex, obj?.questions);
    await storeActiveSession(state.activeSession, { bumpRev: true });

    warnBlockGenerationProfileMismatch(obj, cfg);
    cleaned = normalizeBlockJson(obj, cfg, blockIndex);
    cleaned.questions = shuffleTestQuestionsInList(cleaned.questions);

    let questionCounts = countBlockQuestionsByType(cleaned.questions);
    if (blockQuestionsNeedRetry(cleaned, cfg)) {
      const prevTitles = [];
      for (const line of blocksListText.split("\n")) {
        const m = line.match(/^\s*\d+\.\s*(.+)$/);
        if (m) prevTitles.push(m[1].trim());
      }
      try {
        const retryObj = await deepSeekRegenerateBlockQuestions({
          llmModel,
          language: getStudyLanguage(),
          n_test: cfg.n_test,
          n_socratic: cfg.n_socratic,
          blockTitle,
          blockIndex,
          include_connection_questions: cfg.include_connection_questions,
          explanation: cleaned.explanation,
          materialText: materialChunk,
          gap_focus: cfg.gap_focus,
          previousBlocksTitles: prevTitles.slice(0, Math.max(0, blockIndex)),
          coverageManifest: coverageManifest.slice(-20),
          questionScope,
          prevBlockSummaryForConnection,
          userExtra: buildQuestionCountRetryInstruction(cfg, questionCounts),
        });
        if (Array.isArray(retryObj?.questions) && retryObj.questions.length) {
          cleaned.questions = shuffleTestQuestionsInList(retryObj.questions);
        }
        questionCounts = countBlockQuestionsByType(cleaned.questions);
      } catch (retryErr) {
        console.warn(
          `Block ${blockIndex + 1}: question-count retry failed:`,
          retryErr?.message || retryErr,
        );
      }
    }
    cleaned = attachQuestionCountDiagnostics(cleaned, cfg, questionCounts);
    warnStructuredHeaderCount(cleaned.explanation);
  }

  const testCount = cleaned.questions.filter((q) => q && typeof q === "object" && q.type === "test")
    .length;
  const socCount = cleaned.questions.filter(
    (q) => q && typeof q === "object" && q.type === "socratic",
  ).length;
  if (testCount < cfg.n_test || socCount < cfg.n_socratic) {
    console.warn(
      `Block ${blockIndex + 1}: fewer questions than requested. Requested (${cfg.n_test} test, ${cfg.n_socratic} socratic), got (${testCount} test, ${socCount} socratic).`,
    );
  }

  if (!Array.isArray(state.activeSession.blocks)) state.activeSession.blocks = [];
  state.activeSession.blocks[blockIndex] = cleaned;
  state.activeSession.current_block_index = blockIndex;
  await storeActiveSession(state.activeSession, { bumpRev: true });
  return cleaned;
}

function clearSocraticError() {
  els.socraticError.hidden = true;
  els.socraticError.textContent = "";
}
function setSocraticError(message) {
  els.socraticError.hidden = false;
  els.socraticError.textContent = message;
}
function setSocraticLoading(isLoading) {
  els.socraticSubmitBtn.disabled = isLoading;
  els.socraticSubmitBtn.textContent = isLoading ? "Submitting…" : "Submit";
  els.socraticNextQuestionBtn.disabled = isLoading;
  els.socraticNextBlockBtn.disabled = isLoading;
  els.socraticAnswer.disabled = isLoading;
}

function clearTestError() {
  els.testError.hidden = true;
  els.testError.textContent = "";
}
function setTestError(message) {
  els.testError.hidden = false;
  els.testError.textContent = message;
}

function getBlockTestQuestions(block) {
  const qs = Array.isArray(block?.questions) ? block.questions : [];
  return qs.filter((q) => q && typeof q === "object" && q.type === "test");
}

function getBlockSocraticQuestions(block) {
  if (isOfflineMode()) return [];
  const qs = Array.isArray(block?.questions) ? block.questions : [];
  return qs.filter((q) => q && typeof q === "object" && q.type === "socratic");
}

function getBlockOrderedQuestions(block) {
  const testQs = getBlockTestQuestions(block);
  if (isOfflineMode()) {
    return { testQs, socQs: [], allQs: [...testQs] };
  }
  const socQs = getBlockSocraticQuestions(block);
  return { testQs, socQs, allQs: [...testQs, ...socQs] };
}

async function ensureTestQuestionShuffled(block, q) {
  if (!q || !block || String(q.type || "").trim().toLowerCase() !== "test") return q;
  if (q._optionsShuffled) return q;
  const shuffled = shuffleTestQuestionOptions(q);
  const qs = Array.isArray(block.questions) ? block.questions : null;
  if (qs) {
    const i = qs.indexOf(q);
    if (i >= 0) {
      qs[i] = shuffled;
      if (state.activeSession) await storeActiveSession(state.activeSession, { bumpRev: false });
    }
  }
  return shuffled;
}

function getActiveQuestionContext() {
  if (isPrePackingAssessmentRunner()) {
    return getAssessmentQuestionContext();
  }
  const blocks = getBlocksSafe();
  const block = blocks[state.activeBlockIndex];
  const { testQs, socQs, allQs } = getBlockOrderedQuestions(block);
  const total = allQs.length;
  const globalIndex = Math.max(0, Math.floor(Number(state.activeQuestionIndex) || 0));
  const rawQ = allQs[globalIndex] || null;
  const q = block && rawQ ? ensureTestQuestionShuffled(block, rawQ) : rawQ;
  const type = q && typeof q === "object" ? String(q.type || "") : "";
  const phase = type === "socratic" ? "Socratic" : "Test";
  const localIndex = type === "socratic" ? Math.max(0, globalIndex - testQs.length) : globalIndex;
  return { block, testQs, socQs, allQs, total, globalIndex, localIndex, type, phase, q };
}

function setQuestionProgressUi() {
  const ctx = getActiveQuestionContext();
  const n = Math.max(1, ctx.total);
  const label = isPrePackingAssessmentRunner()
    ? `Knowledge check — Q${Math.min(ctx.globalIndex + 1, n)} of ${n}`
    : `Q${Math.min(ctx.globalIndex + 1, n)} of ${n} (${ctx.phase})`;
  if (els.testMeta) {
    if (isPrePackingAssessmentRunner()) {
      els.testMeta.textContent = label;
    } else {
      const totalBlocks = Math.max(1, getTotalBlocksSafe());
      els.testMeta.textContent = `${label} — Block ${state.activeBlockIndex + 1} of ${totalBlocks}`;
    }
  }
  if (els.socraticQuestionTitle) {
    els.socraticQuestionTitle.textContent = label;
  }
}

export function syncBlockFidelityBanner(block, blockIndexEntry) {
  const banner = els.blockFidelityBanner;
  if (!banner) return;
  const b = block && typeof block === "object" ? block : {};
  const idx = blockIndexEntry && typeof blockIndexEntry === "object" ? blockIndexEntry : {};
  const anchor = String(idx.anchor_quality || b.anchor_quality || "").trim();
  const fidelity = String(b.fidelity_status || "").trim();

  let message = "";
  if (anchor === "weak") {
    message = "Anclaje débil al documento — contrasta con tu PDF.";
  } else if (anchor === "proportional_fallback") {
    message = "Este bloque usa un trozo aproximado del archivo; revisa la fuente.";
  } else if (fidelity === "warn") {
    message = "Fidelidad reducida: parte del contenido podría no reflejar la fuente.";
  }

  if (!message) {
    banner.textContent = "";
    banner.classList.add("hidden");
    banner.hidden = true;
    return;
  }
  banner.textContent = message;
  banner.classList.remove("hidden");
  banner.hidden = false;
}

function resolveSourceFidelityStrictForSession(session = state.activeSession) {
  const mode = String(session?._meta?.source_fidelity_mode || "").trim().toLowerCase();
  if (mode === "strict") return true;
  if (mode === "standard") return false;
  return (
    state.sourceFidelityStrict === true
  );
}

function hasKeyTermsGlossaryBlocks() {
  const arr = loadBlockIndex() || state.lastBlockIndex || [];
  return arr.some((b) => isZeroQuestionBlockTitle(b?.title) && /^Key terms:/i.test(String(b?.title || "")));
}

function renderKeyTermsGlossary() {
  if (!els.keyTermsGlossaryBody) return;
  const arr = loadBlockIndex() || state.lastBlockIndex || [];
  const blocks = getBlocksSafe();
  const parts = [];
  arr.forEach((entry, i) => {
    if (!/^Key terms:/i.test(String(entry?.title || ""))) return;
    const generated = blocks[i];
    const expl = String(generated?.explanation || entry.summary || "").trim();
    parts.push(`<section><h3>${String(entry.title).replace(/</g, "&lt;")}</h3><p>${expl.replace(/</g, "&lt;")}</p></section>`);
  });
  els.keyTermsGlossaryBody.innerHTML = parts.length
    ? parts.join("")
    : "<p>No Key terms blocks in this session.</p>";
}

function syncKeyTermsGlossaryUi() {
  const show = hasKeyTermsGlossaryBlocks() && !isPrePackingAssessmentRunner();
  if (els.keyTermsGlossaryBtn) els.keyTermsGlossaryBtn.hidden = !show;
}

function checkPrerequisiteBlockWarning(blockIndex) {
  const arr = loadBlockIndex() || state.lastBlockIndex || [];
  const entry = arr[blockIndex];
  const inventory = state.activeSession?._meta?.material_graph?.conceptInventory || [];
  const byId = new Map(inventory.filter((c) => c?.id).map((c) => [String(c.id), c]));
  const conceptIds = Array.isArray(entry?.concept_ids) ? entry.concept_ids : [];
  const studied = new Set(
    (state.activeSession?.blocks || [])
      .map((b, i) => (hasGeneratedBlockContent(b) ? i : -1))
      .filter((i) => i >= 0),
  );
  for (const cid of conceptIds) {
    const item = byId.get(String(cid));
    const prereqs = Array.isArray(item?.prerequisite_ids) ? item.prerequisite_ids : [];
    for (const pid of prereqs) {
      const prereqBlockIdx = arr.findIndex((b) =>
        (Array.isArray(b?.concept_ids) ? b.concept_ids : []).map(String).includes(String(pid)),
      );
      if (prereqBlockIdx >= 0 && prereqBlockIdx < blockIndex && !studied.has(prereqBlockIdx)) {
        console.warn(
          `Prerequisite block ${prereqBlockIdx + 1} not yet studied before block ${blockIndex + 1}.`,
        );
        if (els.testMeta) {
          els.testMeta.textContent += " — Prerequisite block not studied yet";
        }
        return;
      }
    }
  }
}

function setTestMeta() {
  if (isPrePackingAssessmentRunner()) {
    els.testHeader.textContent = "Document knowledge check";
    syncBlockFidelityBanner(null, null);
    syncKeyTermsGlossaryUi();
    return;
  }
  const total = Math.max(1, getTotalBlocksSafe());
  const title = getBlockTitleSafe(state.activeBlockIndex);
  els.testHeader.textContent = title;
  els.testMeta.textContent = `Block ${state.activeBlockIndex + 1} of ${total}`;
  checkPrerequisiteBlockWarning(state.activeBlockIndex);
  const block = getBlock(state.activeBlockIndex);
  const indexEntry = getBlockIndexEntry(state.activeBlockIndex);
  syncBlockFidelityBanner(block, indexEntry);
  syncKeyTermsGlossaryUi();
  void syncMnemonicButtonBadge();
}

let testMcAnswered = false;
/** @type {((e: KeyboardEvent) => void) | null} */
let testMcKeydownHandler = null;

function detachTestMcKeydown() {
  if (!testMcKeydownHandler) return;
  document.removeEventListener("keydown", testMcKeydownHandler);
  testMcKeydownHandler = null;
}

function attachTestMcKeydown() {
  detachTestMcKeydown();
  testMcKeydownHandler = (e) => {
    if (e.repeat || isMcTypingTarget(e.target)) return;
    if (els.screenTest?.getAttribute("aria-hidden") === "true") return;

    if (testMcAnswered) {
      if (e.key === "Enter" && els.testNextBtn && !els.testNextBtn.hidden) {
        e.preventDefault();
        els.testNextBtn.click();
      }
      return;
    }

    const letter = letterFromMcKey(e.key);
    if (!letter) return;
    const btn = els.testOptions?.querySelector(`button[data-letter="${letter}"]`);
    if (!btn || btn.disabled) return;
    e.preventDefault();
    btn.click();
  };
  document.addEventListener("keydown", testMcKeydownHandler);
}

function showTestQuestions() {
  els.testRsvpView.hidden = true;
  els.testQaView.hidden = false;
  if (!isPrePackingAssessmentRunner()) {
    setBlockReadSidebarAvailable(true);
  }
}

function beginRsvpForCurrentBlock({ onDone }) {
  const blocks = getBlocksSafe();
  const block = blocks[state.activeBlockIndex];
  // [debug-enrich]
  console.info('[study.beginRsvpForCurrentBlock] Starting RSVP overlay:', {
    activeBlockIndex: state.activeBlockIndex,
    hasBlock: Boolean(block),
    explanationLen: block?.explanation ? String(block.explanation).length : 0,
    readable: block ? blockHasReadableExplanation(block) : false,
  });
  if (!block) {
    const msg = "Missing block.";
    // [debug-enrich]
    console.error('[study.beginRsvpForCurrentBlock] Missing block at index', state.activeBlockIndex);
    setTestError(msg);
    showScreen("test");
    return;
  }
  if (!blockHasReadableExplanation(block)) {
    // [debug-enrich]
    console.warn('[study.beginRsvpForCurrentBlock] No readable explanation — skipping RSVP');
    if (typeof onDone === "function") {
      onDone();
      return;
    }
    setTestError("This block has no reading text. Regenerate the block or skip to questions.");
    showScreen("test");
    return;
  }
  setBlockReadSidebarAvailable(false);
  setRsvpBlockTitle(getBlockTitleSafe(state.activeBlockIndex));
  const rsvpCfg = resolveBlockQuestionConfig(state.activeBlockIndex);
  setRsvpWpmCap(rsvpCfg?.rsvp_wpm_cap);
  if (state.activeSession) {
    ensureSessionStartWpm(state.activeSession, rsvpState.wpm);
  }
  const blockIdx = state.activeBlockIndex;
  const wrappedOnDone = () => {
    if (state.activeSession) {
      recordBlockRsvpWpm(state.activeSession, blockIdx, rsvpState.wpm);
    }
    if (typeof onDone === "function") onDone();
  };
  startRsvpForText(block.explanation || "", wrappedOnDone);
}

function beginPacedReadForCurrentBlock({ onDone }) {
  const blocks = getBlocksSafe();
  const block = blocks[state.activeBlockIndex];
  if (!block) {
    const msg = "Missing block.";
    setTestError(msg);
    showScreen("test");
    return;
  }
  if (!blockHasReadableExplanation(block)) {
    if (typeof onDone === "function") {
      onDone();
      return;
    }
    setTestError("This block has no reading text. Regenerate the block or skip to questions.");
    showScreen("test");
    return;
  }
  setBlockReadSidebarAvailable(false);
  startPacedReadForText(block.explanation || "", {
    title: getBlockTitleSafe(state.activeBlockIndex),
    onDone,
  });
}

function beginBlockReading({ onDone }) {
  const mode = isReadStudyMode(state.activeSession)
    ? "read"
    : isPacedReaderPreferred()
      ? "paced"
      : "rsvp";
  // [debug-enrich]
  console.info('[study.beginBlockReading] Choosing reading mode:', {
    mode,
    activeBlockIndex: state.activeBlockIndex,
    studyMode: state.activeSession?.studyMode ?? state.studyMode ?? null,
  });
  if (isReadStudyMode(state.activeSession)) beginReadForCurrentBlock({ onDone });
  else if (isPacedReaderPreferred()) beginPacedReadForCurrentBlock({ onDone });
  else beginRsvpForCurrentBlock({ onDone });
}

async function renderCurrentReadBlock(block) {
  if (!els.testReadContent) return;
  const doc = await getActiveSession();
  await renderReadBlockContent(els.testReadContent, {
    ...block,
    explanationText: block?.explanation || "",
    images: doc?.shared?.images || [],
  });
}

function beginReadForCurrentBlock({ onDone }) {
  const blocks = getBlocksSafe();
  const block = blocks[state.activeBlockIndex];
  if (!block) {
    setTestError("Missing block.");
    showScreen("test");
    return;
  }
  if (!blockHasReadableExplanation(block)) {
    if (typeof onDone === "function") {
      onDone();
      return;
    }
    setTestError("This block has no reading text. Regenerate the block or skip to questions.");
    showScreen("test");
    return;
  }
  setBlockReadSidebarAvailable(false);
  els.testRsvpView.hidden = true;
  els.testQaView.hidden = true;
  if (els.testReadView) els.testReadView.hidden = false;
  if (els.testReadContinueBtn) {
    els.testReadContinueBtn.onclick = () => {
      if (els.testReadView) els.testReadView.hidden = true;
      if (typeof onDone === "function") onDone();
    };
  }
  void renderCurrentReadBlock(block);
  triggerReadVisualPrefetch(state.activeBlockIndex, block, {
    llmModel: getSessionLlmModel(state.activeSession),
    language: getStudyLanguage(),
    activeSession: state.activeSession,
  });
}

function switchBlockReadingToPaced() {
  const blocks = getBlocksSafe();
  const block = blocks[state.activeBlockIndex];
  const text =
    (typeof rsvpState.sourceExplanation === "string" && rsvpState.sourceExplanation) ||
    block?.explanation ||
    "";
  const onDone = rsvpState.onDone || pacedReaderState.onDone;
  const title = getBlockTitleSafe(state.activeBlockIndex);

  cancelRsvpTimer();
  setRsvpOverlayActive(false);
  setReadingModePref("paced");

  startPacedReadForText(text, { title, onDone });
}

function switchBlockReadingToRsvp() {
  const text = pacedReaderState.sourceText || "";
  const onDone = pacedReaderState.onDone;
  const title = getBlockTitleSafe(state.activeBlockIndex);

  finishPacedRead({ skipCallback: true });
  setReadingModePref("rsvp");
  setRsvpBlockTitle(title);
  startRsvpForText(text, onDone, { skipCountdown: true });
}

async function startTestBlock() {
  clearTestError();
  setTestMeta();
  updateStudyProgressUi();

  els.testFeedback.hidden = true;
  clearMarkdownContainer(els.testFeedback);
  els.testNextBtn.hidden = true;
  els.testNextBtn.textContent = "";
  els.testOptions.innerHTML = "";
  clearMarkdownContainer(els.testQuestionText);
  els.testQaView.hidden = true;
  els.testRsvpView.hidden = false;
  if (els.testReadView) els.testReadView.hidden = true;
  if (els.testRsvpWord) els.testRsvpWord.textContent = "";
  els.testRsvpStatus.textContent = "Generating block…";

  try {
    els.testRsvpSkipBtn.disabled = true;
    await ensureBlockGenerated(state.activeBlockIndex);
  } catch (err) {
    setTestError(err?.message ? String(err.message) : String(err));
    els.testRsvpStatus.textContent = "";
    els.testRsvpSkipBtn.disabled = false;
    return;
  } finally {
    els.testRsvpSkipBtn.disabled = false;
  }

  els.testRsvpStatus.textContent = "";
  els.testRsvpView.hidden = true;

  if (isQuestionsStudyMode(state.activeSession)) {
    showScreen("test");
    updateStudyProgressUi();
    showQuestions(state.activeBlockIndex);
    return;
  }

  beginBlockReading({
    onDone: () => {
      showScreen("test");
      updateStudyProgressUi();
      finishRSVP(state.activeBlockIndex);
    },
  });
}

async function startSocraticBlock() {
  clearSocraticError();
  els.socraticStatus.textContent = "";
  els.socraticResponseBox.hidden = true;
  clearMarkdownContainer(els.socraticResponseBox);
  els.socraticNextQuestionBtn.hidden = true;
  els.socraticNextBlockBtn.hidden = true;

  try {
    setSocraticLoading(true);
    els.socraticStatus.textContent = "Generating block…";
    await ensureBlockGenerated(state.activeBlockIndex);
  } catch (err) {
    setSocraticError(err?.message ? String(err.message) : String(err));
    return;
  } finally {
    setSocraticLoading(false);
    els.socraticStatus.textContent = "";
  }

  if (isQuestionsStudyMode(state.activeSession)) {
    showScreen("socratic");
    updateStudyProgressUi();
    showQuestions(state.activeBlockIndex);
    return;
  }

  beginBlockReading({
    onDone: () => {
      showScreen("socratic");
      updateStudyProgressUi();
      finishRSVP(state.activeBlockIndex);
    },
  });
}

function renderTestQuestion() {
  testMcAnswered = false;
  clearTestError();
  els.testFeedback.hidden = true;
  clearMarkdownContainer(els.testFeedback);
  els.testNextBtn.hidden = true;
  els.testNextBtn.textContent = "";

  const ctx = getActiveQuestionContext();
  if (!ctx.block) {
    setTestError("Missing block.");
    return;
  }

  if (ctx.type !== "test") {
    // If test questions are exhausted, jump to Socratic (or finish block).
    if (ctx.type === "socratic") {
      showScreen("socratic");
      if (!isPrePackingAssessmentRunner()) {
        setBlockReadSidebarAvailable(true);
      }
      renderSocraticQuestion();
      return;
    }
    setTestError("No questions found for this block.");
    return;
  }

  setTestMeta();
  setQuestionProgressUi();

  const q = ctx.q;
  void renderMarkdown(els.testQuestionText, String(q?.question || ""));
  els.testOptions.innerHTML = "";

  const letters = ["A", "B", "C", "D"];
  for (const letter of letters) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.letter = letter;
    const optText = q?.options && q.options[letter] != null ? String(q.options[letter]) : "";
    btn.innerHTML = renderMcOptionHtml(letter, optText);
    if (hasMathInHtml(btn.innerHTML)) void typesetMath(btn);
    btn.addEventListener("click", () => {
      handleTestAnswer({
        chosen: letter,
        correct: String(q?.answer || ""),
        feedback: String(q?.feedback || ""),
      });
    });
    els.testOptions.appendChild(btn);
  }
  attachTestMcKeydown();
}

async function handleTestAnswer({ chosen, correct, feedback }) {
  testMcAnswered = true;
  // [debug-enrich]
  console.info('[study.handleTestAnswer] MCQ answer:', {
    chosen,
    correctAnswer: correct != null ? String(correct).slice(0, 8) : null,
    isCorrect: String(chosen || "") === String(correct || ""),
    blockIndex: state.activeBlockIndex,
    questionIndex: state.activeQuestionIndex,
    isAssessment: isPrePackingAssessmentRunner(),
  });
  if (isPrePackingAssessmentRunner()) {
    handleAssessmentTestAnswer({ chosen, correct, feedback });
    return;
  }
  const btns = Array.from(els.testOptions.querySelectorAll("button"));
  for (const b of btns) b.disabled = true;

  const ctx = getActiveQuestionContext();
  const q = ctx.q;
  const optText = q?.options && q.options[chosen] != null ? String(q.options[chosen]) : "";
  const userAnswer = optText ? `${chosen}. ${optText}` : String(chosen || "");
  recordResponse({
    blockIndex: state.activeBlockIndex,
    questionIndex: ctx.globalIndex,
    questionType: "test",
    questionText: q?.question != null ? String(q.question) : "",
    userAnswer,
    feedback: String(feedback || ""),
    correctAnswer: String(correct || ""),
  });
  try {
    const doc = await getActiveSession();
    const blocks = getBlocksSafe();
    const block = blocks[state.activeBlockIndex];
    if (doc?.docId && block) {
      await finalizeBlockQuestionAnswer({
        docId: doc.docId,
        slice: state.activeSession,
        sourceMode: state.activeSession?.studyMode || state.studyMode,
        blockIndex: state.activeBlockIndex,
        block,
        questionType: "test",
        questionIndex: ctx.globalIndex,
        mcqOutcome: {
          correct:
            String(chosen || "").trim().toUpperCase() === String(correct || "").trim().toUpperCase(),
        },
      });
    }
  } catch (err) {
    console.warn("[block-answer-signals] test finalize failed", err);
  }

  const normalizedChosen = String(chosen || "").trim().toUpperCase();
  const normalizedCorrect = String(correct || "").trim().toUpperCase();
  const chosenBtn = btns.find((b) => b.dataset.letter === normalizedChosen);
  if (chosenBtn) {
    chosenBtn.classList.add(normalizedChosen === normalizedCorrect ? "is-correct" : "is-wrong");
  }
  if (normalizedChosen !== normalizedCorrect) {
    const correctBtn = btns.find((b) => b.dataset.letter === normalizedCorrect);
    if (correctBtn) correctBtn.classList.add("is-correct-soft");
  }

  els.testFeedback.hidden = false;
  void renderMarkdown(els.testFeedback, feedback || "");

  const blocks = getBlocksSafe();
  const isLastGlobal = ctx.globalIndex >= ctx.total - 1;
  const isLastBlock = state.activeBlockIndex >= blocks.length - 1;

  els.testNextBtn.hidden = false;
  els.testNextBtn.textContent = isLastGlobal ? (isLastBlock ? "Finish" : "Next block") : "Next";

  els.testNextBtn.onclick = async () => {
    if (!isLastGlobal) {
      state.activeQuestionIndex += 1;
      if (state.activeSession && typeof state.activeSession === "object") {
        state.activeSession.active_question_index = state.activeQuestionIndex;
        await storeActiveSession(state.activeSession);
      }
      const nextCtx = getActiveQuestionContext();
      if (nextCtx.type === "socratic") {
        showScreen("socratic");
        setBlockReadSidebarAvailable(true);
        renderSocraticQuestion();
      } else {
        renderTestQuestion();
      }
      return;
    }

    if (!isLastBlock) void finishQuestions(state.activeBlockIndex);
    else showSessionComplete();
  };
}

function renderSocraticQuestion() {
  clearSocraticError();
  els.socraticStatus.textContent = "";
  els.socraticResponseBox.hidden = true;
  clearMarkdownContainer(els.socraticResponseBox);
  els.socraticAnswer.value = "";
  els.socraticNextQuestionBtn.hidden = true;
  els.socraticNextBlockBtn.hidden = true;

  const ctx = getActiveQuestionContext();
  if (!ctx.block) {
    setSocraticError("No blocks found in session.");
    return;
  }

  if (ctx.type !== "socratic") {
    if (ctx.type === "test") {
      showScreen("test");
      showTestQuestions();
      renderTestQuestion();
      return;
    }
    setSocraticError("No Socratic questions found for this block.");
    return;
  }

  const q = ctx.q;
  if (isPrePackingAssessmentRunner()) {
    els.socraticHeader.textContent = "Document knowledge check";
    els.socraticMeta.textContent = "";
  } else {
    const total = Math.max(1, getTotalBlocksSafe());
    const blockTitle = getBlockTitleSafe(state.activeBlockIndex);
    els.socraticHeader.textContent = "Socratic";
    els.socraticMeta.textContent = `Block ${state.activeBlockIndex + 1} of ${total}: ${blockTitle}`;
  }
  setQuestionProgressUi();
  void renderMarkdown(els.socraticQuestionText, String(q.question));

  setTimeout(() => els.socraticAnswer.focus(), 0);
}

async function startBlock(blockIndex) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  // [debug-enrich]
  console.info('[study.startBlock] Starting block:', {
    blockIndex: idx,
    totalBlocks: getTotalBlocksSafe(),
    studyMode: state.activeSession?.studyMode ?? state.studyMode ?? null,
    docId: state.activeSession?.docId ?? null,
  });

  // 1) triggerPrefetch(N+1) ? fire and forget
  const total = Math.max(1, getTotalBlocksSafe());
  const blockIndexArr = loadBlockIndex() || state.lastBlockIndex || [];
  const nextIdx = resolveNextStudyBlockIndex(idx, blockIndexArr, total);
  if (nextIdx < total) {
    // [debug-enrich]
    console.debug('[study.startBlock] Prefetching next block:', { nextIdx });
    prefetchStartedAtByIndex.set(nextIdx, Date.now());
    setPrefetchIndicator("generating");
    const cfg = resolveBlockQuestionConfig(nextIdx);
    triggerPrefetch(nextIdx, cfg);
  }

  // 2) triggerCommentReply() ? fire and forget
  if (shouldTriggerCommentReply()) {
    triggerCommentReply();
  }

  // 3) showRSVP(N) ? uses already-generated block data (not prefetch)
  state.activeBlockIndex = idx;
  state.activeQuestionIndex = 0;
  if (state.activeSession && typeof state.activeSession === "object") {
    state.activeSession.current_block_index = idx;
    state.activeSession.active_question_index = 0;
    await storeActiveSession(state.activeSession, { bumpRev: true });
  }

  updateStudyProgressUi();
  showScreen("test");
  void startTestBlock();
}

function withTimeout(promise, timeoutMs, label) {
  const ms = Math.max(0, Number(timeoutMs) || 0);
  if (!ms) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label || "Operation timed out")), ms),
    ),
  ]);
}

async function generateBlockDirect(blockIndex, { timeoutMs, n_test, n_socratic } = {}) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  const resolved = resolveBlockQuestionConfig(idx);
  const cfg = {
    n_test: n_test != null ? n_test : resolved.n_test,
    n_socratic: n_socratic != null ? n_socratic : resolved.n_socratic,
    explanation_profile: resolved.explanation_profile,
    gap_focus: resolved.gap_focus,
  };
  const configKey = buildBlockConfigKey(cfg);
  triggerPrefetch(idx, { ...cfg, force: true });
  const data = await withTimeout(
    getPrefetchedBlock(idx, { configKey }),
    timeoutMs,
    "Block generation timed out",
  );
  if (state.activeSession && typeof state.activeSession === "object") {
    if (!Array.isArray(state.activeSession.blocks)) state.activeSession.blocks = [];
    state.activeSession.blocks[idx] = data;
    await storeActiveSession(state.activeSession, { bumpRev: true });
  }
  return data;
}

function finishRSVP(blockIndex) {
  // [debug-enrich]
  console.info('[study.finishRSVP] Reading finished — showing questions:', {
    blockIndex: Math.max(0, Math.floor(Number(blockIndex) || 0)),
    activeBlockIndex: state.activeBlockIndex,
  });
  showQuestions(blockIndex);
}

async function showQuestions(blockIndex) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  // [debug-enrich]
  console.info('[study.showQuestions] Entering questions for block:', {
    blockIndex: idx,
    studyMode: state.activeSession?.studyMode ?? state.studyMode ?? null,
  });
  state.activeBlockIndex = idx;
  state.activeQuestionIndex = 0;
  if (state.activeSession && typeof state.activeSession === "object") {
    state.activeSession.current_block_index = idx;
    state.activeSession.active_question_index = 0;
    await storeActiveSession(state.activeSession);
  }

  updateStudyProgressUi();

  const blocks = getBlocksSafe();
  const block = blocks[idx];
  const { testQs, socQs, allQs } = getBlockOrderedQuestions(block);
  if (!allQs.length) {
    console.warn(`Block ${idx + 1}: no questions available.`);
  }

  if (testQs.length) {
    showScreen("test");
    showTestQuestions();
    renderTestQuestion();
    return;
  }
  if (socQs.length) {
    showScreen("socratic");
    setBlockReadSidebarAvailable(true);
    renderSocraticQuestion();
    return;
  }
  // No questions: skip directly to next block transition
  void finishQuestions(idx);
}

async function finishQuestions(blockIndex) {
  setBlockReadSidebarAvailable(false);
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  const total = Math.max(1, getTotalBlocksSafe());
  const studyOrder = isQuestionsStudyMode(state.activeSession) ? state.questionsStudyOrder : null;
  // [debug-enrich]
  console.info('[study.finishQuestions] Block questions finished:', {
    blockIndex: idx,
    totalBlocks: total,
    isLast: isLastQuestionsStudyBlock(idx, studyOrder, total),
    hasStudyOrder: Array.isArray(studyOrder) && studyOrder.length > 0,
    studyMode: state.activeSession?.studyMode ?? state.studyMode ?? null,
  });
  if (isLastQuestionsStudyBlock(idx, studyOrder, total)) {
    // [debug-enrich]
    console.info('[study.finishQuestions] Last block — showing session complete');
    showSessionComplete();
    return;
  }

  try {
    commitSessionConceptsForBlock(idx);
  } catch (err) {
    // [debug-enrich]
    console.warn('[study.finishQuestions] commitSessionConceptsForBlock failed (ignored):', {
      blockIndex: idx,
      message: err?.message ?? String(err),
    });
  }

  const o = getOrCreateTransitionOverlay();
  const nextIndex = resolveNextStudyBlockForSession(idx, total);
  // [debug-enrich]
  console.info('[study.finishQuestions] Opening transition overlay:', {
    finishedBlockIndex: idx,
    nextIndex,
    prefetchStatus: prefetchState?.status ?? null,
    prefetchBlockIndex: prefetchState?.blockIndex ?? null,
  });
  o.title.textContent = `Continue to block ${nextIndex + 1} of ${total}`;

  o.finishedBlockIndex = idx;

  const concepts = getSortedSessionConcepts();
  const { newKeys, updatedKeys } = getConceptHighlightsForBlock(idx);
  renderDictionary({
    containerEl: o.dictionaryWrap,
    title: `Concepts so far (${concepts.length} terms)`,
    concepts,
    collapsedByDefault: true,
    newTermKeys: newKeys,
    updatedTermKeys: updatedKeys,
  });

  const blockDefaults = resolveBlockQuestionConfig(nextIndex);
  let nextCfg = { ...blockDefaults };
  const keyOf = (c) => buildBlockConfigKey(c);
  let fastPathConfigKey = keyOf(blockDefaults);
  o.expectedPrefetchConfigKey = fastPathConfigKey;
  let overlayPollTimer = null;

  const renderNextCfgUi = () => {
    if (o.nextTestValue) o.nextTestValue.textContent = String(nextCfg.n_test);
    if (o.nextSocValue) o.nextSocValue.textContent = String(nextCfg.n_socratic);
    if (o.nextQStatus) {
      o.nextQStatus.textContent =
        keyOf(nextCfg) === keyOf(blockDefaults) ? "Block profile" : "Custom";
    }
  };

  renderNextCfgUi();

  if (o.reviewBlockBtn) {
    const showReview = isQuestionsStudyMode(state.activeSession);
    o.reviewBlockBtn.hidden = !showReview;
    o.reviewBlockBtn.onclick = () => {
      if (!showReview) return;
      stopOverlayPoll();
      setTransitionOverlayOpen(false);
      try {
        startReviewFromSessionBlocks({ blockIndices: [idx], reviewType: "both" });
      } catch (err) {
        setTestError(err?.message ? String(err.message) : String(err));
        showScreen("test");
      }
    };
  }

  const setStatusPreparing = () => {
    o.statusBarText.textContent = "Preparing next block…";
    o.statusBarFill.style.animation = "transitionBarSlide 1.2s ease-in-out infinite";
    o.statusBarFill.style.background = "rgba(148, 163, 184, 0.75)";
    o.statusBarFill.style.transform = "translateX(-120%)";
    o.statusBarFill.style.width = "40%";
  };
  const setStatusReady = () => {
    o.statusBarText.textContent = "Ready…";
    o.statusBarText.style.color = "rgba(34, 197, 94, 0.95)";
    o.statusBarFill.style.animation = "none";
    o.statusBarFill.style.width = "100%";
    o.statusBarFill.style.transform = "translateX(0)";
    o.statusBarFill.style.background = "rgba(34, 197, 94, 0.85)";
  };
  const setStatusFailed = () => {
    o.statusBarText.textContent = "Failed to prepare block";
    o.statusBarText.style.color = "rgba(248, 113, 113, 0.95)";
    o.statusBarFill.style.animation = "none";
    o.statusBarFill.style.width = "100%";
    o.statusBarFill.style.transform = "translateX(0)";
    o.statusBarFill.style.background = "rgba(248, 113, 113, 0.6)";
  };

  o.statusBarText.style.color = "";

  const isPrefetchReadyForKey = (key) =>
    prefetchState.blockIndex === nextIndex &&
    prefetchState.status === "ready" &&
    prefetchState.configKey === key;

  const syncPrefetchUi = () => {
    if (isPrefetchReadyForKey(o.expectedPrefetchConfigKey)) {
      setPrefetchIndicator("ready");
      setStatusReady();
      if (o.continueBtn) o.continueBtn.disabled = false;
      renderTransitionSneakPeek(o, idx);
      return;
    }
    if (prefetchState.blockIndex === nextIndex && prefetchState.status === "failed") {
      setPrefetchIndicator("failed");
      setStatusFailed();
      if (o.continueBtn) o.continueBtn.disabled = true;
      renderTransitionSneakPeek(o, idx);
      return;
    }
    if (prefetchState.blockIndex === nextIndex && prefetchState.status === "generating") {
      setPrefetchIndicator("generating");
      setStatusPreparing();
      if (o.continueBtn) o.continueBtn.disabled = true;
      renderTransitionSneakPeek(o, idx);
      return;
    }
    setPrefetchIndicator("generating");
    setStatusPreparing();
    if (o.continueBtn) o.continueBtn.disabled = true;
    renderTransitionSneakPeek(o, idx);
  };

  syncPrefetchUi();

  const showRetryControls = (message) => {
    o.error.hidden = false;
    o.error.textContent = String(message || "Failed to generate block.");
    o.retryBtn.hidden = false;
    o.skipBtn.hidden = false;
  };

  o.retryBtn.hidden = true;
  o.skipBtn.hidden = true;

  const stopOverlayPoll = () => {
    if (overlayPollTimer != null) {
      clearInterval(overlayPollTimer);
      overlayPollTimer = null;
    }
  };

  const persistNextBlock = async (data, cfg) => {
    if (!state.activeSession || typeof state.activeSession !== "object") return;
    if (!Array.isArray(state.activeSession.blocks)) state.activeSession.blocks = [];
    const cleaned = normalizeBlockJson(data, cfg, nextIndex);
    if (Array.isArray(cleaned.questions)) {
      cleaned.questions = shuffleTestQuestionsInList(cleaned.questions);
    }
    state.activeSession.blocks[nextIndex] = cleaned;
    await storeActiveSession(state.activeSession, { bumpRev: true });
    try {
      syncConceptsFromBlock(
        nextIndex,
        Array.isArray(cleaned.concepts) ? cleaned.concepts : [],
      );
    } catch {
      // ignore
    }
    return cleaned;
  };

  const updatePrefetchSlot = (data, cfg) => {
    prefetchState.blockIndex = nextIndex;
    prefetchState.status = "ready";
    prefetchState.data = data;
    prefetchState.error = null;
    prefetchState.configKey = buildBlockConfigKey(cfg);
  };

  const maybeRegeneratePrefetch = () => {
    renderNextCfgUi();
    const targetKey = keyOf(nextCfg);
    const currentKey = prefetchState.blockIndex === nextIndex ? String(prefetchState.configKey || "") : "";
    if (currentKey && currentKey === targetKey && prefetchState.status === "ready") return;

    fastPathConfigKey = targetKey;
    o.expectedPrefetchConfigKey = targetKey;

    setPrefetchIndicator("generating");
    setStatusPreparing();
    o.statusBarText.textContent = "Regenerating next block…";
    triggerPrefetch(nextIndex, { ...nextCfg, force: true });
    syncPrefetchUi();
  };

  const bumpNext = (kind, delta) => {
    if (kind === "test") nextCfg.n_test = clampInt(nextCfg.n_test + delta, 0, MAX_N_TEST, blockDefaults.n_test);
    else nextCfg.n_socratic = clampInt(nextCfg.n_socratic + delta, 0, MAX_N_SOCRATIC, blockDefaults.n_socratic);
    maybeRegeneratePrefetch();
  };

  if (o.nextTestMinus) o.nextTestMinus.onclick = () => bumpNext("test", -1);
  if (o.nextTestPlus) o.nextTestPlus.onclick = () => bumpNext("test", +1);
  if (o.nextSocMinus) o.nextSocMinus.onclick = () => bumpNext("socratic", -1);
  if (o.nextSocPlus) o.nextSocPlus.onclick = () => bumpNext("socratic", +1);

  if (o.adjustBtn) {
    o.adjustBtn.onclick = () => {
      o.error.hidden = true;
      o.error.textContent = "";
      nextCfg = { ...blockDefaults };
      renderNextCfgUi();
      setTransitionOverlayView("adjust");
    };
  }

  if (o.backBtn) {
    o.backBtn.onclick = () => {
      o.error.hidden = true;
      o.error.textContent = "";
      nextCfg = { ...blockDefaults };
      fastPathConfigKey = keyOf(blockDefaults);
      o.expectedPrefetchConfigKey = fastPathConfigKey;
      renderNextCfgUi();
      setTransitionOverlayView("default");
      syncPrefetchUi();
    };
  }

  o.continueBtn.onclick = async () => {
    o.error.hidden = true;
    o.error.textContent = "";
    o.status.textContent = "";

    if (!isPrefetchReadyForKey(fastPathConfigKey)) return;

    try {
      const data = await getPrefetchedBlock(nextIndex, { configKey: fastPathConfigKey });
      persistNextBlock(data, blockDefaults);
      stopOverlayPoll();
      setTransitionOverlayOpen(false);
      startBlock(nextIndex);
    } catch (err) {
      setPrefetchIndicator("failed");
      setStatusFailed();
      showRetryControls(err?.message ? String(err.message) : String(err));
    }
  };

  if (o.confirmBtn) {
    o.confirmBtn.onclick = async () => {
      o.error.hidden = true;
      o.error.textContent = "";
      o.status.textContent = "";

      if ((nextCfg.n_test || 0) <= 0 && (nextCfg.n_socratic || 0) <= 0) {
        showRetryControls("Set at least one question for the next block.");
        return;
      }

      const prefetchedBlock =
        prefetchState.blockIndex === nextIndex && prefetchState.data
          ? prefetchState.data
          : state.activeSession?.blocks?.[nextIndex];
      const baseBlock =
        prefetchedBlock && typeof prefetchedBlock === "object" ? prefetchedBlock : null;
      const baseCfg =
        baseBlock?._config && typeof baseBlock._config === "object"
          ? { ...baseBlock._config }
          : { ...blockDefaults };
      if (baseBlock && !baseBlock._config) baseBlock._config = { ...baseCfg };

      const mode = resolveRegenMode(nextCfg, baseBlock, {
        prefetchReady: prefetchState.blockIndex === nextIndex && prefetchState.status === "ready",
        prefetchConfigKey: prefetchState.configKey,
        baseCfg,
      });

      try {
        let data = null;
        if (mode === "consume_prefetch") {
          data = await getPrefetchedBlock(nextIndex, { configKey: keyOf(nextCfg) });
        } else if (mode === "questions_only") {
          o.status.textContent = "Regenerating questions…";
          if (isQuestionsStudyMode(state.activeSession)) {
            data = await generateQuestionsBlockForIndex(nextIndex, nextCfg);
          } else {
            data = await generateQuestionsOnlyForIndex(nextIndex, {
              n_test: nextCfg.n_test,
              n_socratic: nextCfg.n_socratic,
              baseBlock,
            });
          }
          updatePrefetchSlot(data, nextCfg);
          setPrefetchIndicator("ready");
          setStatusReady();
        } else {
          o.status.textContent = "Regenerating block…";
          setPrefetchIndicator("generating");
          data = await generateBlockDirect(nextIndex, {
            timeoutMs: 30_000,
            n_test: nextCfg.n_test,
            n_socratic: nextCfg.n_socratic,
          });
        }
        persistNextBlock(data, nextCfg);
        fastPathConfigKey = keyOf(nextCfg);
        o.status.textContent = "";
        stopOverlayPoll();
        setTransitionOverlayOpen(false);
        startBlock(nextIndex);
      } catch (err) {
        setPrefetchIndicator("failed");
        setStatusFailed();
        showRetryControls(err?.message ? String(err.message) : String(err));
        o.status.textContent = "";
      }
    };
  }

  o.retryBtn.onclick = async () => {
    o.error.hidden = true;
    o.error.textContent = "";
    o.status.textContent = "Retrying…";
    try {
      setPrefetchIndicator("generating");
      const cfg = o.view === "adjust" ? nextCfg : blockDefaults;
      const data = await generateBlockDirect(nextIndex, {
        timeoutMs: 30_000,
        n_test: cfg.n_test,
        n_socratic: cfg.n_socratic,
      });
      fastPathConfigKey = keyOf(cfg);
      persistNextBlock(data, cfg);
      setPrefetchIndicator("ready");
      setStatusReady();
      o.status.textContent = "";
      stopOverlayPoll();
      setTransitionOverlayOpen(false);
      startBlock(nextIndex);
    } catch (err) {
      setPrefetchIndicator("failed");
      setStatusFailed();
      showRetryControls(err?.message ? String(err.message) : String(err));
      o.status.textContent = "";
    }
  };

  o.skipBtn.onclick = () => {
    stopOverlayPoll();
    setTransitionOverlayOpen(false);
    startBlock(nextIndex + 1);
  };

  overlayPollTimer = setInterval(syncPrefetchUi, 400);
  setTransitionOverlayOpen(true);
}

function setSummaryOverlayOpen(isOpen) {
  if (!els.summaryOverlay) return;
  els.summaryOverlay.setAttribute("aria-hidden", String(!isOpen));
}
function setSummaryOverlayError(message) {
  if (!els.summaryOverlayError) return;
  const m = String(message || "").trim();
  els.summaryOverlayError.hidden = !m;
  els.summaryOverlayError.textContent = m;
}

async function copyPlainTextToClipboard(text) {
  const t = String(text || "");
  if (!t.trim()) return;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(t);
      return;
    }
  } catch {
    // fall back below
  }

  const ta = document.createElement("textarea");
  ta.value = t;
  ta.setAttribute("readonly", "true");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    // ignore
  } finally {
    ta.remove();
  }
}

let materialGraphBackScreen = "blocks";
let lastMaterialGraph = null;
let materialGraphSource = "session";
/** @type {string|null} */
let recallFocusGlobalConceptId = null;
/** Ephemeral vault graph UI state (reset on each open). */
let vaultGraphRenderMode = "node";
/** @type {Set<string>|null} */
let vaultGraphCheckedProjects = null;
/** @type {string} */
let vaultGraphTopicFilter = "all";

function resetVaultGraphChrome() {
  document.getElementById("slowGraphLayout")?.classList.remove("vault-graph-active");
  const detail = document.getElementById("vaultGraphDetailPanel");
  if (detail) {
    detail.hidden = true;
    detail.setAttribute("aria-hidden", "true");
    detail.innerHTML = "";
  }
  const exportBtn = document.getElementById("slowGraphExportBtn");
  if (exportBtn) exportBtn.hidden = false;
  const chrome = document.getElementById("vaultGraphChrome");
  if (chrome) chrome.hidden = true;
}

function syncVaultGraphModeButtons() {
  document.querySelectorAll(".vault-graph-mode-btn").forEach((btn) => {
    const mode = btn.getAttribute("data-mode");
    const active = mode === vaultGraphRenderMode;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
}

function renderVaultProjectFilterCheckboxes(projects) {
  const host = document.getElementById("vaultGraphProjectFilters");
  if (!host) return;
  host.innerHTML = projects
    .map((p) => {
      const checked = !vaultGraphCheckedProjects || vaultGraphCheckedProjects.has(p.id);
      return `<label class="vault-graph-project-check"><input type="checkbox" data-project-id="${p.id}" ${checked ? "checked" : ""}/> ${p.name}</label>`;
    })
    .join("");
  host.querySelectorAll("input[type=checkbox]").forEach((input) => {
    input.addEventListener("change", () => {
      const next = new Set();
      host.querySelectorAll("input[type=checkbox]").forEach((el) => {
        if (el.checked) next.add(el.getAttribute("data-project-id"));
      });
      vaultGraphCheckedProjects = next;
      void refreshVaultGraphView();
    });
  });
}

async function refreshVaultGraphView() {
  const host = document.getElementById("slowGraphContent");
  const detailHost = document.getElementById("vaultGraphDetailPanel");
  if (!host || materialGraphSource !== "vault") return;
  const vault = loadVault();
  const sessions = await getAllSessions();
  const sessionsByDocId = buildSessionsByDocIdMap(sessions);
  lastMaterialGraph = await renderVaultGraphMode(host, detailHost, {
    mode: vaultGraphRenderMode,
    vault,
    topicFilter: vaultGraphTopicFilter,
    projectIds: vaultGraphCheckedProjects,
    sessionsByDocId,
    onSelectEntry: (id) => {
      if (!detailHost) return;
      const entry = getEntryById(id);
      if (entry) renderDetail(detailHost, entry);
    },
  });
}

function wireVaultGraphChromeOnce() {
  const chrome = document.getElementById("vaultGraphChrome");
  if (!chrome || chrome.dataset.wired === "1") return;
  chrome.dataset.wired = "1";
  chrome.querySelectorAll(".vault-graph-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode");
      if (!VAULT_GRAPH_MODES.includes(mode)) return;
      vaultGraphRenderMode = mode;
      syncVaultGraphModeButtons();
      void refreshVaultGraphView();
    });
  });
}

function updateMaterialGraphScreenCopy({ title, hint } = {}) {
  const titleEl = document.getElementById("materialGraphTitle");
  const hintEl = document.getElementById("materialGraphHint");
  if (titleEl && title) titleEl.textContent = title;
  if (hintEl && hint) hintEl.textContent = hint;
}

async function openMaterialGraphScreen({
  backScreen = "blocks",
  session = state.activeSession,
  blockIndex = state.materialGraphContext?.blockIndex,
  conceptInventory = state.materialGraphContext?.conceptInventory,
  mode = "auto",
  title,
  hint,
} = {}) {
  const host = document.getElementById("slowGraphContent");
  if (!host) return;
  materialGraphSource = "session";
  resetVaultGraphChrome();
  materialGraphBackScreen = backScreen;
  updateMaterialGraphScreenCopy({
    title: title || "Material graph",
    hint:
      hint ||
      "Concepts, blocks, and links from your study material.",
  });
  lastMaterialGraph = await mountMaterialGraphScreen(session, host, {
    blockIndex,
    conceptInventory,
    mode,
    onNodeClick: async (node) => {
      if (!node?.sourceAnnotationId || !session?.slow) return;
      const ann = (session.slow.annotations || []).find((a) => a.id === node.sourceAnnotationId);
      if (ann) {
        await storeActiveSession(session);
        initSlowReader(session);
        showScreen("slowReader");
        jumpToAnnotation(session, ann);
      }
    },
  });
  wireMaterialGraphScreen(host, session, {
    onJumpToAnnotation: async (s, ann) => {
      await storeActiveSession(s);
      initSlowReader(s);
      showScreen("slowReader");
      jumpToAnnotation(s, ann);
    },
  });
  if (session) await storeActiveSession(session);
  showScreen("slowGraph");
}

/**
 * Open Knowledge Vault prerequisite graph (Post A+ T12).
 * @param {{ topicFilter?: string }} [options]
 */
export async function openVaultGraphScreen({ topicFilter = "all" } = {}) {
  const host = document.getElementById("slowGraphContent");
  const detailHost = document.getElementById("vaultGraphDetailPanel");
  const layout = document.getElementById("slowGraphLayout");
  if (!host) return;

  const vault = loadVault();
  if ((vault.entries || []).length < VAULT_GRAPH_MIN_ENTRIES) return;

  materialGraphSource = "vault";
  // Topic-picker re-entry calls this while already on slowGraph; keep the real origin.
  if (getCurrentScreenId() !== "slowGraph") {
    materialGraphBackScreen = getCurrentScreenId() || "modeSelect";
  }
  resetVaultGraphChrome();
  layout?.classList.add("vault-graph-active");
  const exportBtn = document.getElementById("slowGraphExportBtn");
  if (exportBtn) exportBtn.hidden = true;

  vaultGraphTopicFilter = topicFilter || "all";
  vaultGraphRenderMode = "node";
  const projects = listProjectsForVaultGraphFilter(loadProjectStore());
  vaultGraphCheckedProjects = new Set(projects.map((p) => p.id));
  wireVaultGraphChromeOnce();
  const chrome = document.getElementById("vaultGraphChrome");
  if (chrome) chrome.hidden = false;
  renderVaultProjectFilterCheckboxes(projects);
  syncVaultGraphModeButtons();

  updateMaterialGraphScreenCopy({
    title: "Knowledge Vault graph",
    hint: "Nodes, timeline, map, or influence tree. Filter by project.",
  });

  if (
    (vault.entries || []).length > VAULT_GRAPH_TOPIC_FILTER_THRESHOLD &&
    (!topicFilter || topicFilter === "all")
  ) {
    if (chrome) chrome.hidden = true;
    renderVaultGraphTopicPicker(host, vault, (topic) => openVaultGraphScreen({ topicFilter: topic }));
    if (detailHost) {
      detailHost.hidden = true;
      detailHost.setAttribute("aria-hidden", "true");
    }
    showScreen("slowGraph");
    return;
  }

  await refreshVaultGraphView();
  showScreen("slowGraph");
}

/**
 * Cross-document concept registry graph (gray/yellow/green maturity).
 * @param {{ focusedDocId?: string|null, projectId?: string|null }} [options]
 */
export async function openConceptRegistryGraphScreen(options = {}) {
  const host = document.getElementById("slowGraphContent");
  const detailHost = document.getElementById("vaultGraphDetailPanel");
  const layout = document.getElementById("slowGraphLayout");
  if (!host) return;

  materialGraphSource = "concept_registry";
  materialGraphBackScreen = getCurrentScreenId() || "vaultBranch";
  resetVaultGraphChrome();
  layout?.classList.add("vault-graph-active");
  const exportBtn = document.getElementById("slowGraphExportBtn");
  if (exportBtn) exportBtn.hidden = true;

  const doc = await getActiveSession();
  const focusedDocId = options.focusedDocId ?? doc?.docId ?? null;

  updateMaterialGraphScreenCopy({
    title: "Concept vault graph",
    hint: focusedDocId
      ? "Yellow/green concepts plus gray neighbors from the active document."
      : "Concepts you have engaged with across all documents.",
  });

  lastMaterialGraph = await mountConceptRegistryGraph(host, detailHost, {
    focusedDocId,
    projectId: options.projectId ?? null,
    onStudyConcept: (globalConceptId) => {
      void enterRecallForGlobalConcept(globalConceptId);
    },
  });
  showScreen("slowGraph");
}

/** Working state for pack concept graph editor (draft only). */
const packConceptEditorState = {
  packId: null,
  sourceDocId: null,
  snapshot: null,
  saver: null,
  edgePickFrom: null,
  linking: false,
  wired: false,
};

function setPackConceptEditorError(message) {
  const el = els.packConceptEditorError;
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function setPackConceptEditorStatus(message) {
  if (els.packConceptEditorStatus) els.packConceptEditorStatus.textContent = message || "";
}

async function persistPackConceptSnapshot(snapshot) {
  if (!packConceptEditorState.packId) return;
  try {
    await updatePackDraftSnapshot(packConceptEditorState.packId, snapshot);
    setPackConceptEditorStatus("Saved");
    setPackConceptEditorError("");
  } catch (err) {
    setPackConceptEditorStatus("Save failed");
    setPackConceptEditorError(String(err?.message || err || "Could not save draft"));
    throw err;
  }
}

function applyPackConceptSnapshot(nextSnapshot) {
  packConceptEditorState.snapshot = nextSnapshot;
  packConceptEditorState.saver?.schedule(nextSnapshot);
  remountPackConceptGraph();
}

function remountPackConceptGraph() {
  const host = els.packConceptGraphMount;
  if (!host || !packConceptEditorState.snapshot) return;
  const canvasGraph = toCanvasGraph(packConceptEditorState.snapshot);
  void mountMaterialGraphScreen(null, host, {
    graph: canvasGraph,
    onNodeClick: (node) => {
      void handlePackConceptNodeClick(node);
    },
    onEdgeClick: (edge) => {
      void handlePackConceptEdgeClick(edge);
    },
  });
}

async function handlePackConceptNodeClick(node) {
  const conceptId = String(node?.id || "").trim();
  if (!conceptId || !packConceptEditorState.snapshot) return;

  if (packConceptEditorState.linking) {
    if (!packConceptEditorState.edgePickFrom) {
      packConceptEditorState.edgePickFrom = conceptId;
      setPackConceptEditorStatus(`From ${conceptId} — click the target concept`);
      setPackConceptEditorError("");
      return;
    }
    const fromId = packConceptEditorState.edgePickFrom;
    packConceptEditorState.edgePickFrom = null;
    packConceptEditorState.linking = false;
    setPackConceptEditorStatus("");
    if (fromId === conceptId) {
      setPackConceptEditorError("Pick a different concept for the relation.");
      return;
    }
    const labels = PACK_EDITOR_EDGE_TYPES.map(
      (t) => `${t} (${PACK_EDITOR_EDGE_LABELS[t] || t})`,
    ).join(", ");
    const raw = window.prompt(`Relation type from ${fromId} → ${conceptId}\nOne of: ${labels}`, "requires");
    if (raw == null) return;
    const type = String(raw).trim().split(/\s+/)[0];
    try {
      applyPackConceptSnapshot(addEdge(packConceptEditorState.snapshot, fromId, conceptId, type));
      setPackConceptEditorError("");
    } catch (err) {
      setPackConceptEditorError(String(err?.message || err));
    }
    return;
  }

  const current =
    packConceptEditorState.snapshot.conceptInventory?.find(
      (c) => String(c?.canonicalId || c?.id || c?.concept_id || "") === conceptId,
    )?.title ||
    node.label ||
    "";
  const action = window.prompt(
    `Rename concept (or type DELETE to remove).\nCurrent: ${current}`,
    current,
  );
  if (action == null) return;
  const trimmed = String(action).trim();
  if (!trimmed) {
    setPackConceptEditorError("Name cannot be empty.");
    return;
  }
  if (trimmed.toUpperCase() === "DELETE") {
    if (!window.confirm(`Delete concept "${current}"? Incident relations will be removed.`)) return;
    // Physical delete; hanging conceptId refs in modes content are an accepted v1 limitation.
    applyPackConceptSnapshot(deleteConcept(packConceptEditorState.snapshot, conceptId));
    return;
  }
  try {
    applyPackConceptSnapshot(renameConcept(packConceptEditorState.snapshot, conceptId, trimmed));
    setPackConceptEditorError("");
  } catch (err) {
    setPackConceptEditorError(String(err?.message || err));
  }
}

async function handlePackConceptEdgeClick(edge) {
  if (!packConceptEditorState.snapshot) return;
  const from = String(edge?.from || "").trim();
  const to = String(edge?.to || "").trim();
  const type = String(edge?.type || "").trim();
  if (!from || !to) return;
  if (!window.confirm(`Remove relation ${from} → ${to} (${type})?`)) return;
  applyPackConceptSnapshot(removeEdge(packConceptEditorState.snapshot, from, to, type));
}

/**
 * Create a pack draft from a library document and open the concept editor.
 * @param {string} docId
 */
export async function enterPackConceptEditorFromDoc(docId) {
  const id = String(docId || "").trim();
  if (!id) return;
  setPackConceptEditorError("");
  setPackConceptEditorStatus("Creating draft…");
  try {
    const ownerUserId = await getAuthUserId();
    const ownerDisplayName = await resolveOwnerDisplayName();
    const draft = await createPackDraft(id, ownerUserId, { ownerDisplayName });
    await enterPackConceptEditor(draft);
  } catch (err) {
    setPackConceptEditorStatus("");
    window.alert(String(err?.message || err || "Could not create pack draft"));
  }
}

/**
 * @param {object} draftRow shared_packs draft row
 */
export async function enterPackConceptEditor(draftRow) {
  if (!draftRow?.id) return;
  if (draftRow.status && draftRow.status !== "draft") {
    window.alert("This pack is already published. Create a new draft to edit.");
    return;
  }
  packConceptEditorState.packId = draftRow.id;
  packConceptEditorState.sourceDocId = draftRow.source_doc_id || null;
  packConceptEditorState.snapshot = draftRow.snapshot || { conceptInventory: [], conceptGraph: { nodes: [], edges: [] } };
  packConceptEditorState.edgePickFrom = null;
  packConceptEditorState.linking = false;
  packConceptEditorState.saver = createDebouncedPackSaver((snap) => persistPackConceptSnapshot(snap));
  if (els.packConceptIncludeSource) els.packConceptIncludeSource.checked = true;
  if (els.packConceptShareCodePanel) els.packConceptShareCodePanel.hidden = true;
  setPackConceptEditorError("");
  setPackConceptEditorStatus("Draft ready");
  remountPackConceptGraph();
  showScreen("packConceptEditor");
  wirePackConceptEditorHandlersOnce();
}

function wirePackConceptEditorHandlersOnce() {
  if (packConceptEditorState.wired) return;
  packConceptEditorState.wired = true;

  els.packConceptEditorBackBtn?.addEventListener("click", async () => {
    try {
      await packConceptEditorState.saver?.flush();
    } catch {
      // keep going back
    }
    enterDocLibraryScreen();
  });

  els.packConceptAddBtn?.addEventListener("click", () => {
    if (!packConceptEditorState.snapshot) return;
    const name = window.prompt("New concept name:");
    if (name == null) return;
    try {
      const { snapshot } = addConcept(packConceptEditorState.snapshot, name);
      applyPackConceptSnapshot(snapshot);
      setPackConceptEditorError("");
    } catch (err) {
      setPackConceptEditorError(String(err?.message || err));
    }
  });

  els.packConceptAddEdgeBtn?.addEventListener("click", () => {
    packConceptEditorState.linking = true;
    packConceptEditorState.edgePickFrom = null;
    setPackConceptEditorError("");
    setPackConceptEditorStatus("Click the first concept, then the second.");
  });

  els.packConceptPublishBtn?.addEventListener("click", () => {
    void publishPackConceptEditor();
  });

  els.packConceptShareCodeCopyBtn?.addEventListener("click", async () => {
    const code = String(els.packConceptShareCodeValue?.textContent || "").trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setPackConceptEditorStatus("Code copied");
    } catch {
      setPackConceptEditorError("Could not copy — select the code manually.");
    }
  });
}

async function publishPackConceptEditor() {
  if (!packConceptEditorState.packId || !packConceptEditorState.snapshot) return;
  setPackConceptEditorError("");
  setPackConceptEditorStatus("Publishing…");
  if (els.packConceptShareCodePanel) els.packConceptShareCodePanel.hidden = true;
  try {
    await packConceptEditorState.saver?.flush();
    const include = Boolean(els.packConceptIncludeSource?.checked);
    const published = await finalizePack(packConceptEditorState.packId, include);
    const code = String(published?.code || "").trim();
    packConceptEditorState.packId = null;
    packConceptEditorState.snapshot = null;
    setPackConceptEditorStatus(code ? "Published" : "Published (no code)");
    if (code && els.packConceptShareCodePanel && els.packConceptShareCodeValue) {
      els.packConceptShareCodeValue.textContent = code;
      els.packConceptShareCodePanel.hidden = false;
      try {
        await navigator.clipboard?.writeText?.(code);
        setPackConceptEditorStatus("Published — code copied");
      } catch {
        // clipboard optional
      }
    } else {
      enterDocLibraryScreen();
    }
  } catch (err) {
    setPackConceptEditorStatus("Publish failed");
    setPackConceptEditorError(String(err?.message || err || "Publish failed"));
  }
}

/**
 * @param {string} globalConceptId
 */
export async function enterRecallForGlobalConcept(globalConceptId) {
  const concept = getConceptById(globalConceptId);
  if (!concept) return;
  const docId = (concept.sourceDocIds || [])[0];
  if (docId) {
    const session = await getSession(docId);
    if (session) {
      await setActiveSession(docId);
      state.activeSession = session;
    }
  }
  recallFocusGlobalConceptId = globalConceptId;
  await enterModeWithContinuity("recall");
}

/** Ephemeral RSVP pre-packing flow state (20260611-rsvp-assessment-reposition). */
let prePackingFlow = null;
/** Persists assessment meta until blocks are confirmed. */
let prePackingDraftMeta = null;

function resetPrePackingFlow() {
  if (prePackingFlow) {
    console.debug("[study.resetPrePackingFlow] Clearing flow:", {
      phase: prePackingFlow.phase,
      hadItemsPromise: Boolean(prePackingFlow.itemsPromise),
      hadPackingPromise: Boolean(prePackingFlow.packingPromise),
    }); // [debug-enrich]
  }
  clearAssessmentChrome();
  prePackingFlow = null;
}

function resolvePrePackingQuestionConfig() {
  let n_test = clampInt(state.nTest, 0, MAX_N_TEST, DEFAULT_N_TEST);
  let n_socratic = clampInt(state.nSocratic, 0, MAX_N_SOCRATIC, DEFAULT_N_SOCRATIC);
  const cap = Math.max(1, Math.floor(Number(ASSESSMENT_FLAGS.ASSESSMENT_ITEMS_MAX) || 23));
  while (n_test + n_socratic > cap && n_socratic > 0) n_socratic -= 1;
  while (n_test + n_socratic > cap && n_test > 0) n_test -= 1;
  return { n_test, n_socratic };
}

/** Stable key for prefetch invalidation (20260616-fix-pregen-assessment). */
export function buildPrefetchConfigKey({
  qCfg,
  conceptInventory,
  cleanedText,
  holisticPlanHash,
}) {
  const ids = (Array.isArray(conceptInventory) ? conceptInventory : [])
    .map((c) => String(c?.id || c?.concept_id || "").trim())
    .filter(Boolean)
    .sort()
    .join(",");
  const len = String(cleanedText ?? "").length;
  const nTest = Math.floor(Number(qCfg?.n_test) || 0);
  const nSocratic = Math.floor(Number(qCfg?.n_socratic) || 0);
  const holistic = holisticPlanHash ? `|${holisticPlanHash}` : "";
  return `${nTest}:${nSocratic}|${ids}|${len}${holistic}`;
}

async function resolveHolisticAssessmentContext(flow) {
  const docId = state.activeDocId || state.activeSession?.docId;
  const doc = docId ? await getSession(docId) : null;
  const conceptGraph = flow?.conceptGraph ?? doc?.shared?.conceptGraph ?? null;
  // ponytail: mini-tree × scoped text for coverage chunking
  const scopedText = resolveScopedMarkdown(doc) || flow?.cleanedText || "";
  const docHierarchy =
    resolveScopedHierarchy(doc) ?? flow?.docHierarchy ?? doc?.shared?.docHierarchy ?? null;
  const inventory = flow?.conceptInventory || [];
  const edges =
    Array.isArray(flow?.edges) && flow.edges.length
      ? flow.edges
      : deriveInventoryEdges(inventory, conceptGraph);
  const budget = computeHolisticAssessmentBudget(inventory, edges);
  const chunks = buildInventoryChunks(docHierarchy, scopedText);

  let plan;
  if (isAdaptiveProbingEnabled()) {
    const adaptive = buildAdaptiveCoveragePlan({
      inventory,
      edges,
      inventoryChunks: chunks,
      rawMarkdown: scopedText,
      budget,
      conceptGraph,
      projectId: doc?.projectId || getUploadDefaultProjectId(),
      docId: doc?.docId || docId || "",
    });
    plan = adaptive?.plan || adaptive;
    if (adaptive?.graph && adaptive?.beliefState) {
      flow.adaptiveProbing = {
        graph: adaptive.graph,
        beliefState: adaptive.beliefState,
        selectedConceptIds: adaptive.selectedConceptIds || [],
        vaultSkippedIds: adaptive.vaultSkippedIds || [],
      };
      await persistAdaptiveBeliefToSession(doc, flow);
    }
  } else {
    plan = buildAssessmentCoveragePlan({
      inventory,
      edges,
      inventoryChunks: chunks,
      rawMarkdown: scopedText,
      budget,
    });
  }
  return { edges, docHierarchy, conceptGraph, budget, plan };
}

async function persistAdaptiveBeliefFromFlow() {
  if (!prePackingFlow?.adaptiveProbing?.beliefState) return;
  const doc = await getActiveSession();
  if (!doc?.shared) return;
  doc.shared.knowledgeBeliefState = { ...prePackingFlow.adaptiveProbing.beliefState };
  await saveDocumentSession(doc);
}

async function persistAdaptiveBeliefToSession(doc, flow) {
  if (!doc?.shared || !flow?.adaptiveProbing?.beliefState) return;
  doc.shared.knowledgeBeliefState = { ...flow.adaptiveProbing.beliefState };
  if (flow.adaptiveProbing.graph?.meta) {
    doc.shared.probeGraphMeta = flow.adaptiveProbing.graph.meta;
  }
  await saveDocumentSession(doc);
}

function createPrePackingItemsPromise(flow) {
  console.debug("[study.createPrePackingItemsPromise] Start:", {
    holistic: isHolisticAssessmentEnabled(),
    inventorySize: flow?.conceptInventory?.length || 0,
    nBlocks: flow?.nBlocks,
    prefetchConfigKey: flow?.prefetchConfigKey || null,
  }); // [debug-enrich]
  if (isHolisticAssessmentEnabled()) {
    return Promise.resolve(resolveHolisticAssessmentContext(flow)).then((ctx) => {
      flow.edges = ctx.edges;
      flow.docHierarchy = ctx.docHierarchy;
      flow.coveragePlan = ctx.plan;
      flow.holisticBudget = ctx.budget;
      const candidateConcepts = resolveAdaptiveCandidateConcepts(flow.conceptInventory, ctx.plan, {
        selectedConceptIds: flow.adaptiveProbing?.selectedConceptIds,
        vaultSkippedIds: flow.adaptiveProbing?.vaultSkippedIds,
      });
      flow.assessedConceptIds = candidateConcepts.map((c) => getConceptId(c)).filter(Boolean);
      return generateHolisticPrePackingAssessmentItems({
        conceptsToAssess: candidateConcepts,
        edges: ctx.edges,
        materialText: flow.cleanedText,
        docHierarchy: ctx.docHierarchy,
        conceptGraph: ctx.conceptGraph,
        plan: ctx.plan,
        onProgress: (msg) => {
          flow.assessmentGenerationStatus = msg;
          if (els.testMeta) els.testMeta.textContent = String(msg || "");
          if (els.generateBlocksStatus) els.generateBlocksStatus.textContent = String(msg || "");
        },
        llmModel: flow.splitOpts?.llmModel,
        language: flow.splitOpts?.language || getStudyLanguage(),
      });
    });
  }

  const qCfg = resolvePrePackingQuestionConfig();
  let inventory = flow.conceptInventory;
  if (isAdaptiveProbingEnabled()) {
    const docId = state.activeDocId || state.activeSession?.docId;
    const filtered = filterInventoryForAdaptiveProbing({
      conceptInventory: flow.conceptInventory,
      conceptGraph: flow.conceptGraph,
      n: qCfg.n_test + qCfg.n_socratic,
      projectId: getUploadDefaultProjectId(),
      docId: docId || "",
    });
    if (filtered.inventory?.length) inventory = filtered.inventory;
    if (filtered.graph && filtered.beliefState) {
      flow.adaptiveProbing = {
        graph: filtered.graph,
        beliefState: filtered.beliefState,
        selectedConceptIds: filtered.selectedConceptIds || [],
        vaultSkippedIds: filtered.vaultSkippedIds || [],
      };
    }
  }
  return generatePrePackingAssessmentItems({
    conceptInventory: inventory,
    edges: flow.edges || [],
    materialText: flow.cleanedText,
    n_test: qCfg.n_test,
    n_socratic: qCfg.n_socratic,
    llmModel: flow.splitOpts?.llmModel,
    language: flow.splitOpts?.language || getStudyLanguage(),
  });
}

function getCurrentPrefetchConfigKey(flow) {
  if (isHolisticAssessmentEnabled()) {
    const inventory = flow.conceptInventory || [];
    const edges =
      Array.isArray(flow.edges) && flow.edges.length
        ? flow.edges
        : deriveInventoryEdges(inventory, flow.conceptGraph);
    const budget = computeHolisticAssessmentBudget(inventory, edges);
    // ponytail: flow.docHierarchy set via resolveScopedHierarchy at gate entry
    const chunks = buildInventoryChunks(flow.docHierarchy, flow.cleanedText || "");
    let plan = flow.coveragePlan;
    if (!plan) {
      if (isAdaptiveProbingEnabled()) {
        const adaptive = buildAdaptiveCoveragePlan({
          inventory,
          edges,
          inventoryChunks: chunks,
          rawMarkdown: flow.cleanedText || "",
          budget,
          conceptGraph: flow.conceptGraph,
          projectId: getUploadDefaultProjectId(),
          docId: state.activeDocId || "",
        });
        plan = adaptive?.plan || adaptive;
      } else {
        plan = buildAssessmentCoveragePlan({
          inventory,
          edges,
          inventoryChunks: chunks,
          rawMarkdown: flow.cleanedText || "",
          budget,
        });
      }
    }
    const adaptiveSuffix = flow.adaptiveProbing?.selectedConceptIds?.length
      ? `|adp:${flow.adaptiveProbing.selectedConceptIds.join(",")}`
      : plan?.adaptiveProbing?.selectedConceptIds?.length
        ? `|adp:${plan.adaptiveProbing.selectedConceptIds.join(",")}`
        : "";
    return buildPrefetchConfigKey({
      qCfg: budget,
      conceptInventory: flow.conceptInventory,
      cleanedText: flow.cleanedText,
      holisticPlanHash: `${plan?.planHash || hashCoveragePlan(plan)}${adaptiveSuffix}|cov2`,
    });
  }
  const qCfg = resolvePrePackingQuestionConfig();
  const adaptiveSuffix = flow.adaptiveProbing?.selectedConceptIds?.length
    ? `|adp:${flow.adaptiveProbing.selectedConceptIds.join(",")}`
    : "";
  return `${buildPrefetchConfigKey({
    qCfg,
    conceptInventory: flow.conceptInventory,
    cleanedText: flow.cleanedText,
  })}${adaptiveSuffix}`;
}

function ensurePrePackingItemsPromise(flow) {
  const currentKey = getCurrentPrefetchConfigKey(flow);
  if (!flow.itemsPromise || flow.prefetchConfigKey !== currentKey) {
    flow.prefetchConfigKey = currentKey;
    flow.itemsPromise = createPrePackingItemsPromise(flow);
  }
  return flow.itemsPromise;
}

function isPrePackingAssessmentRunner() {
  return prePackingFlow?.runnerMode === "assessment";
}

function ensureAssessmentTestQuestionShuffled(block, q) {
  if (!q || !block || String(q.type || "").trim().toLowerCase() !== "test") return q;
  if (q._optionsShuffled) return q;
  const shuffled = shuffleTestQuestionOptions(q);
  const qs = Array.isArray(block.questions) ? block.questions : null;
  if (qs) {
    const i = qs.indexOf(q);
    if (i >= 0) qs[i] = shuffled;
  }
  return shuffled;
}

function getAssessmentQuestionContext() {
  const block = prePackingFlow?.assessmentBlock;
  const { testQs, socQs, allQs } = getBlockOrderedQuestions(block);
  const total = allQs.length;
  const globalIndex = Math.max(0, Math.floor(Number(prePackingFlow?.assessmentQuestionIndex) || 0));
  const rawQ = allQs[globalIndex] || null;
  const q = block && rawQ ? ensureAssessmentTestQuestionShuffled(block, rawQ) : rawQ;
  const type = q && typeof q === "object" ? String(q.type || "") : "";
  const phase = type === "socratic" ? "Socratic" : "Test";
  const localIndex = type === "socratic" ? Math.max(0, globalIndex - testQs.length) : globalIndex;
  return { block, testQs, socQs, allQs, total, globalIndex, localIndex, type, phase, q };
}

function renderAssessmentChrome() {
  document.body.classList.add("assessment-runner-active", "assessment-active");
  setBlockReadSidebarAvailable(false);
  syncFloatingChrome();
  if (els.testAssessmentChrome) els.testAssessmentChrome.hidden = false;
  if (els.socraticAssessmentChrome) els.socraticAssessmentChrome.hidden = false;
  if (els.testRestartBlockBtn) els.testRestartBlockBtn.hidden = true;
  if (els.testRsvpView) els.testRsvpView.hidden = true;
  if (els.testQaView) els.testQaView.hidden = false;
}

function clearAssessmentChrome() {
  document.body.classList.remove("assessment-runner-active", "assessment-active");
  syncFloatingChrome();
  if (els.testAssessmentChrome) els.testAssessmentChrome.hidden = true;
  if (els.socraticAssessmentChrome) els.socraticAssessmentChrome.hidden = true;
  if (els.testRestartBlockBtn) els.testRestartBlockBtn.hidden = false;
}

function stashPrePackingDraftMeta() {
  if (!prePackingFlow) return;
  prePackingDraftMeta = {
    knowledgeProfile: prePackingFlow.knowledgeProfile || null,
    assessmentSkipped: Boolean(prePackingFlow.assessmentSkipped),
    packingIgnoredProfile: Boolean(prePackingFlow.packingIgnoredProfile),
  };
}

function countProfileMastery(profile) {
  if (profile?.byConceptId && typeof profile.byConceptId === "object") {
    const entries = Object.values(profile.byConceptId);
    const assessed = entries.filter((e) => e?.assessed);
    return {
      full: assessed.filter((e) => e.correct).length,
      partial: 0,
      none:
        assessed.filter((e) => !e.correct).length +
        entries.filter((e) => !e?.assessed).length,
    };
  }
  const threshold = ASSESSMENT_FLAGS.ASSESSMENT_MASTERY_THRESHOLD;
  const items = Array.isArray(profile?.items) ? profile.items : [];
  let full = 0;
  let partial = 0;
  let none = 0;
  for (const item of items) {
    if (item?.mastery === "full" && Number(item.confidence) > threshold) full += 1;
    else if (item?.mastery === "partial") partial += 1;
    else none += 1;
  }
  return { full, partial, none };
}

function applyPackedBlocksToEditor(packed, conceptInventory) {
  const finalIndex = packed.blockIndex;
  const splitRunMeta = packed.splitRunMeta;
  const inventory = conceptInventory || packed.conceptInventory || [];
  // [debug-enrich]
  console.info('[study.applyPackedBlocksToEditor] Applying packed blocks to editor:', {
    blockCount: Array.isArray(finalIndex) ? finalIndex.length : null,
    inventoryCount: Array.isArray(inventory) ? inventory.length : 0,
    pipeline: splitRunMeta?.pipeline ?? null,
    packFallback: splitRunMeta?.pack_fallback_reason ?? null,
    hasPacked: Boolean(packed),
  });
  if (!Array.isArray(finalIndex) || !finalIndex.length) {
    // [debug-enrich]
    console.warn('[study.applyPackedBlocksToEditor] Empty or missing blockIndex — editor may be blank');
  }
  state.lastBlockIndex = finalIndex;
  state.lastNBlocks = finalIndex.length;
  window.blockIndex = finalIndex;
  window.indexWasImported = false;
  promoteConceptInventoryToShared(inventory, "rsvp");
  renderSplitMergeSummary(splitRunMeta);
  renderBlocksGraphActions(finalIndex, inventory);
  renderBlockIndexEditor(finalIndex, { readOnly: false });
  setBlocksListJsonCache(formatBlockIndexForConfirmation(finalIndex));
  showScreen("blocks");
  // [debug-enrich]
  console.debug('[study.applyPackedBlocksToEditor] Blocks screen shown');
}

function renderPrePackingAssessmentGraph(inventory) {
  const host = els.prePackingAssessmentGraph;
  if (!host) return;
  const graph = buildRsvpMaterialGraph({
    conceptInventory: inventory,
    blockIndex: [],
  });
  state.materialGraphContext = {
    blockIndex: [],
    conceptInventory: Array.isArray(inventory) ? inventory : [],
  };
  host.textContent = `${graph.nodes.length} concepts · ${graph.edges.length} relations`;
}

function recordAssessmentResponse(row) {
  if (!prePackingFlow) return;
  const responses = Array.isArray(prePackingFlow.assessmentResponses)
    ? prePackingFlow.assessmentResponses
    : [];
  const itemId = String(row?.item_id || "").trim();
  const existing = responses.findIndex((r) => String(r?.item_id || "") === itemId);
  if (existing >= 0) responses[existing] = row;
  else responses.push(row);
  prePackingFlow.assessmentResponses = responses;
}

function handleAssessmentTestAnswer({ chosen, correct, feedback }) {
  const btns = Array.from(els.testOptions.querySelectorAll("button"));
  for (const b of btns) b.disabled = true;

  const ctx = getActiveQuestionContext();
  const q = ctx.q;
  const optText = q?.options && q.options[chosen] != null ? String(q.options[chosen]) : "";
  const userAnswer = optText ? `${chosen}. ${optText}` : String(chosen || "");

  recordAssessmentResponse({
    item_id: String(q?.item_id || `test_${ctx.globalIndex}`),
    questionType: "test",
    userAnswer,
    correctAnswer: String(correct || ""),
    concept_id: String(q?.concept_id || ""),
    questionText: q?.question != null ? String(q.question) : "",
  });
  applyAdaptiveBeliefUpdate(prePackingFlow, q, userAnswer);
  persistAdaptiveBeliefFromFlow().catch(() => {});
  const earlyStop = shouldEarlyStopAdaptiveAssessment(prePackingFlow);
  if (earlyStop) prePackingFlow.adaptiveEarlyStop = true;

  const normalizedChosen = String(chosen || "").trim().toUpperCase();
  const normalizedCorrect = String(correct || "").trim().toUpperCase();
  const chosenBtn = btns.find((b) => b.dataset.letter === normalizedChosen);
  if (chosenBtn) {
    chosenBtn.classList.add(normalizedChosen === normalizedCorrect ? "is-correct" : "is-wrong");
  }
  if (normalizedChosen !== normalizedCorrect) {
    const correctBtn = btns.find((b) => b.dataset.letter === normalizedCorrect);
    if (correctBtn) correctBtn.classList.add("is-correct-soft");
  }

  els.testFeedback.hidden = false;
  void renderMarkdown(els.testFeedback, feedback || "");

  const isLastGlobal = earlyStop || ctx.globalIndex >= ctx.total - 1;
  els.testNextBtn.hidden = false;
  els.testNextBtn.textContent = isLastGlobal ? "Finish assessment" : "Next";

  els.testNextBtn.onclick = () => {
    if (!isLastGlobal) {
      prePackingFlow.assessmentQuestionIndex = ctx.globalIndex + 1;
      const nextCtx = getActiveQuestionContext();
      if (nextCtx.type === "socratic") {
        showScreen("socratic");
        renderSocraticQuestion();
      } else {
        renderTestQuestion();
      }
      return;
    }
    void finishPrePackingAssessment();
  };
}

function handleAssessmentSocraticSubmit(answerText) {
  const ctx = getActiveQuestionContext();
  const q = ctx.q;
  if (!q) return;

  recordAssessmentResponse({
    item_id: String(q?.item_id || `soc_${ctx.globalIndex}`),
    questionType: "socratic",
    userAnswer: answerText,
    concept_id: String(q?.concept_id || ""),
    questionText: String(q.question || ""),
  });

  els.socraticResponseBox.hidden = false;
  els.socraticResponseBox.textContent = "Answer recorded.";

  const isLastQuestion = ctx.globalIndex >= ctx.total - 1;
  if (!isLastQuestion) {
    els.socraticNextQuestionBtn.hidden = false;
  } else {
    els.socraticNextBlockBtn.hidden = false;
    els.socraticNextBlockBtn.textContent = "Finish assessment";
  }
}

function showPrePackingAssessmentGenerationFailure(err) {
  if (!prePackingFlow) return;
  console.error("[assessment] Error:", err);
  prePackingFlow.assessmentGenerationError = err?.message
    ? String(err.message)
    : "Could not load knowledge check questions.";
  prePackingFlow.itemsPromise = null;

  if (els.testHeader) els.testHeader.textContent = "Document knowledge check";
  showScreen("test");
  renderAssessmentChrome();
  if (els.testQaView) els.testQaView.hidden = true;
  if (els.testRsvpView) els.testRsvpView.hidden = true;
  els.testNextBtn.hidden = true;
  els.testOptions.innerHTML = "";
  clearMarkdownContainer(els.testQuestionText);
  els.testFeedback.hidden = true;
  clearMarkdownContainer(els.testFeedback);

  setTestError(
    err?.message ? String(err.message) : "Could not load knowledge check questions.",
  );
  if (els.assessmentRunnerRetry) els.assessmentRunnerRetry.hidden = false;
}

function clearPrePackingAssessmentGenerationFailure() {
  if (prePackingFlow) prePackingFlow.assessmentGenerationError = null;
  if (els.assessmentRunnerRetry) els.assessmentRunnerRetry.hidden = true;
}

async function retryPrePackingAssessmentGeneration() {
  if (!prePackingFlow) return;
  clearPrePackingAssessmentGenerationFailure();
  clearTestError();
  prePackingFlow.itemsPromise = null;
  prePackingFlow.prefetchConfigKey = null;
  await enterPrePackingAssessmentRunner();
}

async function enterPrePackingAssessmentRunner() {
  if (!prePackingFlow) return;
  const holistic = isHolisticAssessmentEnabled();
  const qCfg = holistic
    ? (await resolveHolisticAssessmentContext(prePackingFlow)).budget
    : resolvePrePackingQuestionConfig();
  // fromSharedGate fix (20260711-adaptive-prepacking-activation):
  // startSharedAssessmentFromGate sets runnerMode "shared_gate", but this runner
  // must use runnerMode "assessment" so isPrePackingAssessmentRunner() / questions UI work.
  // Without stashing fromSharedGate, finish/skip never call completeSharedAssessmentGate
  // and the shared knowledge profile is lost (falls through to RSVP packing path).
  if (prePackingFlow.runnerMode === "shared_gate") prePackingFlow.fromSharedGate = true;
  prePackingFlow.runnerMode = "assessment";
  prePackingFlow.assessmentQuestionIndex = 0;
  prePackingFlow.assessmentResponses = [];

  clearPrePackingAssessmentGenerationFailure();
  clearTestError();
  els.testFeedback.hidden = true;
  clearMarkdownContainer(els.testFeedback);
  els.testNextBtn.hidden = true;
  els.testOptions.innerHTML = "";
  clearMarkdownContainer(els.testQuestionText);

  try {
    ensurePrePackingItemsPromise(prePackingFlow);
    const items = await prePackingFlow.itemsPromise;
    const questions = Array.isArray(items) ? items : [];
    if (!questions.length) {
      prePackingFlow.itemsPromise = null;
      throw new Error("Could not generate assessment items.");
    }

    prePackingFlow.assessmentItems = questions;
    prePackingFlow.assessmentBlock = {
      id: 0,
      title: "Document knowledge check",
      explanation: "",
      questions,
      _config: { n_test: qCfg.n_test, n_socratic: qCfg.n_socratic },
    };

    if (els.testHeader) els.testHeader.textContent = "Document knowledge check";
    showScreen("test");
    renderAssessmentChrome();
    showTestQuestions();
    renderTestQuestion();
  } catch (err) {
    console.error("[assessment] Error:", err);
    showPrePackingAssessmentGenerationFailure(err);
  }
}

function renderPrePackingAssessmentQuestion() {
  if (!prePackingFlow) return;
  const items = prePackingFlow.assessmentItems || [];
  const idx = prePackingFlow.questionIndex || 0;
  const item = items[idx];
  if (!item) return;

  if (els.prePackingAssessmentProgress) {
    els.prePackingAssessmentProgress.textContent = `Question ${idx + 1} of ${items.length}`;
  }
  if (els.prePackingAssessmentQuestion) {
    const conceptId = String(item.concept_id || "").trim();
    const presumed = Boolean(prePackingFlow.vaultPresumedKnown?.[conceptId]);
    els.prePackingAssessmentQuestion.textContent = String(item.question || "");
    const existingBadge = els.prePackingAssessmentQuestion.querySelector(".pre-packing-presumed-badge");
    if (existingBadge) existingBadge.remove();
    if (presumed) {
      const badge = document.createElement("span");
      badge.className = "pre-packing-presumed-badge";
      badge.textContent = "✓ Presumed known (override below)";
      els.prePackingAssessmentQuestion.appendChild(badge);
    }
  }
  const optionsHost = els.prePackingAssessmentOptions;
  if (!optionsHost) return;
  optionsHost.innerHTML = "";
  const groupName = "prePackingAssessmentOption";
  const conceptId = String(item.concept_id || "").trim();
  const presumed = Boolean(prePackingFlow.vaultPresumedKnown?.[conceptId]);
  const options = [...(item.options || [])];
  if (presumed) options.unshift(PREPACKING_ALREADY_KNOW_ANSWER);
  options.push(PREPACKING_DONT_KNOW_ANSWER);
  const saved = prePackingFlow.responses?.find((r) => r.item_id === item.item_id)?.answer;
  for (const opt of options) {
    const label = document.createElement("label");
    label.className = "pre-packing-assessment-option";
    if (opt === PREPACKING_ALREADY_KNOW_ANSWER) label.classList.add("is-presumed-known");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = groupName;
    input.value = opt;
    if (saved === opt) input.checked = true;
    label.appendChild(input);
    const span = document.createElement("span");
    span.textContent = opt;
    label.appendChild(span);
    optionsHost.appendChild(label);
  }
  if (els.prePackingAssessmentNext) {
    els.prePackingAssessmentNext.textContent =
      idx >= items.length - 1 ? "Finish" : "Next";
  }
}

async function enterPrePackingAssessmentScreen() {
  if (!prePackingFlow) return;
  if (isAssessmentQuestionsUiEnabled()) {
    await enterPrePackingAssessmentRunner();
    return;
  }
  renderPrePackingAssessmentGraph(prePackingFlow.conceptInventory);
  prePackingFlow.questionIndex = 0;
  prePackingFlow.responses = [];
  if (els.prePackingAssessmentError) {
    els.prePackingAssessmentError.hidden = true;
    els.prePackingAssessmentError.textContent = "";
  }
  if (els.prePackingAssessmentStatus) {
    els.prePackingAssessmentStatus.textContent = "Loading questions…";
  }
  showScreen("prePackingAssessment");

  try {
    ensurePrePackingItemsPromise(prePackingFlow);
    const items = await prePackingFlow.itemsPromise;
    prePackingFlow.assessmentItems = Array.isArray(items) ? items : [];
    const doc = await getActiveSession();
    prePackingFlow.vaultPresumedKnown = buildVaultPresumedKnownMap(
      prePackingFlow.conceptInventory,
      doc?.shared?.docTopics || [],
    );
    if (!prePackingFlow.assessmentItems.length) {
      prePackingFlow.itemsPromise = null;
      console.info("[study] No assessment questions generated — skipping to pack with neutral weights");
      if (els.prePackingAssessmentStatus) els.prePackingAssessmentStatus.textContent = "";
      await handlePrePackingSkip();
      return;
    }
    if (els.prePackingAssessmentStatus) els.prePackingAssessmentStatus.textContent = "";
    renderPrePackingAssessmentQuestion();
  } catch (err) {
    console.error("[assessment] Error:", err);
    if (els.prePackingAssessmentError) {
      els.prePackingAssessmentError.hidden = false;
      els.prePackingAssessmentError.textContent = "Could not load knowledge check questions.";
    }
    if (els.prePackingAssessmentStatus) {
      els.prePackingAssessmentStatus.textContent = "";
    }
    prePackingFlow.itemsPromise = null;
    prePackingFlow.assessmentGenerationError = err?.message
      ? String(err.message)
      : "Could not load knowledge check questions.";
  }
}

async function handlePrePackingSkip() {
  if (!prePackingFlow) {
    // [debug-enrich]
    console.warn("[study.handlePrePackingSkip] No prePackingFlow — noop");
    return;
  }
  if (prePackingFlow.runnerMode === "shared_gate" || prePackingFlow.fromSharedGate) {
    // [debug-enrich]
    console.info("[study.handlePrePackingSkip] Shared gate assessment skipped");
    await completeSharedAssessmentGate({ outcome: "skipped", profile: null });
    return;
  }
  // Legacy non-shared-gate pack-on-skip path removed (unreachable under current UI).
  console.warn("[study.handlePrePackingSkip] Non-shared-gate skip ignored (dead path removed)");
}

function collectCurrentPrePackingAnswer() {
  const selected = document.querySelector(
    '#prePackingAssessmentOptions input[type="radio"]:checked',
  );
  return selected ? String(selected.value || "") : "";
}

async function advancePrePackingAssessment() {
  if (!prePackingFlow) return;
  const items = prePackingFlow.assessmentItems || [];
  const idx = prePackingFlow.questionIndex || 0;
  const item = items[idx];
  if (!item) return;

  const answer = collectCurrentPrePackingAnswer();
  if (!answer) {
    if (els.prePackingAssessmentError) {
      els.prePackingAssessmentError.hidden = false;
      els.prePackingAssessmentError.textContent = "Select an option to continue.";
    }
    return;
  }
  if (els.prePackingAssessmentError) {
    els.prePackingAssessmentError.hidden = true;
    els.prePackingAssessmentError.textContent = "";
  }

  const responses = Array.isArray(prePackingFlow.responses) ? prePackingFlow.responses : [];
  const existing = responses.findIndex((r) => r.item_id === item.item_id);
  const row = { item_id: item.item_id, answer };
  if (existing >= 0) responses[existing] = row;
  else responses.push(row);
  prePackingFlow.responses = responses;
  applyAdaptiveBeliefUpdate(prePackingFlow, item, answer);
  persistAdaptiveBeliefFromFlow().catch(() => {});

  const earlyStop = shouldEarlyStopAdaptiveAssessment(prePackingFlow);
  if (earlyStop) prePackingFlow.adaptiveEarlyStop = true;

  if (!earlyStop && idx < items.length - 1) {
    prePackingFlow.questionIndex = idx + 1;
    renderPrePackingAssessmentQuestion();
    return;
  }

  await finishPrePackingAssessment();
}

async function finishPrePackingAssessment() {
  if (!prePackingFlow) return;
  console.info("[study.finishPrePackingAssessment] Start:", {
    runnerMode: prePackingFlow.runnerMode,
    responseCount: (prePackingFlow.assessmentResponses || prePackingFlow.responses || []).length,
    hasParallelPack: Boolean(ASSESSMENT_FLAGS.ASSESSMENT_PARALLEL_PACKING),
  }); // [debug-enrich]
  clearAssessmentChrome();
  if (els.prePackingAssessmentStatus) {
    els.prePackingAssessmentStatus.textContent = "Evaluating responses…";
  }
  if (els.prePackingAssessmentNext) els.prePackingAssessmentNext.disabled = true;

  const assessmentItems =
    prePackingFlow.assessmentBlock?.questions || prePackingFlow.assessmentItems || [];
  const assessmentResponses = isPrePackingAssessmentRunner()
    ? prePackingFlow.assessmentResponses
    : prePackingFlow.responses;

  if (prePackingFlow.vaultPresumedKnown) {
    recordVaultAssessmentContradictions(
      assessmentItems,
      assessmentResponses,
      prePackingFlow.vaultPresumedKnown,
    );
  }

  const profile = enrichKnowledgeProfileWithAdaptiveStatuses(
    await evaluatePrePackingAssessmentResponses({
      items: assessmentItems,
      responses: assessmentResponses,
      conceptInventory: prePackingFlow.conceptInventory,
      llmModel: prePackingFlow.splitOpts?.llmModel,
      language: prePackingFlow.splitOpts?.language || getStudyLanguage(),
    }),
    prePackingFlow,
  );

  prePackingFlow.knowledgeProfile = profile;
  prePackingFlow.assessmentSkipped = false;
  prePackingFlow.packingIgnoredProfile = false;
  console.debug("[study.finishPrePackingAssessment] Profile evaluated:", {
    hasProfile: Boolean(profile),
    masteryCounts: countProfileMastery(profile),
    adaptiveEarlyStop: Boolean(prePackingFlow.adaptiveEarlyStop),
  }); // [debug-enrich]

  if (prePackingFlow.runnerMode === "shared_gate" || prePackingFlow.fromSharedGate) {
    console.info("[study.finishPrePackingAssessment] Completing shared gate with accepted outcome", {
      hasProfile: Boolean(profile),
    }); // [debug-enrich]
    await completeSharedAssessmentGate({ outcome: "accepted", profile });
    return;
  }

  // Legacy non-shared-gate pack/results path removed (unreachable under current UI).
  console.warn("[study.finishPrePackingAssessment] Non-shared-gate finish ignored (dead path removed)");
  if (els.prePackingAssessmentNext) els.prePackingAssessmentNext.disabled = false;
}

function renderBlocksGraphActions(blockIndex, conceptInventory = []) {
  const host = document.getElementById("blocksGraphActions");
  if (!host) return;
  const blocks = Array.isArray(blockIndex) ? blockIndex : [];
  const inventory = Array.isArray(conceptInventory) ? conceptInventory : [];
  if (!blocks.length && !inventory.length) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }
  const graph = buildRsvpMaterialGraph({ conceptInventory: inventory, blockIndex: blocks });
  state.materialGraphContext = {
    blockIndex: blocks,
    conceptInventory: Array.isArray(conceptInventory) ? conceptInventory : [],
  };
  const lang = getStudyLanguage() || "English";
  const es = String(lang).toLowerCase().startsWith("es");
  host.hidden = false;
  host.innerHTML = `
    ${renderGraphUnlockButtonHtml(lang, { id: "blocksMaterialGraphBtn" })}
    <span class="hint">${es ? `${graph.nodes.length} nodos · ${graph.edges.length} enlaces` : `${graph.nodes.length} nodes · ${graph.edges.length} edges`}</span>`;
}

async function renderSlowPhase0GraphActions(session) {
  const host = document.getElementById("slowPhase0GraphActions");
  if (!host || !session?.slow?.phase0) {
    if (host) {
      host.hidden = true;
      host.innerHTML = "";
    }
    return;
  }
  const graph = await buildSessionGraph(session, { mode: "slow_phase0" });
  const lang = getStudyLanguage() || "English";
  const es = String(lang).toLowerCase().startsWith("es");
  host.hidden = false;
  host.innerHTML = `
    ${renderGraphUnlockButtonHtml(lang, { id: "slowPhase0GraphBtn" })}
    <span class="hint">${es ? "Vista previa del mapa argumental" : "Argument map preview"} — ${graph.nodes.length} nodes</span>`;
}

function wireMaterialGraphHandlers() {
  document.getElementById("blocksGraphActions")?.addEventListener("click", (e) => {
    if (!e.target?.closest("#blocksMaterialGraphBtn")) return;
    openMaterialGraphScreen({
      backScreen: "blocks",
      session: state.activeSession,
      mode: "rsvp",
      title: "Concept graph",
      hint: "How concepts connect and which blocks cover them.",
    });
  });

  document.getElementById("slowPhase0GraphActions")?.addEventListener("click", (e) => {
    if (!e.target?.closest("#slowPhase0GraphBtn")) return;
    openMaterialGraphScreen({
      backScreen: "slowPhase0",
      session: state.activeSession,
      mode: "slow_phase0",
      title: "Orientation graph",
      hint: "Argument map and concepts to track while reading.",
    });
  });

  document.getElementById("slowPhase3GraphActions")?.addEventListener("click", (e) => {
    if (!e.target?.closest("#slowPhase3GraphBtn")) return;
    openMaterialGraphScreen({
      backScreen: "slowPhase3",
      session: state.activeSession,
      mode: "slow_enriched",
      title: "Enriched graph",
      hint: "Your annotations linked to concepts and argument nodes.",
    });
  });

  document.getElementById("slowPhase3Content")?.addEventListener("click", (e) => {
    if (!e.target?.closest("#slowPhase3ModuleCGraphBtn")) return;
    openMaterialGraphScreen({
      backScreen: "slowPhase3",
      session: state.activeSession,
      mode: "slow_enriched",
      title: "Enriched graph",
      hint: "Your annotations linked to concepts and argument nodes.",
    });
  });

  document.getElementById("slowGraphBackBtn")?.addEventListener("click", () => {
    if (materialGraphSource === "vault") resetVaultGraphChrome();
    showScreen(materialGraphBackScreen || "blocks");
  });

  document.getElementById("slowGraphExportBtn")?.addEventListener("click", () => {
    void (async () => {
      const session = state.activeSession;
      const host = document.getElementById("slowGraphContent");
      const graph =
        lastMaterialGraph ||
        (await mountMaterialGraphScreen(session, host, {
          blockIndex: state.materialGraphContext?.blockIndex,
          conceptInventory: state.materialGraphContext?.conceptInventory,
          mode: "auto",
        }));
      if (!graph) return;
      const lang = getStudyLanguage() || "English";
      const md = buildGraphSubgraphMarkdown(graph, lang);
      const stem = String(
        session?.materialMeta?.fileName || session?._meta?.source_files?.[0]?.name || "material-graph",
      ).replace(/\.[^.]+$/, "");
      downloadTextFile({
        filename: `${stem}_graph_${Date.now()}.md`,
        text: md,
      });
    })();
  });
}

async function wireSlowPhase3Handlers() {
  document.getElementById("slowPhase3BackBtn")?.addEventListener("click", async () => {
    const session = state.activeSession;
    if (!session?.slow) return;
    session.slow.phase = "phase1";
    await storeActiveSession(session);
    // End this Phase 3 visit so Complete regenerates; graph round-trips keep DOM.
    clearPhase3ScreenContent();
    initSlowReader(session);
    showScreen("slowReader");
  });

  document.getElementById("slowPhase3FinishBtn")?.addEventListener("click", async () => {
    const session = state.activeSession;
    if (!session?.slow) return;
    session.slow.depthScore = computeDepthScore(session.slow.annotations, {
      criticalMode: Boolean(session.slow.criticalMode),
    });
    session.slow.phase = "complete";
    session.slow.graphEnrichedUnlocked = true;
    await storeActiveSession(session);
    clearPhase3ScreenContent();
    void exportSessionMarkdown();
    enterRetrievalHub({ entrySource: "exposure_complete" });
  });

  // Sole Phase 3 init path: Complete, resume (navigateSlowByPhase), and graph return
  // all flip aria-hidden via showScreen — initPhase3Screen guards against re-generation.
  const observer = new MutationObserver(async () => {
    if (els.screenSlowPhase3?.getAttribute("aria-hidden") === "false") {
      const session = state.activeSession;
      if (session?.slow) {
        await storeActiveSession(session);
        void initPhase3Screen(
          session,
          document.getElementById("slowPhase3Content"),
          document.getElementById("slowPhase3Modules"),
          document.getElementById("slowPhase3Score"),
        );
      }
    }
  });
  if (els.screenSlowPhase3) {
    observer.observe(els.screenSlowPhase3, { attributes: true, attributeFilter: ["aria-hidden"] });
  }
}

export async function wireStudyHandlers() {
  registerChromeStudyModeResolver(() =>
    normalizeStudyMode(state.studyMode || state.activeSession?.studyMode),
  );
  registerChromeHasConceptsResolver(() => getSortedSessionConcepts().length > 0);
  registerDictionaryChromeSyncHook(() => syncFloatingChrome());
  initMnemonicChrome({
    resolveActiveConceptIds: resolveMnemonicActiveConceptIds,
    resolveStudyMode: () => {
      const screenId = getCurrentScreenId();
      if (screenId === "review") return "review";
      if (screenId === "clozeStudy") return "cloze";
      if (screenId === "recall") return "recall";
      if (screenId === "slowReader") return "slow";
      const mode = normalizeStudyMode(state.studyMode || state.activeSession?.studyMode || "rsvp");
      return mode === "questions" ? "questions" : mode === "rsvp" ? "rsvp" : mode;
    },
    resolveScreenId: getCurrentScreenId,
  });
  setSlowSessionGetter(() => state.activeSession);
  wireStudyModeSelector();
  els.modeSelectRetryPreparationBtn?.addEventListener("click", () => {
    void handleRetryPreparationClick();
  });
  els.generateBlocksRetryPreparationBtn?.addEventListener("click", () => {
    void handleRetryPreparationClick();
  });
  els.modeSelectBackBtn?.addEventListener("click", () => enterAppHome());
  wireScopeSelectionHandlers();
  wireOnboardingQuestionnaireHandlers();
  wireSlowPhase0Handlers();
  wireSlowPhase3Handlers();
  wireMaterialGraphHandlers();
  wireClozeStudyHandlers();
  setClozeStudyCompleteExitHandler(() => enterModeSelectScreen());
  els.clozeGenerateBtn?.addEventListener("click", () => {
    const session = state.activeSession;
    if (session?.studyMode === "cloze") void runClozeGeneration(session);
  });
  els.clozeStudyBtn?.addEventListener("click", async () => {
    const session = state.activeSession;
    if (session?.studyMode === "cloze") enterClozeStudyScreen(session, await getActiveSession());
  });
  els.clozeViewGraphBtn?.addEventListener("click", () => {
    const session = state.activeSession;
    if (session?.studyMode === "cloze") mountClozeGraph(session);
  });
  els.clozeExportBtn?.addEventListener("click", () => {
    const session = state.activeSession;
    if (session?.studyMode === "cloze") exportClozeItemsMarkdown(session);
  });
  resetCreateScreenModeUi();
  renderFlowPanel(await getActiveSession());

  setBlockReadContentProvider(() => {
    const blocks = getBlocksSafe();
    const block = blocks[state.activeBlockIndex];
    return {
      title: getBlockTitleSafe(state.activeBlockIndex),
      explanation: String(block?.explanation || ""),
    };
  });
  const defaults = loadDefaultQuestionConfig();
  state.nTest = clampInt(defaults.n_test, 0, MAX_N_TEST, DEFAULT_N_TEST);
  state.nSocratic = clampInt(defaults.n_socratic, 0, MAX_N_SOCRATIC, DEFAULT_N_SOCRATIC);
  renderQuestionConfigUi();

  syncSourceFidelityStrictUi(state.sourceFidelityStrict === true);

  function goAfterBlocksConfirmed(nBlocks) {
    goToSessionReady(nBlocks);
  }

  function goToSessionReady(nBlocks) {
    const n = Math.max(1, Math.floor(Number(nBlocks) || 1));
    // [debug-enrich]
    console.info('[study.goToSessionReady] Showing session ready:', {
      nBlocksRequested: nBlocks,
      nBlocksResolved: n,
      studyMode: state.studyMode ?? null,
      docId: state.activeSession?.docId ?? null,
    });
    setFullPackEntryCta(n);
    if (els.sessionReadyMeta) {
      els.sessionReadyMeta.textContent = `Session ready. Blocks: ${n}`;
    }
    showScreen("ready");
  }

  async function startStudyingNow() {
    // [debug-enrich]
    console.info('[study.startStudyingNow] Start studying clicked:', {
      studyModeRadio: getSelectedStudyModeRadio(),
      stateStudyMode: state.studyMode ?? null,
    });
    els.startStudyingError.hidden = true;
    els.startStudyingError.textContent = "";
    els.startStudyingStatus.textContent = "";

    const studyMode = normalizeStudyMode(state.studyMode || getSelectedStudyModeRadio());
    await applyFlowRecommendationOnEnterMode(studyMode);
    state.activeSession = await loadActiveSession();
    if (!state.activeSession) {
      // [debug-enrich]
      console.error('[study.startStudyingNow] No active session — returning to create');
      els.startStudyingError.hidden = false;
      els.startStudyingError.textContent = "No saved session found. Generate blocks first.";
      returnToCreateScreen();
      return;
    }
    ensureSessionResponseState();
    if (!state.activeSession._meta || typeof state.activeSession._meta !== "object") {
      state.activeSession._meta = {};
    }
    if (!Number.isFinite(Number(state.activeSession._meta.study_started_at))) {
      state.activeSession._meta.study_started_at = Date.now();
      await storeActiveSession(state.activeSession);
    }
    state.nTest = clampInt(state.activeSession?.n_test, 0, MAX_N_TEST, state.nTest);
    state.nSocratic = clampInt(state.activeSession?.n_socratic, 0, MAX_N_SOCRATIC, state.nSocratic);
    state.activeBlockIndex = Math.max(0, Number(state.activeSession?.current_block_index) || 0);
    const savedQ = state.activeSession?.active_question_index;
    state.activeQuestionIndex =
      savedQ != null && Number.isFinite(Number(savedQ))
        ? Math.max(0, Math.floor(Number(savedQ)))
        : 0;
    applyQuestionsStudyOrderForSession(await getActiveSession());
    if (
      isQuestionsStudyMode(state.activeSession) &&
      Array.isArray(state.questionsStudyOrder) &&
      state.questionsStudyOrder.length &&
      state.activeBlockIndex === 0 &&
      state.activeQuestionIndex === 0
    ) {
      state.activeBlockIndex = state.questionsStudyOrder[0];
    }
    // [debug-enrich]
    console.info('[study.startStudyingNow] Entering study loop:', {
      docId: state.activeSession?.docId ?? null,
      studyMode: state.activeSession?.studyMode ?? studyMode,
      activeBlockIndex: state.activeBlockIndex,
      activeQuestionIndex: state.activeQuestionIndex,
      nTest: state.nTest,
      nSocratic: state.nSocratic,
      totalBlocks: getTotalBlocksSafe(),
      studyStartedAt: state.activeSession?._meta?.study_started_at ?? null,
    });
    updateStudyProgressUi();
    startBlock(state.activeBlockIndex);
  }


  loadRsvpDefaultsFromStorage();

  if (els.blocksFilterInput) {
    els.blocksFilterInput.addEventListener("input", () => applyBlockFilterToEditor());
  }
  if (els.blocksClearFilterBtn) {
    els.blocksClearFilterBtn.addEventListener("click", () => {
      if (els.blocksFilterInput) els.blocksFilterInput.value = "";
      applyBlockFilterToEditor();
      const first = els.blocksListEditor?.querySelector('input[name="blockTitle"]');
      if (first) first.focus();
    });
  }
  if (els.blocksExpandAllBtn) {
    els.blocksExpandAllBtn.addEventListener("click", () => {
      const items = Array.from(
        els.blocksListEditor?.querySelectorAll("[data-block-id]") || [],
      );
      for (const item of items) {
        if (!item.hidden) item.open = true;
      }
    });
  }
  if (els.blocksCollapseAllBtn) {
    els.blocksCollapseAllBtn.addEventListener("click", () => {
      const items = Array.from(
        els.blocksListEditor?.querySelectorAll("[data-block-id]") || [],
      );
      for (const item of items) item.open = false;
    });
  }

  if (els.studyNotesInput) {
    const stored = String(localStorage.getItem(LS_STUDY_NOTES_KEY) || "");
    els.studyNotesInput.value = stored;
    state.studyNotes = stored;
    autoGrowStudyNotesInput();
    let studyNotesInvalidationTimer = null;
    els.studyNotesInput.addEventListener("input", () => {
      autoGrowStudyNotesInput();
      const v = String(els.studyNotesInput.value || "");
      state.studyNotes = v;
      try {
        localStorage.setItem(LS_STUDY_NOTES_KEY, v);
      } catch {
        // ignore
      }
      clearTimeout(studyNotesInvalidationTimer);
      studyNotesInvalidationTimer = setTimeout(() => {
        invalidateBlockSplitCache();
        clearRecommendBlocksUi();
        void maybeAutoRecommendBlockCount();
      }, 500);
    });
  }

  els.fileInput.addEventListener("change", async () => {
    clearOfflinePackError();
    if (els.offlinePackStatus) els.offlinePackStatus.textContent = "";
    if (!els.fileExtractHint) return;
    try {
      els.fileExtractHint.textContent = "";
      const fileList = els.fileInput.files ? Array.from(els.fileInput.files) : [];
      const file = fileList[0];
      if (!file) {
        invalidateBlockSplitCacheAndRecommendUi();
        return;
      }
      els.fileExtractHint.textContent = `Selected: ${String(file.name || "file")} (${formatFileSize(file.size)})`;
      const markerProbe = await file.slice(0, 64 * 1024).text();
      if (String(markerProbe || "").includes("OFFLINE_PACK_V1")) {
        els.fileExtractHint.textContent = "Loading offline pack…";
        const rawMaterialText = await readFileAsText(file);
        await loadOfflinePack(rawMaterialText, String(file.name || ""));
        return;
      }
      if (window.offlineMode === true) {
        window.offlineMode = false;
        window.offlinePack = null;
        setBlocksReadonlyMode({ enabled: false, bannerText: "" });
      }
      state.materialBootstrapActive = false;
      state.lastRawMaterialText = "";
      state.lastCleanedMaterialText = "";
      state.lastCleanedMaterialWordCount = 0;
      invalidateBlockSplitCacheAndRecommendUi();
      void maybeAutoRecommendBlockCount();
    } catch {
      els.fileExtractHint.textContent = "";
    }
  });

  enableUnifiedMaterialUpload();

  els.generateBlocksForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (els.alreadyKnowMaterial?.checked) {
      clearGenerateError();
      els.generateBlocksStatus.textContent = "";
      setGenerateLoading(true);
      try {
        const resolved = await resolveMaterialForGenerate();
        if (!resolved) {
          setGenerateError("Please choose a file (.pdf, .html, .txt, or .md).");
          return;
        }
        const { file, cleanedText, wordCount, originalFormat, normalizedFormat, warnings, fallbackSections } =
          resolved;
        if (!String(cleanedText || "").trim()) {
          setGenerateError("File appears to be empty.");
          return;
        }
        const llmModel = getDefaultLlmModel();
        assertLlmKeyPresent(llmModel);
        const result = await importFromDocument(
          file,
          {
            cleanedText,
            wordCount,
            originalFormat,
            normalizedFormat,
            warnings,
            fallbackSections,
          },
          {
            llmModel,
            language: getStudyLanguage(),
            onProgress: (msg) => {
              if (els.generateBlocksStatus) els.generateBlocksStatus.textContent = msg;
            },
          },
        );
        const parts = [];
        if (result.added) parts.push(`${result.added} new`);
        if (result.merged) parts.push(`${result.merged} merged`);
        const summary = parts.length
          ? `Imported ${parts.join(", ")} concept${result.added + result.merged === 1 ? "" : "s"} into Knowledge Vault.`
          : "No new concepts were added to the Knowledge Vault.";
        if (result.errors?.length) {
          const detail = result.errors.join(" ");
          if (parts.length) {
            els.generateBlocksStatus.textContent = `${summary} ${detail}`;
          } else {
            setGenerateError(detail);
            els.generateBlocksStatus.textContent = "";
            return;
          }
        } else {
          els.generateBlocksStatus.textContent = summary;
        }
        if (els.fileInput) els.fileInput.value = "";
        if (els.alreadyKnowMaterial) els.alreadyKnowMaterial.checked = false;
        if (els.fileExtractHint) els.fileExtractHint.textContent = "";
        invalidateBlockSplitCacheAndRecommendUi();
      } catch (err) {
        setGenerateError(err?.message ? String(err.message) : String(err));
        if (String(err?.message || "").includes("DeepSeek")) showScreen("settings");
      } finally {
        setGenerateLoading(false);
      }
      return;
    }

    const selectedMode = getSelectedStudyModeRadio() || normalizeStudyMode(state.studyMode);
    if (!selectedMode) {
      setGenerateError("Please choose a study mode first.");
      return;
    }
    state.studyMode = selectedMode;

    if (selectedMode === "cloze") {
      if (isOfflineMode()) {
        setGenerateError("Offline pack is only available in RSVP mode.");
        return;
      }
      clearGenerateError();
      els.generateBlocksStatus.textContent = "";
      setGenerateLoading(true);
      els.generateBlocksStatus.textContent = "Reading material…";
      const resolvedCloze = await resolveMaterialForGenerate();
      if (!resolvedCloze) {
        setGenerateLoading(false);
        els.generateBlocksStatus.textContent = "";
        setGenerateError("Please choose a file (.pdf, .html, .txt, or .md).");
        return;
      }
      els.generateBlocksStatus.textContent = "";
      try {
        const { file, cleanedText, normalizedFormat, originalFormat, pendingImages, structureHeadings } =
          resolvedCloze;
        if (!cleanedText.trim()) throw new Error("File appears to be empty.");
        const llmModel = getDefaultLlmModel();
        const doc = await ensureDocumentSessionForUpload(cleanedText, {
          pendingImages,
          structureHeadings,
        });
        await computeAndPersistModeRecommendation(doc, cleanedText, null);
        const sessionObj = createClozeSession({
          normalizedText: cleanedText,
          normalizedFormat,
          fileName: String(file.name || ""),
          originalFormat,
          llmModel,
          language: getStudyLanguage(),
        });
        await persistModeSliceToDocument(doc, "cloze", sessionObj);
        state.activeSession = sessionObj;
        await storeActiveSession(sessionObj);
        setGenerateBlocksFormHidden(true);
        updateClozeSessionPanel(sessionObj);
        showCreateScreen();
      } catch (err) {
        setGenerateError(err?.message ? String(err.message) : String(err));
      } finally {
        setGenerateLoading(false);
        els.generateBlocksStatus.textContent = "";
      }
      return;
    }

    if (selectedMode === "slow") {
      if (isOfflineMode()) {
        setGenerateError("Offline pack is only available in RSVP mode.");
        return;
      }
      clearGenerateError();
      els.generateBlocksStatus.textContent = "";
      const llmModel = getDefaultLlmModel();
      try {
        assertLlmKeyPresent(llmModel);
      } catch (err) {
        setGenerateError(err?.message ? String(err.message) : String(err));
        if (String(err?.message || "").includes("DeepSeek")) showScreen("settings");
        return;
      }
      setGenerateLoading(true);
      els.generateBlocksStatus.textContent = "Reading material…";
      const resolvedSlow = await resolveMaterialForGenerate();
      if (!resolvedSlow) {
        setGenerateLoading(false);
        els.generateBlocksStatus.textContent = "";
        setGenerateError("Please choose a file (.pdf, .html, .txt, or .md).");
        return;
      }
      els.generateBlocksStatus.textContent = "";
      try {
        const { file, cleanedText, originalFormat, pendingImages, structureHeadings } = resolvedSlow;
        if (!cleanedText.trim()) throw new Error("File appears to be empty.");
        const doc = await ensureDocumentSessionForUpload(cleanedText, {
          pendingImages,
          structureHeadings,
        });
        await setUploadMeta(doc.docId, {
          fileName: String(file.name || ""),
          originalFormat: String(originalFormat || ""),
          uploadedAt: new Date().toISOString(),
        });
        state.lastCleanedMaterialText = cleanedText;
        state.lastCleanedMaterialWordCount = countWords(cleanedText);
        state.lastUploadedFileNames = [String(file.name || "")].filter(Boolean);
        state.materialBootstrapActive = false;
        showDocumentPreparingScreen("Preparing document…");
        const prepared = await ensureScopeStructurePreparation(doc, {
          ...preparationGateOptions((msg) => {
            if (els.reviewGeneratingLabel) {
              els.reviewGeneratingLabel.textContent = formatPreparationProgressMessage(msg);
            }
          }),
        });
        await enterModeSelectAfterTier1Gate(prepared);
      } catch (err) {
        setGenerateError(err?.message ? String(err.message) : String(err));
      } finally {
        setGenerateLoading(false);
        els.generateBlocksStatus.textContent = "";
      }
      return;
    }

    if (isOfflineMode()) {
      setGenerateError("Offline mode is active. Start this session from the loaded offline pack.");
      return;
    }
    if (window.offlineMode === true) {
      window.offlineMode = false;
      window.offlinePack = null;
    }
    setBlocksReadonlyMode({ enabled: false, bannerText: "" });
    clearGenerateError();
    els.generateBlocksStatus.textContent = "";
    const bootstrapRsvp = Boolean(state.materialBootstrapActive);
    state.originalMaterialText = "";
    state.studyNotes = els.studyNotesInput ? String(els.studyNotesInput.value || "") : "";
    state.lastNBlocks = 0;
    if (!bootstrapRsvp) {
      state.lastUploadedFileNames = [];
      state.lastCleanedMaterialText = "";
      state.lastCleanedMaterialWordCount = 0;
    }
    state.lastBlockIndex = null;
    window.indexWasImported = false;
    if (els.importIndexLabel) els.importIndexLabel.textContent = "";
    clearSessionConceptStorage();
    clearGuideChatStorage({ removeAllStored: true });

    const llmModel = getDefaultLlmModel();
    try {
      assertLlmKeyPresent(llmModel);
    } catch (err) {
      setGenerateError(err?.message ? String(err.message) : String(err));
      if (String(err?.message || "").includes("DeepSeek")) showScreen("settings");
      return;
    }
    state.pendingLlmModel = llmModel;

    // Validate global question defaults for this session.
    if ((state.nTest || 0) <= 0 && (state.nSocratic || 0) <= 0) {
      setGenerateError("Please set at least one question per block (test or socratic).");
      return;
    }
    storeDefaultQuestionConfig({ n_test: state.nTest, n_socratic: state.nSocratic });

    let nBlocks;
    if (selectedMode === "questions") {
      nBlocks = 20;
    } else {
      nBlocks = Number(els.blocksInput.value);
      if (!Number.isFinite(nBlocks) || nBlocks < 5 || nBlocks > 60) {
        setGenerateError("Blocks must be a number between 5 and 60.");
        return;
      }
    }

    setGenerateLoading(true);
    els.generateBlocksStatus.textContent = "Reading material…";

    const resolvedRsvp = await resolveMaterialForGenerate();
    if (!resolvedRsvp) {
      setGenerateLoading(false);
      els.generateBlocksStatus.textContent = "";
      setGenerateError("Please choose a file (.pdf, .html, .txt, or .md).");
      return;
    }

    els.generateBlocksStatus.textContent = getLlmCallingLabel(llmModel);

    try {
      const { file, cleanedText, wordCount, pendingImages, structureHeadings } = resolvedRsvp;
      if (!bootstrapRsvp) {
        state.lastCleanedMaterialText = cleanedText;
        state.lastCleanedMaterialWordCount = wordCount;
        state.lastUploadedFileNames = [String(file.name || "")].filter(Boolean);
        if (els.fileExtractHint) {
          els.fileExtractHint.textContent = `(~${wordCount} words extracted)`;
        }
      }
      if (!cleanedText.trim()) {
        throw new Error("File appears to be empty.");
      }
      state.originalMaterialText = cleanedText;
      const doc = await ensureDocumentSessionForUpload(cleanedText, {
        pendingImages,
        structureHeadings,
      });
      await computeAndPersistModeRecommendation(doc, cleanedText, null);

      const fingerprint = buildBlockSplitFingerprint({
        file,
        studyNotes: String(state.studyNotes || ""),
        wordCount,
      });
      const cache = getBlockSplitCache();
      const splitOpts = {
        llmModel,
        studyNotes: String(state.studyNotes || ""),
        language: getStudyLanguage(),
        onProgress: (msg) => {
          els.generateBlocksStatus.textContent = msg;
        },
      };

      resetPrePackingFlow();
      prePackingDraftMeta = null;
      migrateKnowledgeProfileToShared(doc);
      const packKnowledgeProfile = resolvePackKnowledgeProfile(doc);
      const packOpts = { ...splitOpts, knowledgeProfile: packKnowledgeProfile };
      console.info("[study.generateBlocks] RSVP split start:", {
        docId: doc?.docId,
        nBlocks,
        wordCount,
        hasSharedProfile: Boolean(packKnowledgeProfile),
        hasCachedInventory: isConceptInventoryValid(doc),
        cacheValid: isBlockSplitCacheValid(cache, fingerprint),
        preparedPack: Boolean(resolveRsvpInventoryForPack(doc, { fingerprint })),
      }); // [debug-enrich]

      let packed;
      const preparedPack = resolveRsvpInventoryForPack(doc, { fingerprint });
      if (preparedPack) {
        console.debug("[study.generateBlocks] Pack path: preparedPack"); // [debug-enrich]
        packed = await packInventoryToBlocks(
          preparedPack.inventory,
          nBlocks,
          cleanedText,
          packOpts,
        );
      } else if (isBlockSplitCacheValid(cache, fingerprint)) {
        console.debug("[study.generateBlocks] Pack path: blockSplitCache"); // [debug-enrich]
        packed = await packInventoryToBlocks(
          cache.conceptInventory,
          nBlocks,
          cleanedText,
          packOpts,
        );
      } else if (isConceptInventoryValid(doc)) {
        console.debug("[study.generateBlocks] Pack path: shared.conceptInventory"); // [debug-enrich]
        packed = await packInventoryToBlocks(
          doc.shared.conceptInventory,
          nBlocks,
          cleanedText,
          packOpts,
        );
      } else {
        const sparseInv = doc?.shared?.conceptInventory;
        const blockGuard = evaluateConceptInventoryGuard(doc);
        if (
          blockGuard.decision === "degraded" &&
          Array.isArray(sparseInv) &&
          sparseInv.length > 0
        ) {
          console.warn("[study.generateBlocks] Pack path: degraded sparse inventory", {
            conceptCount: sparseInv.length,
          }); // [debug-enrich]
          packed = await packInventoryToBlocks(sparseInv, nBlocks, cleanedText, packOpts);
        } else {
          console.debug("[study.generateBlocks] Pack path: twoPhaseConceptSplit"); // [debug-enrich]
          const splitResult = await twoPhaseConceptSplit(cleanedText, nBlocks, splitOpts);
          packed = {
            blockIndex: splitResult.blockIndex,
            splitRunMeta: splitResult.splitRunMeta,
            conceptInventory: splitResult.conceptInventory,
          };
          const inv = splitResult.conceptInventory;
          if (Array.isArray(inv) && inv.length > 0) {
            setBlockSplitCache({
              fingerprint,
              conceptInventory: inv,
              recommendation: cache?.recommendation ?? null,
            });
          }
        }
      }
      if (!Array.isArray(packed.blockIndex) || !packed.blockIndex.length) {
        throw new Error(
          "Block split returned no blocks. Please try generating blocks again.",
        );
      }
      packed.blockIndex = applyKnowledgeProfileToBlockIndex(packed.blockIndex);
      promoteConceptInventoryToShared(
        packed.conceptInventory ||
          packed.splitRunMeta?.concept_inventory ||
          [],
        "rsvp",
      );
      applyPackedBlocksToEditor(
        packed,
        packed.conceptInventory || packed.splitRunMeta?.concept_inventory,
      );
      return;
    } catch (err) {
      console.error("[study.generateBlocks] Failed:", {
        message: err?.message || String(err),
        stack: err?.stack,
        prePackingActive: Boolean(prePackingFlow),
      }); // [debug-enrich]
      setGenerateError(err?.message ? String(err.message) : String(err));
    } finally {
      setGenerateLoading(false);
      els.generateBlocksStatus.textContent = "";
    }
  });

  els.confirmBlocksBtn.addEventListener("click", async () => {
    // [debug-enrich]
    console.info('[study.confirmBlocks] Confirm clicked:', {
      offlineMode: window.offlineMode === true,
      lastNBlocks: state.lastNBlocks ?? null,
      lastBlockIndexLen: Array.isArray(state.lastBlockIndex) ? state.lastBlockIndex.length : 0,
      indexWasImported: Boolean(window.indexWasImported),
      hasOriginalMaterial: Boolean(state.originalMaterialText?.trim?.()),
      studyMode: state.studyMode ?? null,
    });
    clearConfirmError();
    els.confirmBlocksStatus.textContent = "";

    if (window.offlineMode === true) {
      setConfirmLoading(true);
      els.confirmBlocksStatus.textContent = "Loading offline session…";
      try {
        const pack = window.offlinePack && typeof window.offlinePack === "object" ? window.offlinePack : null;
        const offlineBlocks = normalizeOfflineBlocks(pack?.blocks);
        if (!pack || !offlineBlocks.length) {
          throw new Error("Invalid or corrupted offline pack");
        }
        const index = blockIndexFromOfflineBlocks(offlineBlocks);
        const confirmedBlocksListText = blocksListTextFromBlockIndex(index);
        const sessionObj = initActiveSessionFromBlocksList({
          nBlocks: offlineBlocks.length,
          blocksListText: confirmedBlocksListText,
          includeConnectionQuestions:
            pack?.config?.include_connection_questions != null ? Boolean(pack.config.include_connection_questions) : true,
        });
        sessionObj.n_test = clampInt(pack?.config?.n_test, 0, MAX_N_TEST, DEFAULT_N_TEST);
        sessionObj.n_socratic = 0;
        sessionObj.language = String(pack?.config?.language || getStudyLanguage()).trim() || "English";
        sessionObj.blocks = offlineBlocks.map((b) => ({
          ...b,
          _config: {
            n_test: sessionObj.n_test,
            n_socratic: 0,
            include_connection_questions: sessionObj.include_connection_questions,
          },
        }));
        sessionObj._meta = pack.meta && typeof pack.meta === "object" ? pack.meta : {};
        sessionObj.current_block_index = 0;
        sessionObj.active_question_index = 0;
        clearSessionConceptStorage();
        clearGuideChatStorage({ removeAllStored: true });
        state.activeSession = sessionObj;
        state.activeBlockIndex = 0;
        state.activeQuestionIndex = 0;
        state.nTest = sessionObj.n_test;
        state.nSocratic = 0;
        await storeActiveSession(sessionObj);
        refreshGuideContext();
        window.assessmentConfig = { skipped: true };
        showScreen("ready");
        setFullPackEntryCta(offlineBlocks.length);
        if (els.sessionReadyMeta) {
          els.sessionReadyMeta.textContent = `Offline session ready. Blocks: ${offlineBlocks.length}`;
        }
      } catch (err) {
        setConfirmError(err?.message ? String(err.message) : String(err));
      } finally {
        setConfirmLoading(false);
        els.confirmBlocksStatus.textContent = "";
      }
      return;
    }

    const llmModel = normalizeLlmModel(state.pendingLlmModel ?? LLM_MODEL_DEEPSEEK);
    try {
      assertLlmKeyPresent(llmModel);
    } catch (err) {
      setConfirmError(err?.message ? String(err.message) : String(err));
      return;
    }

    const indexLen = Array.isArray(state.lastBlockIndex) ? state.lastBlockIndex.length : 0;
    const nBlocks = indexLen > 0 ? indexLen : Number(state.lastNBlocks);
    if (!Number.isFinite(nBlocks) || nBlocks <= 0) {
      setConfirmError("Missing blocks count from previous step. Regenerate blocks.");
      returnToCreateScreen();
      return;
    }

    if (!window.indexWasImported && !state.originalMaterialText.trim()) {
      setConfirmError(
        "Missing original material from previous step. Please re-upload and regenerate blocks.",
      );
      returnToCreateScreen();
      return;
    }

    setConfirmLoading(true);
    els.confirmBlocksStatus.textContent = "Saving blocks list…";

    try {
      if (!state.lastBlockIndex || !Array.isArray(state.lastBlockIndex)) {
        throw new Error("Missing generated blocks. Please regenerate blocks.");
      }

      syncHiddenBlocksJsonFromEditor();
      const edited = safeParseJson(getBlocksListJsonCache() || "");
      if (!Array.isArray(edited)) {
        throw new Error(
          "Blocks list looks invalid. Please ensure each block has a title and a summary.",
        );
      }

      const editedMap = new Map();
      for (const item of edited) {
        if (!item || typeof item !== "object") {
          throw new Error("Each block must be an object with {id,title,summary}.");
        }
        const id = Number(item.id);
        const title = String(item.title || "").trim();
        const summary = String(item.summary || "").trim();
        if (!Number.isFinite(id) || id <= 0) {
          throw new Error("Each block must have a numeric id.");
        }
        if (!title) throw new Error(`Block ${id} is missing a title.`);
        if (!summary) throw new Error(`Block ${id} is missing a summary.`);
        editedMap.set(id, { id, title, summary });
      }

      const merged = [];
      for (const b of state.lastBlockIndex) {
        const id = Number(b.id);
        const e = editedMap.get(id);
        if (!e) {
          throw new Error(
            `Missing block id ${id} in the edited list. Keep all ids 1..${nBlocks}.`,
          );
        }
        const row = {
          id,
          title: e.title,
          summary: e.summary,
          chunk: String(b.chunk || ""),
        };
        if (Array.isArray(b.signature) && b.signature.length) row.signature = b.signature;
        if (Array.isArray(b.concept_ids) && b.concept_ids.length) row.concept_ids = b.concept_ids;
        if (b.anchor_quality) row.anchor_quality = b.anchor_quality;
        if (Array.isArray(b.chunk_match_terms) && b.chunk_match_terms.length) {
          row.chunk_match_terms = b.chunk_match_terms;
        }
        if (b.learning_goal) row.learning_goal = b.learning_goal;
        if (b._initial_block_config && typeof b._initial_block_config === "object") {
          row._initial_block_config = b._initial_block_config;
        }
        merged.push(row);
      }
      merged.sort((a, b) => a.id - b.id);
      if (merged.length !== nBlocks) {
        throw new Error(`Expected ${nBlocks} blocks, but found ${merged.length}.`);
      }
      for (let i = 0; i < merged.length; i += 1) {
        if (merged[i].id !== i + 1) {
          throw new Error(`Block ids must be 1..${nBlocks} in order.`);
        }
      }

      localStorage.setItem("block_index", JSON.stringify(merged));
      const confirmedBlocksListText = blocksListTextFromBlockIndex(merged);
      clearSessionConceptStorage();
      clearGuideChatStorage({ removeAllStored: true });

      const sessionObj = initActiveSessionFromBlocksList({
        mode: normalizeStudyMode(state.studyMode),
        nBlocks,
        blocksListText: confirmedBlocksListText,
        includeConnectionQuestions: state.includeConnectionQuestions,
      });
      sessionObj.n_test = clampInt(state.nTest, 0, MAX_N_TEST, DEFAULT_N_TEST);
      sessionObj.n_socratic = clampInt(state.nSocratic, 0, MAX_N_SOCRATIC, DEFAULT_N_SOCRATIC);
      if (Array.isArray(sessionObj.blocks)) {
        for (let i = 0; i < sessionObj.blocks.length; i += 1) {
          const b = sessionObj.blocks[i];
          if (!b || typeof b !== "object") sessionObj.blocks[i] = {};
          if (!sessionObj.blocks[i]._config || typeof sessionObj.blocks[i]._config !== "object") {
            sessionObj.blocks[i]._config = {};
          }
          sessionObj.blocks[i]._config.n_test = sessionObj.n_test;
          sessionObj.blocks[i]._config.n_socratic = sessionObj.n_socratic;
          sessionObj.blocks[i]._config.include_connection_questions = sessionObj.include_connection_questions;
          const initialCfg = merged[i]?._initial_block_config;
          if (initialCfg && typeof initialCfg === "object") {
            if (initialCfg.explanation_profile) {
              sessionObj.blocks[i]._config.explanation_profile = initialCfg.explanation_profile;
            }
            if (Array.isArray(initialCfg.gap_focus) && initialCfg.gap_focus.length) {
              sessionObj.blocks[i]._config.gap_focus = initialCfg.gap_focus;
            }
          }
        }
      }
      if (!sessionObj._meta || typeof sessionObj._meta !== "object") {
        sessionObj._meta = {};
      }
      sessionObj._meta.llm_model = llmModel;
      const notes = String(state.studyNotes || "").trim();
      if (notes) {
        sessionObj._meta.study_notes = notes;
      }
      if (Array.isArray(state.lastUploadedFileNames) && state.lastUploadedFileNames.length) {
        sessionObj._meta.source_files = state.lastUploadedFileNames.map((name) => ({
          name: String(name || ""),
        }));
      }
      sessionObj._meta.source_fidelity_mode = state.sourceFidelityStrict ? "strict" : "standard";
      ensureSessionPipelineLevers(sessionObj, state.sourceFidelityStrict);
      ensureSessionCoverageManifest(sessionObj);
      if (state.lastCleanedMaterialText) {
        sessionObj._meta.cleaned_material = state.lastCleanedMaterialText;
      }
      const mgInventory = state.materialGraphContext?.conceptInventory || [];
      sessionObj._meta.material_graph = {
        blockIndex: merged,
        conceptInventory: mgInventory,
      };
      state.materialGraphContext = {
        blockIndex: merged,
        conceptInventory: mgInventory,
      };
      promoteConceptInventoryToShared(mgInventory, "rsvp");
      await storeActiveSession(sessionObj);
      state.activeSession = sessionObj;
      refreshGuideContext();
      if (prePackingDraftMeta) {
        if (prePackingDraftMeta.assessmentSkipped) {
          setAssessmentSkipped(sessionObj, true);
        } else if (prePackingDraftMeta.packingIgnoredProfile) {
          setPackingIgnoredProfile(sessionObj, true);
          if (prePackingDraftMeta.knowledgeProfile) {
            setKnowledgeProfile(sessionObj, prePackingDraftMeta.knowledgeProfile);
          }
        } else if (prePackingDraftMeta.knowledgeProfile) {
          setKnowledgeProfile(sessionObj, prePackingDraftMeta.knowledgeProfile);
        }
        prePackingDraftMeta = null;
      }

      // [debug-enrich]
      console.info('[study.confirmBlocks] Session initialized from blocks:', {
        nBlocks,
        docId: sessionObj?.docId ?? null,
        studyMode: sessionObj?.studyMode ?? null,
        mergedCount: merged.length,
      });
      goAfterBlocksConfirmed(nBlocks);
    } catch (err) {
      // [debug-enrich]
      console.error('[study.confirmBlocks] Confirm failed:', {
        message: err?.message ?? String(err),
      });
      setConfirmError(err?.message ? String(err.message) : String(err));
    } finally {
      setConfirmLoading(false);
      els.confirmBlocksStatus.textContent = "";
    }
  });

  els.assessmentRunnerRetry?.addEventListener("click", () => {
    void retryPrePackingAssessmentGeneration();
  });
  els.prePackingAssessmentSkip?.addEventListener("click", () => {
    void handlePrePackingSkip();
  });
  els.assessmentGateAcceptBtn?.addEventListener("click", () => {
    void handleAssessmentGateAccept();
  });
  els.assessmentGateSkipBtn?.addEventListener("click", () => {
    void handleAssessmentGateSkip();
  });
  els.modeSelectRedoAssessmentBtn?.addEventListener("click", () => {
    void handleRedoAssessmentRequest();
  });
  els.prePackingAssessmentNext?.addEventListener("click", () => {
    void advancePrePackingAssessment();
  });

  els.startStudyingBtn.addEventListener("click", async () => startStudyingNow());
  if (els.generateFullPackBtn) {
    els.generateFullPackBtn.addEventListener("click", async () => {
      const blockIndex = Array.isArray(state.lastBlockIndex) ? state.lastBlockIndex : [];
      if (!blockIndex.length) {
        if (els.startStudyingError) {
          els.startStudyingError.hidden = false;
          els.startStudyingError.textContent = "Missing blocks index. Please confirm blocks again.";
        }
        return;
      }
      if (!state.activeSession || typeof state.activeSession !== "object") {
        if (els.startStudyingError) {
          els.startStudyingError.hidden = false;
          els.startStudyingError.textContent = "Missing active session.";
        }
        return;
      }
      if (els.startStudyingError) {
        els.startStudyingError.hidden = true;
        els.startStudyingError.textContent = "";
      }

      resetFullPackActions();
      window.offlinePackCancelled = false;
      fullPackRunActive = true;
      updateFullPackProgressUi({
        pct: 0,
        phase: 1,
        phaseText: "Phase 1 of 3: Parsing document",
        actionText: "Preparing...",
        etaText: "",
        warning: "",
        error: "",
      });
      showScreen("fullPackGenerating");

      try {
        const htmlText = String(
          state.lastRawMaterialText || state.lastCleanedMaterialText || state.originalMaterialText || "",
        );
        const progressPhaseFromPct = (pct) => {
          const p = Number(pct) || 0;
          if (p < 6) return 1;
          if (p < 20) return 2;
          return 3;
        };
        const result = await generateOfflinePack(blockIndex, htmlText, {
          language: getStudyLanguage(),
          n_test: state.activeSession.n_test,
          include_connection_questions: state.activeSession.include_connection_questions,
          llmModel: getSessionLlmModel(state.activeSession),
          updateProgress: (pct, phaseText, actionText) => {
            updateFullPackProgressUi({
              pct,
              phase: progressPhaseFromPct(pct),
              phaseText,
              actionText,
            });
          },
          updateETA: (secondsRemaining) => {
            const sec = Math.max(0, Number(secondsRemaining) || 0);
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            updateFullPackProgressUi({
              etaText: `~${m}m ${s}s remaining`,
            });
          },
        });

        state.activeSession.blocks = result.results;
        await storeActiveSession(state.activeSession, { bumpRev: true });
        const failed = result.results.filter((b) => b && b._failed).length;

        if (result.cancelled) {
          updateFullPackProgressUi({
            warning: `Cancelled. ${result.completed} of ${result.total} blocks generated.`,
          });
          if (els.fullPackCancelBtn) els.fullPackCancelBtn.hidden = true;
          if (els.fullPackStudyNowBtn) {
            els.fullPackStudyNowBtn.hidden = false;
            els.fullPackStudyNowBtn.textContent = "Download partial pack";
          }
          if (els.fullPackExitBtn) {
            els.fullPackExitBtn.hidden = false;
            els.fullPackExitBtn.textContent = "Go back";
          }
          return;
        }

        updateFullPackProgressUi({
          pct: 100,
          phase: 3,
          phaseText: "Phase 3 of 3: Generating content",
          actionText: "Generation complete",
          etaText: "~0m 0s remaining",
          warning: failed > 0 ? `${failed} blocks failed and have no content` : "",
        });
        exportOfflinePack();
        if (els.fullPackCancelBtn) els.fullPackCancelBtn.hidden = true;
        if (els.fullPackStudyNowBtn) {
          els.fullPackStudyNowBtn.hidden = false;
          els.fullPackStudyNowBtn.textContent = "Study now →";
        }
        if (els.fullPackExitBtn) {
          els.fullPackExitBtn.hidden = false;
          els.fullPackExitBtn.textContent = "Done ? study later";
        }
      } catch (err) {
        const msg = err?.message ? String(err.message) : String(err);
        updateFullPackProgressUi({ error: msg });
      } finally {
        fullPackRunActive = false;
      }
    });
  }
  if (els.fullPackCancelBtn) {
    els.fullPackCancelBtn.addEventListener("click", () => {
      window.offlinePackCancelled = true;
      if (!fullPackRunActive) showScreen("blocks");
    });
  }
  if (els.fullPackStudyNowBtn) {
    els.fullPackStudyNowBtn.addEventListener("click", async () => {
      if (els.fullPackStudyNowBtn.textContent === "Download partial pack") {
        exportOfflinePack();
        return;
      }
      await startStudyingNow();
    });
  }
  if (els.fullPackExitBtn) {
    els.fullPackExitBtn.addEventListener("click", () => {
      if (els.fullPackExitBtn.textContent === "Go back") {
        showScreen("blocks");
        return;
      }
      enterModeSelectScreen();
    });
  }

  wireSourceFidelityStrictUi((strict) => {
    state.sourceFidelityStrict = strict;
    saveSourceFidelityStrictPreference(strict);
  });

  els.socraticSubmitBtn.addEventListener("click", async () => {
    // [debug-enrich]
    console.info('[study.socraticSubmit] Submit clicked:', {
      isAssessment: isPrePackingAssessmentRunner(),
      offline: isOfflineMode(),
      blockIndex: state.activeBlockIndex,
      questionIndex: state.activeQuestionIndex,
      answerLen: String(els.socraticAnswer?.value || "").trim().length,
    });
    if (isPrePackingAssessmentRunner()) {
      clearSocraticError();
      const answer = String(els.socraticAnswer.value || "").trim();
      if (!answer) {
        setSocraticError("Please write an answer before submitting.");
        return;
      }
      handleAssessmentSocraticSubmit(answer);
      return;
    }
    if (isOfflineMode()) {
      setSocraticError("Offline mode supports test questions only.");
      return;
    }
    clearSocraticError();
    els.socraticStatus.textContent = "";
    els.socraticResponseBox.hidden = true;
    clearMarkdownContainer(els.socraticResponseBox);

    const llmModel = getSessionLlmModel(state.activeSession);
    try {
      assertLlmKeyPresent(llmModel);
    } catch (err) {
      setSocraticError(err?.message ? String(err.message) : String(err));
      return;
    }

    const blocks = getBlocksSafe();
    const block = blocks[state.activeBlockIndex];
    if (!block) {
      setSocraticError("Missing block.");
      return;
    }
    const ctx = getActiveQuestionContext();
    if (ctx.type !== "socratic" || !ctx.q || !ctx.q.question) {
      setSocraticError("Missing question.");
      return;
    }
    const q = ctx.q;

    const answer = String(els.socraticAnswer.value || "").trim();
    if (!answer) {
      setSocraticError("Please write an answer before submitting.");
      return;
    }

    recordResponse({
      blockIndex: state.activeBlockIndex,
      questionIndex: ctx.globalIndex,
      questionType: "socratic",
      questionText: String(q.question || ""),
      userAnswer: answer,
      feedback: "",
      correctAnswer: "",
    });

    setSocraticLoading(true);
    els.socraticStatus.textContent = getLlmCallingLabel(llmModel);
    try {
      const doc = await getActiveSession();
      const scopeFields = resolveChatScopeFields(doc);
      const resp = await deepSeekSocraticTutor({
        llmModel,
        blockTitle: String(block.title || `Block ${state.activeBlockIndex + 1}`),
        question: String(q.question),
        studentAnswer: answer,
        ...scopeFields,
        studentIntent: doc?.shared?.studentIntent ?? null,
      });
      // [debug-enrich]
      console.info('[study.socraticSubmit] Tutor response received:', {
        blockIndex: state.activeBlockIndex,
        replyLen: resp ? String(resp).length : 0,
      });

      els.socraticResponseBox.hidden = false;
      void renderMarkdown(els.socraticResponseBox, resp);

      recordResponse({
        blockIndex: state.activeBlockIndex,
        questionIndex: ctx.globalIndex,
        questionType: "socratic",
        questionText: String(q.question || ""),
        userAnswer: answer,
        feedback: resp,
        correctAnswer: "",
      });
      try {
        const doc = await getActiveSession();
        if (doc?.docId) {
          await finalizeBlockQuestionAnswer({
            docId: doc.docId,
            slice: state.activeSession,
            sourceMode: state.activeSession?.studyMode || state.studyMode,
            blockIndex: state.activeBlockIndex,
            block,
            questionType: "socratic",
            questionIndex: ctx.globalIndex,
            socraticAnswer: answer,
          });
        }
      } catch (err) {
        console.warn("[block-answer-signals] socratic finalize failed", err);
      }

      const isLastQuestion = ctx.globalIndex >= ctx.total - 1;
      const isLastBlock = state.activeBlockIndex >= blocks.length - 1;
      if (!isLastQuestion) {
        els.socraticNextQuestionBtn.hidden = false;
      } else if (!isLastBlock) {
        els.socraticNextBlockBtn.hidden = false;
      } else {
        els.socraticNextBlockBtn.hidden = false;
        els.socraticNextBlockBtn.textContent = "Finish";
      }
    } catch (err) {
      // [debug-enrich]
      console.error('[study.socraticSubmit] Tutor submit failed:', {
        blockIndex: state.activeBlockIndex,
        message: err?.message ?? String(err),
        status: err?.status ?? null,
      });
      setSocraticError(err?.message ? String(err.message) : String(err));
    } finally {
      setSocraticLoading(false);
      els.socraticStatus.textContent = "";
    }
  });

  els.socraticNextQuestionBtn.addEventListener("click", async () => {
    if (isPrePackingAssessmentRunner()) {
      const ctx = getActiveQuestionContext();
      if (ctx.globalIndex < ctx.total - 1) {
        prePackingFlow.assessmentQuestionIndex = ctx.globalIndex + 1;
      }
      const nextCtx = getActiveQuestionContext();
      if (nextCtx.type === "test") {
        showScreen("test");
        showTestQuestions();
        renderTestQuestion();
      } else {
        renderSocraticQuestion();
      }
      return;
    }
    const ctx = getActiveQuestionContext();
    if (ctx.globalIndex < ctx.total - 1) {
      state.activeQuestionIndex += 1;
      if (state.activeSession && typeof state.activeSession === "object") {
        state.activeSession.active_question_index = state.activeQuestionIndex;
        await storeActiveSession(state.activeSession);
      }
    }
    const nextCtx = getActiveQuestionContext();
    if (nextCtx.type === "test") {
      showScreen("test");
      showTestQuestions();
      renderTestQuestion();
    } else {
      renderSocraticQuestion();
    }
  });

  els.socraticNextBlockBtn.addEventListener("click", () => {
    if (isPrePackingAssessmentRunner()) {
      void finishPrePackingAssessment();
      return;
    }
    const blocks = getBlocksSafe();
    if (state.activeBlockIndex < blocks.length - 1) {
      void finishQuestions(state.activeBlockIndex);
      return;
    }
    showSessionComplete();
  });

  els.testRsvpSkipBtn.addEventListener("click", () => {
    clearTestError();
    if (els.rsvpOverlay.getAttribute("aria-hidden") === "false") {
      finishRsvp();
      return;
    }
    if (isPacedReaderActive()) {
      finishPacedRead();
      return;
    }
    showTestQuestions();
    renderTestQuestion();
  });

  els.keyTermsGlossaryBtn?.addEventListener("click", () => {
    renderKeyTermsGlossary();
    els.keyTermsGlossaryDialog?.showModal?.();
  });
  els.keyTermsGlossaryClose?.addEventListener("click", () => {
    els.keyTermsGlossaryDialog?.close?.();
  });

  els.testRestartBlockBtn.addEventListener("click", async () => {
    clearTestError();
    els.testFeedback.hidden = true;
    clearMarkdownContainer(els.testFeedback);
    state.activeQuestionIndex = 0;
    if (state.activeSession && typeof state.activeSession === "object") {
      state.activeSession.active_question_index = 0;
      await storeActiveSession(state.activeSession);
    }
    beginBlockReading({
      onDone: () => {
        showScreen("test");
        updateStudyProgressUi();
        showTestQuestions();
        renderTestQuestion();
      },
    });
  });

  els.dictionaryCloseBtn.addEventListener("click", () => {
    setDictionaryOverlayOpen(false);
  });

  if (els.downloadOfflinePackBtn) {
    els.downloadOfflinePackBtn.addEventListener("click", () => {
      void handleOfflinePackClick();
    });
  }

  setOnPersistFailure((error) => {
    const msg =
      error === "quota"
        ? "Could not save blocks ? browser storage is full."
        : "Could not save study progress.";
    showExportToast(msg, { variant: "error", durationMs: 5000 });
    syncPersistenceHealthBanner();
  });

  if (els.summaryOverlayCloseBtn) {
    els.summaryOverlayCloseBtn.addEventListener("click", () => setSummaryOverlayOpen(false));
  }
  if (els.summaryOverlayCopyBtn) {
    els.summaryOverlayCopyBtn.addEventListener("click", async () => {
      const t = String(els.summaryOverlayBody?.textContent || "");
      await copyPlainTextToClipboard(t);
    });
  }

  if (els.summarySoFarBtn) {
    els.summarySoFarBtn.addEventListener("click", async () => {
      if (isOfflineMode()) {
        return;
      }
      const explanations = state.activeSession?.blocks
        ?.filter((b) => b != null)
        .map((b) => b.explanation);
      const n = Array.isArray(explanations) ? explanations.length : 0;
      if (!n) {
        if (els.summaryOverlayTitle) els.summaryOverlayTitle.textContent = "Summary so far";
        if (els.summaryOverlayBody) clearMarkdownContainer(els.summaryOverlayBody);
        setSummaryOverlayError("No blocks studied yet.");
        setSummaryOverlayOpen(true);
        return;
      }

      const prevText = els.summarySoFarBtn.textContent;
      els.summarySoFarBtn.disabled = true;
      els.summarySoFarBtn.textContent = "Summarising…";

      if (els.summaryOverlayTitle) {
        els.summaryOverlayTitle.textContent = `Summary so far (blocks 1?${n})`;
      }
      if (els.summaryOverlayBody) {
        els.summaryOverlayBody.textContent = "Summarising…";
        els.summaryOverlayBody.classList.remove("md-content");
      }
      setSummaryOverlayError("");
      setSummaryOverlayOpen(true);

      try {
        const llmModel = getSessionLlmModel(state.activeSession);
        assertLlmKeyPresent(llmModel);

        const language = getStudyLanguage();
        const userPrompt = explanations.join("\n\n");
        const out = await deepSeekSummarySoFar({ llmModel, language, userPrompt });
        if (els.summaryOverlayBody) void renderMarkdown(els.summaryOverlayBody, out);
        setSummaryOverlayError("");
      } catch (err) {
        if (els.summaryOverlayBody) clearMarkdownContainer(els.summaryOverlayBody);
        setSummaryOverlayError(err?.message || "Failed to generate summary.");
      } finally {
        els.summarySoFarBtn.disabled = false;
        els.summarySoFarBtn.textContent = prevText || "Summary so far";
      }
    });
  }

  window.addEventListener("beforeunload", () => {
    void exportSessionMarkdown({ source: "beforeunload" });
  });

  wireRsvpHandlers();
  wirePacedReaderHandlers({ onSwitchToRsvp: switchBlockReadingToRsvp });
  els.rsvpSwitchToPacedBtn?.addEventListener("click", switchBlockReadingToPaced);

  setOnPrefetchReady(({ blockIndex }) => {
    refreshUiOnPrefetchReady();
    syncExportButtonsEnabled();
    syncPersistenceHealthBanner();
    if (!isReadStudyMode(state.activeSession)) return;
    const block = getBlock(blockIndex);
    if (!block) return;
    triggerReadVisualPrefetch(blockIndex, block, {
      llmModel: getSessionLlmModel(state.activeSession),
      language: getStudyLanguage(),
      activeSession: state.activeSession,
    });
  });

  setOnReadVisualResolved((blockIndex) => {
    if (!isReadStudyMode(state.activeSession)) return;
    if (blockIndex !== state.activeBlockIndex) return;
    if (els.testReadView?.hidden) return;
    const block = getBlock(blockIndex);
    if (block) void renderCurrentReadBlock(block);
  });

  setOnBridgeReady(() => {
    refreshUiOnPrefetchReady();
  });

  syncOfflinePackButtonVisibility();
  updateDictionaryButtonVisibility();
  syncExportButtonsEnabled();
  syncPersistenceHealthBanner();
}

