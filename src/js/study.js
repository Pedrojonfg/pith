import {
  deepSeekAuditBlockOverlap,
  deepSeekGenerateBlockJson,
  deepSeekSocraticTutor,
  deepSeekSummarySoFar,
  GapSynthesisError,
  generateAssessmentSynthesis,
  synthesizeAssessmentGaps,
  generatePrePackingAssessmentItems,
  generateHolisticPrePackingAssessmentItems,
  buildInventoryChunks,
  evaluatePrePackingAssessmentResponses,
  extractVaultCandidates,
  normalizeConceptsToVault,
  PREPACKING_DONT_KNOW_ANSWER,
  PREPACKING_ALREADY_KNOW_ANSWER,
} from "./api.js?v=20260527_1";
import {
  ASSESSMENT_FLAGS,
  isAssessmentQuestionsUiEnabled,
  isHolisticAssessmentEnabled,
  isPrePackingAssessmentEnabled,
  saveSourceFidelityStrictPreference,
} from "./config/flags.js";
import {
  buildAssessmentCoveragePlan,
  computeHolisticAssessmentBudget,
  deriveInventoryEdges,
  hashCoveragePlan,
} from "./assessment-coverage.js?v=20260618_1";
import {
  assertLlmKeyPresent,
  getApiKeyForLlmModel,
  getDefaultLlmModel,
  getLlmCallingLabel,
  getSessionLlmModel,
  llmChatCompletions,
  LLM_MODEL_DEEPSEEK,
  normalizeLlmModel,
} from "./llm.js?v=20260525_1";
import {
  buildDocumentHierarchy,
  buildDeterministicPedagogicalMeta,
  hasMarkdownHeadings,
} from "./normalization/hierarchy.js?v=20260609_1";
import { analyzeText } from "./recommendation/analyzer.js?v=20260609_1";
import {
  computeBlockCountRecommendation,
  formatBlockCountReasoning,
} from "./recommendation/block-count-recommender.js?v=20260611_1";
import { computeModeRecommendation } from "./recommendation/recommender.js?v=20260609_1";
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
} from "./document-preparation.js";
import { normalizePreparationState } from "./session-types.js";
import { isMcTypingTarget, letterFromMcKey } from "./mc-keyboard.js?v=20260612_1";
import {
  recordUserOverride,
  updateFlowProgress,
} from "./recommendation/tracker.js?v=20260609_1";
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
} from "./dictionary.js?v=20260526_1";
import { extractSneakPeek } from "./sneakPeek.js?v=20260527_1";
import { MAX_N_TEST } from "./config.js?v=20260527_1";
import {
  exportOfflinePack,
  exportSessionMarkdown,
  exportClozeItemsMarkdown,
  downloadTextFile,
  resolveSessionForExport,
  buildMarkdown,
} from "./export.js?v=20260525_1";
import { computePersistenceHealth, tryRecoverBlocksFromV1Backup } from "./block-store.js";
import {
  clearGuideChatStorage,
  refreshGuideContext,
  triggerCommentReply,
} from "./guide-chat.js?v=20260526_1";
import {
  clearMarkdownContainer,
  hasMathInHtml,
  renderMarkdown,
  renderMcOptionHtml,
} from "./markdown.js?v=20260525_1";
import { cancelRsvpTimer, finishRsvp, loadRsvpDefaultsFromStorage, persistRsvpDefaults, rsvpState, setRsvpBlockTitle, setRsvpOverlayActive, setRsvpPlayState, setWordsPerFlash, startRsvpForText, wireRsvpHandlers } from "./rsvp.js?v=20260526_2";
import {
  finishPacedRead,
  isPacedReaderActive,
  isPacedReaderPreferred,
  pacedReaderState,
  setReadingModePref,
  startPacedReadForText,
  wirePacedReaderHandlers,
} from "./paced-reader.js?v=20260610_1";
import { extractResumePayloadFromMarkdown } from "./resume.js?v=20260525_1";
import { isOfflineMode } from "./offline.js?v=20260606_1";
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
  getStoredKey,
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
  normalizeBlockJson,
  ensureSessionResponseState,
  gapLabelsForBlock,
  generateOfflinePack,
  mergeGapLists,
  setKnowledgeProfile,
  setAssessmentSkipped,
  setPackingIgnoredProfile,
} from "./session.js?v=20260611_2";
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
  syncStudyLanguage,
  typesetMath,
  updateFullPackProgressUi,
  updateSessionCompleteSummary,
} from "./ui.js?v=20260525_1";
import { LS_BLOCK_INDEX_KEY, LS_STUDY_NOTES_KEY } from "./config.js?v=20260527_1";
import {
  buildScopeOptions,
  buildEqualLengthSections,
  scopeCharCount,
  SCOPE_CHAR_WARN,
  formatCharCount,
} from "./slow/headings.js?v=20260609_1";
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
} from "./slow/phase0.js?v=20260528_1";
import { getScopeText, initSlowReader, navigateSlowByPhase, setSlowSessionGetter } from "./slow/reader.js?v=20260528_1";
import { initPhase3Screen } from "./slow/phase3.js?v=20260528_1";
import { computeDepthScore } from "./slow/gamification.js?v=20260528_1";
import {
  buildGraphSubgraphMarkdown,
  buildRsvpMaterialGraph,
  buildSessionGraph,
  mountMaterialGraphScreen,
  renderGraphUnlockButtonHtml,
  wireMaterialGraphScreen,
} from "./graph/view.js?v=20260607_1";
import { jumpToAnnotation } from "./slow/sidebar.js?v=20260528_1";
import { getValidItems, getPhaseLabel, runClozePipelinePhases } from "./cloze/pipeline.js?v=20260607_1";
import {
  applyAssessmentPrioritizedOrder,
  enterClozeStudyScreen,
  setClozeStudyCompleteExitHandler,
  wireClozeStudyHandlers,
} from "./cloze/study.js?v=20260607_1";
import { parseClozePackFiles } from "./cloze/export-import.js?v=20260607_1";
import { startReviewFromSessionBlocks, runVaultSm2ReviewSession } from "./review.js?v=20260525_1";
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
import { prioritizeByAssessmentSignals } from "./assessment-signals.js?v=20260612_1";
import { getDocumentRetrievalModes } from "./mode-taxonomy.js";
import { mapMcqOutcomeToQuality, registerOrUpdateSmItem } from "./sm2-ingest.js";
import { promoteFromMcqBlock } from "./concept-registry/ingest.js";
import { createRecallStudyController } from "./recall-study.js";
import {
  buildModeSliceFromShared,
  resolveModeEntryState,
} from "./mode-bootstrap.js?v=20260612_1";
import {
  addConceptsToShared,
  computeDocId,
  createSession,
  getActiveSession,
  getAllSessions,
  getSession,
  getSmItemsDueToday,
  getVaultReviewDueCount,
  saveActiveSession as saveDocumentSession,
  setActiveSession,
  setUploadMeta,
  syncAssessmentSignalsToShared,
  updateRecommendation,
} from "./session-store.js?v=20260609_1";
import {
  findVaultEntryForConceptId,
  getVaultContextForDoc,
} from "./vault/prompt-injection.js";
import { getCurrentMastery, PRESUMED_KNOWN_THRESHOLD } from "./vault/mastery-model.js";
import { importFromDocument } from "./vault/import.js";
import {
  mountVaultGraphScreen,
  renderVaultGraphTopicPicker,
  VAULT_GRAPH_MIN_ENTRIES,
  VAULT_GRAPH_TOPIC_FILTER_THRESHOLD,
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
export function syncSlowDocHierarchyToShared(slowSession) {
  const doc = getActiveSession();
  if (!doc) return;
  doc.shared.docHierarchy = slowSession?.docHierarchy ?? null;
  const hierarchy = slowSession?.docHierarchy;
  doc.shared.docTopics = Array.isArray(hierarchy?.topics) ? hierarchy.topics : [];
  saveDocumentSession(doc);
}

export async function ensureDocumentSessionForUpload(markdown) {
  const text = String(markdown || "");
  const docId = await computeDocId(text);
  let doc = getSession(docId);
  if (!doc) {
    doc = await createSession(text, { docId, projectId: getUploadDefaultProjectId() });
  } else if (doc.shared.rawMarkdown !== text) {
    doc.shared.rawMarkdown = text;
    doc.shared.docMeta = {
      ...doc.shared.docMeta,
      charCount: text.length,
    };
    saveDocumentSession(doc);
  }
  setActiveSession(docId);
  return doc;
}

let documentPreparationRunId = 0;

/**
 * Run DPP after upload; updates shared preparation state.
 * @param {import("./session-store.js").DocumentSession} doc
 * @param {{ onProgress?: (msg: object) => void, studyNotes?: string, stopAfterTier?: number }} [options]
 */
export async function startDocumentPreparation(doc, options = {}) {
  if (!doc?.docId) return null;
  const prep = normalizePreparationState(doc.shared?.preparation);
  if (prep.status === "ready") return doc;
  const runId = ++documentPreparationRunId;
  const result = await runDocumentPreparationPipeline(doc, {
    llmModel: getSessionLlmModel(),
    language: getStudyLanguage(),
    studyNotes: options.studyNotes ?? state.studyNotes ?? "",
    stopAfterTier: options.stopAfterTier,
    onProgress: (msg) => {
      if (runId !== documentPreparationRunId) return;
      options.onProgress?.(msg);
    },
  });
  return result?.doc ?? doc;
}

function formatPreparationProgressMessage(msg) {
  const label = msg?.label || PHASE_LABELS[msg?.phaseId] || msg?.phaseId || "Preparing";
  const wave = msg?.wave ? ` (wave ${msg.wave})` : "";
  return `${label}${wave}â€¦`;
}

function applySharedBlockRecommendationToUi(doc) {
  const rec = doc?.shared?.blockRecommendation;
  if (!rec?.nBlocks) return false;
  if (els.blocksInput) els.blocksInput.value = String(rec.nBlocks);
  const signals = rec.signals || rec;
  if (els.recommendBlocksWhy) {
    els.recommendBlocksWhy.textContent = rec.rationale || formatBlockCountReasoning(signals);
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
export function computeAndPersistModeRecommendation(
  doc,
  cleanedText,
  hierarchyResult = null,
  options = {},
) {
  if (!doc?.docId) return;
  if (doc.shared?.modeRecommendation && !options.force) return;
  try {
    const textMetrics = analyzeText(String(cleanedText || ""));
    const pedagogicalMeta =
      hierarchyResult?.pedagogicalMeta ?? buildDeterministicPedagogicalMeta(textMetrics);
    const method = hierarchyResult?.method === "llm" ? "llm_meta" : "deterministic";
    const recommendation = computeModeRecommendation(textMetrics, pedagogicalMeta, { method });
    doc.shared.modeRecommendation = recommendation;
    updateRecommendation(doc.docId, recommendation);
  } catch (err) {
    console.warn("mode recommendation compute failed", err);
  }
}

/**
 * @param {import("./session-store.js").DocumentSession | null | undefined} [doc]
 */
export function persistFlowRecommendationProgress(doc = getActiveSession()) {
  if (!doc?.shared?.modeRecommendation) return;
  try {
    const updated = updateFlowProgress(doc.shared.modeRecommendation, doc);
    doc.shared.modeRecommendation = updated;
    updateRecommendation(doc.docId, updated);
  } catch (err) {
    console.warn("flow recommendation progress sync failed", err);
  }
}

/**
 * @param {string} chosenMode
 * @param {import("./session-store.js").DocumentSession | null | undefined} [doc]
 */
export function applyFlowRecommendationOnEnterMode(chosenMode, doc = getActiveSession()) {
  if (!doc?.shared?.modeRecommendation) return;
  try {
    const slot = normalizeStudyMode(chosenMode);
    const recommendedStep = getRecommendedStep(doc.shared.modeRecommendation);
    if (recommendedStep && slot !== normalizeStudyMode(recommendedStep.mode)) {
      const updated = recordUserOverride(doc.shared.modeRecommendation, slot);
      doc.shared.modeRecommendation = updated;
      updateRecommendation(doc.docId, updated);
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
  questions: "Questions",
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
  return steps.map((step) => getFlowModeShortLabel(String(step?.mode || ""))).join(" â†’ ");
}

/**
 * @param {Record<string, unknown> | null | undefined} recommendation
 * @param {import("./session-store.js").DocumentSession | null | undefined} [doc]
 * @returns {string}
 */
function resolveFlowWhyText(recommendation, doc = getActiveSession()) {
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
function buildRecommendationSubtitle(recommendation, doc = getActiveSession()) {
  const reasoning = String(recommendation?.reasoning || "").trim();
  const whyText = resolveFlowWhyText(recommendation, doc);
  const parts = [];
  if (reasoning) parts.push(reasoning);
  if (whyText && whyText !== reasoning) parts.push(whyText);
  return parts.join(" â€” ");
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
function syncModeSelectView(doc = getActiveSession()) {
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
}

function openModeSelectManualView() {
  modeSelectManualOpen = true;
  syncModeSelectView(getActiveSession());
}

function closeModeSelectManualView() {
  modeSelectManualOpen = false;
  syncModeSelectView(getActiveSession());
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
    els.flowRecommendStatus.textContent = isLoading ? "Computing your study flowâ€¦" : "";
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
  const { cleanedText, originalFormat } = await readAndCleanMaterialText(file);
  if (!cleanedText.trim()) {
    throw new Error("The file appears to be empty.");
  }
  const doc = await ensureDocumentSessionForUpload(cleanedText);
  setUploadMeta(doc.docId, {
    fileName: String(file.name || ""),
    originalFormat: String(originalFormat || ""),
    uploadedAt: new Date().toISOString(),
  });
  state.lastCleanedMaterialText = cleanedText;
  state.lastCleanedMaterialWordCount = countWords(cleanedText);
  state.lastUploadedFileNames = [String(file.name || "")].filter(Boolean);
  state.materialBootstrapActive = false;

  void startDocumentPreparation(doc, {
    studyNotes: state.studyNotes,
    onProgress: () => {
      renderFlowPanel(getActiveSession());
    },
  }).then(() => {
    renderFlowPanel(getActiveSession());
  });

  const refreshed = getActiveSession();
  resetModeSelectUi();
  renderFlowPanel(refreshed);
  showScreen("modeSelect");
  return refreshed?.shared?.modeRecommendation ?? null;
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

function wireFlowPanelHandlers() {
  if (flowPanelWired) return;
  flowPanelWired = true;

  els.recommendationStartBtn?.addEventListener("click", () => {
    const doc = getActiveSession();
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
export function renderFlowPanel(doc = getActiveSession()) {
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
  const subtitle = buildRecommendationSubtitle(recommendation, doc);

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

export function persistModeSliceToDocument(doc, mode, slice) {
  if (!doc?.modes) return;
  const slot = normalizeStudyMode(mode);
  doc.modes[slot] = slice;
  saveDocumentSession(doc);
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
  criticalMode = false,
  language,
}) {
  const lang = String(language || getStudyLanguage()).trim() || "English";
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
      normalizedTextFull: String(normalizedText || ""),
      normalizedFormat: normalizedFormat === "html_min" ? "html_min" : "markdown",
      readingScope: null,
      phase: "scope",
      criticalMode: Boolean(criticalMode),
      fillableMapMode: false,
      checkpointsEnabled: true,
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
  return "RSVP";
}

/** QA stub â€” delegates to recall controller when document session exists. */
export function showRecallStudyStub() {
  const doc = getActiveSession();
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

function getRecallController() {
  if (!recallStudyController) {
    recallStudyController = createRecallStudyController({
      els,
      getDoc: () => getActiveSession(),
      persistSlice: persistModeSliceToDocument,
      showScreen,
      setStudyMode: (mode) => {
        state.studyMode = mode;
      },
      runConceptInventoryForDoc: async () => {
        const doc = getActiveSession();
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
      updateFlowProgress: (doc) => {
        if (!doc?.shared?.modeRecommendation) return;
        const updated = updateFlowProgress(doc.shared.modeRecommendation, doc);
        updateRecommendation(doc.docId, updated);
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

function resetModeSelectUi() {
  document.querySelectorAll('input[name="studyMode"]').forEach((r) => {
    r.checked = false;
  });
  modeSelectManualOpen = false;
  clearFlowRecommendFeedback();
  for (const mode of ["rsvp", "slow", "cloze", "questions", "recall"]) {
    if (loadSessionForMode(mode)) {
      setStudyModeRadio(mode);
      break;
    }
  }
}

function triggerVaultUpdateOnSessionExit() {
  const doc = getActiveSession();
  if (!doc?.docId) return;
  const mode = String(state.studyMode || "rsvp").trim() || "rsvp";
  const sessionForVault = {
    ...doc,
    modes: {
      rsvp: loadSessionForMode("rsvp"),
      slow: loadSessionForMode("slow"),
      cloze: loadSessionForMode("cloze"),
      questions: loadSessionForMode("questions"),
    },
  };
  void import("./vault/session-close.js")
    .then(async (m) => {
      await m.updateVaultFromSession(sessionForVault, mode);
      const { syncVaultToReviewPool } = await import("./vault/spaced-review.js");
      const fresh = getActiveSession();
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
      : { projectId: "misc", shared: { docTopics: Array.isArray(docOrTopics) ? docOrTopics : [] } };
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

function recordVaultAssessmentContradictions(items, responses, presumedMap) {
  const doc = getActiveSession();
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
  saveDocumentSession(doc);
}

export function enterModeSelectScreen() {
  triggerVaultUpdateOnSessionExit();
  syncFlowExitState();
  persistFlowRecommendationProgress();
  resetModeSelectUi();
  resetCreateScreenModeUi();
  renderFlowPanel(getActiveSession());
  mountModeSelectBreadcrumb(getActiveSession());
  syncSessionHubActions();
  showScreen("modeSelect");
  syncExportButtonsEnabled();
  syncPersistenceHealthBanner();
}

let createSessionStartRunId = 0;

function guessSessionNameFromFileName(fileName) {
  const raw = String(fileName || "").trim();
  if (!raw) return "Untitled session";
  return raw.replace(/\.[^/.]+$/, "").trim() || "Untitled session";
}

function applySessionTitleToActiveDoc(title) {
  const doc = getActiveSession();
  const safeTitle = String(title || "").trim();
  if (!doc || !safeTitle) return;
  doc.shared.docMeta = {
    ...(doc.shared.docMeta || {}),
    titleInferred: safeTitle,
  };
  saveDocumentSession(doc);
}

async function handleCreateSessionStartFilePicked() {
  const file = els.createSessionStartFileInput?.files?.[0];
  if (!file) return;
  const runId = ++createSessionStartRunId;
  if (els.createSessionStartStatus) {
    els.createSessionStartStatus.textContent = "Extracting textâ€¦";
  }
  if (els.createSessionStartContinueBtn) {
    els.createSessionStartContinueBtn.disabled = true;
  }
  if (els.createSessionStartNameInput) {
    els.createSessionStartNameInput.disabled = true;
  }
  try {
    const { cleanedText, originalFormat } = await readAndCleanMaterialText(file);
    if (!String(cleanedText || "").trim()) {
      throw new Error("The file appears to be empty.");
    }
    if (runId !== createSessionStartRunId) return;
    const doc = await ensureDocumentSessionForUpload(cleanedText);
    const suggestedTitle = guessSessionNameFromFileName(file.name);
    setUploadMeta(doc.docId, {
      fileName: String(file.name || ""),
      originalFormat: String(originalFormat || ""),
      uploadedAt: new Date().toISOString(),
    });
    doc.shared.docMeta = {
      ...(doc.shared.docMeta || {}),
      titleInferred: suggestedTitle,
    };
    saveDocumentSession(doc);
    state.lastCleanedMaterialText = cleanedText;
    state.lastCleanedMaterialWordCount = countWords(cleanedText);
    state.lastUploadedFileNames = [String(file.name || "")].filter(Boolean);
    if (els.createSessionStartNameInput) {
      els.createSessionStartNameInput.disabled = false;
      els.createSessionStartNameInput.value = suggestedTitle;
    }
    if (els.createSessionStartContinueBtn) {
      els.createSessionStartContinueBtn.disabled = false;
    }
    if (els.createSessionStartStatus) {
      els.createSessionStartStatus.textContent = "Preparing documentâ€¦";
    }
    mountModeSelectBreadcrumb(doc);
    void startDocumentPreparation(doc, {
      studyNotes: state.studyNotes,
      onProgress: (msg) => {
        if (runId !== createSessionStartRunId) return;
        if (els.createSessionStartStatus) {
          els.createSessionStartStatus.textContent = formatPreparationProgressMessage(msg);
        }
      },
    })
      .then(() => {
        if (runId !== createSessionStartRunId) return;
        if (els.createSessionStartStatus) {
          els.createSessionStartStatus.textContent = "Document ready. You can continue.";
        }
      })
      .catch(() => {
        if (runId !== createSessionStartRunId) return;
        if (els.createSessionStartStatus) {
          els.createSessionStartStatus.textContent =
            "Document uploaded. Preparation incomplete; you can continue anyway.";
        }
      });
  } catch (err) {
    if (runId !== createSessionStartRunId) return;
    if (els.createSessionStartStatus) {
      els.createSessionStartStatus.textContent = err?.message
        ? String(err.message)
        : "Could not process this file.";
    }
  }
}

function handleCreateSessionStartContinue() {
  const doc = getActiveSession();
  if (!doc?.docId) {
    if (els.createSessionStartStatus) {
      els.createSessionStartStatus.textContent = "Upload a file before continuing.";
    }
    return;
  }
  const title = String(els.createSessionStartNameInput?.value || "").trim();
  applySessionTitleToActiveDoc(title || "Untitled session");
  enterModeSelectScreen();
}

export function enterCreateSessionStartScreen() {
  createSessionStartRunId += 1;
  if (els.createSessionStartFileInput) {
    els.createSessionStartFileInput.value = "";
  }
  const doc = getActiveSession();
  const defaultName = doc?.shared?.docMeta?.titleInferred || "";
  if (els.createSessionStartNameInput) {
    els.createSessionStartNameInput.value = defaultName;
    els.createSessionStartNameInput.disabled = !doc;
  }
  if (els.createSessionStartContinueBtn) {
    els.createSessionStartContinueBtn.disabled = !doc;
  }
  if (els.createSessionStartStatus) {
    els.createSessionStartStatus.textContent = doc
      ? "Document loaded. Update session name and continue."
      : "Upload your material to start.";
  }
  mountModeSelectBreadcrumb(doc || null);
  showScreen("createSessionStart");
}

export function enterAppHome() {
  refreshVaultReviewBadge();
  showScreen("appHome");
}

export function enterVaultBranch() {
  showScreen("vaultBranch");
}

/**
 * Inventory-only ingest â€” creates DocumentSession with gray concepts, no mode slices.
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
  setUploadMeta(doc.docId, {
    fileName,
    originalFormat,
    uploadedAt: new Date().toISOString(),
  });
  setActiveSession(doc.docId);
  await startDocumentPreparation(doc, { stopAfterTier: 1 });
  return getSession(doc.docId);
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

function syncSessionHubActions() {
  const doc = getActiveSession();
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

function renderUploadVaultCandidates() {
  const list = els.uploadVaultCandidateList;
  if (!list) return;
  const doc = getActiveSession();
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
  const doc = getActiveSession();
  if (!doc?.docId) {
    enterModeSelectScreen();
    return;
  }
  if (els.uploadVaultError) {
    els.uploadVaultError.hidden = true;
    els.uploadVaultError.textContent = "";
  }
  if (els.btnUploadVaultRetry) els.btnUploadVaultRetry.hidden = true;
  if (els.uploadVaultStatus) els.uploadVaultStatus.textContent = "Loading suggestionsâ€¦";
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
  const doc = getActiveSession();
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
  if (els.uploadVaultStatus) els.uploadVaultStatus.textContent = "Queuing vault uploadâ€¦";
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
      els.uploadVaultStatus.textContent = "Uploading to vault in backgroundâ€¦";
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
  let session = getActiveSession() || getSession(docId);
  if (!session || session.docId !== docId) {
    session = getSession(docId) || { docId, shared: { conceptInventory: [], docTopics: [] } };
  }
  await processUploadQueue(session, () => syncVaultUploadResumeBanner());
  syncVaultUploadResumeBanner();
}

function refreshVaultReviewBadge() {
  const badge = els.vaultReviewBadge;
  if (!badge) return;
  const due = getVaultReviewDueCount();
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

/**
 * @param {{ docId?: string, entrySource?: string, returnScreen?: string }} [options]
 */
export function enterRetrievalHub(options = {}) {
  const docId = String(options.docId || getActiveSession()?.docId || "").trim();
  const doc = docId ? getSession(docId) : null;
  if (!doc) {
    enterDocLibraryScreen();
    return;
  }
  if (docId !== getActiveSession()?.docId) {
    setActiveSession(docId);
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
  showScreen("retrievalHub");
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

function ingestSm2FromTestAnswer({ correct, firstTry = true, usedHint = false, skipped = false }) {
  try {
    const doc = getActiveSession();
    if (!doc?.docId) return;
    const blocks = getBlocksSafe();
    const block = blocks[state.activeBlockIndex];
    const blockId = String(block?.block_id ?? block?.id ?? state.activeBlockIndex);
    const conceptIds = Array.isArray(block?.concept_ids)
      ? block.concept_ids
      : Array.isArray(block?.concepts)
        ? block.concepts.map((c) => c?.canonicalId || c?.label || c).filter(Boolean)
        : [];
    registerOrUpdateSmItem(doc.docId, {
      sourceType: "rsvp_block",
      sourceId: blockId,
      title: getBlockTitleSafe(state.activeBlockIndex),
      contentPreview: conceptIds.slice(0, 3).join(", "),
      quality: mapMcqOutcomeToQuality({ correct, firstTry, usedHint, skipped }),
    });
    void promoteFromMcqBlock({
      docId: doc.docId,
      conceptIds,
      correct,
      firstTry,
      usedHint,
      skipped,
      source: isQuestionsStudyMode() ? "questions" : "rsvp",
    });
  } catch (err) {
    console.warn("[sm2-ingest] RSVP ingest failed", err);
  }
}

function promoteConceptInventoryToShared(inventory, detectedBy = "rsvp") {
  const doc = getActiveSession();
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
  if (concepts.length) addConceptsToShared(doc.docId, concepts);
}

function persistInventoryRunMeta(doc, invResult) {
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
  saveDocumentSession(doc);
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
      "Concept inventory partially recovered â€” some sections could not be processed. Results may be incomplete.",
    );
  }
}

async function ensureDocHierarchyForInventory(doc, cleanedText, wordCount, onProgress) {
  let docHierarchy = doc?.shared?.docHierarchy;
  if (docHierarchy?.tree?.length || wordCount <= 8000) return docHierarchy;
  if (typeof onProgress === "function") onProgress("Building document structureâ€¦");
  docHierarchy = await buildDocumentHierarchy(cleanedText, null, { useCache: true });
  if (doc?.shared && docHierarchy) {
    doc.shared.docHierarchy = docHierarchy;
    saveDocumentSession(doc);
  }
  return docHierarchy;
}

function syncActiveSessionAssessmentSignals() {
  const doc = getActiveSession();
  const session = state.activeSession;
  if (!doc?.docId || !session?._responses) return;
  const mode = normalizeStudyMode(session.studyMode || state.studyMode);
  if (mode !== "rsvp" && mode !== "questions") return;
  try {
    syncAssessmentSignalsToShared(doc.docId, session, mode);
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
  if (!Number.isFinite(n) || n <= 0) return "â€”";
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

/** @returns {{ docId: string, title: string, modes: string[], smDue: number, updatedAt: number }[]} */
export function buildDocLibraryRows() {
  return getAllSessions().map((doc) => ({
    docId: doc.docId,
    title: doc.shared?.docMeta?.titleInferred || "Untitled document",
    modes: Object.entries(doc.modes || {})
      .filter(([, value]) => value != null)
      .map(([key]) => key),
    smDue: getSmItemsDueToday(doc.docId).length,
    updatedAt: doc.updatedAt || 0,
  }));
}

export function renderDocLibrary() {
  const container = els.docLibraryList;
  if (!container) return;

  const rows = buildDocLibraryRows();
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
      return `<button type="button" class="doc-library-item" data-doc-id="${escapeDocLibraryHtml(row.docId)}" role="listitem">
        <span class="doc-library-title">${escapeDocLibraryHtml(row.title)}</span>
        <span class="doc-library-meta">
          <span class="doc-library-modes">${escapeDocLibraryHtml(formatDocLibraryModes(row.modes))}</span>
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

function reopenDocumentFromLibrary(docId) {
  const id = String(docId || "").trim();
  if (!id || !getSession(id)) return;
  setActiveSession(id);
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
 * @param {{ llmModel?: string, language?: string, criticalMode?: boolean }} [options]
 */
export function applyModeEntry(doc, mode, options = {}) {
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
    persistModeSliceToDocument(doc, mode, slice);
    return { action: "bootstrap", mode: normalized, slice };
  }
  return { action: "upload_required", mode: normalized, slice: null };
}

function showBootstrappedCreateScreen(mode, slice, doc) {
  hydrateMaterialStateFromDoc(doc);
  state.studyMode = mode;
  state.activeSession = slice;
  storeActiveSession(slice);
  setStudyModeRadio(mode);
  if (els.createModeLabel) {
    els.createModeLabel.textContent = getStudyModeLabel(mode);
  }
  updateCreateScreenModeVisibility(mode);

  if (mode === "slow") {
    if (doc.shared?.docHierarchy) {
      slice.docHierarchy = doc.shared.docHierarchy;
      storeActiveSession(slice);
    }
    setGenerateBlocksFormHidden(true);
    clearMaterialBootstrapUi();
    showScreen("slowScope");
    renderSlowScopeScreen(slice);
    return;
  }

  if (mode === "cloze") {
    setGenerateBlocksFormHidden(true);
    setMaterialBootstrapUi(true, doc);
    updateClozeSessionPanel(slice);
    showCreateScreen();
    return;
  }

  setGenerateBlocksFormHidden(false);
  setMaterialBootstrapUi(true, doc);
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

  applyFlowRecommendationOnEnterMode(normalized);
  const doc = getActiveSession();
  const entry = applyModeEntry(doc, normalized, {
    llmModel: getSessionLlmModel(),
    language: getStudyLanguage(),
  });

  if (entry.action === "resume" && entry.slice) {
    if (normalized === "slow") resumeSlowSession(entry.slice);
    else if (normalized === "cloze") resumeClozeSession(entry.slice);
    else if (normalized === "questions") resumeQuestionsSession(entry.slice);
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

function shouldRunPrePackingAssessment() {
  if (!isPrePackingAssessmentEnabled()) return false;
  if (isOfflineMode()) return false;
  return els.rsvpRunAssessment?.checked !== false;
}

function updateCreateScreenModeVisibility(mode) {
  const isSlow = mode === "slow";
  const isRsvp = mode === "rsvp";
  const isCloze = mode === "cloze";
  const isQuestions = mode === "questions";
  const showComments = isRsvp || isQuestions;
  if (els.generateBlocksForm) {
    els.generateBlocksForm.classList.toggle("create-form--slow", isSlow);
  }
  if (els.rsvpOfflinePackRow) els.rsvpOfflinePackRow.hidden = !isRsvp;
  if (els.rsvpBlocksCountGroup) els.rsvpBlocksCountGroup.hidden = !isRsvp;
  if (els.rsvpCommentsGroup) els.rsvpCommentsGroup.hidden = !showComments;
  if (els.rsvpAssessmentOption) {
    els.rsvpAssessmentOption.hidden = !isRsvp || isOfflineMode() || !isPrePackingAssessmentEnabled();
  }
  if (els.slowOnlyControls) els.slowOnlyControls.hidden = !isSlow;
  if (els.clozeImportSection) els.clozeImportSection.hidden = !isCloze;
  if (els.blocksInput) els.blocksInput.required = isRsvp;
  if (!isRsvp) invalidateBlockSplitCacheAndRecommendUi();
  else void maybeAutoRecommendBlockCount();
  if (els.generateBlocksBtn) {
    const bootstrapped = Boolean(state.materialBootstrapActive);
    if (bootstrapped && (isSlow || isCloze)) {
      els.generateBlocksBtn.textContent = "Continue with loaded material â†’";
    } else if (isQuestions) {
      els.generateBlocksBtn.textContent = "Generate questions";
    } else {
      els.generateBlocksBtn.textContent =
        isSlow || isCloze ? "Upload and continue â†’" : "Generate blocks";
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
      els.clozePipelineProgress.textContent = `Generating items â€” Phase ${phaseNum + 1}/5: ${getPhaseLabel(phaseNum)}`;
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

function resumeClozeSession(session) {
  if (session?.language) syncStudyLanguage(session.language);
  state.activeSession = session;
  state.studyMode = "cloze";
  storeActiveSession(session);
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
  storeActiveSession(session);

  try {
    const result = await runClozePipelinePhases(session.cloze.normalizedText, session, {
      onPhase(phaseIndex, statusKey, partial = {}) {
        session.cloze.pipelinePhase = phaseIndex;
        session.cloze.pipelineStatus = statusKey;
        if (partial.epistemicGraph) session.cloze.epistemicGraph = partial.epistemicGraph;
        if (partial.analysis) session.cloze.analysis = partial.analysis;
        if (partial.items) session.cloze.items = partial.items;
        updateClozeSessionPanel(session);
        storeActiveSession(session);
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
    applyAssessmentPrioritizedOrder(session, getActiveSession());
    updateClozeSessionPanel(session);
    storeActiveSession(session);
  } catch (err) {
    session.cloze.pipelineStatus = "failed";
    session.cloze.pipelineError = err?.message ? String(err.message) : String(err);
    updateClozeSessionPanel(session);
    storeActiveSession(session);
  } finally {
    clozePipelineRunning = false;
  }
}

function setClozeImportError(msg) {
  if (!els.clozeImportError) return;
  const text = String(msg || "").trim();
  els.clozeImportError.hidden = !text;
  els.clozeImportError.textContent = text;
}

async function importClozePacksFromInput() {
  clearClozeImportError();
  if (els.clozeImportStatus) els.clozeImportStatus.textContent = "";
  const fileList = els.clozeImportInput?.files ? Array.from(els.clozeImportInput.files) : [];
  if (!fileList.length) {
    setClozeImportError("Choose at least one exported .md cloze pack file.");
    return;
  }
  if (els.clozeImportBtn) els.clozeImportBtn.disabled = true;
  if (els.clozeImportStatus) els.clozeImportStatus.textContent = "Importingâ€¦";
  try {
    const result = await parseClozePackFiles(fileList, readFileAsText);
    if (!result.ok) {
      const detail = Array.isArray(result.errors) && result.errors.length ? result.errors.join(" Â· ") : "";
      throw new Error(
        detail ||
          (result.reason === "no_valid_items"
            ? "No valid items in the selected files."
            : "Could not import any cloze pack."),
      );
    }
    const sessionObj = result.session;
    state.activeSession = sessionObj;
    state.studyMode = "cloze";
    storeActiveSession(sessionObj);
    setGenerateBlocksFormHidden(true);
    updateClozeSessionPanel(sessionObj);
    showCreateScreen();
    const warn =
      Array.isArray(result.errors) && result.errors.length
        ? ` (${result.errors.length} file(s) skipped)`
        : "";
    if (els.clozeImportStatus) {
      els.clozeImportStatus.textContent = `${result.validCount} items from ${result.packCount} pack(s)${warn}`;
    }
  } catch (err) {
    setClozeImportError(err?.message ? String(err.message) : String(err));
    if (els.clozeImportStatus) els.clozeImportStatus.textContent = "";
  } finally {
    if (els.clozeImportBtn) els.clozeImportBtn.disabled = false;
  }
}

function clearClozeImportError() {
  setClozeImportError("");
}

function wireClozeImportHandlers() {
  els.clozeImportInput?.addEventListener("change", () => {
    clearClozeImportError();
    const fileList = els.clozeImportInput?.files ? Array.from(els.clozeImportInput.files) : [];
    if (els.clozeImportHint) {
      els.clozeImportHint.textContent = fileList.length
        ? `${fileList.length} archivo(s): ${fileList.map((f) => f.name).join(", ")}`
        : "";
    }
  });
  els.clozeImportBtn?.addEventListener("click", () => {
    void importClozePacksFromInput();
  });
}

function mountClozeGraph(session) {
  if (!els.clozeGraphMount || !session?.cloze?.epistemicGraph) return;
  els.clozeGraphMount.hidden = false;
  mountMaterialGraphScreen(session, els.clozeGraphMount, { mode: "cloze" });
}

function showModeResumeOrUpload(mode) {
  state.studyMode = mode;
  updateCreateScreenModeVisibility(mode);
  setGenerateBlocksFormHidden(false);
}

function resumeSlowSession(session) {
  if (session?.language) syncStudyLanguage(session.language);
  state.activeSession = session;
  state.studyMode = "slow";
  storeActiveSession(session);
  if (String(session?.slow?.phase || "") === "scope") {
    renderSlowScopeScreen(session);
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

function resumeRsvpSession(session) {
  state.activeSession = session;
  state.studyMode = "rsvp";
  storeActiveSession(session);
  const n = Math.max(1, Number(session?.n_blocks) || 1);
  if (els.sessionReadyMeta) {
    els.sessionReadyMeta.textContent = `Session ready. Blocks: ${n}`;
  }
  setFullPackEntryCta(n);
  showScreen("ready");
}

function resumeQuestionsSession(session) {
  state.activeSession = session;
  state.studyMode = "questions";
  storeActiveSession(session);
  const n = Math.max(1, Number(session?.n_blocks) || 1);
  if (els.sessionReadyMeta) {
    els.sessionReadyMeta.textContent = "Questions session ready.";
  }
  setFullPackEntryCta(n);
  showScreen("ready");
}

function selectSlowScope(session, opt, listEl) {
  const slow = session?.slow;
  if (!slow || !opt) return;
  listEl?.querySelectorAll("button[data-scope-id]").forEach((b) => {
    b.setAttribute("aria-selected", String(b.dataset.scopeId === opt.id));
  });
  slow.readingScope = {
    id: opt.id,
    kind: opt.kind,
    charStart: opt.charStart,
    charEnd: opt.charEnd,
    label: opt.label,
  };
  const chars = scopeCharCount(opt);
  if (els.slowScopeConfirmBtn) els.slowScopeConfirmBtn.disabled = false;
  if (els.slowScopeCharCount) {
    els.slowScopeCharCount.textContent = `Scope selected: ${formatCharCount(chars)} characters`;
  }
  if (els.slowScopeLongWarning) {
    els.slowScopeLongWarning.hidden = chars < SCOPE_CHAR_WARN;
    if (!els.slowScopeLongWarning.hidden) {
      els.slowScopeLongWarning.textContent =
        "Scope â‰¥ 60k characters â€” Phase 0 will use map-reduce by section.";
    }
  }
  storeActiveSession(session);
}

function groupScopeOptionsHierarchical(options) {
  const full = options.find((o) => o.kind === "full");
  const sections = options.filter((o) => o.kind !== "full");
  const l1 = sections.filter((o) => (o.level || 2) === 1);
  const childrenByParent = new Map();
  for (const opt of sections) {
    if ((opt.level || 2) === 1) continue;
    const parent = opt.parentLabel || "";
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent).push(opt);
  }
  return { full, l1, childrenByParent, sections };
}

function slowHierarchyLoadingActive(session) {
  return Boolean(session?._docHierarchyLoading);
}

async function populateDocumentHierarchy(session, markdownText, llmModel) {
  const text = String(markdownText || "");
  const needsLlm = text.length >= 3000 && !hasMarkdownHeadings(text);
  let llmFn = null;
  if (needsLlm && getApiKeyForLlmModel(llmModel)) {
    llmFn = async ({ systemPrompt, userPrompt, temperature, maxTokens, signal }) =>
      llmChatCompletions({
        llmModel: normalizeLlmModel(llmModel),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
        signal,
      });
  }

  if (needsLlm && !llmFn) {
    session.docHierarchy = null;
    syncSlowDocHierarchyToShared(session);
    const doc = getActiveSession();
    if (doc) computeAndPersistModeRecommendation(doc, text, null);
    return;
  }

  if (needsLlm && llmFn) {
    session._docHierarchyLoading = true;
    if (state.activeSession === session) {
      renderSlowScopeScreen(session);
    }
  }

  try {
    const hierarchyResult = await buildDocumentHierarchy(text, llmFn, { useCache: true });
    session.docHierarchy = hierarchyResult;
    syncSlowDocHierarchyToShared(session);
    const doc = getActiveSession();
    if (doc) computeAndPersistModeRecommendation(doc, text, hierarchyResult);
  } finally {
    session._docHierarchyLoading = false;
    storeActiveSession(session);
    if (state.activeSession === session) {
      renderSlowScopeScreen(session);
    }
  }
}

function renderSlowScopeScreen(session) {
  const slow = session?.slow;
  if (!slow) return;

  if (els.slowScopeHierarchyLoading) {
    const loading = slowHierarchyLoadingActive(session);
    els.slowScopeHierarchyLoading.hidden = !loading;
    if (loading) {
      els.slowScopeHierarchyLoading.textContent =
        "Analyzing document structureâ€¦";
    }
  }

  const options = buildScopeOptions(slow.normalizedTextFull, slow.normalizedFormat, {
    headingOverrides: slow.headingOverrides || [],
    fallbackSections: slow.fallbackSections || undefined,
    docHierarchy: session.docHierarchy,
  });
  const listEl = els.slowScopeList;
  if (!listEl) return;
  listEl.innerHTML = "";

  if (els.slowScopeWarningBanner) {
    const lowConf = (slow.structureWarnings || []).includes("low_heading_confidence");
    els.slowScopeWarningBanner.hidden = !lowConf;
    if (lowConf) {
      els.slowScopeWarningBanner.textContent =
        "No sections were detected automatically. Add divisions manually or study the full document.";
    }
  }

  if (els.slowScopeEditBtn) {
    els.slowScopeEditBtn.textContent = slow.scopeEditMode ? "Done" : "Edit sections";
    if (!els.slowScopeEditBtn._wired) {
      els.slowScopeEditBtn._wired = true;
      els.slowScopeEditBtn.addEventListener("click", () => {
        const s = state.activeSession;
        if (!s?.slow) return;
        s.slow.scopeEditMode = !s.slow.scopeEditMode;
        storeActiveSession(s);
        renderSlowScopeScreen(s);
      });
    }
  }

  if (els.slowScopeAutoSplitBtn) {
    const showAuto =
      (slow.structureWarnings || []).includes("low_heading_confidence") &&
      !slow.fallbackSections?.length;
    els.slowScopeAutoSplitBtn.hidden = !showAuto;
    if (!els.slowScopeAutoSplitBtn._wired) {
      els.slowScopeAutoSplitBtn._wired = true;
      els.slowScopeAutoSplitBtn.addEventListener("click", () => {
        const s = state.activeSession;
        if (!s?.slow) return;
        s.slow.fallbackSections = buildEqualLengthSections(s.slow.normalizedTextFull, {
          targetChunkSize: 5000,
          labelPrefix: "Section",
        });
        storeActiveSession(s);
        renderSlowScopeScreen(s);
      });
    }
  }

  const selectedId = slow.readingScope?.id || null;
  const editMode = Boolean(slow.scopeEditMode);
  const { full, l1, childrenByParent } = groupScopeOptionsHierarchical(options);

  function appendScopeRow(opt, { indent = false, child = false } = {}) {
    const li = document.createElement("li");
    li.className = child ? "slow-scope-child" : indent ? "slow-scope-indent" : "";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "option");
    btn.dataset.scopeId = opt.id;
    btn.dataset.charStart = String(opt.charStart);
    btn.dataset.charEnd = String(opt.charEnd);
    btn.dataset.kind = opt.kind;
    const sizeLabel = opt.displaySize || formatCharCount(scopeCharCount(opt));
    btn.textContent = `${opt.label} (${sizeLabel})`;
    btn.setAttribute("aria-selected", String(selectedId === opt.id));
    btn.addEventListener("click", () => selectSlowScope(session, opt, listEl));
    li.appendChild(btn);

    if (editMode && opt.kind !== "full") {
      const actions = document.createElement("span");
      actions.className = "slow-scope-edit-actions";
      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.textContent = "Renombrar";
      renameBtn.className = "btn-link";
      renameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const newLabel = window.prompt("New section name:", opt.label);
        if (!newLabel?.trim()) return;
        slow.headingOverrides = slow.headingOverrides || [];
        slow.headingOverrides.push({
          type: "rename",
          headingId: opt.id,
          newLabel: newLabel.trim(),
        });
        storeActiveSession(session);
        renderSlowScopeScreen(session);
      });
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Eliminar";
      removeBtn.className = "btn-link";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        slow.headingOverrides = slow.headingOverrides || [];
        slow.headingOverrides.push({ type: "remove", headingId: opt.id });
        storeActiveSession(session);
        renderSlowScopeScreen(session);
      });
      actions.append(renameBtn, removeBtn);
      li.appendChild(actions);
    }

    listEl.appendChild(li);
    return li;
  }

  if (full) appendScopeRow(full);

  for (const parent of l1) {
    const children = childrenByParent.get(parent.label) || [];
    const collapsed = slow.scopeCollapsedParents?.[parent.id] !== false;
    const li = document.createElement("li");
    li.className = "slow-scope-parent";

    if (children.length) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "slow-scope-toggle";
      toggle.textContent = collapsed ? "â–¶" : "â–¼";
      toggle.setAttribute("aria-label", collapsed ? "Expand" : "Collapse");
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        slow.scopeCollapsedParents = slow.scopeCollapsedParents || {};
        slow.scopeCollapsedParents[parent.id] = !collapsed;
        storeActiveSession(session);
        renderSlowScopeScreen(session);
      });
      li.appendChild(toggle);
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "option");
    btn.dataset.scopeId = parent.id;
    btn.dataset.charStart = String(parent.charStart);
    btn.dataset.charEnd = String(parent.charEnd);
    btn.dataset.kind = parent.kind;
    const parentSize = parent.displaySize || formatCharCount(scopeCharCount(parent));
    btn.textContent = `${parent.label} (${parentSize})`;
    btn.setAttribute("aria-selected", String(selectedId === parent.id));
    btn.addEventListener("click", () => selectSlowScope(session, parent, listEl));
    li.appendChild(btn);
    listEl.appendChild(li);

    if (!collapsed && children.length) {
      for (const child of children) {
        appendScopeRow(child, { child: true });
      }
    }
  }

  const orphanSections = options.filter(
    (o) => o.kind !== "full" && (o.level || 2) !== 1 && !o.parentLabel,
  );
  for (const opt of orphanSections) {
    if (l1.some((p) => childrenByParent.get(p.label)?.includes(opt))) continue;
    appendScopeRow(opt, { indent: true });
  }

  if (els.slowScopeConfirmBtn) {
    els.slowScopeConfirmBtn.disabled = !slow.readingScope;
  }
  if (els.slowScopeCharCount && slow.readingScope) {
    const chars = scopeCharCount(slow.readingScope);
    els.slowScopeCharCount.textContent = `Scope selected: ${formatCharCount(chars)} characters`;
  }
  if (els.slowScopeFillableMap) {
    els.slowScopeFillableMap.checked = Boolean(slow.fillableMapMode);
    if (!els.slowScopeFillableMap._wired) {
      els.slowScopeFillableMap._wired = true;
      els.slowScopeFillableMap.addEventListener("change", () => {
        const s = state.activeSession;
        if (!s?.slow) return;
        s.slow.fillableMapMode = Boolean(els.slowScopeFillableMap.checked);
        storeActiveSession(s);
      });
    }
  }
  if (els.slowScopeCheckpoints) {
    els.slowScopeCheckpoints.checked = slow.checkpointsEnabled !== false;
    if (!els.slowScopeCheckpoints._wired) {
      els.slowScopeCheckpoints._wired = true;
      els.slowScopeCheckpoints.addEventListener("change", () => {
        const s = state.activeSession;
        if (!s?.slow) return;
        s.slow.checkpointsEnabled = Boolean(els.slowScopeCheckpoints.checked);
        storeActiveSession(s);
      });
    }
  }
}

function setSlowPhase0Controls({ showRetry = false, showSkip = false, showContinue = false } = {}) {
  if (els.slowPhase0RetryBtn) els.slowPhase0RetryBtn.hidden = !showRetry;
  if (els.slowPhase0SkipBtn) els.slowPhase0SkipBtn.hidden = !showSkip;
  if (els.slowPhase0ContinueBtn) els.slowPhase0ContinueBtn.hidden = !showContinue;
}

const PHASE0_MAX_CONCEPTS = 5;

function persistPhase0Edits(session) {
  if (!session?.slow?.phase0) return;
  storeActiveSession(session);
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
    input.placeholder = "Pregunta antes de leerâ€¦";
    input.addEventListener("input", () => {
      phase0.prequestions[index] = input.value.trim();
      persistPhase0Edits(session);
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "slow-phase0-icon-btn";
    del.textContent = "Ã—";
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
    del.textContent = "Ã—";
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
  placeholder.textContent = "Add from dictionaryâ€¦";
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
      phase0.criticalExaminePoints.map((p) => `Â· ${p}`).join("\n"),
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
        els.slowPhase0Progress.textContent = "Generating orientationâ€¦";
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
    renderSlowPhase0GraphActions(session);
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

  const doc = getActiveSession();
  const cachedOrientation = doc?.shared?.slowOrientation?.payload;
  if (cachedOrientation && typeof cachedOrientation === "object") {
    slow.phase0 = applyFillableMapMode(
      ensurePhase0UserFields(cachedOrientation),
      slow.fillableMapMode,
    );
    slow.phase0Status = "ready";
    slow.phase0Error = null;
    storeActiveSession(session);
    renderSlowPhase0Screen(session);
    return;
  }

  const token = ++phase0GenerationToken;
  slow.phase0Status = "generating";
  slow.phase0Error = null;
  if (els.slowPhase0Progress) {
    els.slowPhase0Progress.hidden = false;
    els.slowPhase0Progress.textContent = "Generating orientationâ€¦";
  }
  renderSlowPhase0Screen(session);
  storeActiveSession(session);

  const scopeText = getScopeText(session);
  try {
    const orientation = await generatePhase0ForScope(scopeText, session, {
      language: String(session?.language || getStudyLanguage()).trim() || "English",
      onProgress: ({ phase, current, total, label }) => {
        if (token !== phase0GenerationToken) return;
        if (!els.slowPhase0Progress) return;
        els.slowPhase0Progress.hidden = false;
        if (phase === "chunk") {
          els.slowPhase0Progress.textContent = `Phase 0: section ${current}/${total} â€” ${label}`;
        } else {
          els.slowPhase0Progress.textContent = "Phase 0: synthesizing global orientationâ€¦";
        }
      },
    });
    if (token !== phase0GenerationToken) return;
    slow.phase0 = applyFillableMapMode(ensurePhase0UserFields(orientation), slow.fillableMapMode);
    slow.phase0Status = "ready";
    slow.phase0Error = null;
    storeActiveSession(session);
    renderSlowPhase0Screen(session);
  } catch (err) {
    if (token !== phase0GenerationToken) return;
    slow.phase0Status = "failed";
    slow.phase0Error = err?.message ? String(err.message) : "Phase 0 generation failed.";
    storeActiveSession(session);
    renderSlowPhase0Screen(session);
  }
}

function skipSlowPhase0(session) {
  if (!session?.slow) return;
  if (!session.slow.phase0SeenReread) return;
  session.slow.phase0Status = "skipped";
  session.slow.phase0 = null;
  session.slow.phase0Error = null;
  session.slow.phase = "phase1";
  storeActiveSession(session);
  navigateSlowByPhase(session);
  initSlowReader(session);
}

function continueSlowPhase0(session) {
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
  storeActiveSession(session);
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

function wireSlowPhase0Handlers() {
  els.slowPhase0RetryBtn?.addEventListener("click", () => {
    const session = state.activeSession;
    if (!session?.slow) return;
    session.slow.phase0Status = "idle";
    session.slow.phase0Error = null;
    storeActiveSession(session);
    void runPhase0Generation(session);
  });

  els.slowPhase0SkipBtn?.addEventListener("click", () => {
    phase0GenerationToken += 1;
    skipSlowPhase0(state.activeSession);
  });

  els.slowPhase0ContinueBtn?.addEventListener("click", () => {
    continueSlowPhase0(state.activeSession);
  });

  els.slowPhase0CollapseBtn?.addEventListener("click", () => {
    const session = state.activeSession;
    if (!session?.slow) return;
    session.slow.phase0Collapsed = !session.slow.phase0Collapsed;
    renderSlowPhase0Content(session);
    updatePhase0CollapseUi(session);
    storeActiveSession(session);
  });
}

function prepareSlowPhase0Entry(session) {
  const slow = session?.slow;
  if (!slow?.readingScope) return;
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

function wireSlowScopeHandlers() {
  els.slowScopeConfirmBtn?.addEventListener("click", () => {
    const session = state.activeSession;
    if (!session?.slow?.readingScope) return;
    applyFlowRecommendationOnEnterMode("slow");
    if (els.slowScopeFillableMap) {
      session.slow.fillableMapMode = Boolean(els.slowScopeFillableMap.checked);
    }
    if (els.slowScopeCheckpoints) {
      session.slow.checkpointsEnabled = Boolean(els.slowScopeCheckpoints.checked);
    }
    session.slow.phase = "phase0";
    prepareSlowPhase0Entry(session);
    storeActiveSession(session);
    enterSlowPhase0(session);
  });

  els.slowScopeBackBtn?.addEventListener("click", () => {
    enterModeSelectScreen();
  });
}

function wireDocLibraryHandlers() {
  projectLibraryCallbacks.onDocumentOpen = (docId) => reopenDocumentFromLibrary(docId);
  projectLibraryCallbacks.onBack = () => enterAppHome();
  projectLibraryCallbacks.onCreateSessionInProject = (projectId) => {
    setUploadProjectContext(projectId);
    enterCreateSessionStartScreen();
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
  els.btnDownloadSessionMd?.addEventListener("click", () => handleExportSessionClick());
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
  els.createSessionStartFileInput?.addEventListener("change", () => {
    void handleCreateSessionStartFilePicked();
  });
  els.createSessionStartContinueBtn?.addEventListener("click", () => {
    handleCreateSessionStartContinue();
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

  els.criticalModeToggleBtn?.addEventListener("click", () => {
    const pressed = els.criticalModeToggleBtn.getAttribute("aria-pressed") === "true";
    const next = !pressed;
    els.criticalModeToggleBtn.setAttribute("aria-pressed", String(next));
  });
}

let splitMergeSummaryEls = null;

function ensureSplitMergeSummaryEls() {
  if (splitMergeSummaryEls) return splitMergeSummaryEls;
  const host = els.screenBlocksList;
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
      top.textContent = `Keep #${keepId}: ${keepAfter || keepBefore || "Untitled"} â† absorb ${absorbIds
        .map((x) => `#${x}`)
        .join(", ")}`;
      const sub = document.createElement("div");
      sub.className = "hint";
      sub.style.marginTop = "6px";
      sub.textContent =
        absorbTitles.length || keepBefore
          ? `${keepBefore ? `Before: ${keepBefore}. ` : ""}${
              absorbTitles.length ? `Absorbed: ${absorbTitles.filter(Boolean).join(" Â· ")}` : ""
            }`
          : "";
      if (sub.textContent) card.appendChild(sub);
    } else {
      top.textContent = `Keep #${keepId} â† absorb ${absorbIds.map((x) => `#${x}`).join(", ")}`;
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
    state.nTest = clampInt(state.nTest + delta, 0, MAX_N_TEST, 2);
  } else {
    state.nSocratic = clampInt(state.nSocratic + delta, 0, 3, 1);
  }
  renderQuestionConfigUi();
}

function setGenerateLoading(isLoading) {
  els.generateBlocksBtn.disabled = isLoading;
  els.generateBlocksBtn.textContent = isLoading ? "Generatingâ€¦" : "Generate blocks";
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

function hasMaterialForBlockRecommend() {
  const hasFile = Boolean(els.fileInput?.files?.length);
  const doc = getActiveSession();
  const hasBootstrap =
    Boolean(state.materialBootstrapActive) && Boolean(String(doc?.shared?.rawMarkdown || "").trim());
  return hasFile || hasBootstrap;
}

async function maybeAutoRecommendBlockCount() {
  const mode = resolveActiveCreateMode();
  if (mode !== "rsvp") return;
  if (!els.generateBlocksForm || els.generateBlocksForm.hidden) return;
  if (!hasMaterialForBlockRecommend()) return;
  const doc = getActiveSession();
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
  const doc = getActiveSession();
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

  const docEarly = getActiveSession();
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

    if (isBlockSplitCacheValid(cache, fingerprint)) {
      inventory = cache.conceptInventory;
    } else {
      const doc = getActiveSession();
      const docHierarchy = await ensureDocHierarchyForInventory(
        doc,
        cleanedText,
        wordCount,
        (msg) => {
          if (els.recommendBlocksStatus) els.recommendBlocksStatus.textContent = msg;
        },
      );
      const invResult = await runConceptInventoryWithFallback(cleanedText, {
        llmModel,
        studyNotes: String(state.studyNotes || ""),
        language: getStudyLanguage(),
        docHierarchy,
        wordCount,
        nBlocks: Number(els.blocksInput?.value) || 12,
        onProgress: (msg) => {
          if (els.recommendBlocksStatus) els.recommendBlocksStatus.textContent = msg;
        },
      });
      notifyInventoryRunStatus(invResult);
      if (invResult.kind === "fallback_mono") {
        throw new Error(
          "Concept inventory could not be generated. Try a shorter section or chapter scope.",
        );
      }
      inventory = invResult.inventory;
      persistInventoryRunMeta(doc, invResult);
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
    const recommendation = computeBlockCountRecommendation(signals);
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
    els.offlinePackStatus.textContent = isLoading ? "Readingâ€¦" : "";
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
      `${totalBlocks} blocks Â· Generated ${generatedAt}`
      + (failedBlocks > 0 ? ` Â· ${failedBlocks} blocks have no content` : ""),
  });
  if (els.confirmBlocksStatus) {
    els.confirmBlocksStatus.textContent = `${totalBlocks} blocks Â· Generated ${generatedAt}`;
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
  els.confirmBlocksBtn.textContent = isLoading ? "Savingâ€¦" : "Looks good, start session";
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

function handleExportSessionClick() {
  const result = exportSessionMarkdown({ force: true, source: "button" });
  if (result.ok) {
    const blocks = result.blockCount != null ? ` (${result.blockCount} blocks)` : "";
    showExportToast(`Session saved${blocks}`);
    return;
  }
  if (result.error === "no_session") {
    setResumeError("No session to export â€” generate block content first.");
    showExportToast("No session to export", { variant: "error", durationMs: 5000 });
    return;
  }
  if (result.error === "download_blocked") {
    const session = resolveSessionForExport();
    if (session) void copyPlainTextToClipboard(buildMarkdown(session));
    showExportToast("Download blocked â€” content copied to clipboard", {
      variant: "error",
      durationMs: 5000,
    });
    return;
  }
  showExportToast("Could not save session", { variant: "error", durationMs: 5000 });
}

async function handleOfflinePackClick() {
  const result = exportOfflinePack();
  if (result.ok) {
    showExportToast("Offline pack downloaded");
    return;
  }
  const messages = {
    no_session: "No session to export.",
    no_block_content: "Generate block content before downloading offline pack.",
    offline: "Offline pack is not available in offline mode.",
    download_blocked: "Download blocked â€” try again or check browser settings.",
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

function syncPersistenceHealthBanner() {
  const doc = getActiveSession();
  const health = computePersistenceHealth(doc);
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
      ? "Study progress may not be fully saved â€” browser storage is full."
      : "Study progress may not be fully saved â€” block content is missing but dictionary or chat data exists.";

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
      recoverBtn.addEventListener("click", () => {
        const recovered = tryRecoverBlocksFromV1Backup(doc?.modes?.rsvp);
        if (!recovered || !doc) return;
        if (!doc.modes) doc.modes = {};
        const slice = doc.modes.rsvp || { studyMode: "rsvp", blocks: [], n_blocks: recovered.length };
        slice.blocks = recovered;
        slice.n_blocks = Math.max(Number(slice.n_blocks) || 0, recovered.length);
        doc.modes.rsvp = slice;
        saveDocumentSession(doc);
        persistHealthDismissed = true;
        showExportToast("Imported blocks from backup â€” review before continuing");
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
  } = await import("./input-normalization.js?v=20260527_1");

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

  const { normalizedFormat, normalizedContent, warnings, fallbackSections } =
    await normalizeStudyMaterial(rawContent, detectedFormat);

  const cleanedText = normalizedContent;
  return {
    cleanedText,
    wordCount: countWords(cleanedText),
    originalFormat: detectedFormat,
    normalizedFormat,
    warnings: warnings || [],
    fallbackSections: fallbackSections || null,
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
  let timeLabel = "â€”";
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
  try {
    commitSessionConceptsForBlock(state.activeBlockIndex);
  } catch {
    // ignore concept commit errors
  }
  persistFlowRecommendationProgress();
  syncOfflinePackButtonVisibility();
  updateSessionCompleteSummary(computeSessionCompleteSummary());
  showScreen("complete");
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
  return `What's next â€” ${name}`;
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
    o.sneakPeekText.textContent = "Preparing next blockâ€¦";
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
    o.sneakPeekText.textContent = "Writing transition previewâ€¦";
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
  sneakPeekText.textContent = "Preparing next blockâ€¦";

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
  nextTestMinus.textContent = "âˆ’";
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
  nextSocMinus.textContent = "âˆ’";
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

async function ensureBlockGenerated(blockIndex) {
  const existing = getBlock(blockIndex);
  const needsReaderText = !isQuestionsStudyMode(state.activeSession);
  if (needsReaderText) {
    if (blockHasReadableExplanation(existing) && hasGeneratedBlockContent(existing)) {
      return existing;
    }
  } else if (hasGeneratedBlockContent(existing)) {
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
      prevBlockSummaryForConnection = String(prev?.explanation || "")
        .split(/\n\n/)[0]
        .trim()
        .slice(0, 220);
    }

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
    };

    let obj = null;
    try {
      obj = await deepSeekGenerateBlockJson(blockRequest);
    } catch (err) {
      const message = err?.message ? String(err.message) : String(err);
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
    storeActiveSession(state.activeSession, { bumpRev: true });

    warnBlockGenerationProfileMismatch(obj, cfg);
    cleaned = normalizeBlockJson(obj, cfg, blockIndex);
    cleaned.questions = shuffleTestQuestionsInList(cleaned.questions);
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
  storeActiveSession(state.activeSession, { bumpRev: true });
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
  els.socraticSubmitBtn.textContent = isLoading ? "Submittingâ€¦" : "Submit";
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

function ensureTestQuestionShuffled(block, q) {
  if (!q || !block || String(q.type || "").trim().toLowerCase() !== "test") return q;
  if (q._optionsShuffled) return q;
  const shuffled = shuffleTestQuestionOptions(q);
  const qs = Array.isArray(block.questions) ? block.questions : null;
  if (qs) {
    const i = qs.indexOf(q);
    if (i >= 0) {
      qs[i] = shuffled;
      if (state.activeSession) storeActiveSession(state.activeSession, { bumpRev: false });
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
    ? `Knowledge check Â· Q${Math.min(ctx.globalIndex + 1, n)} of ${n}`
    : `Q${Math.min(ctx.globalIndex + 1, n)} of ${n} (${ctx.phase})`;
  if (els.testMeta) {
    if (isPrePackingAssessmentRunner()) {
      els.testMeta.textContent = label;
    } else {
      const totalBlocks = Math.max(1, getTotalBlocksSafe());
      els.testMeta.textContent = `${label} Â· Block ${state.activeBlockIndex + 1} of ${totalBlocks}`;
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
    message = "Anclaje dÃ©bil al documento â€” contrasta con tu PDF.";
  } else if (anchor === "proportional_fallback") {
    message = "Este bloque usa un trozo aproximado del archivo; revisa la fuente.";
  } else if (fidelity === "warn") {
    message = "Fidelidad reducida: parte del contenido podrÃ­a no reflejar la fuente.";
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
          els.testMeta.textContent += " Â· Prerequisite block not studied yet";
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
  setBlockReadSidebarAvailable(true);
}

function beginRsvpForCurrentBlock({ onDone }) {
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
  setRsvpBlockTitle(getBlockTitleSafe(state.activeBlockIndex));
  startRsvpForText(block.explanation || "", onDone);
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
  if (isPacedReaderPreferred()) beginPacedReadForCurrentBlock({ onDone });
  else beginRsvpForCurrentBlock({ onDone });
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
  if (els.testRsvpWord) els.testRsvpWord.textContent = "";
  els.testRsvpStatus.textContent = "Generating blockâ€¦";

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
    els.socraticStatus.textContent = "Generating blockâ€¦";
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
      setBlockReadSidebarAvailable(true);
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

function handleTestAnswer({ chosen, correct, feedback }) {
  testMcAnswered = true;
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
  syncActiveSessionAssessmentSignals();
  ingestSm2FromTestAnswer({
    correct: String(chosen || "").trim().toUpperCase() === String(correct || "").trim().toUpperCase(),
  });

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

  els.testNextBtn.onclick = () => {
    if (!isLastGlobal) {
      state.activeQuestionIndex += 1;
      if (state.activeSession && typeof state.activeSession === "object") {
        state.activeSession.active_question_index = state.activeQuestionIndex;
        storeActiveSession(state.activeSession);
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

function startBlock(blockIndex) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));

  // 1) triggerPrefetch(N+1) â€” fire and forget
  const total = Math.max(1, getTotalBlocksSafe());
  const blockIndexArr = loadBlockIndex() || state.lastBlockIndex || [];
  const nextIdx = resolveNextStudyBlockIndex(idx, blockIndexArr, total);
  if (nextIdx < total) {
    prefetchStartedAtByIndex.set(nextIdx, Date.now());
    setPrefetchIndicator("generating");
    const cfg = resolveBlockQuestionConfig(nextIdx);
    triggerPrefetch(nextIdx, cfg);
  }

  // 2) triggerCommentReply() â€” fire and forget
  if (shouldTriggerCommentReply()) {
    triggerCommentReply();
  }

  // 3) showRSVP(N) â€” uses already-generated block data (not prefetch)
  state.activeBlockIndex = idx;
  state.activeQuestionIndex = 0;
  if (state.activeSession && typeof state.activeSession === "object") {
    state.activeSession.current_block_index = idx;
    state.activeSession.active_question_index = 0;
    storeActiveSession(state.activeSession, { bumpRev: true });
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
    storeActiveSession(state.activeSession, { bumpRev: true });
  }
  return data;
}

function finishRSVP(blockIndex) {
  showQuestions(blockIndex);
}

function showQuestions(blockIndex) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  state.activeBlockIndex = idx;
  state.activeQuestionIndex = 0;
  if (state.activeSession && typeof state.activeSession === "object") {
    state.activeSession.current_block_index = idx;
    state.activeSession.active_question_index = 0;
    storeActiveSession(state.activeSession);
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
  if (isLastQuestionsStudyBlock(idx, studyOrder, total)) {
    showSessionComplete();
    return;
  }

  try {
    commitSessionConceptsForBlock(idx);
  } catch {
    // ignore
  }

  const o = getOrCreateTransitionOverlay();
  const nextIndex = resolveNextStudyBlockForSession(idx, total);
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
    o.statusBarText.textContent = "Preparing next blockâ€¦";
    o.statusBarFill.style.animation = "transitionBarSlide 1.2s ease-in-out infinite";
    o.statusBarFill.style.background = "rgba(148, 163, 184, 0.75)";
    o.statusBarFill.style.transform = "translateX(-120%)";
    o.statusBarFill.style.width = "40%";
  };
  const setStatusReady = () => {
    o.statusBarText.textContent = "Ready âœ“";
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

  const persistNextBlock = (data, cfg) => {
    if (!state.activeSession || typeof state.activeSession !== "object") return;
    if (!Array.isArray(state.activeSession.blocks)) state.activeSession.blocks = [];
    const cleaned = normalizeBlockJson(data, cfg, nextIndex);
    if (Array.isArray(cleaned.questions)) {
      cleaned.questions = shuffleTestQuestionsInList(cleaned.questions);
    }
    state.activeSession.blocks[nextIndex] = cleaned;
    storeActiveSession(state.activeSession, { bumpRev: true });
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
    o.statusBarText.textContent = "Regenerating next blockâ€¦";
    triggerPrefetch(nextIndex, { ...nextCfg, force: true });
    syncPrefetchUi();
  };

  const bumpNext = (kind, delta) => {
    if (kind === "test") nextCfg.n_test = clampInt(nextCfg.n_test + delta, 0, MAX_N_TEST, blockDefaults.n_test);
    else nextCfg.n_socratic = clampInt(nextCfg.n_socratic + delta, 0, 3, blockDefaults.n_socratic);
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
          o.status.textContent = "Regenerating questionsâ€¦";
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
          o.status.textContent = "Regenerating blockâ€¦";
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
    o.status.textContent = "Retryingâ€¦";
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
}

function updateMaterialGraphScreenCopy({ title, hint } = {}) {
  const titleEl = document.getElementById("materialGraphTitle");
  const hintEl = document.getElementById("materialGraphHint");
  if (titleEl && title) titleEl.textContent = title;
  if (hintEl && hint) hintEl.textContent = hint;
}

function openMaterialGraphScreen({
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
  lastMaterialGraph = mountMaterialGraphScreen(session, host, {
    blockIndex,
    conceptInventory,
    mode,
    onNodeClick: (node) => {
      if (!node?.sourceAnnotationId || !session?.slow) return;
      const ann = (session.slow.annotations || []).find((a) => a.id === node.sourceAnnotationId);
      if (ann) {
        storeActiveSession(session);
        initSlowReader(session);
        showScreen("slowReader");
        jumpToAnnotation(session, ann);
      }
    },
  });
  wireMaterialGraphScreen(host, session, {
    onJumpToAnnotation: (s, ann) => {
      storeActiveSession(s);
      initSlowReader(s);
      showScreen("slowReader");
      jumpToAnnotation(s, ann);
    },
  });
  if (session) storeActiveSession(session);
  showScreen("slowGraph");
}

/**
 * Open Knowledge Vault prerequisite graph (Post A+ T12).
 * @param {{ topicFilter?: string }} [options]
 */
export function openVaultGraphScreen({ topicFilter = "all" } = {}) {
  const host = document.getElementById("slowGraphContent");
  const detailHost = document.getElementById("vaultGraphDetailPanel");
  const layout = document.getElementById("slowGraphLayout");
  if (!host) return;

  const vault = loadVault();
  if ((vault.entries || []).length < VAULT_GRAPH_MIN_ENTRIES) return;

  materialGraphSource = "vault";
  materialGraphBackScreen = getCurrentScreenId() || "modeSelect";
  resetVaultGraphChrome();
  layout?.classList.add("vault-graph-active");
  const exportBtn = document.getElementById("slowGraphExportBtn");
  if (exportBtn) exportBtn.hidden = true;

  updateMaterialGraphScreenCopy({
    title: "Knowledge Vault graph",
    hint: "Nodes colored by mastery. Click a node for concept details.",
  });

  if (
    (vault.entries || []).length > VAULT_GRAPH_TOPIC_FILTER_THRESHOLD &&
    (!topicFilter || topicFilter === "all")
  ) {
    renderVaultGraphTopicPicker(host, vault, (topic) => openVaultGraphScreen({ topicFilter: topic }));
    if (detailHost) {
      detailHost.hidden = true;
      detailHost.setAttribute("aria-hidden", "true");
    }
    showScreen("slowGraph");
    return;
  }

  lastMaterialGraph = mountVaultGraphScreen(host, detailHost, {
    vault,
    topicFilter,
    onNodeClick: (node) => {
      if (!detailHost) return;
      const entry = getEntryById(node.vaultEntryId || node.id);
      if (entry) renderDetail(detailHost, entry);
    },
  });
  showScreen("slowGraph");
}

/**
 * Cross-document concept registry graph (gray/yellow/green maturity).
 * @param {{ focusedDocId?: string|null, projectId?: string|null }} [options]
 */
export function openConceptRegistryGraphScreen(options = {}) {
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

  const doc = getActiveSession();
  const focusedDocId = options.focusedDocId ?? doc?.docId ?? null;

  updateMaterialGraphScreenCopy({
    title: "Concept vault graph",
    hint: focusedDocId
      ? "Yellow/green concepts plus gray neighbors from the active document."
      : "Concepts you have engaged with across all documents.",
  });

  lastMaterialGraph = mountConceptRegistryGraph(host, detailHost, {
    focusedDocId,
    projectId: options.projectId ?? null,
    onStudyConcept: (globalConceptId) => {
      void enterRecallForGlobalConcept(globalConceptId);
    },
  });
  showScreen("slowGraph");
}

/**
 * @param {string} globalConceptId
 */
export async function enterRecallForGlobalConcept(globalConceptId) {
  const concept = getConceptById(globalConceptId);
  if (!concept) return;
  const docId = (concept.sourceDocIds || [])[0];
  if (docId) {
    const session = getSession(docId);
    if (session) {
      setActiveSession(docId);
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
  clearAssessmentChrome();
  prePackingFlow = null;
}

function resolvePrePackingQuestionConfig() {
  let n_test = clampInt(state.nTest, 0, MAX_N_TEST, 2);
  let n_socratic = clampInt(state.nSocratic, 0, 3, 1);
  const cap = Math.max(1, Math.floor(Number(ASSESSMENT_FLAGS.ASSESSMENT_ITEMS_MAX) || 7));
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

function resolveHolisticAssessmentContext(flow) {
  const docId = state.activeDocId || state.activeSession?.docId;
  const doc = docId ? getSession(docId) : null;
  const conceptGraph = flow?.conceptGraph ?? doc?.shared?.conceptGraph ?? null;
  const docHierarchy = flow?.docHierarchy ?? doc?.shared?.docHierarchy ?? null;
  const inventory = flow?.conceptInventory || [];
  const edges =
    Array.isArray(flow?.edges) && flow.edges.length
      ? flow.edges
      : deriveInventoryEdges(inventory, conceptGraph);
  const budget = computeHolisticAssessmentBudget(inventory, edges);
  const chunks = buildInventoryChunks(docHierarchy, flow?.cleanedText || "");
  const plan = buildAssessmentCoveragePlan({
    inventory,
    edges,
    inventoryChunks: chunks,
    rawMarkdown: flow?.cleanedText || "",
    budget,
  });
  return { edges, docHierarchy, conceptGraph, budget, plan };
}

function createPrePackingItemsPromise(flow) {
  if (isHolisticAssessmentEnabled()) {
    const ctx = resolveHolisticAssessmentContext(flow);
    flow.edges = ctx.edges;
    flow.docHierarchy = ctx.docHierarchy;
    flow.coveragePlan = ctx.plan;
    flow.holisticBudget = ctx.budget;
    return generateHolisticPrePackingAssessmentItems({
      conceptInventory: flow.conceptInventory,
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
  }

  const qCfg = resolvePrePackingQuestionConfig();
  return generatePrePackingAssessmentItems({
    conceptInventory: flow.conceptInventory,
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
    const ctx = resolveHolisticAssessmentContext(flow);
    return buildPrefetchConfigKey({
      qCfg: ctx.budget,
      conceptInventory: flow.conceptInventory,
      cleanedText: flow.cleanedText,
      holisticPlanHash: ctx.plan?.planHash || hashCoveragePlan(ctx.plan),
    });
  }
  const qCfg = resolvePrePackingQuestionConfig();
  return buildPrefetchConfigKey({
    qCfg,
    conceptInventory: flow.conceptInventory,
    cleanedText: flow.cleanedText,
  });
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
  document.body.classList.add("assessment-runner-active");
  if (els.testAssessmentChrome) els.testAssessmentChrome.hidden = false;
  if (els.socraticAssessmentChrome) els.socraticAssessmentChrome.hidden = false;
  if (els.testRestartBlockBtn) els.testRestartBlockBtn.hidden = true;
  if (els.testRsvpView) els.testRsvpView.hidden = true;
  if (els.testQaView) els.testQaView.hidden = false;
}

function clearAssessmentChrome() {
  document.body.classList.remove("assessment-runner-active");
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
}

async function runPrePackingPack({ knowledgeProfile = null, onProgress } = {}) {
  if (!prePackingFlow) throw new Error("Pre-packing flow not initialized.");
  const { conceptInventory, nBlocks, cleanedText, splitOpts } = prePackingFlow;
  return packInventoryToBlocks(conceptInventory, nBlocks, cleanedText, {
    ...splitOpts,
    knowledgeProfile,
    onProgress,
  });
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
  host.textContent = `${graph.nodes.length} concepts Â· ${graph.edges.length} relations`;
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

  const isLastGlobal = ctx.globalIndex >= ctx.total - 1;
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

  setTestError("Could not load knowledge check questions.");
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
    ? resolveHolisticAssessmentContext(prePackingFlow).budget
    : resolvePrePackingQuestionConfig();
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
      badge.textContent = "âœ“ Presumed known (override below)";
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
    els.prePackingAssessmentStatus.textContent = "Loading questionsâ€¦";
  }
  showScreen("prePackingAssessment");

  try {
    ensurePrePackingItemsPromise(prePackingFlow);
    const items = await prePackingFlow.itemsPromise;
    prePackingFlow.assessmentItems = Array.isArray(items) ? items : [];
    const doc = getActiveSession();
    prePackingFlow.vaultPresumedKnown = buildVaultPresumedKnownMap(
      prePackingFlow.conceptInventory,
      doc?.shared?.docTopics || [],
    );
    if (!prePackingFlow.assessmentItems.length) {
      prePackingFlow.itemsPromise = null;
      throw new Error("Could not generate assessment items.");
    }
    if (els.prePackingAssessmentStatus) els.prePackingAssessmentStatus.textContent = "";
    renderPrePackingAssessmentQuestion();
  } catch (err) {
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
  if (!prePackingFlow) return;
  prePackingFlow.knowledgeProfile = null;
  prePackingFlow.assessmentSkipped = true;
  prePackingFlow.packingIgnoredProfile = false;
  setGenerateLoading(true);
  try {
    const packed = await runPrePackingPack({ knowledgeProfile: null });
    if (!prePackingFlow) return;
    prePackingFlow.packedResult = packed;
    stashPrePackingDraftMeta();
    applyPackedBlocksToEditor(packed, prePackingFlow.conceptInventory);
    resetPrePackingFlow();
  } catch (err) {
    setGenerateError(err?.message ? String(err.message) : String(err));
    showCreateScreen();
  } finally {
    setGenerateLoading(false);
  }
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

  if (idx < items.length - 1) {
    prePackingFlow.questionIndex = idx + 1;
    renderPrePackingAssessmentQuestion();
    return;
  }

  await finishPrePackingAssessment();
}

async function finishPrePackingAssessment() {
  if (!prePackingFlow) return;
  clearAssessmentChrome();
  if (els.prePackingAssessmentStatus) {
    els.prePackingAssessmentStatus.textContent = "Evaluating responsesâ€¦";
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

  const profile = await evaluatePrePackingAssessmentResponses({
    items: assessmentItems,
    responses: assessmentResponses,
    conceptInventory: prePackingFlow.conceptInventory,
    llmModel: prePackingFlow.splitOpts?.llmModel,
    language: prePackingFlow.splitOpts?.language || getStudyLanguage(),
  });

  prePackingFlow.knowledgeProfile = profile;
  prePackingFlow.assessmentSkipped = false;
  prePackingFlow.packingIgnoredProfile = false;

  if (ASSESSMENT_FLAGS.ASSESSMENT_PARALLEL_PACKING && profile) {
    const flow = prePackingFlow;
    prePackingFlow.packingPromise = runPrePackingPack({
      knowledgeProfile: profile,
      onProgress: (msg) => {
        if (els.prePackingResultsStatus) els.prePackingResultsStatus.textContent = msg;
      },
    }).then((packed) => {
      if (prePackingFlow === flow) flow.packedResult = packed;
      return packed;
    });
  }

  const counts = countProfileMastery(profile);
  if (!profile || counts.full === 0) {
    if (!prePackingFlow.packingPromise) {
      prePackingFlow.packingPromise = runPrePackingPack({
        knowledgeProfile: profile,
      });
    }
    const packed = await prePackingFlow.packingPromise;
    if (!prePackingFlow) return;
    prePackingFlow.packedResult = packed;
    stashPrePackingDraftMeta();
    applyPackedBlocksToEditor(packed, prePackingFlow.conceptInventory);
    resetPrePackingFlow();
    return;
  }

  renderPrePackingResultsScreen(counts);
  showScreen("prePackingResults");
  if (els.prePackingAssessmentNext) els.prePackingAssessmentNext.disabled = false;
}

function renderPrePackingResultsScreen(counts) {
  if (!prePackingFlow) return;
  const { full, partial, none } = counts;
  if (els.prePackingResultsSummary) {
    els.prePackingResultsSummary.textContent = `Mastered: ${full} Â· Partial: ${partial} Â· New: ${none}`;
  }
  if (els.prePackingResultsDiff) {
    if (ASSESSMENT_FLAGS.ASSESSMENT_SHOW_DIFF) {
      const n = prePackingFlow.nBlocks;
      els.prePackingResultsDiff.hidden = false;
      els.prePackingResultsDiff.textContent = `Hasta ${n} â†’ packing with profile (may be fewer blocks)`;
    } else {
      els.prePackingResultsDiff.hidden = true;
    }
  }
  const list = els.prePackingResultsDetailList;
  if (list && prePackingFlow.knowledgeProfile?.items) {
    list.innerHTML = "";
    for (const item of prePackingFlow.knowledgeProfile.items) {
      const li = document.createElement("li");
      li.textContent = `${item.concept_id}: ${item.mastery} (${Math.round(item.confidence * 100)}%)`;
      list.appendChild(li);
    }
  }
}

async function handlePrePackingAccept() {
  if (!prePackingFlow) return;
  if (els.prePackingResultsAccept) els.prePackingResultsAccept.disabled = true;
  if (els.prePackingResultsStatus) {
    els.prePackingResultsStatus.textContent = "Preparing blocksâ€¦";
  }
  try {
    let packed = prePackingFlow.packedResult;
    if (!packed && prePackingFlow.packingPromise) {
      packed = await prePackingFlow.packingPromise;
    }
    if (!packed) {
      packed = await runPrePackingPack({
        knowledgeProfile: prePackingFlow.knowledgeProfile,
      });
    }
    if (!prePackingFlow) return;
    prePackingFlow.packedResult = packed;
    if (ASSESSMENT_FLAGS.ASSESSMENT_SHOW_DIFF && els.prePackingResultsDiff) {
      els.prePackingResultsDiff.textContent = `Hasta ${prePackingFlow.nBlocks} â†’ ${packed.blockIndex.length}`;
    }
    stashPrePackingDraftMeta();
    applyPackedBlocksToEditor(packed, prePackingFlow.conceptInventory);
    resetPrePackingFlow();
  } catch (err) {
    setGenerateError(err?.message ? String(err.message) : String(err));
    showCreateScreen();
  } finally {
    if (els.prePackingResultsAccept) els.prePackingResultsAccept.disabled = false;
    if (els.prePackingResultsStatus) els.prePackingResultsStatus.textContent = "";
  }
}

async function handlePrePackingIgnore() {
  if (!prePackingFlow) return;
  prePackingFlow.packingIgnoredProfile = true;
  if (els.prePackingResultsStatus) {
    els.prePackingResultsStatus.textContent = "Re-packing without profileâ€¦";
  }
  try {
    prePackingFlow.packingPromise = null;
    const packed = await runPrePackingPack({ knowledgeProfile: null });
    if (!prePackingFlow) return;
    prePackingFlow.packedResult = packed;
    stashPrePackingDraftMeta();
    applyPackedBlocksToEditor(packed, prePackingFlow.conceptInventory);
    resetPrePackingFlow();
  } catch (err) {
    setGenerateError(err?.message ? String(err.message) : String(err));
    showCreateScreen();
  }
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
    <span class="hint">${es ? `${graph.nodes.length} nodos Â· ${graph.edges.length} enlaces` : `${graph.nodes.length} nodes Â· ${graph.edges.length} edges`}</span>`;
}

function renderSlowPhase0GraphActions(session) {
  const host = document.getElementById("slowPhase0GraphActions");
  if (!host || !session?.slow?.phase0) {
    if (host) {
      host.hidden = true;
      host.innerHTML = "";
    }
    return;
  }
  const graph = buildSessionGraph(session, { mode: "slow_phase0" });
  const lang = getStudyLanguage() || "English";
  const es = String(lang).toLowerCase().startsWith("es");
  host.hidden = false;
  host.innerHTML = `
    ${renderGraphUnlockButtonHtml(lang, { id: "slowPhase0GraphBtn" })}
    <span class="hint">${es ? "Vista previa del mapa argumental" : "Argument map preview"} Â· ${graph.nodes.length} nodes</span>`;
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
    const session = state.activeSession;
    const host = document.getElementById("slowGraphContent");
    const graph =
      lastMaterialGraph ||
      mountMaterialGraphScreen(session, host, {
        blockIndex: state.materialGraphContext?.blockIndex,
        conceptInventory: state.materialGraphContext?.conceptInventory,
        mode: "auto",
      });
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
  });
}

function wireSlowPhase3Handlers() {
  document.getElementById("slowPhase3BackBtn")?.addEventListener("click", () => {
    const session = state.activeSession;
    if (!session?.slow) return;
    session.slow.phase = "phase1";
    storeActiveSession(session);
    initSlowReader(session);
    showScreen("slowReader");
  });

  document.getElementById("slowPhase3FinishBtn")?.addEventListener("click", () => {
    const session = state.activeSession;
    if (!session?.slow) return;
    session.slow.depthScore = computeDepthScore(session.slow.annotations, {
      criticalMode: Boolean(session.slow.criticalMode),
    });
    session.slow.phase = "complete";
    session.slow.graphEnrichedUnlocked = true;
    storeActiveSession(session);
    exportSessionMarkdown();
    enterRetrievalHub({ entrySource: "exposure_complete" });
  });

  const observer = new MutationObserver(() => {
    if (els.screenSlowPhase3?.getAttribute("aria-hidden") === "false") {
      const session = state.activeSession;
      if (session?.slow) {
        storeActiveSession(session);
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

export function wireStudyHandlers() {
  registerChromeStudyModeResolver(() =>
    normalizeStudyMode(state.studyMode || state.activeSession?.studyMode),
  );
  registerChromeHasConceptsResolver(() => getSortedSessionConcepts().length > 0);
  registerDictionaryChromeSyncHook(() => syncFloatingChrome());
  setSlowSessionGetter(() => state.activeSession);
  wireStudyModeSelector();
  els.modeSelectBackBtn?.addEventListener("click", () => enterAppHome());
  wireSlowScopeHandlers();
  wireSlowPhase0Handlers();
  wireSlowPhase3Handlers();
  wireMaterialGraphHandlers();
  wireClozeStudyHandlers();
  setClozeStudyCompleteExitHandler(() => enterModeSelectScreen());
  wireClozeImportHandlers();
  els.clozeGenerateBtn?.addEventListener("click", () => {
    const session = state.activeSession;
    if (session?.studyMode === "cloze") void runClozeGeneration(session);
  });
  els.clozeStudyBtn?.addEventListener("click", () => {
    const session = state.activeSession;
    if (session?.studyMode === "cloze") enterClozeStudyScreen(session, getActiveSession());
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
  renderFlowPanel(getActiveSession());

  setBlockReadContentProvider(() => {
    const blocks = getBlocksSafe();
    const block = blocks[state.activeBlockIndex];
    return {
      title: getBlockTitleSafe(state.activeBlockIndex),
      explanation: String(block?.explanation || ""),
    };
  });
  const defaults = loadDefaultQuestionConfig();
  state.nTest = clampInt(defaults.n_test, 0, MAX_N_TEST, 2);
  state.nSocratic = clampInt(defaults.n_socratic, 0, 3, 1);
  renderQuestionConfigUi();

  if (els.sourceFidelityStrictToggleBtn) {
    syncSourceFidelityStrictUi(state.sourceFidelityStrict === true);
  }

  function goAfterBlocksConfirmed(nBlocks) {
    goToSessionReady(nBlocks);
  }

  function goToSessionReady(nBlocks) {
    const n = Math.max(1, Math.floor(Number(nBlocks) || 1));
    setFullPackEntryCta(n);
    if (els.sessionReadyMeta) {
      els.sessionReadyMeta.textContent = `Session ready. Blocks: ${n}`;
    }
    showScreen("ready");
  }

  async function startStudyingNow() {
    els.startStudyingError.hidden = true;
    els.startStudyingError.textContent = "";
    els.startStudyingStatus.textContent = "";

    const studyMode = normalizeStudyMode(state.studyMode || getSelectedStudyModeRadio());
    applyFlowRecommendationOnEnterMode(studyMode);
    state.activeSession = loadActiveSession();
    if (!state.activeSession) {
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
      storeActiveSession(state.activeSession);
    }
    state.nTest = clampInt(state.activeSession?.n_test, 0, MAX_N_TEST, state.nTest);
    state.nSocratic = clampInt(state.activeSession?.n_socratic, 0, 3, state.nSocratic);
    state.activeBlockIndex = Math.max(0, Number(state.activeSession?.current_block_index) || 0);
    const savedQ = state.activeSession?.active_question_index;
    state.activeQuestionIndex =
      savedQ != null && Number.isFinite(Number(savedQ))
        ? Math.max(0, Math.floor(Number(savedQ)))
        : 0;
    applyQuestionsStudyOrderForSession(getActiveSession());
    if (
      isQuestionsStudyMode(state.activeSession) &&
      Array.isArray(state.questionsStudyOrder) &&
      state.questionsStudyOrder.length &&
      state.activeBlockIndex === 0 &&
      state.activeQuestionIndex === 0
    ) {
      state.activeBlockIndex = state.questionsStudyOrder[0];
    }
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
        els.fileExtractHint.textContent = "Loading offline packâ€¦";
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
      els.generateBlocksStatus.textContent = "Reading materialâ€¦";
      const resolvedCloze = await resolveMaterialForGenerate();
      if (!resolvedCloze) {
        setGenerateLoading(false);
        els.generateBlocksStatus.textContent = "";
        setGenerateError("Please choose a file (.pdf, .html, .txt, or .md).");
        return;
      }
      els.generateBlocksStatus.textContent = "";
      try {
        const { file, cleanedText, normalizedFormat, originalFormat } = resolvedCloze;
        if (!cleanedText.trim()) throw new Error("File appears to be empty.");
        const llmModel = getDefaultLlmModel();
        const doc = await ensureDocumentSessionForUpload(cleanedText);
        computeAndPersistModeRecommendation(doc, cleanedText, null);
        const sessionObj = createClozeSession({
          normalizedText: cleanedText,
          normalizedFormat,
          fileName: String(file.name || ""),
          originalFormat,
          llmModel,
          language: getStudyLanguage(),
        });
        persistModeSliceToDocument(doc, "cloze", sessionObj);
        state.activeSession = sessionObj;
        storeActiveSession(sessionObj);
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
      els.generateBlocksStatus.textContent = "Reading materialâ€¦";
      const resolvedSlow = await resolveMaterialForGenerate();
      if (!resolvedSlow) {
        setGenerateLoading(false);
        els.generateBlocksStatus.textContent = "";
        setGenerateError("Please choose a file (.pdf, .html, .txt, or .md).");
        return;
      }
      els.generateBlocksStatus.textContent = "";
      try {
        const {
          file,
          cleanedText,
          normalizedFormat,
          originalFormat,
          warnings,
          fallbackSections,
        } = resolvedSlow;
        if (!cleanedText.trim()) throw new Error("File appears to be empty.");
        const criticalMode =
          els.criticalModeToggleBtn?.getAttribute("aria-pressed") === "true";
        const doc = await ensureDocumentSessionForUpload(cleanedText);
        const sessionObj = createSlowSession({
          normalizedText: cleanedText,
          normalizedFormat,
          fileName: String(file.name || ""),
          originalFormat,
          llmModel,
          criticalMode,
          language: getStudyLanguage(),
        });
        if (sessionObj.slow) {
          sessionObj.slow.structureWarnings = warnings || [];
          sessionObj.slow.fallbackSections = fallbackSections;
          if ((warnings || []).includes("low_heading_confidence")) {
            sessionObj.slow.scopeEditMode = true;
          }
        }
        persistModeSliceToDocument(doc, "slow", sessionObj);
        state.activeSession = sessionObj;
        storeActiveSession(sessionObj);
        showScreen("slowScope");
        const needsAsyncHierarchy =
          cleanedText.length >= 3000 && !hasMarkdownHeadings(cleanedText);
        if (needsAsyncHierarchy) {
          renderSlowScopeScreen(sessionObj);
          void populateDocumentHierarchy(sessionObj, cleanedText, llmModel);
        } else {
          const hierarchyResult = await buildDocumentHierarchy(cleanedText, null, {
            useCache: true,
          });
          sessionObj.docHierarchy = hierarchyResult;
          syncSlowDocHierarchyToShared(sessionObj);
          computeAndPersistModeRecommendation(doc, cleanedText, hierarchyResult);
          storeActiveSession(sessionObj);
          renderSlowScopeScreen(sessionObj);
        }
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
    els.generateBlocksStatus.textContent = "Reading materialâ€¦";

    const resolvedRsvp = await resolveMaterialForGenerate();
    if (!resolvedRsvp) {
      setGenerateLoading(false);
      els.generateBlocksStatus.textContent = "";
      setGenerateError("Please choose a file (.pdf, .html, .txt, or .md).");
      return;
    }

    els.generateBlocksStatus.textContent = getLlmCallingLabel(llmModel);

    try {
      const { file, cleanedText, wordCount } = resolvedRsvp;
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
      const doc = await ensureDocumentSessionForUpload(cleanedText);
      computeAndPersistModeRecommendation(doc, cleanedText, null);

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
      const prePackingOn = shouldRunPrePackingAssessment();

      if (!prePackingOn) {
        let packed;
        if (isBlockSplitCacheValid(cache, fingerprint)) {
          packed = await packInventoryToBlocks(
            cache.conceptInventory,
            nBlocks,
            cleanedText,
            splitOpts,
          );
        } else {
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
        if (!Array.isArray(packed.blockIndex) || !packed.blockIndex.length) {
          throw new Error(
            "Block split returned no blocks. Please try generating blocks again.",
          );
        }
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
      }

      let conceptInventory;
      if (isBlockSplitCacheValid(cache, fingerprint)) {
        conceptInventory = cache.conceptInventory;
      } else {
        const docHierarchy = await ensureDocHierarchyForInventory(
          doc,
          cleanedText,
          wordCount,
          (msg) => {
            els.generateBlocksStatus.textContent = msg;
          },
        );
        const invResult = await runConceptInventoryWithFallback(cleanedText, {
          ...splitOpts,
          docHierarchy,
          nBlocks,
          wordCount,
        });
        notifyInventoryRunStatus(invResult);
        persistInventoryRunMeta(doc, invResult);
        if (invResult.kind === "fallback_mono") {
          promoteConceptInventoryToShared([], "rsvp");
          applyPackedBlocksToEditor(
            {
              blockIndex: invResult.blockIndex,
              splitRunMeta: invResult.splitRunMeta,
            },
            [],
          );
          return;
        }
        conceptInventory = invResult.inventory;
        if (Array.isArray(conceptInventory) && conceptInventory.length > 0) {
          setBlockSplitCache({
            fingerprint,
            conceptInventory,
            recommendation: cache?.recommendation ?? null,
          });
        }
      }

      if (!Array.isArray(conceptInventory) || !conceptInventory.length) {
        throw new Error("Concept inventory returned no concepts. Please try again.");
      }

      promoteConceptInventoryToShared(conceptInventory, "rsvp");

      const docIdForPrep = state.activeDocId || state.activeSession?.docId;
      const docForPrep = docIdForPrep ? getSession(docIdForPrep) : null;
      const holistic = isHolisticAssessmentEnabled();
      const prepEdges = deriveInventoryEdges(
        conceptInventory,
        docForPrep?.shared?.conceptGraph,
      );
      const holisticBudget = holistic
        ? computeHolisticAssessmentBudget(conceptInventory, prepEdges)
        : null;
      const holisticPlan = holistic
        ? buildAssessmentCoveragePlan({
            inventory: conceptInventory,
            edges: prepEdges,
            inventoryChunks: buildInventoryChunks(
              docForPrep?.shared?.docHierarchy,
              cleanedText,
            ),
            rawMarkdown: cleanedText,
            budget: holisticBudget,
          })
        : null;
      const qCfg = holistic ? holisticBudget : resolvePrePackingQuestionConfig();
      const prefetchConfigKey = buildPrefetchConfigKey({
        qCfg,
        conceptInventory,
        cleanedText,
        holisticPlanHash: holisticPlan?.planHash,
      });
      prePackingFlow = {
        phase: "assessment",
        conceptInventory,
        edges: prepEdges,
        docHierarchy: docForPrep?.shared?.docHierarchy ?? null,
        conceptGraph: docForPrep?.shared?.conceptGraph ?? null,
        nBlocks,
        cleanedText,
        splitOpts,
        fingerprint,
        assessmentItems: [],
        prefetchConfigKey,
        coveragePlan: holisticPlan,
        holisticBudget: holisticBudget,
        itemsPromise: null,
        responses: [],
        knowledgeProfile: null,
        packingPromise: null,
        packedResult: null,
        assessmentSkipped: false,
        packingIgnoredProfile: false,
        questionIndex: 0,
        draftMeta: { _meta: {} },
      };
      prePackingFlow.itemsPromise = createPrePackingItemsPromise(prePackingFlow);

      setGenerateLoading(false);
      els.generateBlocksStatus.textContent = "";
      await enterPrePackingAssessmentScreen();
      return;
    } catch (err) {
      setGenerateError(err?.message ? String(err.message) : String(err));
    } finally {
      setGenerateLoading(false);
      els.generateBlocksStatus.textContent = "";
    }
  });

  els.confirmBlocksBtn.addEventListener("click", async () => {
    clearConfirmError();
    els.confirmBlocksStatus.textContent = "";

    if (window.offlineMode === true) {
      setConfirmLoading(true);
      els.confirmBlocksStatus.textContent = "Loading offline sessionâ€¦";
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
        sessionObj.n_test = clampInt(pack?.config?.n_test, 0, MAX_N_TEST, 2);
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
        storeActiveSession(sessionObj);
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
    els.confirmBlocksStatus.textContent = "Saving blocks listâ€¦";

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
      sessionObj.n_test = clampInt(state.nTest, 0, MAX_N_TEST, 2);
      sessionObj.n_socratic = clampInt(state.nSocratic, 0, 3, 1);
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
      storeActiveSession(sessionObj);
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

      goAfterBlocksConfirmed(nBlocks);
    } catch (err) {
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
  els.prePackingAssessmentNext?.addEventListener("click", () => {
    void advancePrePackingAssessment();
  });
  els.prePackingResultsAccept?.addEventListener("click", () => {
    void handlePrePackingAccept();
  });
  els.prePackingResultsIgnore?.addEventListener("click", () => {
    void handlePrePackingIgnore();
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
        storeActiveSession(state.activeSession, { bumpRev: true });
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
          els.fullPackStudyNowBtn.textContent = "Study now â†’";
        }
        if (els.fullPackExitBtn) {
          els.fullPackExitBtn.hidden = false;
          els.fullPackExitBtn.textContent = "Done â€” study later";
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

  if (els.sourceFidelityStrictToggleBtn) {
    els.sourceFidelityStrictToggleBtn.addEventListener("click", () => {
      const pressed = els.sourceFidelityStrictToggleBtn.getAttribute("aria-pressed") === "true";
      const next = !pressed;
      state.sourceFidelityStrict = next;
      saveSourceFidelityStrictPreference(next);
      syncSourceFidelityStrictUi(next);
    });
  }

  els.socraticSubmitBtn.addEventListener("click", async () => {
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
      const resp = await deepSeekSocraticTutor({
        llmModel,
        blockTitle: String(block.title || `Block ${state.activeBlockIndex + 1}`),
        question: String(q.question),
        studentAnswer: answer,
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
      syncActiveSessionAssessmentSignals();

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
      setSocraticError(err?.message ? String(err.message) : String(err));
    } finally {
      setSocraticLoading(false);
      els.socraticStatus.textContent = "";
    }
  });

  els.socraticNextQuestionBtn.addEventListener("click", () => {
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
        storeActiveSession(state.activeSession);
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

  els.testRestartBlockBtn.addEventListener("click", () => {
    clearTestError();
    els.testFeedback.hidden = true;
    clearMarkdownContainer(els.testFeedback);
    state.activeQuestionIndex = 0;
    if (state.activeSession && typeof state.activeSession === "object") {
      state.activeSession.active_question_index = 0;
      storeActiveSession(state.activeSession);
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
        ? "Could not save blocks â€” browser storage is full."
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
      els.summarySoFarBtn.textContent = "Summarisingâ€¦";

      if (els.summaryOverlayTitle) {
        els.summaryOverlayTitle.textContent = `Summary so far (blocks 1â€“${n})`;
      }
      if (els.summaryOverlayBody) {
        els.summaryOverlayBody.textContent = "Summarisingâ€¦";
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
    exportSessionMarkdown({ source: "beforeunload" });
  });

  wireRsvpHandlers();
  wirePacedReaderHandlers({ onSwitchToRsvp: switchBlockReadingToRsvp });
  els.rsvpSwitchToPacedBtn?.addEventListener("click", switchBlockReadingToPaced);

  setOnPrefetchReady(() => {
    refreshUiOnPrefetchReady();
    syncExportButtonsEnabled();
    syncPersistenceHealthBanner();
  });

  setOnBridgeReady(() => {
    refreshUiOnPrefetchReady();
  });

  syncOfflinePackButtonVisibility();
  updateDictionaryButtonVisibility();
  syncExportButtonsEnabled();
  syncPersistenceHealthBanner();
}

