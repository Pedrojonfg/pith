import {
  deepSeekGenerateBlockJson,
  deepSeekSocraticTutor,
  deepSeekSummarySoFar,
  GapSynthesisError,
  generateAssessmentQuestions,
  generateAssessmentSynthesis,
  synthesizeAssessmentGaps,
  generatePrePackingAssessmentItems,
  evaluatePrePackingAssessmentResponses,
  PREPACKING_DONT_KNOW_ANSWER,
} from "./api.js?v=20260527_1";
import {
  ASSESSMENT_FLAGS,
  isPrePackingAssessmentEnabled,
} from "./config/flags.js";
import {
  assertLlmKeyPresent,
  getApiKeyForLlmModel,
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
import { exportOfflinePack, exportSessionMarkdown, exportClozeItemsMarkdown, downloadTextFile } from "./export.js?v=20260525_1";
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
  warnBlockGenerationProfileMismatch,
  safeParseJson,
  shouldTriggerCommentReply,
  describeSplitRunMetaForUi,
  storeDefaultQuestionConfig,
  runConceptInventory,
  packInventoryToBlocks,
  twoPhaseConceptSplit,
  state,
  storeActiveSession,
  triggerPrefetch,
  setOnPrefetchReady,
  setOnBridgeReady,
  triggerBridgePrefetch,
  getPrefetchedBlock,
  hasGeneratedBlockContent,
  isQuestionsStudyMode,
  normalizeBlockJson,
  ensureSessionResponseState,
  applyAssessmentResults,
  gapLabelsForBlock,
  generateOfflinePack,
  mergeGapLists,
  setKnowledgeProfile,
  setAssessmentSkipped,
  setPackingIgnoredProfile,
} from "./session.js?v=20260527_1";
import {
  els,
  enableUnifiedMaterialUpload,
  getStudyLanguage,
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
  syncStudyLanguage,
  typesetMath,
  updateFullPackProgressUi,
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
import { startReviewFromSessionBlocks } from "./review.js?v=20260525_1";
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
  saveActiveSession as saveDocumentSession,
  setActiveSession,
  setUploadMeta,
  syncAssessmentSignalsToShared,
  updateRecommendation,
} from "./session-store.js?v=20260609_1";

/**
 * Resolve or create DocumentSession for uploaded markdown; set active doc pointer.
 * @param {string} markdown
 */
/** Mirror slow slice docHierarchy onto active DocumentSession.shared. */
export function syncSlowDocHierarchyToShared(slowSession) {
  const doc = getActiveSession();
  if (!doc) return;
  doc.shared.docHierarchy = slowSession?.docHierarchy ?? null;
  saveDocumentSession(doc);
}

export async function ensureDocumentSessionForUpload(markdown) {
  const text = String(markdown || "");
  const docId = await computeDocId(text);
  let doc = getSession(docId);
  if (!doc) {
    doc = await createSession(text, { docId });
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
  const slot = normalizeStudyMode(mode);
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
 * @returns {'cta_upload'|'intro'|'progress'|'hidden'}
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
  return "cta_upload";
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
 * @param {HTMLElement | null | undefined} host
 * @param {Array<{ id?: string, mode?: string, label?: string }>} steps
 * @param {Set<string>} completed
 * @param {number} currentStepIndex
 */
function renderFlowProgressStepper(host, steps, completed, currentStepIndex) {
  if (!host) return;
  host.replaceChildren();
  steps.forEach((step, index) => {
    if (index > 0) {
      const arrow = document.createElement("span");
      arrow.className = "flow-progress-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      host.appendChild(arrow);
    }
    const chip = document.createElement("span");
    chip.className = "flow-progress-step";
    chip.setAttribute("role", "listitem");
    const short = getFlowModeShortLabel(String(step?.mode || ""));
    if (step?.id && completed.has(step.id)) {
      chip.classList.add("completed");
      chip.textContent = `${short} ✓`;
    } else if (index === currentStepIndex) {
      chip.classList.add("current");
      chip.setAttribute("aria-current", "step");
      chip.textContent = short;
    } else {
      chip.classList.add("upcoming");
      chip.textContent = short;
    }
    host.appendChild(chip);
  });
}

function clearFlowRecommendFeedback() {
  if (els.flowRecommendStatus) els.flowRecommendStatus.textContent = "";
  if (els.flowRecommendError) {
    els.flowRecommendError.hidden = true;
    els.flowRecommendError.textContent = "";
  }
}

function setFlowRecommendLoading(isLoading) {
  if (els.flowRecommendBtn) {
    els.flowRecommendBtn.disabled = Boolean(isLoading);
    els.flowRecommendBtn.textContent = isLoading
      ? "Analyzing material…"
      : "Recommend my study flow";
  }
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

  const llmModel = normalizeLlmModel(els.llmModelSelect?.value || getSessionLlmModel());
  const hierarchyResult = await buildHierarchyForFlowRecommendation(cleanedText, llmModel);

  if (hierarchyResult) {
    doc.shared.docHierarchy = hierarchyResult;
    saveDocumentSession(doc);
  }

  computeAndPersistModeRecommendation(doc, cleanedText, hierarchyResult, { force: true });

  const refreshed = getActiveSession();
  resetModeSelectUi();
  renderFlowPanel(refreshed);
  showScreen("modeSelect");
  return refreshed?.shared?.modeRecommendation ?? null;
}

function startReviewFromRecommendation() {
  const session =
    loadSessionForMode("questions") ||
    loadSessionForMode("rsvp") ||
    loadActiveSession();
  if (session) {
    state.activeSession = session;
    storeActiveSession(session);
    const total = Math.max(1, getTotalBlocksSafe());
    const indices = Array.from({ length: total }, (_, i) => i);
    try {
      startReviewFromSessionBlocks({ blockIndices: indices, reviewType: "both" });
      return;
    } catch {
      // fall through to review config
    }
  }
  els.reviewSessionBtn?.click();
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

  els.recommendationOverrideSelect?.addEventListener("change", (event) => {
    const select = event.target;
    const mode = select && "value" in select ? String(select.value || "").trim() : "";
    if (!mode) return;
    const doc = getActiveSession();
    if (!doc?.shared?.modeRecommendation) return;
    const updated = recordUserOverride(doc.shared.modeRecommendation, mode);
    doc.shared.modeRecommendation = updated;
    updateRecommendation(doc.docId, updated);
    renderFlowPanel(doc);
    startModeFromRecommendation(mode);
    if (select && "value" in select) select.value = "";
  });

  els.recommendationQuickFlow?.addEventListener("click", (event) => {
    const trigger = event.target.closest?.("[data-quick-mode]");
    if (!trigger) return;
    const mode = trigger.getAttribute("data-quick-mode");
    if (mode) startModeFromRecommendation(mode);
  });
}

export function wireFlowRecommendUpload() {
  const btn = els.flowRecommendBtn;
  const input = els.flowRecommendFileInput;
  if (!btn || !input) return;

  btn.addEventListener("click", () => {
    clearFlowRecommendFeedback();
    input.click();
  });

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    clearFlowRecommendFeedback();
    setFlowRecommendLoading(true);
    try {
      await recommendFlowFromUploadedFile(file);
      if (els.flowRecommendStatus) {
        els.flowRecommendStatus.textContent = "Recommendation ready — see the suggested flow below.";
      }
    } catch (err) {
      setFlowRecommendError(err?.message ? String(err.message) : String(err));
    } finally {
      setFlowRecommendLoading(false);
      input.value = "";
    }
  });
}

/**
 * @param {import("./session-store.js").DocumentSession | null | undefined} [doc]
 */
export function renderFlowPanel(doc = getActiveSession()) {
  const viewState = resolveFlowPanelViewState(doc);
  const uploadWrap = els.flowRecommendUpload;
  const panel = els.recommendationPanel;
  const recommendation = doc?.shared?.modeRecommendation;

  if (uploadWrap) uploadWrap.hidden = viewState !== "cta_upload";
  if (panel) panel.hidden = viewState !== "intro" && viewState !== "progress";

  if (viewState === "hidden" || viewState === "cta_upload") return;
  if (!hasValidModeRecommendation(recommendation) || !panel) return;

  const primaryFlow = Array.isArray(recommendation.primaryFlow) ? recommendation.primaryFlow : [];
  const quickFlow = Array.isArray(recommendation.quickFlow) ? recommendation.quickFlow : [];
  const analysis =
    recommendation.analysis && typeof recommendation.analysis === "object"
      ? recommendation.analysis
      : {};
  const genreLabel = String(analysis.genreLabel || "Academic text");
  const totalMin = sumFlowTimeMin(primaryFlow);
  const quickMin = sumFlowTimeMin(quickFlow);
  const whyText = resolveFlowWhyText(recommendation, doc);

  if (els.recommendationGenreLabel) {
    els.recommendationGenreLabel.textContent = `${genreLabel} · ~${totalMin} min full flow (approx.)`;
  }
  if (els.recommendationFlowTitle) {
    els.recommendationFlowTitle.textContent = formatIntroFlowLine(primaryFlow);
  }
  if (els.recommendationReasoning) {
    els.recommendationReasoning.textContent = String(recommendation.reasoning || "");
  }
  if (els.recommendationWhyBody) {
    els.recommendationWhyBody.textContent = whyText || "No additional explanation.";
  }

  const nextStep =
    viewState === "progress" ? getRecommendedStep(recommendation) : primaryFlow[0];
  if (els.recommendationStartBtn) {
    if (nextStep?.mode) {
      const prefix = viewState === "progress" ? "Continue with" : "Start";
      els.recommendationStartBtn.textContent = `${prefix} ${getFlowModeShortLabel(String(nextStep.mode))}`;
      els.recommendationStartBtn.hidden = false;
    } else {
      els.recommendationStartBtn.hidden = true;
    }
  }

  if (els.recommendationOverrideSelect) {
    els.recommendationOverrideSelect.disabled = false;
  }

  if (els.recommendationQuickFlow) {
    if (quickFlow.length && quickMin < totalMin) {
      const labels = quickFlow
        .map((step) => {
          const mode = String(step?.mode || "");
          const label = getFlowModeShortLabel(mode);
          return `<button type="button" data-quick-mode="${mode}">${label}</button>`;
        })
        .join(" → ");
      els.recommendationQuickFlow.innerHTML = `Only ~${quickMin} min? → ${labels}`;
      els.recommendationQuickFlow.hidden = false;
    } else {
      els.recommendationQuickFlow.hidden = true;
      els.recommendationQuickFlow.textContent = "";
    }
  }

  const showStepper = viewState === "intro" || viewState === "progress";
  if (els.recommendationProgress) {
    els.recommendationProgress.hidden = !showStepper;
  }
  if (els.recommendationProgressSteps && showStepper) {
    const completed = new Set(
      Array.isArray(recommendation.completedSteps) ? recommendation.completedSteps : [],
    );
    const currentStepIndex =
      typeof recommendation.currentStepIndex === "number" ? recommendation.currentStepIndex : 0;
    renderFlowProgressStepper(
      els.recommendationProgressSteps,
      primaryFlow,
      completed,
      viewState === "intro" ? -1 : currentStepIndex,
    );
  }
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
  return "RSVP";
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
  clearFlowRecommendFeedback();
}

export function enterModeSelectScreen() {
  syncFlowExitState();
  persistFlowRecommendationProgress();
  resetModeSelectUi();
  resetCreateScreenModeUi();
  renderFlowPanel(getActiveSession());
  showScreen("modeSelect");
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
  if (!Number.isFinite(n) || n <= 0) return "—";
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
  renderDocLibrary();
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
  if (els.modeMaterialLoadedBanner) els.modeMaterialLoadedBanner.hidden = true;
  if (els.studyFileInputRow) els.studyFileInputRow.hidden = false;
  if (els.fileInput) els.fileInput.required = true;
}

function setMaterialBootstrapUi(active, doc) {
  state.materialBootstrapActive = Boolean(active);
  if (els.modeMaterialLoadedBanner) {
    els.modeMaterialLoadedBanner.hidden = !active;
    if (active) {
      const docTitle = els.modeMaterialLoadedBanner.querySelector(".mode-material-loaded-doc");
      if (docTitle) {
        docTitle.textContent = String(doc?.shared?.docMeta?.titleInferred || "").trim();
      }
    }
  }
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
    if (els.modeResumePanel) els.modeResumePanel.hidden = true;
    if (els.generateBlocksForm) els.generateBlocksForm.hidden = true;
    clearMaterialBootstrapUi();
    showScreen("slowScope");
    renderSlowScopeScreen(slice);
    return;
  }

  if (mode === "cloze") {
    if (els.modeResumePanel) els.modeResumePanel.hidden = true;
    if (els.generateBlocksForm) els.generateBlocksForm.hidden = true;
    setMaterialBootstrapUi(true, doc);
    updateClozeSessionPanel(slice);
    showScreen("create");
    return;
  }

  if (els.modeResumePanel) els.modeResumePanel.hidden = true;
  if (els.generateBlocksForm) els.generateBlocksForm.hidden = false;
  setMaterialBootstrapUi(true, doc);
  showScreen("create");
}

/**
 * @param {string} mode
 */
export async function enterModeWithContinuity(mode) {
  const normalized = normalizeStudyMode(mode);
  if (normalized === "review") {
    startReviewFromRecommendation();
    return;
  }

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
    else resumeRsvpSession(entry.slice);
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
  showScreen("create");
}

function returnToCreateScreen() {
  const mode = state.studyMode || getSelectedStudyModeRadio();
  if (mode) enterCreateScreenForMode(mode);
  else enterModeSelectScreen();
}

function updateCreateScreenModeVisibility(mode) {
  const isSlow = mode === "slow";
  const isRsvp = mode === "rsvp";
  const isCloze = mode === "cloze";
  const isQuestions = mode === "questions";
  const showBlockConfig = isRsvp || isQuestions;
  if (els.rsvpImportDetails) els.rsvpImportDetails.hidden = !isRsvp;
  if (els.rsvpAdvancedDetails) els.rsvpAdvancedDetails.hidden = !showBlockConfig;
  if (els.slowOnlyControls) els.slowOnlyControls.hidden = !isSlow;
  if (els.clozeImportSection) els.clozeImportSection.hidden = !isCloze;
  if (els.blocksInput) els.blocksInput.required = showBlockConfig;
  if (els.recommendBlocksBtn) els.recommendBlocksBtn.hidden = !isRsvp;
  if (!isRsvp) invalidateBlockSplitCacheAndRecommendUi();
  if (els.generateBlocksBtn) {
    const bootstrapped = Boolean(state.materialBootstrapActive);
    if (bootstrapped && (isSlow || isCloze)) {
      els.generateBlocksBtn.textContent = "Continue with loaded material →";
    } else {
      els.generateBlocksBtn.textContent =
        isSlow || isCloze ? "Upload and continue →" : "Generate blocks";
    }
  }
  setOfflinePackButtonVisibility(isRsvp && !isOfflineMode());
}

function resetCreateScreenModeUi() {
  clearMaterialBootstrapUi();
  if (els.modeResumePanel) els.modeResumePanel.hidden = true;
  if (els.generateBlocksForm) els.generateBlocksForm.hidden = true;
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

function resumeClozeSession(session) {
  if (session?.language) syncStudyLanguage(session.language);
  state.activeSession = session;
  state.studyMode = "cloze";
  storeActiveSession(session);
  if (els.generateBlocksForm) els.generateBlocksForm.hidden = true;
  if (els.modeResumePanel) els.modeResumePanel.hidden = true;
  updateClozeSessionPanel(session);
  showScreen("create");
  if (session?.cloze?.pipelineStatus === "ready" && getValidItems(session.cloze.items || []).length > 0) {
    // User can tap Estudiar; optional auto-navigate deferred.
  }
}

let clozePipelineRunning = false;

async function runClozeGeneration(session) {
  if (!session?.cloze || clozePipelineRunning) return;
  const llmModel = normalizeLlmModel(session.llmModel || els.llmModelSelect?.value);
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
  if (els.clozeImportStatus) els.clozeImportStatus.textContent = "Importing…";
  try {
    const result = await parseClozePackFiles(fileList, readFileAsText);
    if (!result.ok) {
      const detail = Array.isArray(result.errors) && result.errors.length ? result.errors.join(" · ") : "";
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
    if (els.generateBlocksForm) els.generateBlocksForm.hidden = true;
    if (els.modeResumePanel) els.modeResumePanel.hidden = true;
    updateClozeSessionPanel(sessionObj);
    showScreen("create");
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
  const slot = loadSessionForMode(mode);
  state.studyMode = mode;
  updateCreateScreenModeVisibility(mode);
  if (slot) {
    if (els.modeResumePanel) {
      els.modeResumePanel.hidden = false;
      if (els.modeResumeHint) {
        const label = getStudyModeLabel(mode);
        els.modeResumeHint.textContent = `You have a saved ${label} session. Continue where you left off or start fresh.`;
      }
    }
    if (els.generateBlocksForm) els.generateBlocksForm.hidden = true;
  } else {
    if (els.modeResumePanel) els.modeResumePanel.hidden = true;
    if (els.generateBlocksForm) els.generateBlocksForm.hidden = false;
  }
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
    els.sessionReadyMeta.textContent = `Questions session ready. Blocks: ${n}`;
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
        "Scope ≥ 60k characters — Phase 0 will use map-reduce by section.";
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
        "Analyzing document structure…";
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
      toggle.textContent = collapsed ? "▶" : "▼";
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
    input.placeholder = "Pregunta antes de leer…";
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
      phase0.criticalExaminePoints.map((p) => `· ${p}`).join("\n"),
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

  const token = ++phase0GenerationToken;
  slow.phase0Status = "generating";
  slow.phase0Error = null;
  if (els.slowPhase0Progress) {
    els.slowPhase0Progress.hidden = false;
    els.slowPhase0Progress.textContent = "Generating orientation…";
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
  els.modeSelectDocLibraryBtn?.addEventListener("click", () => {
    enterDocLibraryScreen();
  });

  els.docLibraryBackBtn?.addEventListener("click", () => {
    enterModeSelectScreen();
  });

  els.docLibraryList?.addEventListener("click", (event) => {
    const item = event.target.closest?.(".doc-library-item");
    if (!item) return;
    const docId = item.getAttribute("data-doc-id");
    if (docId) reopenDocumentFromLibrary(docId);
  });
}

function wireStudyModeSelector() {
  wireFlowPanelHandlers();
  wireFlowRecommendUpload();
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

  els.continueSessionBtn?.addEventListener("click", () => {
    const mode = getSelectedStudyModeRadio() || state.studyMode;
    if (!mode) return;
    applyFlowRecommendationOnEnterMode(mode);
    const session = loadSessionForMode(mode);
    if (!session) return;
    if (mode === "slow") resumeSlowSession(session);
    else if (mode === "cloze") resumeClozeSession(session);
    else if (mode === "questions") resumeQuestionsSession(session);
    else resumeRsvpSession(session);
  });

  els.newSessionModeBtn?.addEventListener("click", () => {
    const mode = getSelectedStudyModeRadio() || state.studyMode;
    if (!mode) return;
    const hadSlot = Boolean(loadSessionForMode(mode));
    if (hadSlot) {
      const ok = window.confirm(
        "Starting a new session will replace your saved session for this mode. Continue?",
      );
      if (!ok) return;
      const doc = getActiveSession();
      if (doc?.modes) {
        persistModeSliceToDocument(doc, mode, null);
      }
    }
    clearMaterialBootstrapUi();
    if (els.modeResumePanel) els.modeResumePanel.hidden = true;
    if (els.generateBlocksForm) els.generateBlocksForm.hidden = false;
    if (els.clozeSessionPanel) els.clozeSessionPanel.hidden = true;
    state.studyMode = mode;
    state.activeSession = null;
    updateCreateScreenModeVisibility(mode);
    const doc = getActiveSession();
    if (doc?.shared?.rawMarkdown) {
      void enterModeWithContinuity(mode);
    }
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
      top.textContent = `Keep #${keepId}: ${keepAfter || keepBefore || "Untitled"} ← absorb ${absorbIds
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
      top.textContent = `Keep #${keepId} ← absorb ${absorbIds.map((x) => `#${x}`).join(", ")}`;
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
  if (!els.blocksListEditor || !els.blocksListOutput) return;
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
  els.blocksListOutput.value = JSON.stringify(arr, null, 2);
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

function setQuestionPreviewLabel(nTest, nSocratic) {
  if (!els.questionsPreviewLabel) return;
  const t = Math.max(0, Math.min(MAX_N_TEST, Math.round(Number(nTest) || 0)));
  const s = Math.max(0, Math.min(3, Math.round(Number(nSocratic) || 0)));
  const total = t + s;
  els.questionsPreviewLabel.textContent = total
    ? `${total} questions per block (${t} test + ${s} socratic)`
    : "0 questions per block (increase at least one)";
}

function renderQuestionConfigUi() {
  if (els.nTestValue) els.nTestValue.textContent = String(state.nTest);
  if (els.nSocraticValue) els.nSocraticValue.textContent = String(state.nSocratic);
  setQuestionPreviewLabel(state.nTest, state.nSocratic);
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

function setRecommendLoading(isLoading) {
  if (els.recommendBlocksBtn) els.recommendBlocksBtn.disabled = isLoading;
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

async function handleRecommendBlockCount() {
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

  const llmModel = normalizeLlmModel(els.llmModelSelect?.value);
  try {
    assertLlmKeyPresent(llmModel);
  } catch (err) {
    if (els.recommendBlocksStatus) {
      els.recommendBlocksStatus.textContent = err?.message ? String(err.message) : String(err);
    }
    if (String(err?.message || "").includes("DeepSeek")) showScreen("setup");
    return;
  }

  state.studyNotes = els.studyNotesInput ? String(els.studyNotesInput.value || "") : "";
  state.pendingLlmModel = llmModel;

  setRecommendLoading(true);
  try {
    const resolved = await resolveMaterialForGenerate();
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
      const { inventory: indexed } = await runConceptInventory(cleanedText, {
        llmModel,
        studyNotes: String(state.studyNotes || ""),
        language: getStudyLanguage(),
        onProgress: (msg) => {
          if (els.recommendBlocksStatus) els.recommendBlocksStatus.textContent = msg;
        },
      });
      inventory = indexed;
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
    setRecommendLoading(false);
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
  if (els.loadOfflinePackBtn) {
    els.loadOfflinePackBtn.disabled = isLoading;
    els.loadOfflinePackBtn.textContent = isLoading ? "Loading offline pack…" : "📦 Load offline pack";
  }
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
      `📦 ${totalBlocks} blocks · Generated ${generatedAt}`
      + (failedBlocks > 0 ? ` · ⚠️ ${failedBlocks} blocks have no content` : ""),
  });
  if (els.confirmBlocksStatus) {
    els.confirmBlocksStatus.textContent = `📦 ${totalBlocks} blocks · Generated ${generatedAt}`;
  }
  if (els.confirmBlocksError) {
    els.confirmBlocksError.hidden = failedBlocks <= 0;
    els.confirmBlocksError.textContent =
      failedBlocks > 0 ? `⚠️ ${failedBlocks} blocks have no content` : "";
  }
  renderBlockIndexEditor(state.lastBlockIndex, { readOnly: true });
  if (els.blocksListOutput) {
    els.blocksListOutput.value = formatBlockIndexForConfirmation(state.lastBlockIndex);
  }
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
function setResumeLoading(isLoading) {
  if (els.resumeSessionBtn) els.resumeSessionBtn.disabled = isLoading;
  if (els.resumeSessionStatus) els.resumeSessionStatus.textContent = isLoading ? "Restoring…" : "";
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

function showSessionComplete() {
  try {
    commitSessionConceptsForBlock(state.activeBlockIndex);
  } catch {
    // ignore concept commit errors
  }
  persistFlowRecommendationProgress();
  syncOfflinePackButtonVisibility();
  showScreen("complete");
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

function renderTransitionSneakPeek(o, finishedIdx) {
  if (!o?.sneakPeekWrap || !o?.sneakPeekText) return;
  if (!Number.isFinite(finishedIdx)) return;
  if (isQuestionsStudyMode(state.activeSession)) {
    o.sneakPeekWrap.hidden = true;
    o.sneakPeekText.textContent = "";
    return;
  }

  const nextIndex = finishedIdx + 1;
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

async function ensureBlockGenerated(blockIndex) {
  const existing = getBlock(blockIndex);
  if (hasGeneratedBlockContent(existing)) return existing;
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
    };

    let obj = null;
    try {
      obj = await deepSeekGenerateBlockJson(blockRequest);
    } catch (err) {
      const message = err?.message ? String(err.message) : String(err);
      if (!message.includes("valid JSON")) throw err;
      obj = await deepSeekGenerateBlockJson(blockRequest);
    }

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
  const label = `Q${Math.min(ctx.globalIndex + 1, n)} of ${n} (${ctx.phase})`;
  if (els.testMeta) {
    const totalBlocks = Math.max(1, getTotalBlocksSafe());
    els.testMeta.textContent = `${label} · Block ${state.activeBlockIndex + 1} of ${totalBlocks}`;
  }
  if (els.socraticQuestionTitle) {
    els.socraticQuestionTitle.textContent = label;
  }
}

function setTestMeta() {
  const total = Math.max(1, getTotalBlocksSafe());
  const title = getBlockTitleSafe(state.activeBlockIndex);
  els.testHeader.textContent = title;
  els.testMeta.textContent = `Block ${state.activeBlockIndex + 1} of ${total}`;
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
    setSocraticError(msg);
    els.testError.hidden = false;
    els.testError.textContent = msg;
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
    setSocraticError(msg);
    els.testError.hidden = false;
    els.testError.textContent = msg;
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
  els.testRsvpStatus.textContent = "";
  els.testRsvpView.hidden = true;
  els.testQaView.hidden = true;

  try {
    els.testRsvpSkipBtn.disabled = true;
    els.testRsvpStatus.textContent = "Generating block…";
    await ensureBlockGenerated(state.activeBlockIndex);
  } catch (err) {
    setTestError(err?.message ? String(err.message) : String(err));
    els.testRsvpStatus.textContent = "";
    els.testRsvpSkipBtn.disabled = false;
    return;
  } finally {
    els.testRsvpStatus.textContent = "";
    els.testRsvpSkipBtn.disabled = false;
  }

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
}

function handleTestAnswer({ chosen, correct, feedback }) {
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
  const total = Math.max(1, getTotalBlocksSafe());
  const blockTitle = getBlockTitleSafe(state.activeBlockIndex);
  els.socraticHeader.textContent = "Socratic";
  els.socraticMeta.textContent = `Block ${state.activeBlockIndex + 1} of ${total}: ${blockTitle}`;
  setQuestionProgressUi();
  void renderMarkdown(els.socraticQuestionText, String(q.question));

  setTimeout(() => els.socraticAnswer.focus(), 0);
}

function startBlock(blockIndex) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));

  // 1) triggerPrefetch(N+1) — fire and forget
  const total = Math.max(1, getTotalBlocksSafe());
  const nextIdx = idx + 1;
  if (nextIdx < total) {
    prefetchStartedAtByIndex.set(nextIdx, Date.now());
    setPrefetchIndicator("generating");
    const cfg = resolveBlockQuestionConfig(nextIdx);
    triggerPrefetch(nextIdx, cfg);
  }

  // 2) triggerCommentReply() — fire and forget
  if (shouldTriggerCommentReply()) {
    triggerCommentReply();
  }

  // 3) showRSVP(N) — uses already-generated block data (not prefetch)
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
  if (idx >= total - 1) {
    showSessionComplete();
    return;
  }

  try {
    commitSessionConceptsForBlock(idx);
  } catch {
    // ignore
  }

  const o = getOrCreateTransitionOverlay();
  const nextIndex = idx + 1;
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
    o.statusBarText.textContent = "Ready ✓";
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
    o.statusBarText.textContent = "Regenerating next block…";
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

const ASSESSMENT_SECONDS_PER_QUESTION = 12;
const ASSESSMENT_ADVANCE_AFTER_ANSWER_MS = 1500;

let assessmentRunnerEls = null;
let assessmentFlowBusy = false;

function assessmentRunnerInnerHtml() {
  return `
    <div class="assessment-runner-inner">
      <div id="assessmentRunnerHead" class="assessment-question-head" aria-live="polite">
        Question 1 of 1
      </div>
      <div class="assessment-top">
        <span id="assessmentRunnerMeta">12s to answer</span>
        <span id="assessmentRunnerScore">Score: 0.00</span>
      </div>
      <div class="assessment-bar-label">Session progress</div>
      <div class="assessment-bar-track" aria-hidden="true">
        <div id="assessmentRunnerProgress" class="assessment-bar-fill"></div>
      </div>
      <div class="assessment-bar-label">Time for this question</div>
      <div class="assessment-bar-track assessment-timer-track" aria-hidden="true">
        <div id="assessmentRunnerTimer" class="assessment-bar-fill assessment-timer-fill"></div>
      </div>
      <div id="assessmentRunnerQuestion" class="assessment-question"></div>
      <div id="assessmentRunnerOptions" class="assessment-options"></div>
      <div id="assessmentRunnerPenalty" class="assessment-penalty"></div>
    </div>
  `;
}

function bindAssessmentRunnerEls(root) {
  return {
    root,
    head: root.querySelector("#assessmentRunnerHead"),
    meta: root.querySelector("#assessmentRunnerMeta"),
    score: root.querySelector("#assessmentRunnerScore"),
    progress: root.querySelector("#assessmentRunnerProgress"),
    timer: root.querySelector("#assessmentRunnerTimer"),
    question: root.querySelector("#assessmentRunnerQuestion"),
    options: root.querySelector("#assessmentRunnerOptions"),
    penalty: root.querySelector("#assessmentRunnerPenalty"),
  };
}

function ensureAssessmentRunnerEls() {
  let root = document.getElementById("assessmentRunner");
  if (!root) {
    root = document.createElement("section");
    root.id = "assessmentRunner";
    root.className = "assessment-runner";
    root.hidden = true;
    root.innerHTML = assessmentRunnerInnerHtml();
    document.body.appendChild(root);
  }
  assessmentRunnerEls = bindAssessmentRunnerEls(root);
  return assessmentRunnerEls;
}

let materialGraphBackScreen = "blocks";
let lastMaterialGraph = null;

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

/** Ephemeral RSVP pre-packing flow state (20260611-rsvp-assessment-reposition). */
let prePackingFlow = null;
/** Persists assessment meta until blocks are confirmed. */
let prePackingDraftMeta = null;

function resetPrePackingFlow() {
  prePackingFlow = null;
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
  if (els.blocksListOutput) {
    els.blocksListOutput.value = formatBlockIndexForConfirmation(finalIndex);
  }
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
  host.textContent = `${graph.nodes.length} concepts · ${graph.edges.length} relations`;
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
    els.prePackingAssessmentQuestion.textContent = String(item.question || "");
  }
  const optionsHost = els.prePackingAssessmentOptions;
  if (!optionsHost) return;
  optionsHost.innerHTML = "";
  const groupName = "prePackingAssessmentOption";
  const options = [...(item.options || []), PREPACKING_DONT_KNOW_ANSWER];
  const saved = prePackingFlow.responses?.find((r) => r.item_id === item.item_id)?.answer;
  for (const opt of options) {
    const label = document.createElement("label");
    label.className = "pre-packing-assessment-option";
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
    if (!prePackingFlow.itemsPromise) {
      prePackingFlow.itemsPromise = generatePrePackingAssessmentItems({
        conceptInventory: prePackingFlow.conceptInventory,
        maxItems: ASSESSMENT_FLAGS.ASSESSMENT_ITEMS_MAX,
        llmModel: prePackingFlow.splitOpts?.llmModel,
        language: prePackingFlow.splitOpts?.language || getStudyLanguage(),
      });
    }
    const items = await prePackingFlow.itemsPromise;
    prePackingFlow.assessmentItems = Array.isArray(items) ? items : [];
    if (!prePackingFlow.assessmentItems.length) {
      throw new Error("Could not generate assessment items.");
    }
    if (els.prePackingAssessmentStatus) els.prePackingAssessmentStatus.textContent = "";
    renderPrePackingAssessmentQuestion();
  } catch (err) {
    if (els.prePackingAssessmentError) {
      els.prePackingAssessmentError.hidden = false;
      els.prePackingAssessmentError.textContent = err?.message
        ? String(err.message)
        : "Assessment unavailable — packing without profile.";
    }
    if (els.prePackingAssessmentStatus) {
      els.prePackingAssessmentStatus.textContent = "Falling back to uniform packing…";
    }
    await handlePrePackingSkip();
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
    prePackingFlow.packedResult = packed;
    stashPrePackingDraftMeta();
    applyPackedBlocksToEditor(packed, prePackingFlow.conceptInventory);
    resetPrePackingFlow();
  } catch (err) {
    setGenerateError(err?.message ? String(err.message) : String(err));
    showScreen("create");
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
  if (els.prePackingAssessmentStatus) {
    els.prePackingAssessmentStatus.textContent = "Evaluating responses…";
  }
  if (els.prePackingAssessmentNext) els.prePackingAssessmentNext.disabled = true;

  const profile = await evaluatePrePackingAssessmentResponses({
    items: prePackingFlow.assessmentItems,
    responses: prePackingFlow.responses,
    conceptInventory: prePackingFlow.conceptInventory,
    llmModel: prePackingFlow.splitOpts?.llmModel,
    language: prePackingFlow.splitOpts?.language || getStudyLanguage(),
  });

  prePackingFlow.knowledgeProfile = profile;
  prePackingFlow.assessmentSkipped = false;
  prePackingFlow.packingIgnoredProfile = false;

  if (ASSESSMENT_FLAGS.ASSESSMENT_PARALLEL_PACKING && profile) {
    prePackingFlow.packingPromise = runPrePackingPack({
      knowledgeProfile: profile,
      onProgress: (msg) => {
        if (els.prePackingResultsStatus) els.prePackingResultsStatus.textContent = msg;
      },
    }).then((packed) => {
      prePackingFlow.packedResult = packed;
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
    els.prePackingResultsSummary.textContent = `Mastered: ${full} · Partial: ${partial} · New: ${none}`;
  }
  if (els.prePackingResultsDiff) {
    if (ASSESSMENT_FLAGS.ASSESSMENT_SHOW_DIFF) {
      const n = prePackingFlow.nBlocks;
      els.prePackingResultsDiff.hidden = false;
      els.prePackingResultsDiff.textContent = `Hasta ${n} → packing with profile (may be fewer blocks)`;
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
    els.prePackingResultsStatus.textContent = "Preparing blocks…";
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
    prePackingFlow.packedResult = packed;
    if (ASSESSMENT_FLAGS.ASSESSMENT_SHOW_DIFF && els.prePackingResultsDiff) {
      els.prePackingResultsDiff.textContent = `Hasta ${prePackingFlow.nBlocks} → ${packed.blockIndex.length}`;
    }
    stashPrePackingDraftMeta();
    applyPackedBlocksToEditor(packed, prePackingFlow.conceptInventory);
    resetPrePackingFlow();
  } catch (err) {
    setGenerateError(err?.message ? String(err.message) : String(err));
    showScreen("create");
  } finally {
    if (els.prePackingResultsAccept) els.prePackingResultsAccept.disabled = false;
    if (els.prePackingResultsStatus) els.prePackingResultsStatus.textContent = "";
  }
}

async function handlePrePackingIgnore() {
  if (!prePackingFlow) return;
  prePackingFlow.packingIgnoredProfile = true;
  if (els.prePackingResultsStatus) {
    els.prePackingResultsStatus.textContent = "Re-packing without profile…";
  }
  try {
    const packed = await runPrePackingPack({ knowledgeProfile: null });
    prePackingFlow.packedResult = packed;
    stashPrePackingDraftMeta();
    applyPackedBlocksToEditor(packed, prePackingFlow.conceptInventory);
    resetPrePackingFlow();
  } catch (err) {
    setGenerateError(err?.message ? String(err.message) : String(err));
    showScreen("create");
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
    <span class="hint">${es ? `${graph.nodes.length} nodos · ${graph.edges.length} enlaces` : `${graph.nodes.length} nodes · ${graph.edges.length} edges`}</span>`;
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
    <span class="hint">${es ? "Vista previa del mapa argumental" : "Argument map preview"} · ${graph.nodes.length} nodes</span>`;
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
    enterModeSelectScreen();
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

  // Connection questions are enabled by default (bloques 2..N).
  if (els.connectionQuestionsToggleBtn) {
    const next = state.includeConnectionQuestions !== false;
    els.connectionQuestionsToggleBtn.setAttribute("aria-pressed", String(next));
    if (els.connectionQuestionsToggleSubtitle) {
      els.connectionQuestionsToggleSubtitle.hidden = next;
    }
  }

  function goAfterBlocksConfirmed(nBlocks) {
    if (isPrePackingAssessmentEnabled()) {
      goToSessionReady(nBlocks);
      return;
    }
    goToInitialAssessment();
  }

  function setAssessmentUiDefaults() {
    const hideLegacy = isPrePackingAssessmentEnabled();
    if (els.assessmentChoiceWrap) els.assessmentChoiceWrap.hidden = hideLegacy;
    if (els.assessmentConfigWrap) els.assessmentConfigWrap.hidden = true;
    if (els.assessmentMaxQuestions) els.assessmentMaxQuestions.value = "20";
    if (els.assessmentPenaliseBtn) els.assessmentPenaliseBtn.setAttribute("aria-pressed", "true");
    if (els.assessmentPenaliseSubtitle) els.assessmentPenaliseSubtitle.hidden = false;
    if (els.assessmentMaxQuestionsLabel) {
      const n = 20;
      els.assessmentMaxQuestionsLabel.textContent = `${n} questions · ~${n * 12} seconds`;
    }
  }

  function goToSessionReady(nBlocks) {
    const n = Math.max(1, Math.floor(Number(nBlocks) || 1));
    setFullPackEntryCta(n);
    if (els.sessionReadyMeta) {
      els.sessionReadyMeta.textContent = `Session ready. Blocks: ${n}`;
    }
    showScreen("ready");
  }

  function goToInitialAssessment() {
    delete window.assessmentConfig;
    setAssessmentUiDefaults();
    showScreen("assessment");
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
    state.nTest = clampInt(state.activeSession?.n_test, 0, MAX_N_TEST, state.nTest);
    state.nSocratic = clampInt(state.activeSession?.n_socratic, 0, 3, state.nSocratic);
    state.activeBlockIndex = Math.max(0, Number(state.activeSession?.current_block_index) || 0);
    const savedQ = state.activeSession?.active_question_index;
    state.activeQuestionIndex =
      savedQ != null && Number.isFinite(Number(savedQ))
        ? Math.max(0, Math.floor(Number(savedQ)))
        : 0;
    updateStudyProgressUi();
    startBlock(state.activeBlockIndex);
  }

  function showAssessmentResults(responses, questions) {
    const resp = Array.isArray(responses) ? responses : [];
    const qs = Array.isArray(questions) ? questions : [];
    const blockIndex = Array.isArray(state.lastBlockIndex)
      ? state.lastBlockIndex
      : safeParseJson(localStorage.getItem(LS_BLOCK_INDEX_KEY) || "[]");
    const byBlock = new Map();

    function ensureBlockBucket(blockId) {
      const id = Number(blockId);
      if (!Number.isFinite(id) || id <= 0) return null;
      if (!byBlock.has(id)) {
        byBlock.set(id, {
          total: 0,
          correct: 0,
          wrong: 0,
          skipped: 0,
          title:
            String(
              (Array.isArray(blockIndex) ? blockIndex.find((b) => Number(b?.id) === id)?.title : "") ||
                `Block ${id}`,
            ).trim() || `Block ${id}`,
        });
      }
      return byBlock.get(id);
    }

    for (let i = 0; i < qs.length; i += 1) {
      const q = qs[i] || {};
      const r = resp[i] || {};
      const blockId = Number(r.block_id ?? q.block_id);
      const b = ensureBlockBucket(blockId);
      if (!b) continue;
      b.total += 1;
      if (r.skipped) {
        b.skipped += 1;
      } else if (r.correct === true) {
        b.correct += 1;
      } else if (r.correct === false) {
        b.wrong += 1;
      }
    }

    const perBlock = {};
    let strongCount = 0;
    let weakCount = 0;
    let rawTotal = 0;
    let penalisedTotal = 0;

    const blockRows = Array.from(byBlock.entries())
      .map(([id, b]) => ({ id, ...b }))
      .sort((a, b) => a.id - b.id);

    for (const row of blockRows) {
      const total = Math.max(1, Number(row.total) || 0);
      const raw = Number(row.correct) / total;
      const penalised = (Number(row.correct) - 0.33 * Number(row.wrong)) / total;
      let classification = "ok";
      if (penalised > 0.75) classification = "strong";
      else if (penalised < 0.45) classification = "weak";
      if (classification === "strong") strongCount += 1;
      if (classification === "weak") weakCount += 1;
      rawTotal += Number(row.correct);
      penalisedTotal += Number(row.correct) - 0.33 * Number(row.wrong);
      perBlock[String(row.id)] = {
        score: penalised,
        classification,
      };
      row.raw = raw;
      row.penalised = penalised;
      row.classification = classification;
    }

    const maxQuestions = Math.max(1, qs.length);
    const pct = (penalisedTotal / maxQuestions) * 100;
    window.assessmentResults = {
      perBlock,
      penalisedTotal,
      rawTotal,
      maxQuestions,
      pct,
      skipped: false,
    };
    document.body.classList.add("assessment-active");
    hideSidebar();

    const o = ensureAssessmentRunnerEls();
    o.root.hidden = false;
    o.root.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "assessment-runner-inner";

    const h = document.createElement("h1");
    h.style.margin = "0";
    h.style.fontSize = "24px";
    h.textContent = `Assessment complete — ${penalisedTotal.toFixed(2)}/${maxQuestions} (${Math.round(
      pct,
    )}%) · ${strongCount} strong · ${weakCount} weak blocks`;
    wrap.appendChild(h);

    const gapStatusEl = document.createElement("div");
    gapStatusEl.className = "hint gap-synthesis-status";
    gapStatusEl.textContent = "Analysing gaps…";
    wrap.appendChild(gapStatusEl);

    const heatmap = document.createElement("div");
    heatmap.style.display = "grid";
    heatmap.style.gridTemplateColumns = "repeat(auto-fill, minmax(180px, 1fr))";
    heatmap.style.gap = "10px";

    const palette = {
      strong: "rgba(34, 197, 94, 0.24)",
      ok: "rgba(250, 204, 21, 0.2)",
      weak: "rgba(248, 113, 113, 0.24)",
    };
    for (const row of blockRows) {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.style.textAlign = "left";
      pill.style.background = palette[row.classification] || palette.ok;
      pill.style.minHeight = "54px";
      pill.style.borderRadius = "999px";
      pill.style.padding = "10px 14px";
      const words = String(row.title || "")
        .trim()
        .split(/\s+/)
        .slice(0, 4)
        .join(" ");
      pill.textContent = words || `Block ${row.id}`;
      pill.title = `Score: ${row.correct}/${row.total} questions`;
      heatmap.appendChild(pill);
    }
    wrap.appendChild(heatmap);

    const coachPlaceholder = document.createElement("div");
    coachPlaceholder.className = "hint";
    coachPlaceholder.textContent = "Analysing your results...";
    coachPlaceholder.style.marginTop = "4px";
    wrap.appendChild(coachPlaceholder);

    void generateAssessmentSynthesis(window.assessmentResults, blockIndex, getStudyLanguage()).then(
      (text) => {
        if (!coachPlaceholder.isConnected) return;
        if (!text) {
          coachPlaceholder.remove();
          return;
        }
        const card = document.createElement("div");
        card.className = "assessment-coach-card";
        void renderMarkdown(card, String(text));
        coachPlaceholder.replaceWith(card);
      },
    );

    const summary = document.createElement("div");
    summary.className = "response-box";
    summary.style.marginTop = "6px";
    if (weakCount === 0 && strongCount === 0) {
      summary.textContent = "No changes — all blocks in normal range";
    } else {
      const weakLine =
        weakCount > 0
          ? `${weakCount} weak → thorough explanation + ≥1 question per flagged gap`
          : "";
      const strongLine =
        strongCount > 0 ? `${strongCount} strong → brief recap (~150–220 words), fewer questions` : "";
      summary.innerHTML = [weakLine, strongLine].filter(Boolean).join("<br>");
    }
    wrap.appendChild(summary);

    const actions = document.createElement("div");
    actions.className = "row assessment-results-actions";
    const acceptBtn = document.createElement("button");
    acceptBtn.type = "button";
    acceptBtn.textContent = "Accept suggestions";
    actions.appendChild(acceptBtn);
    wrap.appendChild(actions);

    const gapDetails = document.createElement("details");
    gapDetails.className = "gap-review-details";
    const gapDetailsSummary = document.createElement("summary");
    gapDetailsSummary.textContent = "Review gaps (optional)";
    gapDetails.appendChild(gapDetailsSummary);
    const gapEditorRoot = document.createElement("div");
    gapEditorRoot.className = "gap-editor-grid";
    gapDetails.appendChild(gapEditorRoot);
    wrap.appendChild(gapDetails);

    const userEdits = {};
    const userTouchedBlocks = new Set();
    let synthesisDraft = {};
    let synthesisStatus = "pending";

    const gapEditors = new Map();

    function syncUserEdits(blockId, labels) {
      const key = String(blockId);
      const normalized = labels
        .map((l) => String(l || "").trim())
        .filter((l) => l.length >= 3 && l.length <= 80);
      if (!normalized.length) {
        userEdits[key] = [];
      } else {
        userEdits[key] = normalized.map((label) => ({ label, source: "user" }));
      }
      userTouchedBlocks.add(key);
    }

    function mountGapBlockEditor(blockId, title, initialLabels) {
      const section = document.createElement("div");
      section.className = "gap-block-editor";
      const heading = document.createElement("div");
      heading.className = "gap-block-title";
      heading.textContent = `#${blockId} ${title}`;
      const chipsRow = document.createElement("div");
      chipsRow.className = "gap-chips";
      const addRow = document.createElement("div");
      addRow.className = "gap-add-row";
      const addInput = document.createElement("input");
      addInput.type = "text";
      addInput.placeholder = "Add gap label…";
      addInput.maxLength = 80;
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.textContent = "Add";
      addRow.append(addInput, addBtn);
      section.append(heading, chipsRow, addRow);
      gapEditorRoot.appendChild(section);

      let labels = initialLabels.slice();

      function renderChips() {
        chipsRow.replaceChildren();
        labels.forEach((label, idx) => {
          const chip = document.createElement("span");
          chip.className = "gap-chip";
          const text = document.createElement("input");
          text.type = "text";
          text.value = label;
          text.maxLength = 80;
          text.addEventListener("change", () => {
            labels[idx] = String(text.value || "").trim();
            syncUserEdits(blockId, labels);
          });
          const rm = document.createElement("button");
          rm.type = "button";
          rm.className = "gap-chip-remove";
          rm.setAttribute("aria-label", "Remove gap");
          rm.textContent = "×";
          rm.addEventListener("click", () => {
            labels.splice(idx, 1);
            syncUserEdits(blockId, labels);
            renderChips();
          });
          chip.append(text, rm);
          chipsRow.appendChild(chip);
        });
      }

      function addLabel(raw) {
        const label = String(raw || "").trim();
        if (label.length < 3 || labels.length >= 8) return;
        if (labels.includes(label)) return;
        labels.push(label);
        addInput.value = "";
        syncUserEdits(blockId, labels);
        renderChips();
      }

      addBtn.addEventListener("click", () => addLabel(addInput.value));
      addInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addLabel(addInput.value);
        }
      });

      renderChips();
      return {
        setLabels(newLabels) {
          labels = newLabels.slice();
          renderChips();
        },
        getLabels: () => labels.slice(),
      };
    }

    for (const row of blockRows) {
      gapEditors.set(
        row.id,
        mountGapBlockEditor(row.id, row.title || `Block ${row.id}`, []),
      );
    }

    function applySynthesisToEditors() {
      for (const row of blockRows) {
        const key = String(row.id);
        if (userTouchedBlocks.has(key)) continue;
        const editor = gapEditors.get(row.id);
        if (!editor) continue;
        editor.setLabels(gapLabelsForBlock(synthesisDraft, row.id));
      }
    }

    function setGapStatusMessage(status) {
      if (status === "ok") {
        gapStatusEl.textContent = "Gaps ready";
        return;
      }
      if (status === "timeout") {
        gapStatusEl.textContent = "Gap analysis timed out — using block scores only";
        return;
      }
      if (status === "error") {
        gapStatusEl.textContent = "Gap analysis failed — using block scores only";
        return;
      }
      if (status === "skipped") {
        gapStatusEl.textContent = "Gap analysis skipped (no API key)";
        return;
      }
      gapStatusEl.textContent = "Analysing gaps…";
    }

    const synthesisPromise = synthesizeAssessmentGaps({
      assessmentResults: window.assessmentResults,
      questions: qs,
      responses: resp,
      blockIndex,
      language: getStudyLanguage(),
    })
      .then((result) => {
        synthesisStatus = "ok";
        synthesisDraft = result?.gaps_by_block && typeof result.gaps_by_block === "object" ? result.gaps_by_block : {};
        setGapStatusMessage("ok");
        applySynthesisToEditors();
        return result;
      })
      .catch((err) => {
        if (err instanceof GapSynthesisError) {
          if (err.code === "missing_api_key") synthesisStatus = "skipped";
          else if (err.code === "timeout") synthesisStatus = "timeout";
          else synthesisStatus = "error";
        } else {
          synthesisStatus = "error";
        }
        synthesisDraft = {};
        setGapStatusMessage(synthesisStatus);
        if (synthesisStatus === "error") console.warn("[gap-synthesis]", err);
        return { gaps_by_block: {} };
      });

    function resolveGapsSource(merged) {
      const hasGaps = merged && typeof merged === "object" && Object.keys(merged).length > 0;
      if (!hasGaps) return "none";
      const hadSynthesis =
        synthesisStatus === "ok" &&
        synthesisDraft &&
        typeof synthesisDraft === "object" &&
        Object.keys(synthesisDraft).length > 0;
      if (userTouchedBlocks.size > 0 && hadSynthesis) return "merged";
      if (userTouchedBlocks.size > 0) return "user";
      return "synthesis";
    }

    function cleanupResultsUi() {
      o.root.hidden = true;
      o.root.innerHTML = assessmentRunnerInnerHtml();
      assessmentRunnerEls = bindAssessmentRunnerEls(o.root);
      document.body.classList.remove("assessment-active");
      showSidebar();
    }

    acceptBtn.addEventListener("click", async () => {
      acceptBtn.disabled = true;
      const prevLabel = acceptBtn.textContent;
      acceptBtn.textContent = "Applying…";
      try {
        await synthesisPromise;
        const merged = mergeGapLists({ gaps_by_block: synthesisDraft }, userEdits);
        const gapsSource = resolveGapsSource(merged);
        const applyResult = applyAssessmentResults({
          ...(window.assessmentResults || {}),
          gapsByBlock: merged,
          gaps_by_block: merged,
          gapsSource,
          gaps_source: gapsSource,
          synthesisStatus,
          synthesis_status: synthesisStatus,
        });

        wrap.innerHTML = "";
        const okTitle = document.createElement("h1");
        okTitle.style.margin = "0";
        okTitle.style.fontSize = "24px";
        okTitle.textContent = "Session personalised. Ready to generate blocks.";
        const okMeta = document.createElement("p");
        okMeta.className = "subtle";
        okMeta.style.margin = "8px 0 0";
        okMeta.textContent = `Strong: ${applyResult.strongBlocks.length} · Weak: ${applyResult.weakBlocks.length}`;
        const goBtn = document.createElement("button");
        goBtn.type = "button";
        goBtn.textContent = "Start generating →";
        goBtn.style.marginTop = "12px";
        wrap.appendChild(okTitle);
        wrap.appendChild(okMeta);
        wrap.appendChild(goBtn);
        goBtn.addEventListener("click", async () => {
          cleanupResultsUi();
          await startStudyingNow();
        });
      } finally {
        if (acceptBtn.isConnected) {
          acceptBtn.disabled = false;
          acceptBtn.textContent = prevLabel;
        }
      }
    });

    o.root.appendChild(wrap);
  }

  async function runAssessment(questions, penalise, maxQuestions) {
    const o = ensureAssessmentRunnerEls();
    const cap = Math.max(1, Math.floor(Number(maxQuestions) || 0));
    const list = (Array.isArray(questions) ? questions : []).slice(0, cap);
    const penaltyOn = Boolean(penalise);
    if (!list.length) {
      showAssessmentResults([], []);
      return;
    }

    let currentQ = 0;
    const responses = [];
    let score = 0;
    let settled = false;
    let timerId = null;
    let rafId = null;
    let startedAt = 0;
    const timerMs = ASSESSMENT_SECONDS_PER_QUESTION * 1000;

    function cleanup() {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      document.removeEventListener("keydown", onKeyDown);
      o.root.hidden = true;
      document.body.classList.remove("assessment-active");
      showSidebar();
    }

    function formatScore(n) {
      return `${n >= 0 ? "" : "-"}${Math.abs(n).toFixed(2)}`;
    }

    function renderHeader() {
      if (o.head) {
        o.head.textContent = `Question ${currentQ + 1} of ${list.length}`;
      }
      o.score.textContent = `Score: ${formatScore(score)}`;
      const p = ((currentQ + 1) / list.length) * 100;
      o.progress.style.width = `${Math.max(0, Math.min(100, p))}%`;
    }

    function updateTimeMeta(elapsedMs) {
      const secsLeft = Math.max(0, Math.ceil((timerMs - elapsedMs) / 1000));
      o.meta.textContent = `${secsLeft}s to answer`;
    }

    function stopTimer() {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function tickTimer() {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.max(0, Math.min(1, elapsed / timerMs));
      const remaining = 1 - ratio;
      o.timer.style.width = `${remaining * 100}%`;
      const hue = 120 * remaining; // green -> red
      o.timer.style.background = `hsl(${hue} 90% 55%)`;
      updateTimeMeta(elapsed);
      if (ratio < 1 && !settled) rafId = requestAnimationFrame(tickTimer);
    }

    function getLetterFromKey(e) {
      const k = String(e.key || "").toUpperCase();
      if (k === "A" || k === "B" || k === "C" || k === "D") return k;
      return "";
    }

    function renderQuestion() {
      settled = false;
      stopTimer();
      renderHeader();

      const q = normalizeTestQuestion(list[currentQ] || {});
      const qText = String(q.question || "").trim();
      o.question.textContent = qText || "Untitled question";
      o.options.innerHTML = "";

      const options = q.options && typeof q.options === "object" ? q.options : {};
      for (const key of ["A", "B", "C", "D"]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "assessment-option-btn";
        btn.setAttribute("data-option", key);
        btn.innerHTML = `<span class="assessment-option-key">${key}</span><span>${String(
          options[key] || "",
        )}</span>`;
        btn.addEventListener("click", () => settleAnswer(key));
        o.options.appendChild(btn);
      }

      o.penalty.textContent = penaltyOn ? "Wrong answers: -0.33 pts" : "";
      startedAt = Date.now();
      updateTimeMeta(0);
      o.timer.style.width = "100%";
      o.timer.style.background = "hsl(120 90% 55%)";
      rafId = requestAnimationFrame(tickTimer);
      timerId = setTimeout(() => settleAnswer(""), timerMs);
    }

    function markCorrectAnswer(correctLetter) {
      if (!correctLetter) return;
      const correctBtn = o.options.querySelector(`[data-option="${correctLetter}"]`);
      if (correctBtn) correctBtn.classList.add("is-correct");
    }

    function disableOptions() {
      const all = o.options.querySelectorAll("button");
      for (const b of all) b.disabled = true;
    }

    function settleAnswer(letter) {
      if (settled) return;
      settled = true;
      stopTimer();
      disableOptions();

      const q = list[currentQ] || {};
      const correctAnswer = String(q.answer || "").trim().toUpperCase();
      const blockId = Number(q.block_id);

      if (!letter) {
        responses.push({ block_id: blockId, correct: null, skipped: true });
      } else if (letter === correctAnswer) {
        score += 1;
        window.assessmentScore = score;
        responses.push({ block_id: blockId, correct: true, skipped: false });
        const selected = o.options.querySelector(`[data-option="${letter}"]`);
        if (selected) selected.classList.add("is-correct");
      } else {
        if (penaltyOn) score -= 0.33;
        window.assessmentScore = score;
        responses.push({ block_id: blockId, correct: false, skipped: false });
        const selected = o.options.querySelector(`[data-option="${letter}"]`);
        if (selected) selected.classList.add("is-wrong");
        markCorrectAnswer(correctAnswer);
      }

      renderHeader();
      o.meta.textContent = "Next question…";
      window.setTimeout(() => {
        currentQ += 1;
        if (currentQ >= list.length) {
          cleanup();
          showAssessmentResults(responses, list);
          return;
        }
        renderQuestion();
      }, ASSESSMENT_ADVANCE_AFTER_ANSWER_MS);
    }

    function onKeyDown(e) {
      if (e.repeat) return;
      const letter = getLetterFromKey(e);
      if (!letter || settled) return;
      e.preventDefault();
      settleAnswer(letter);
    }

    document.body.classList.add("assessment-active");
    hideSidebar();
    o.root.hidden = false;
    document.addEventListener("keydown", onKeyDown);
    renderQuestion();
  }

  if (els.nTestMinusBtn) els.nTestMinusBtn.addEventListener("click", () => bumpQuestionCount("test", -1));
  if (els.nTestPlusBtn) els.nTestPlusBtn.addEventListener("click", () => bumpQuestionCount("test", +1));
  if (els.nSocraticMinusBtn) els.nSocraticMinusBtn.addEventListener("click", () => bumpQuestionCount("socratic", -1));
  if (els.nSocraticPlusBtn) els.nSocraticPlusBtn.addEventListener("click", () => bumpQuestionCount("socratic", +1));

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
  if (els.importIndexFile) {
    const setImportIndexLabel = (text) => {
      if (els.importIndexLabel) els.importIndexLabel.textContent = text;
      if (els.importIndexConfirmLabel) els.importIndexConfirmLabel.textContent = text;
    };
    const openImportIndexFile = () => {
      clearConfirmError();
      if (els.confirmBlocksStatus) els.confirmBlocksStatus.textContent = "";
      setImportIndexLabel("");
      els.importIndexFile.value = "";
      els.importIndexFile.click();
    };
    if (els.importIndexBtn) {
      els.importIndexBtn.addEventListener("click", openImportIndexFile);
    }
    if (els.importIndexConfirmBtn) {
      els.importIndexConfirmBtn.addEventListener("click", openImportIndexFile);
    }
    els.importIndexFile.addEventListener("change", async () => {
      const fileList = els.importIndexFile.files
        ? Array.from(els.importIndexFile.files)
        : [];
      const file = fileList[0];
      if (!file) return;
      clearConfirmError();
      if (els.confirmBlocksStatus) els.confirmBlocksStatus.textContent = "Importing…";
      try {
        const rawText = await file.text();
        const mapped = parseImportedIndexText(rawText);
        if (!Array.isArray(mapped) || !mapped.length) {
          throw new Error("Could not parse file. Expected JSON array or text list.");
        }
        state.lastBlockIndex = mapped;
        state.lastNBlocks = mapped.length;
        window.blockIndex = mapped;
        window.indexWasImported = true;
        renderSplitMergeSummary(null);
        renderBlocksGraphActions(mapped, []);
        renderBlockIndexEditor(mapped, { readOnly: false });
        if (els.blocksListOutput) {
          els.blocksListOutput.value = formatBlockIndexForConfirmation(mapped);
        }
        setImportIndexLabel(`✓ ${mapped.length} blocks imported — skipping auto-split`);
        if (els.confirmBlocksStatus) els.confirmBlocksStatus.textContent = "";
        showScreen("blocks");
      } catch (err) {
        setConfirmError("Could not parse file. Expected JSON array or text list.");
        setImportIndexLabel("");
        window.indexWasImported = false;
        if (els.confirmBlocksStatus) els.confirmBlocksStatus.textContent = "";
      }
    });
  }

  if (els.studyNotesInput) {
    const stored = String(localStorage.getItem(LS_STUDY_NOTES_KEY) || "");
    els.studyNotesInput.value = stored;
    state.studyNotes = stored;
    let studyNotesInvalidationTimer = null;
    els.studyNotesInput.addEventListener("input", () => {
      const v = String(els.studyNotesInput.value || "");
      state.studyNotes = v;
      try {
        localStorage.setItem(LS_STUDY_NOTES_KEY, v);
      } catch {
        // ignore
      }
      clearTimeout(studyNotesInvalidationTimer);
      studyNotesInvalidationTimer = setTimeout(() => {
        invalidateBlockSplitCacheAndRecommendUi();
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
    } catch {
      els.fileExtractHint.textContent = "";
    }
  });

  enableUnifiedMaterialUpload();

  if (els.recommendBlocksBtn) {
    els.recommendBlocksBtn.addEventListener("click", () => {
      void handleRecommendBlockCount();
    });
  }

  els.generateBlocksForm.addEventListener("submit", async (e) => {
    e.preventDefault();
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
      const resolvedCloze = await resolveMaterialForGenerate();
      if (!resolvedCloze) {
        setGenerateError("Please choose a file (.pdf, .html, .txt, or .md).");
        return;
      }
      setGenerateLoading(true);
      try {
        const { file, cleanedText, normalizedFormat, originalFormat } = resolvedCloze;
        if (!cleanedText.trim()) throw new Error("File appears to be empty.");
        const llmModel = normalizeLlmModel(els.llmModelSelect?.value);
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
        if (els.generateBlocksForm) els.generateBlocksForm.hidden = true;
        updateClozeSessionPanel(sessionObj);
        showScreen("create");
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
      const llmModel = normalizeLlmModel(els.llmModelSelect?.value);
      try {
        assertLlmKeyPresent(llmModel);
      } catch (err) {
        setGenerateError(err?.message ? String(err.message) : String(err));
        if (String(err?.message || "").includes("DeepSeek")) showScreen("setup");
        return;
      }
      const resolvedSlow = await resolveMaterialForGenerate();
      if (!resolvedSlow) {
        setGenerateError("Please choose a file (.pdf, .html, .txt, or .md).");
        return;
      }
      setGenerateLoading(true);
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

    const llmModel = normalizeLlmModel(els.llmModelSelect?.value);
    try {
      assertLlmKeyPresent(llmModel);
    } catch (err) {
      setGenerateError(err?.message ? String(err.message) : String(err));
      if (String(err?.message || "").includes("DeepSeek")) showScreen("setup");
      return;
    }
    state.pendingLlmModel = llmModel;

    // Validate global question defaults for this session.
    if ((state.nTest || 0) <= 0 && (state.nSocratic || 0) <= 0) {
      setGenerateError("Please set at least one question per block (test or socratic).");
      return;
    }
    storeDefaultQuestionConfig({ n_test: state.nTest, n_socratic: state.nSocratic });

    const nBlocks = Number(els.blocksInput.value);
    if (!Number.isFinite(nBlocks) || nBlocks < 5 || nBlocks > 60) {
      setGenerateError("Blocks must be a number between 5 and 60.");
      return;
    }

    const resolvedRsvp = await resolveMaterialForGenerate();
    if (!resolvedRsvp) {
      setGenerateError("Please choose a file (.pdf, .html, .txt, or .md).");
      return;
    }

    setGenerateLoading(true);
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
      const prePackingOn = isPrePackingAssessmentEnabled();

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
        const invResult = await runConceptInventory(cleanedText, splitOpts);
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

      prePackingFlow = {
        phase: "assessment",
        conceptInventory,
        nBlocks,
        cleanedText,
        splitOpts,
        fingerprint,
        assessmentItems: [],
        itemsPromise: generatePrePackingAssessmentItems({
          conceptInventory,
          maxItems: ASSESSMENT_FLAGS.ASSESSMENT_ITEMS_MAX,
          llmModel: splitOpts.llmModel,
          language: splitOpts.language,
        }).catch(() => []),
        responses: [],
        knowledgeProfile: null,
        packingPromise: null,
        packedResult: null,
        assessmentSkipped: false,
        packingIgnoredProfile: false,
        questionIndex: 0,
        draftMeta: { _meta: {} },
      };

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
    els.confirmBlocksStatus.textContent = "Saving blocks list…";

    try {
      if (!state.lastBlockIndex || !Array.isArray(state.lastBlockIndex)) {
        throw new Error("Missing generated blocks. Please regenerate blocks.");
      }

      syncHiddenBlocksJsonFromEditor();
      const edited = safeParseJson(els.blocksListOutput.value || "");
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
      // #region agent log
      fetch('http://127.0.0.1:7501/ingest/6a96a96a-b441-41a6-a2c1-f773e722183c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe9701'},body:JSON.stringify({sessionId:'fe9701',runId:'pre-fix',hypothesisId:'H5',location:'src/js/study.js:2816',message:'confirm blocks before storeActiveSession',data:{nBlocks,sessionBlocks:Array.isArray(sessionObj.blocks)?sessionObj.blocks.length:null,stateActiveSessionBefore:!!state.activeSession,indexWasImported:window.indexWasImported===true},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      storeActiveSession(sessionObj);
      state.activeSession = sessionObj;
      refreshGuideContext();
      // #region agent log
      fetch('http://127.0.0.1:7501/ingest/6a96a96a-b441-41a6-a2c1-f773e722183c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe9701'},body:JSON.stringify({sessionId:'fe9701',runId:'pre-fix',hypothesisId:'H6',location:'src/js/study.js:2820',message:'confirm blocks after storeActiveSession',data:{storedSessionExists:!!loadActiveSession(),stateActiveSessionAfterStore:!!state.activeSession},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7501/ingest/6a96a96a-b441-41a6-a2c1-f773e722183c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe9701'},body:JSON.stringify({sessionId:'fe9701',runId:'pre-fix',hypothesisId:'H5,H6,H7',location:'src/js/study.js:2835',message:'generate offline pack clicked',data:{blockIndexLength:blockIndex.length,stateActiveSession:!!state.activeSession,storedSessionExists:!!loadActiveSession(),indexWasImported:window.indexWasImported===true},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
          els.fullPackStudyNowBtn.textContent = "Study now →";
        }
        if (els.fullPackExitBtn) {
          els.fullPackExitBtn.hidden = false;
          els.fullPackExitBtn.textContent = "Done — study later";
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

  if (els.assessmentMaxQuestions) {
    els.assessmentMaxQuestions.addEventListener("input", () => {
      const n = clampInt(els.assessmentMaxQuestions.value, 10, 60, 20);
      if (els.assessmentMaxQuestionsLabel) {
        els.assessmentMaxQuestionsLabel.textContent = `${n} questions · ~${n * 12} seconds`;
      }
    });
  }
  if (els.assessmentPenaliseBtn) {
    els.assessmentPenaliseBtn.addEventListener("click", () => {
      const pressed = els.assessmentPenaliseBtn.getAttribute("aria-pressed") === "true";
      const next = !pressed;
      els.assessmentPenaliseBtn.setAttribute("aria-pressed", String(next));
      if (els.assessmentPenaliseSubtitle) els.assessmentPenaliseSubtitle.hidden = !next;
    });
  }

  if (els.connectionQuestionsToggleBtn) {
    els.connectionQuestionsToggleBtn.addEventListener("click", () => {
      const pressed = els.connectionQuestionsToggleBtn.getAttribute("aria-pressed") === "true";
      const next = !pressed;
      state.includeConnectionQuestions = next;
      els.connectionQuestionsToggleBtn.setAttribute("aria-pressed", String(next));
      if (els.connectionQuestionsToggleSubtitle) {
        els.connectionQuestionsToggleSubtitle.hidden = next;
      }
    });
  }
  if (els.assessmentTakeBtn) {
    els.assessmentTakeBtn.addEventListener("click", () => {
      if (els.assessmentChoiceWrap) els.assessmentChoiceWrap.hidden = true;
      if (els.assessmentConfigWrap) els.assessmentConfigWrap.hidden = false;
      // Ensure labels are consistent even if user never touched slider yet.
      const n = clampInt(els.assessmentMaxQuestions?.value, 10, 60, 20);
      if (els.assessmentMaxQuestionsLabel) {
        els.assessmentMaxQuestionsLabel.textContent = `${n} questions · ~${n * 12} seconds`;
      }
    });
  }
  if (els.assessmentSkipBtn) {
    els.assessmentSkipBtn.addEventListener("click", async () => {
      if (isOfflineMode()) {
        await startStudyingNow();
        return;
      }
      window.assessmentConfig = { skipped: true };
      const n =
        Number(state.activeSession?.n_blocks) ||
        Number(state.lastNBlocks) ||
        safeParseJson(localStorage.getItem(LS_BLOCK_INDEX_KEY) || "[]")?.length ||
        1;
      goToSessionReady(n);
    });
  }
  if (els.assessmentStartBtn) {
    els.assessmentStartBtn.addEventListener("click", async () => {
      if (assessmentFlowBusy) return;
      if (isOfflineMode()) {
        await startStudyingNow();
        return;
      }
      const maxQuestions = clampInt(els.assessmentMaxQuestions?.value, 10, 60, 20);
      const penalise = els.assessmentPenaliseBtn?.getAttribute("aria-pressed") === "true";
      window.assessmentConfig = { maxQuestions, penalise, skipped: false };
      const n =
        Number(state.activeSession?.n_blocks) ||
        Number(state.lastNBlocks) ||
        safeParseJson(localStorage.getItem(LS_BLOCK_INDEX_KEY) || "[]")?.length ||
        1;

      assessmentFlowBusy = true;
      const prevBtnLabel = els.assessmentStartBtn.textContent;
      els.assessmentStartBtn.disabled = true;
      els.assessmentStartBtn.textContent = "Generating…";
      if (els.assessmentGeneratingError) {
        els.assessmentGeneratingError.hidden = true;
        els.assessmentGeneratingError.textContent = "";
      }
      if (els.assessmentGeneratingLabel) {
        els.assessmentGeneratingLabel.textContent =
          "Building your personalised questions. This may take a moment.";
      }
      showScreen("assessmentGenerating");

      try {
        const rawBlockIndex = JSON.parse(localStorage.getItem(LS_BLOCK_INDEX_KEY) || "[]");
        const questions = await generateAssessmentQuestions(rawBlockIndex, maxQuestions);
        await runAssessment(questions, penalise, maxQuestions);
      } catch (err) {
        if (els.assessmentGeneratingError) {
          els.assessmentGeneratingError.hidden = false;
          els.assessmentGeneratingError.textContent = err?.message
            ? String(err.message)
            : "Could not generate the assessment. Please try again.";
        }
        showScreen("assessment");
        if (els.assessmentChoiceWrap) els.assessmentChoiceWrap.hidden = true;
        if (els.assessmentConfigWrap) els.assessmentConfigWrap.hidden = false;
      } finally {
        assessmentFlowBusy = false;
        els.assessmentStartBtn.disabled = false;
        els.assessmentStartBtn.textContent = prevBtnLabel;
      }
    });
  }

  els.socraticSubmitBtn.addEventListener("click", async () => {
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

  if (els.dictionaryBtn) {
    els.dictionaryBtn.addEventListener("click", () => {
      const concepts = getSortedSessionConcepts();
      renderConceptDictionaryInto({
        listEl: els.dictionaryOverlayList,
        defEl: els.dictionaryOverlayDef,
        concepts,
      });
      setDictionaryOverlayOpen(true);
    });
  }
  els.dictionaryCloseBtn.addEventListener("click", () => {
    setDictionaryOverlayOpen(false);
  });
  els.betweenBlocksDictionaryOpenBtn.addEventListener("click", () => {
    const concepts = getSortedSessionConcepts();
    renderConceptDictionaryInto({
      listEl: els.dictionaryOverlayList,
      defEl: els.dictionaryOverlayDef,
      concepts,
    });
    setDictionaryOverlayOpen(true);
  });

  els.saveSessionBtn.addEventListener("click", () => {
    exportSessionMarkdown();
  });
  if (els.downloadOfflinePackBtn) {
    els.downloadOfflinePackBtn.addEventListener("click", () => {
      exportOfflinePack();
    });
  }
  if (els.saveSessionInlineBtn) {
    els.saveSessionInlineBtn.addEventListener("click", () => exportSessionMarkdown());
  }

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
        els.summaryOverlayTitle.textContent = `Summary so far (blocks 1–${n})`;
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
    exportSessionMarkdown();
  });

  wireRsvpHandlers();
  wirePacedReaderHandlers({ onSwitchToRsvp: switchBlockReadingToRsvp });
  els.rsvpSwitchToPacedBtn?.addEventListener("click", switchBlockReadingToPaced);

  if (els.resumeSessionBtn) {
    els.resumeSessionBtn.addEventListener("click", async () => {
      clearResumeError();
      if (els.resumeSessionStatus) els.resumeSessionStatus.textContent = "";
      if (!getStoredKey()) {
        setResumeError('Missing DeepSeek API key. Click "Change API key" to set it.');
        showScreen("setup");
        return;
      }
      const origFile = els.resumeMaterialInput?.files?.[0];
      const mdFile = els.resumeMdInput?.files?.[0];
      if (!origFile) {
        setResumeError("Please choose the original material file.");
        return;
      }
      if (!mdFile) {
        setResumeError("Please choose the exported session markdown (.md).");
        return;
      }
      setResumeLoading(true);
      try {
        const mdText = await readFileAsText(mdFile);
        const rawPayload = extractResumePayloadFromMarkdown(mdText);
        const { cleanedText, wordCount } = await readAndCleanMaterialText(origFile);
        if (!cleanedText.trim()) {
          throw new Error("Original material file appears to be empty.");
        }
        const { sessionObj, pointer, session_concepts } =
          buildSessionFromResumePayload(rawPayload);
        const blockIdxArr = buildBlockIndexFromResumePayload(rawPayload, cleanedText);
        localStorage.setItem(LS_BLOCK_INDEX_KEY, JSON.stringify(blockIdxArr));
        restoreSessionConceptStorage({
          sessionConcepts: session_concepts,
          blocks: sessionObj.blocks,
        });
        if (!sessionObj._meta || typeof sessionObj._meta !== "object") sessionObj._meta = {};
        sessionObj._meta.source_files = [{ name: String(origFile.name || "") }];
        assertLlmKeyPresent(getSessionLlmModel(sessionObj));
        clearGuideChatStorage();
        storeActiveSession(sessionObj);
        state.activeSession = sessionObj;
        state.nTest = clampInt(sessionObj.n_test, 0, MAX_N_TEST, state.nTest);
        state.nSocratic = clampInt(sessionObj.n_socratic, 0, 3, state.nSocratic);
        state.originalMaterialText = cleanedText;
        state.lastCleanedMaterialText = cleanedText;
        state.lastCleanedMaterialWordCount = wordCount;
        state.lastNBlocks = sessionObj.n_blocks;
        state.lastUploadedFileNames = [String(origFile.name || "")];
        state.lastBlockIndex = blockIdxArr;
        if (pointer.session_complete) {
          state.activeBlockIndex = Math.max(0, sessionObj.n_blocks - 1);
          state.activeQuestionIndex = 0;
          syncOfflinePackButtonVisibility();
          showScreen("complete");
        } else {
          state.activeBlockIndex = pointer.current_block_index;
          state.activeQuestionIndex = pointer.active_question_index;
          showScreen("ready");
          setFullPackEntryCta(sessionObj.n_blocks);
          els.sessionReadyMeta.textContent = `Session restored. Next: Block ${
            pointer.current_block_index + 1
          } of ${sessionObj.n_blocks}.`;
        }
        refreshGuideContext();
        updateDictionaryButtonVisibility();
      } catch (err) {
        setResumeError(err?.message ? String(err.message) : String(err));
      } finally {
        setResumeLoading(false);
      }
    });
  }

  setOnPrefetchReady(() => {
    refreshUiOnPrefetchReady();
  });

  setOnBridgeReady(() => {
    refreshUiOnPrefetchReady();
  });

  syncOfflinePackButtonVisibility();
  updateDictionaryButtonVisibility();
}

