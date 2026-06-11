import { LS_STUDY_LANG_KEY, STUDY_LANG_OPTIONS } from "./config.js?v=20260525_1";
import { getStoredGeminiKey } from "./llm.js?v=20260525_1";
import { renderMarkdown } from "./markdown.js?v=20260525_1";
import { isOfflineMode } from "./offline.js?v=20260606_1";

/** @type {null | (() => { title?: string, explanation?: string })} */
let blockReadContentProvider = null;

/** @type {() => string} */
let resolveChromeStudyMode = () => "rsvp";

/** @type {() => boolean} */
let resolveChromeHasConcepts = () => false;

let currentScreenId = "setup";
let blockReadWanted = false;
let guideToggleSuppressed = false;

/** @param {() => string} resolver */
export function registerChromeStudyModeResolver(resolver) {
  resolveChromeStudyMode = typeof resolver === "function" ? resolver : () => "rsvp";
  syncFloatingChrome();
}

/** @param {() => boolean} resolver */
export function registerChromeHasConceptsResolver(resolver) {
  resolveChromeHasConcepts = typeof resolver === "function" ? resolver : () => false;
  syncFloatingChrome();
}

/** @returns {'rsvp'|'slow'|'cloze'|'questions'} */
function normalizeChromeStudyMode(mode) {
  const m = String(mode || "").trim();
  if (m === "slow") return "slow";
  if (m === "cloze") return "cloze";
  if (m === "questions") return "questions";
  return "rsvp";
}

/**
 * @typedef {object} ChromeVisibilityContext
 * @property {string} screenId
 * @property {string} studyMode
 * @property {boolean} blockReadWanted
 * @property {boolean} hasConcepts
 * @property {boolean} offline
 * @property {boolean} assessmentActive
 * @property {boolean} [guideToggleSuppressed]
 */

/**
 * Pure chrome visibility rules for floating FABs.
 * @param {ChromeVisibilityContext} ctx
 * @returns {{ showBlockReadFab: boolean, showGuideFab: boolean }}
 */
const CHROME_GUIDE_STUDY_SCREENS = new Set([
  "test",
  "socratic",
  "between",
  "review",
  "reviewGenerating",
  "reviewSummary",
  "clozeStudy",
]);

export function resolveChromeVisibility(ctx) {
  const studyMode = normalizeChromeStudyMode(ctx.studyMode);
  const isRsvp = studyMode === "rsvp";
  const isGuideStudyMode =
    studyMode === "rsvp" || studyMode === "cloze" || studyMode === "questions";
  const assessmentActive = Boolean(ctx.assessmentActive);
  const guideToggleSuppressed = Boolean(ctx.guideToggleSuppressed);
  const screenId = String(ctx.screenId || "");

  const showBlockReadFab =
    isRsvp &&
    Boolean(ctx.blockReadWanted) &&
    (screenId === "test" || screenId === "socratic") &&
    !assessmentActive;

  const onGuideStudyScreen =
    CHROME_GUIDE_STUDY_SCREENS.has(screenId) &&
    (screenId !== "between" || Boolean(ctx.hasConcepts)) &&
    (screenId !== "clozeStudy" || studyMode === "cloze");

  const showGuideFab =
    isGuideStudyMode &&
    onGuideStudyScreen &&
    !ctx.offline &&
    !assessmentActive &&
    !guideToggleSuppressed;

  return { showBlockReadFab, showGuideFab };
}

export function syncFloatingChrome() {
  const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
  const blockReadBtn = document.getElementById("block-read-toggle-btn");
  const blockReadSidebar = document.getElementById("block-read-sidebar");
  const { showBlockReadFab, showGuideFab } = resolveChromeVisibility({
    screenId: currentScreenId,
    studyMode: resolveChromeStudyMode(),
    blockReadWanted,
    hasConcepts: resolveChromeHasConcepts(),
    offline: isOfflineMode(),
    assessmentActive: document.body.classList.contains("assessment-active"),
    guideToggleSuppressed,
  });

  if (sidebarToggleBtn) {
    sidebarToggleBtn.hidden = !showGuideFab;
    if (showGuideFab) sidebarToggleBtn.style.removeProperty("display");
    else sidebarToggleBtn.style.display = "none";
  }

  if (blockReadBtn) {
    blockReadBtn.hidden = !showBlockReadFab;
    if (showBlockReadFab) blockReadBtn.style.removeProperty("display");
    else blockReadBtn.style.display = "none";
  }
  if (blockReadSidebar) {
    if (!showBlockReadFab) {
      blockReadSidebar.hidden = true;
      closeBlockReadSidebar();
    } else {
      blockReadSidebar.hidden = false;
    }
  }
}

export const els = {
  changeKeyLink: document.getElementById("changeKeyLink"),
  newSessionBtn: document.getElementById("newSessionBtn"),
  dictionaryBtn: document.getElementById("dictionaryBtn"),

  screenApiSetup: document.getElementById("screenApiSetup"),
  screenModeSelect: document.getElementById("screenModeSelect"),
  screenDocLibrary: document.getElementById("screenDocLibrary"),
  docLibraryList: document.getElementById("docLibraryList"),
  docLibraryBackBtn: document.getElementById("docLibraryBackBtn"),
  modeSelectDocLibraryBtn: document.getElementById("modeSelectDocLibraryBtn"),
  flowRecommendUpload: document.getElementById("flowRecommendUpload"),
  flowRecommendBtn: document.getElementById("flowRecommendBtn"),
  flowRecommendFileInput: document.getElementById("flowRecommendFileInput"),
  flowRecommendStatus: document.getElementById("flowRecommendStatus"),
  flowRecommendError: document.getElementById("flowRecommendError"),
  recommendationPanel: document.getElementById("recommendationPanel"),
  recommendationGenreLabel: document.getElementById("recommendationGenreLabel"),
  recommendationFlowTitle: document.getElementById("recommendationFlowTitle"),
  recommendationReasoning: document.getElementById("recommendationReasoning"),
  recommendationStartBtn: document.getElementById("recommendationStartBtn"),
  recommendationOverrideSelect: document.getElementById("recommendationOverrideSelect"),
  recommendationWhyDetails: document.getElementById("recommendationWhyDetails"),
  recommendationWhyBody: document.getElementById("recommendationWhyBody"),
  recommendationQuickFlow: document.getElementById("recommendationQuickFlow"),
  recommendationProgress: document.getElementById("recommendationProgress"),
  recommendationProgressSteps: document.getElementById("recommendationProgressSteps"),
  screenPlaceholder: document.getElementById("screenPlaceholder"),
  screenPrePackingAssessment: document.getElementById("screenPrePackingAssessment"),
  screenPrePackingResults: document.getElementById("screenPrePackingResults"),
  screenBlocksList: document.getElementById("screenBlocksList"),
  prePackingAssessmentScreen: document.getElementById("screenPrePackingAssessment"),
  prePackingAssessmentSkip: document.getElementById("prePackingAssessmentSkip"),
  prePackingAssessmentProgress: document.getElementById("prePackingAssessmentProgress"),
  prePackingAssessmentQuestion: document.getElementById("prePackingAssessmentQuestion"),
  prePackingAssessmentOptions: document.getElementById("prePackingAssessmentOptions"),
  prePackingAssessmentNext: document.getElementById("prePackingAssessmentNext"),
  prePackingAssessmentGraph: document.getElementById("prePackingAssessmentGraph"),
  prePackingAssessmentStatus: document.getElementById("prePackingAssessmentStatus"),
  prePackingAssessmentError: document.getElementById("prePackingAssessmentError"),
  prePackingResultsScreen: document.getElementById("screenPrePackingResults"),
  prePackingResultsSummary: document.getElementById("prePackingResultsSummary"),
  prePackingResultsDiff: document.getElementById("prePackingResultsDiff"),
  prePackingResultsAccept: document.getElementById("prePackingResultsAccept"),
  prePackingResultsIgnore: document.getElementById("prePackingResultsIgnore"),
  prePackingResultsDetail: document.getElementById("prePackingResultsDetail"),
  prePackingResultsDetailList: document.getElementById("prePackingResultsDetailList"),
  prePackingResultsStatus: document.getElementById("prePackingResultsStatus"),
  screenInitialAssessment: document.getElementById("screenInitialAssessment"),
  screenAssessmentGenerating: document.getElementById("screenAssessmentGenerating"),
  screenSessionReady: document.getElementById("screenSessionReady"),
  screenFullPackGenerating: document.getElementById("screenFullPackGenerating"),
  screenBetweenBlocks: document.getElementById("screenBetweenBlocks"),
  screenSocratic: document.getElementById("screenSocratic"),
  screenTest: document.getElementById("screenTest"),
  assessmentRunnerSkip: document.getElementById("assessmentRunnerSkip"),
  assessmentRunnerSkipSocratic: document.getElementById("assessmentRunnerSkipSocratic"),
  testAssessmentChrome: document.getElementById("testAssessmentChrome"),
  socraticAssessmentChrome: document.getElementById("socraticAssessmentChrome"),
  screenComplete: document.getElementById("screenComplete"),
  screenReviewConfig: document.getElementById("screenReviewConfig"),
  screenReviewGenerating: document.getElementById("screenReviewGenerating"),
  screenReview: document.getElementById("screenReview"),
  screenReviewSummary: document.getElementById("screenReviewSummary"),

  apiKeyForm: document.getElementById("apiKeyForm"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  geminiApiKeyInput: document.getElementById("geminiApiKeyInput"),
  apiKeyStatus: document.getElementById("apiKeyStatus"),
  llmModelSelect: document.getElementById("llmModelSelect"),

  studyProgress: document.getElementById("studyProgress"),
  studyProgressLabel: document.getElementById("studyProgressLabel"),
  studyProgressTitle: document.getElementById("studyProgressTitle"),
  studyProgressFill: document.getElementById("studyProgressFill"),
  saveSessionInlineBtn: document.getElementById("saveSessionInlineBtn"),
  summarySoFarBtn: document.getElementById("summarySoFarBtn"),

  saveSessionBtn: document.getElementById("saveSessionBtn"),
  downloadOfflinePackBtn: document.getElementById("downloadOfflinePackBtn"),
  reviewSessionBtn: document.getElementById("reviewSessionBtn"),

  betweenBlocksDictionaryWrap: document.getElementById(
    "betweenBlocksDictionaryWrap",
  ),
  betweenBlocksDictionaryOpenBtn: document.getElementById(
    "betweenBlocksDictionaryOpenBtn",
  ),
  betweenBlocksDictList: document.getElementById("betweenBlocksDictList"),
  betweenBlocksDictDef: document.getElementById("betweenBlocksDictDef"),

  dictionaryOverlay: document.getElementById("dictionaryOverlay"),
  dictionaryCloseBtn: document.getElementById("dictionaryCloseBtn"),
  dictionaryOverlayList: document.getElementById("dictionaryOverlayList"),
  dictionaryOverlayDef: document.getElementById("dictionaryOverlayDef"),

  summaryOverlay: document.getElementById("summaryOverlay"),
  summaryOverlayTitle: document.getElementById("summaryOverlayTitle"),
  summaryOverlayBody: document.getElementById("summaryOverlayBody"),
  summaryOverlayError: document.getElementById("summaryOverlayError"),
  summaryOverlayCopyBtn: document.getElementById("summaryOverlayCopyBtn"),
  summaryOverlayCloseBtn: document.getElementById("summaryOverlayCloseBtn"),

  reviewFocusInput: document.getElementById("reviewFocusInput"),
  reviewBlocksList: document.getElementById("reviewBlocksList"),
  reviewBlocksSelectAllBtn: document.getElementById("reviewBlocksSelectAllBtn"),
  reviewBlocksDeselectAllBtn: document.getElementById("reviewBlocksDeselectAllBtn"),
  reviewTypeTestBtn: document.getElementById("reviewTypeTestBtn"),
  reviewTypeSocraticBtn: document.getElementById("reviewTypeSocraticBtn"),
  reviewTypeBothBtn: document.getElementById("reviewTypeBothBtn"),
  reviewNQuestionsInput: document.getElementById("reviewNQuestionsInput"),
  reviewStartBtn: document.getElementById("reviewStartBtn"),
  reviewCancelBtn: document.getElementById("reviewCancelBtn"),
  reviewConfigStatus: document.getElementById("reviewConfigStatus"),
  reviewConfigError: document.getElementById("reviewConfigError"),

  reviewGeneratingLabel: document.getElementById("reviewGeneratingLabel"),
  reviewGeneratingFill: document.getElementById("reviewGeneratingFill"),
  reviewGeneratingCancelBtn: document.getElementById("reviewGeneratingCancelBtn"),
  reviewGeneratingError: document.getElementById("reviewGeneratingError"),

  reviewMeta: document.getElementById("reviewMeta"),
  reviewScore: document.getElementById("reviewScore"),
  reviewQuitBtn: document.getElementById("reviewQuitBtn"),
  reviewQuestionText: document.getElementById("reviewQuestionText"),
  reviewTestView: document.getElementById("reviewTestView"),
  reviewTestOptions: document.getElementById("reviewTestOptions"),
  reviewTestFeedback: document.getElementById("reviewTestFeedback"),
  reviewNextBtn: document.getElementById("reviewNextBtn"),
  reviewSocraticView: document.getElementById("reviewSocraticView"),
  reviewSocraticAnswer: document.getElementById("reviewSocraticAnswer"),
  reviewSocraticSendBtn: document.getElementById("reviewSocraticSendBtn"),
  reviewSocraticNextBtn: document.getElementById("reviewSocraticNextBtn"),
  reviewSocraticStatus: document.getElementById("reviewSocraticStatus"),
  reviewSocraticResponseBox: document.getElementById("reviewSocraticResponseBox"),
  reviewError: document.getElementById("reviewError"),

  reviewSummaryMeta: document.getElementById("reviewSummaryMeta"),
  reviewWrongList: document.getElementById("reviewWrongList"),
  reviewSummaryBackBtn: document.getElementById("reviewSummaryBackBtn"),
  reviewSummaryNewBtn: document.getElementById("reviewSummaryNewBtn"),

  generateBlocksForm: document.getElementById("generateBlocksForm"),
  generateBlocksFooter: document.getElementById("generateBlocksFooter"),
  fileInput: document.getElementById("fileInput"),
  fileExtractHint: document.getElementById("fileExtractHint"),
  loadOfflinePackBtn: document.getElementById("loadOfflinePackBtn"),
  offlinePackInput: document.getElementById("offlinePackInput"),
  offlinePackStatus: document.getElementById("offlinePackStatus"),
  offlinePackError: document.getElementById("offlinePackError"),
  resumeMaterialInput: document.getElementById("resumeMaterialInput"),
  resumeMdInput: document.getElementById("resumeMdInput"),
  resumeSessionBtn: document.getElementById("resumeSessionBtn"),
  resumeSessionStatus: document.getElementById("resumeSessionStatus"),
  resumeSessionError: document.getElementById("resumeSessionError"),
  blocksInput: document.getElementById("blocksInput"),
  recommendBlocksBtn: document.getElementById("recommendBlocksBtn"),
  recommendBlocksStatus: document.getElementById("recommendBlocksStatus"),
  recommendBlocksWhy: document.getElementById("recommendBlocksWhy"),
  languageSelect: document.getElementById("languageSelect"),
  studyNotesInput: document.getElementById("studyNotesInput"),
  nTestMinusBtn: document.getElementById("nTestMinusBtn"),
  nTestPlusBtn: document.getElementById("nTestPlusBtn"),
  nTestValue: document.getElementById("nTestValue"),
  nSocraticMinusBtn: document.getElementById("nSocraticMinusBtn"),
  nSocraticPlusBtn: document.getElementById("nSocraticPlusBtn"),
  nSocraticValue: document.getElementById("nSocraticValue"),
  connectionQuestionsToggleBtn: document.getElementById("connectionQuestionsToggleBtn"),
  connectionQuestionsToggleSubtitle: document.getElementById(
    "connectionQuestionsToggleSubtitle",
  ),
  questionsPreviewLabel: document.getElementById("questionsPreviewLabel"),
  generateBlocksBtn: document.getElementById("generateBlocksBtn"),
  generateBlocksStatus: document.getElementById("generateBlocksStatus"),
  generateBlocksError: document.getElementById("generateBlocksError"),
  blocksFilterInput: document.getElementById("blocksFilterInput"),
  blocksExpandAllBtn: document.getElementById("blocksExpandAllBtn"),
  blocksCollapseAllBtn: document.getElementById("blocksCollapseAllBtn"),
  blocksClearFilterBtn: document.getElementById("blocksClearFilterBtn"),
  blocksListEditor: document.getElementById("blocksListEditor"),
  blocksReadonlyBanner: document.getElementById("blocksReadonlyBanner"),
  blocksListOutput: document.getElementById("blocksListOutput"),
  importIndexBtn: document.getElementById("import-index-btn"),
  importIndexLabel: document.getElementById("import-index-label"),
  importIndexFile: document.getElementById("import-index-file"),
  importIndexConfirmBtn: document.getElementById("import-index-btn-confirm"),
  importIndexConfirmLabel: document.getElementById("import-index-label-confirm"),
  confirmBlocksBtn: document.getElementById("confirmBlocksBtn"),
  confirmBlocksStatus: document.getElementById("confirmBlocksStatus"),
  confirmBlocksError: document.getElementById("confirmBlocksError"),

  assessmentChoiceWrap: document.getElementById("assessmentChoiceWrap"),
  assessmentSkipBtn: document.getElementById("assessmentSkipBtn"),
  assessmentTakeBtn: document.getElementById("assessmentTakeBtn"),
  assessmentConfigWrap: document.getElementById("assessmentConfigWrap"),
  assessmentMaxQuestions: document.getElementById("assessmentMaxQuestions"),
  assessmentMaxQuestionsLabel: document.getElementById("assessmentMaxQuestionsLabel"),
  assessmentPenaliseBtn: document.getElementById("assessmentPenaliseBtn"),
  assessmentPenaliseSubtitle: document.getElementById("assessmentPenaliseSubtitle"),
  assessmentStartBtn: document.getElementById("assessmentStartBtn"),
  assessmentGeneratingLabel: document.getElementById("assessmentGeneratingLabel"),
  assessmentGeneratingFill: document.getElementById("assessmentGeneratingFill"),
  assessmentGeneratingError: document.getElementById("assessmentGeneratingError"),

  sessionReadyMeta: document.getElementById("sessionReadyMeta"),
  modeMaterialLoadedBanner: document.getElementById("modeMaterialLoadedBanner"),
  studyFileInputRow: document.getElementById("studyFileInputRow"),
  modeResumePanel: document.getElementById("modeResumePanel"),
  modeResumeHint: document.getElementById("modeResumeHint"),
  rsvpImportDetails: document.getElementById("rsvpImportDetails"),
  rsvpAdvancedDetails: document.getElementById("rsvpAdvancedDetails"),
  createBackToModesBtn: document.getElementById("createBackToModesBtn"),
  createModeLabel: document.getElementById("createModeLabel"),
  continueSessionBtn: document.getElementById("continueSessionBtn"),
  newSessionModeBtn: document.getElementById("newSessionModeBtn"),
  rsvpOnlyControls: document.getElementById("rsvpOnlyControls"),
  rsvpBlocksSection: document.getElementById("rsvpBlocksSection"),
  slowOnlyControls: document.getElementById("slowOnlyControls"),
  criticalModeToggleBtn: document.getElementById("criticalModeToggleBtn"),
  clozeSessionPanel: document.getElementById("clozeSessionPanel"),
  clozePipelineProgress: document.getElementById("clozePipelineProgress"),
  clozeReadySummary: document.getElementById("clozeReadySummary"),
  clozeGenerateBtn: document.getElementById("clozeGenerateBtn"),
  clozeStudyBtn: document.getElementById("clozeStudyBtn"),
  clozeExportBtn: document.getElementById("clozeExportBtn"),
  clozeViewGraphBtn: document.getElementById("clozeViewGraphBtn"),
  clozePipelineError: document.getElementById("clozePipelineError"),
  clozeGraphMount: document.getElementById("clozeGraphMount"),
  clozeImportSection: document.getElementById("clozeImportSection"),
  clozeImportInput: document.getElementById("clozeImportInput"),
  clozeImportBtn: document.getElementById("clozeImportBtn"),
  clozeImportHint: document.getElementById("clozeImportHint"),
  clozeImportStatus: document.getElementById("clozeImportStatus"),
  clozeImportError: document.getElementById("clozeImportError"),
  screenClozeStudy: document.getElementById("screenClozeStudy"),
  clozeStudyContent: document.getElementById("clozeStudyContent"),
  clozeStudyMeta: document.getElementById("clozeStudyMeta"),
  clozeStudyBackBtn: document.getElementById("clozeStudyBackBtn"),

  screenSlowScope: document.getElementById("screenSlowScope"),
  screenSlowPhase0: document.getElementById("screenSlowPhase0"),
  screenSlowReader: document.getElementById("screenSlowReader"),
  screenSlowPhase3: document.getElementById("screenSlowPhase3"),
  screenSlowGraph: document.getElementById("screenSlowGraph"),
  slowScopeList: document.getElementById("slowScopeList"),
  slowScopeHierarchyLoading: document.getElementById("slowScopeHierarchyLoading"),
  slowScopeWarningBanner: document.getElementById("slowScopeWarningBanner"),
  slowScopeEditBtn: document.getElementById("slowScopeEditBtn"),
  slowScopeAutoSplitBtn: document.getElementById("slowScopeAutoSplitBtn"),
  slowScopeCharCount: document.getElementById("slowScopeCharCount"),
  slowScopeLongWarning: document.getElementById("slowScopeLongWarning"),
  slowScopeConfirmBtn: document.getElementById("slowScopeConfirmBtn"),
  slowScopeBackBtn: document.getElementById("slowScopeBackBtn"),
  slowScopeFillableMap: document.getElementById("slowScopeFillableMap"),
  slowScopeFillableHint: document.getElementById("slowScopeFillableHint"),
  slowScopeCheckpoints: document.getElementById("slowScopeCheckpoints"),
  slowScopeCheckpointsHint: document.getElementById("slowScopeCheckpointsHint"),
  slowPhase0Progress: document.getElementById("slowPhase0Progress"),
  slowPhase0CollapseBtn: document.getElementById("slowPhase0CollapseBtn"),
  slowPhase0Content: document.getElementById("slowPhase0Content"),
  slowPhase0Error: document.getElementById("slowPhase0Error"),
  slowPhase0RetryBtn: document.getElementById("slowPhase0RetryBtn"),
  slowPhase0SkipBtn: document.getElementById("slowPhase0SkipBtn"),
  slowPhase0ContinueBtn: document.getElementById("slowPhase0ContinueBtn"),
  slowReaderPage: document.getElementById("slowReaderPage"),
  slowReaderMargin: document.getElementById("slowReaderMargin"),
  slowReaderPrevBtn: document.getElementById("slowReaderPrevBtn"),
  slowReaderNextBtn: document.getElementById("slowReaderNextBtn"),
  slowReaderCompleteBtn: document.getElementById("slowReaderCompleteBtn"),

  startStudyingBtn: document.getElementById("startStudyingBtn"),
  generateFullPackBtn: document.getElementById("generateFullPackBtn"),
  startStudyingStatus: document.getElementById("startStudyingStatus"),
  startStudyingError: document.getElementById("startStudyingError"),
  fullPackProgressLabel: document.getElementById("fullPackProgressLabel"),
  fullPackProgressFill: document.getElementById("fullPackProgressFill"),
  fullPackEtaLabel: document.getElementById("fullPackEtaLabel"),
  fullPackActionLabel: null,
  fullPackPhaseWrap: null,
  fullPackPhase1: null,
  fullPackPhase2: null,
  fullPackPhase3: null,
  fullPackCtaSubtitle: null,
  fullPackWarning: document.getElementById("fullPackWarning"),
  fullPackError: document.getElementById("fullPackError"),
  fullPackCancelBtn: document.getElementById("fullPackCancelBtn"),
  fullPackStudyNowBtn: document.getElementById("fullPackStudyNowBtn"),
  fullPackExitBtn: document.getElementById("fullPackExitBtn"),

  betweenBlocksHeader: document.getElementById("betweenBlocksHeader"),
  betweenBlocksMeta: document.getElementById("betweenBlocksMeta"),
  betweenBlocksInput: document.getElementById("betweenBlocksInput"),
  betweenBlocksSkipBtn: document.getElementById("betweenBlocksSkipBtn"),
  betweenBlocksSendBtn: document.getElementById("betweenBlocksSendBtn"),
  betweenBlocksStatus: document.getElementById("betweenBlocksStatus"),
  betweenBlocksError: document.getElementById("betweenBlocksError"),

  socraticHeader: document.getElementById("socraticHeader"),
  socraticMeta: document.getElementById("socraticMeta"),
  socraticQuestionTitle: document.getElementById("socraticQuestionTitle"),
  socraticQuestionText: document.getElementById("socraticQuestionText"),
  socraticAnswer: document.getElementById("socraticAnswer"),
  socraticSubmitBtn: document.getElementById("socraticSubmitBtn"),
  socraticNextQuestionBtn: document.getElementById("socraticNextQuestionBtn"),
  socraticNextBlockBtn: document.getElementById("socraticNextBlockBtn"),
  socraticStatus: document.getElementById("socraticStatus"),
  socraticResponseBox: document.getElementById("socraticResponseBox"),
  socraticError: document.getElementById("socraticError"),

  rsvpOverlay: document.getElementById("rsvpOverlay"),
  rsvpChunk: document.getElementById("rsvpChunk"),
  rsvpProgress: document.getElementById("rsvpProgress"),
  rsvpProgressTrack: document.getElementById("rsvpProgressTrack"),
  rsvpProgressFill: document.getElementById("rsvpProgressFill"),
  rsvpProgressLabel: document.getElementById("rsvpProgressLabel"),
  rsvpWpm: document.getElementById("rsvpWpm"),
  rsvpWpmLabel: document.getElementById("rsvpWpmLabel"),
  rsvpWpfButtons: Array.from(document.querySelectorAll("[data-wpf]")),
  rsvpComprehensionPause: document.getElementById("rsvpComprehensionPause"),
  rsvpComprehensionEvery: document.getElementById("rsvpComprehensionEvery"),
  rsvpPlayPauseBtn: document.getElementById("rsvpPlayPauseBtn"),
  rsvpSkipBtn: document.getElementById("rsvpSkipBtn"),
  rsvpSwitchToPacedBtn: document.getElementById("rsvpSwitchToPacedBtn"),

  pacedReaderOverlay: document.getElementById("pacedReaderOverlay"),
  pacedReaderPage: document.getElementById("pacedReaderPage"),
  pacedReaderBlockTitle: document.getElementById("pacedReaderBlockTitle"),
  pacedReaderPageIndicator: document.getElementById("pacedReaderPageIndicator"),
  pacedReaderPrevBtn: document.getElementById("pacedReaderPrevBtn"),
  pacedReaderNextBtn: document.getElementById("pacedReaderNextBtn"),
  pacedReaderContinueBtn: document.getElementById("pacedReaderContinueBtn"),
  pacedSwitchToRsvpBtn: document.getElementById("pacedSwitchToRsvpBtn"),
  pacedFontSmallerBtn: document.getElementById("pacedFontSmallerBtn"),
  pacedFontLargerBtn: document.getElementById("pacedFontLargerBtn"),
  pacedFontSizeLabel: document.getElementById("pacedFontSizeLabel"),
  pacedLineSmallerBtn: document.getElementById("pacedLineSmallerBtn"),
  pacedLineLargerBtn: document.getElementById("pacedLineLargerBtn"),
  pacedLineHeightLabel: document.getElementById("pacedLineHeightLabel"),

  testHeader: document.getElementById("testHeader"),
  testMeta: document.getElementById("testMeta"),
  testRsvpView: document.getElementById("testRsvpView"),
  testRsvpWord: document.getElementById("testRsvpWord"),
  testRsvpSkipBtn: document.getElementById("testRsvpSkipBtn"),
  testRsvpStatus: document.getElementById("testRsvpStatus"),
  testQaView: document.getElementById("testQaView"),
  testQuestionText: document.getElementById("testQuestionText"),
  testOptions: document.getElementById("testOptions"),
  testFeedback: document.getElementById("testFeedback"),
  testRestartBlockBtn: document.getElementById("testRestartBlockBtn"),
  testNextBtn: document.getElementById("testNextBtn"),
  testError: document.getElementById("testError"),
};

// #region agent log
fetch('http://127.0.0.1:7501/ingest/6a96a96a-b441-41a6-a2c1-f773e722183c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe9701'},body:JSON.stringify({sessionId:'fe9701',runId:'pre-fix',hypothesisId:'H1',location:'src/js/ui.js:204',message:'DOM refs snapshot',data:{hasLoadOfflinePackBtn:!!els.loadOfflinePackBtn,hasImportIndexBtn:!!els.importIndexBtn,hasImportIndexFile:!!els.importIndexFile,hasImportIndexLabel:!!els.importIndexLabel},timestamp:Date.now()})}).catch(()=>{});
// #endregion

function ensureFullPackCtaSubtitle() {
  if (els.fullPackCtaSubtitle) return els.fullPackCtaSubtitle;
  if (!els.generateFullPackBtn) return null;
  const subtitle = document.createElement("div");
  subtitle.id = "fullPackCtaSubtitle";
  subtitle.className = "hint";
  subtitle.style.marginTop = "6px";
  subtitle.style.fontSize = "12px";
  subtitle.textContent = "Pre-generates all blocks · works without internet after";
  els.generateFullPackBtn.insertAdjacentElement("afterend", subtitle);
  els.fullPackCtaSubtitle = subtitle;
  return subtitle;
}

function ensureFullPackProgressScaffold() {
  if (!els.screenFullPackGenerating) return null;
  if (els.fullPackActionLabel && els.fullPackPhaseWrap) return els;

  const progressHost = els.fullPackProgressLabel?.parentElement || els.screenFullPackGenerating;

  const phaseWrap = document.createElement("div");
  phaseWrap.id = "fullPackPhaseWrap";
  phaseWrap.className = "hint";
  phaseWrap.style.display = "grid";
  phaseWrap.style.gap = "6px";
  phaseWrap.style.marginBottom = "12px";

  const phase1 = document.createElement("div");
  const phase2 = document.createElement("div");
  const phase3 = document.createElement("div");
  phase1.textContent = "Phase 1 of 3: Parsing document";
  phase2.textContent = "Phase 2 of 3: Mapping blocks";
  phase3.textContent = "Phase 3 of 3: Generating content";
  phaseWrap.appendChild(phase1);
  phaseWrap.appendChild(phase2);
  phaseWrap.appendChild(phase3);

  const action = document.createElement("div");
  action.id = "fullPackActionLabel";
  action.className = "hint";
  action.style.marginBottom = "10px";

  progressHost.insertBefore(phaseWrap, els.fullPackProgressLabel || null);
  progressHost.insertBefore(action, els.fullPackProgressLabel || null);

  els.fullPackPhaseWrap = phaseWrap;
  els.fullPackPhase1 = phase1;
  els.fullPackPhase2 = phase2;
  els.fullPackPhase3 = phase3;
  els.fullPackActionLabel = action;
  return els;
}

function paintPhaseRow(el, status) {
  if (!el) return;
  if (status === "active") {
    el.style.color = "#3b82f6";
    el.style.fontWeight = "600";
    return;
  }
  if (status === "done") {
    el.style.color = "#cbd5e1";
    el.style.fontWeight = "500";
    return;
  }
  el.style.color = "#94a3b8";
  el.style.fontWeight = "400";
}

export function setFullPackEntryCta(nBlocks) {
  if (els.generateFullPackBtn) {
    els.generateFullPackBtn.textContent = "Generate offline pack 📦";
  }
  const subtitle = ensureFullPackCtaSubtitle();
  if (subtitle) {
    const n = Math.max(0, Math.floor(Number(nBlocks) || 0));
    subtitle.textContent = `Pre-generates all ${n} blocks · works without internet after`;
  }
}

export function updateFullPackProgressUi({
  pct = 0,
  phase = 1,
  phaseText = "",
  actionText = "",
  etaText = "",
  warning = "",
  error = "",
} = {}) {
  ensureFullPackProgressScaffold();
  if (els.fullPackProgressFill) {
    const safePct = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    els.fullPackProgressFill.style.width = `${safePct}%`;
  }
  if (els.fullPackProgressLabel) {
    els.fullPackProgressLabel.textContent = String(phaseText || "");
  }
  if (els.fullPackActionLabel) {
    els.fullPackActionLabel.textContent = String(actionText || "");
  }
  if (els.fullPackEtaLabel) {
    els.fullPackEtaLabel.textContent = String(etaText || "");
  }
  paintPhaseRow(els.fullPackPhase1, phase === 1 ? "active" : phase > 1 ? "done" : "pending");
  paintPhaseRow(els.fullPackPhase2, phase === 2 ? "active" : phase > 2 ? "done" : "pending");
  paintPhaseRow(els.fullPackPhase3, phase === 3 ? "active" : "pending");

  if (els.fullPackWarning) {
    const t = String(warning || "").trim();
    els.fullPackWarning.hidden = !t;
    els.fullPackWarning.textContent = t;
  }
  if (els.fullPackError) {
    const t = String(error || "").trim();
    els.fullPackError.hidden = !t;
    els.fullPackError.textContent = t;
  }
}

function ensureOfflinePackButton() {
  if (els.downloadOfflinePackBtn) return els.downloadOfflinePackBtn;
  const actionsRow = els.screenComplete?.querySelector(".row");
  if (!actionsRow) return null;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "downloadOfflinePackBtn";
  btn.textContent = "Download offline pack";
  btn.hidden = true;
  if (els.reviewSessionBtn && els.reviewSessionBtn.parentElement === actionsRow) {
    actionsRow.insertBefore(btn, els.reviewSessionBtn);
  } else {
    actionsRow.appendChild(btn);
  }
  els.downloadOfflinePackBtn = btn;
  return btn;
}

ensureOfflinePackButton();

export function setOfflinePackButtonVisibility(isVisible) {
  const btn = ensureOfflinePackButton();
  if (!btn) return;
  btn.hidden = !isVisible;
}

export function enableUnifiedMaterialUpload() {
  if (els.loadOfflinePackBtn) {
    els.loadOfflinePackBtn.hidden = false;
  }
}

function ensureOfflineModeBanner() {
  if (els.offlineModeBanner) return els.offlineModeBanner;
  if (!els.studyProgress) return null;
  const banner = document.createElement("div");
  banner.id = "offlineModeBanner";
  banner.className = "hint";
  banner.textContent = "📦 Offline mode";
  banner.style.marginTop = "6px";
  banner.style.fontSize = "12px";
  banner.hidden = true;
  els.studyProgress.appendChild(banner);
  els.offlineModeBanner = banner;
  return banner;
}

function applyOfflineUiRestrictions() {
  const offline = isOfflineMode();
  const banner = ensureOfflineModeBanner();
  if (banner) banner.hidden = !offline;
  if (els.summarySoFarBtn) {
    els.summarySoFarBtn.hidden = offline;
  }
  if (els.generateFullPackBtn) {
    els.generateFullPackBtn.hidden = offline;
  }
  const llmLabel = document.querySelector('label[for="llmModelSelect"]');
  if (llmLabel) llmLabel.style.display = offline ? "none" : "";
  if (els.llmModelSelect) {
    els.llmModelSelect.hidden = offline;
    els.llmModelSelect.disabled = offline;
    const llmHint = els.llmModelSelect.nextElementSibling;
    if (llmHint?.classList?.contains("hint")) {
      llmHint.style.display = offline ? "none" : "";
    }
  }
  syncFloatingChrome();
}

function ensurePrefetchDot() {
  if (!els.studyProgressLabel) return;
  if (els.studyProgressLabelText && els.prefetchDot) return;

  const label = els.studyProgressLabel;
  const existingText = String(label.textContent || "");
  label.textContent = "";

  const textSpan = document.createElement("span");
  textSpan.id = "studyProgressLabelText";
  textSpan.textContent = existingText;

  const dot = document.createElement("span");
  dot.id = "prefetchDot";
  dot.setAttribute("aria-hidden", "true");
  dot.style.display = "inline-block";
  dot.style.width = "8px";
  dot.style.height = "8px";
  dot.style.borderRadius = "999px";
  dot.style.marginLeft = "8px";
  dot.style.background = "rgba(148, 163, 184, 0.9)"; // idle gray
  dot.style.verticalAlign = "middle";

  // Add keyframes once
  if (!document.getElementById("prefetchDotStyles")) {
    const style = document.createElement("style");
    style.id = "prefetchDotStyles";
    style.textContent =
      "@keyframes prefetchDotPulse { 0%{transform:scale(1);opacity:.65} 50%{transform:scale(1.25);opacity:1} 100%{transform:scale(1);opacity:.65} }";
    document.head.appendChild(style);
  }

  label.appendChild(textSpan);
  label.appendChild(dot);

  els.studyProgressLabelText = textSpan;
  els.prefetchDot = dot;
}

export function setPrefetchIndicator(status) {
  ensurePrefetchDot();
  const dot = els.prefetchDot;
  if (!dot) return;
  const s = String(status || "idle");

  dot.style.animation = "none";
  dot.style.opacity = "1";

  if (s === "generating") {
    dot.style.background = "rgba(59, 130, 246, 0.95)"; // blue
    dot.style.animation = "prefetchDotPulse 1.2s ease-in-out infinite";
    return;
  }
  if (s === "ready") {
    dot.style.background = "rgba(34, 197, 94, 0.95)"; // green
    return;
  }
  if (s === "failed") {
    dot.style.background = "rgba(248, 113, 113, 0.95)"; // red
    return;
  }
  dot.style.background = "rgba(148, 163, 184, 0.9)"; // idle gray
}

/** @returns {Promise<void>} */
export function typesetMath(containerEl) {
  try {
    const mj = window.MathJax;
    if (!mj || typeof mj.typesetPromise !== "function") return Promise.resolve();
    if (!containerEl) return Promise.resolve();
    // MathJax caches typeset state per element. When we reuse containers and
    // replace their contents (common in our quiz UI), re-typesetting without
    // clearing can result in missing/blank output in some cases.
    if (typeof mj.typesetClear === "function") {
      try {
        mj.typesetClear([containerEl]);
      } catch {
        // ignore
      }
    }
    return mj.typesetPromise([containerEl]).catch(() => undefined);
  } catch {
    return Promise.resolve();
  }
}

export function toggleSidebar() {
  if (isOfflineMode()) return;
  const sidebar = document.getElementById("guide-sidebar");
  if (!sidebar) return;
  if (sidebar.classList.contains("disabled")) return;
  sidebar.classList.toggle("collapsed");
}

export function setBlockReadContentProvider(provider) {
  blockReadContentProvider = typeof provider === "function" ? provider : null;
}

export function closeBlockReadSidebar() {
  const sidebar = document.getElementById("block-read-sidebar");
  if (sidebar) sidebar.classList.add("collapsed");
}

export function refreshBlockReadSidebarContent() {
  const body = document.getElementById("block-read-body");
  const titleEl = document.getElementById("block-read-title");
  if (!body || !blockReadContentProvider) return;
  const { title, explanation } = blockReadContentProvider();
  if (titleEl) titleEl.textContent = title ? String(title) : "Block text";
  void renderMarkdown(body, String(explanation || ""));
  void typesetMath(body);
}

export function toggleBlockReadSidebar() {
  const sidebar = document.getElementById("block-read-sidebar");
  if (!sidebar || sidebar.hidden) return;
  const willOpen = sidebar.classList.contains("collapsed");
  sidebar.classList.toggle("collapsed");
  if (willOpen) refreshBlockReadSidebarContent();
}

export function setBlockReadSidebarAvailable(available) {
  blockReadWanted = Boolean(available);
  syncFloatingChrome();
}

export function hideSidebar() {
  guideToggleSuppressed = true;
  const sidebar = document.getElementById("guide-sidebar");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  if (sidebar) {
    sidebar.classList.add("disabled");
    sidebar.style.opacity = "0.5";
  }
  if (toggleBtn) {
    toggleBtn.disabled = true;
    toggleBtn.setAttribute("aria-disabled", "true");
  }
  syncFloatingChrome();
}

export function showSidebar() {
  if (isOfflineMode()) return;
  guideToggleSuppressed = false;
  const sidebar = document.getElementById("guide-sidebar");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  if (sidebar) {
    sidebar.classList.remove("disabled");
    sidebar.style.opacity = "";
  }
  if (toggleBtn) {
    toggleBtn.disabled = false;
    toggleBtn.setAttribute("aria-disabled", "false");
  }
  syncFloatingChrome();
}

export function initLanguageUi() {
  if (!els.languageSelect) return;
  els.languageSelect.innerHTML = "";
  for (const opt of STUDY_LANG_OPTIONS) {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    els.languageSelect.appendChild(o);
  }
  const stored = localStorage.getItem(LS_STUDY_LANG_KEY);
  const initial =
    stored && STUDY_LANG_OPTIONS.some((o) => o.value === stored)
      ? stored
      : "English";
  els.languageSelect.value = initial;
  localStorage.setItem(LS_STUDY_LANG_KEY, initial);
  els.languageSelect.addEventListener("change", () => {
    const v = String(els.languageSelect.value || "").trim();
    const safe = v && STUDY_LANG_OPTIONS.some((o) => o.value === v) ? v : "English";
    localStorage.setItem(LS_STUDY_LANG_KEY, safe);
  });
}

export function getStudyLanguage() {
  const stored = localStorage.getItem(LS_STUDY_LANG_KEY);
  if (stored && STUDY_LANG_OPTIONS.some((o) => o.value === stored)) {
    return stored;
  }
  return "English";
}

export function syncStudyLanguage(lang) {
  const v = String(lang || "").trim();
  const safe = v && STUDY_LANG_OPTIONS.some((o) => o.value === v) ? v : getStudyLanguage();
  localStorage.setItem(LS_STUDY_LANG_KEY, safe);
  if (els.languageSelect) els.languageSelect.value = safe;
  return safe;
}

function resolveModeSelectScreenEl() {
  if (els.screenModeSelect) return els.screenModeSelect;
  const el = document.getElementById("screenModeSelect");
  if (el) els.screenModeSelect = el;
  return el;
}

export function showScreen(which) {
  currentScreenId = which;
  const showSetup = which === "setup";
  const showModeSelect = which === "modeSelect";
  const showDocLibrary = which === "docLibrary";
  const modeSelectEl = showModeSelect ? resolveModeSelectScreenEl() : els.screenModeSelect;
  const showModeSelectScreen = showModeSelect && !!modeSelectEl;
  const showCreate = which === "create" || (showModeSelect && !modeSelectEl);
  const showPrePackingAssessment = which === "prePackingAssessment";
  const showPrePackingResults = which === "prePackingResults";
  const showBlocks = which === "blocks";
  const showAssessment = which === "assessment";
  const showAssessmentGenerating = which === "assessmentGenerating";
  const showReady = which === "ready";
  const showFullPackGenerating = which === "fullPackGenerating";
  const showBetween = which === "between";
  const showSocratic = which === "socratic";
  const showTest = which === "test";
  const showComplete = which === "complete";
  const showReviewConfig = which === "reviewConfig";
  const showReviewGenerating = which === "reviewGenerating";
  const showReview = which === "review";
  const showReviewSummary = which === "reviewSummary";
  const showSlowScope = which === "slowScope";
  const showSlowPhase0 = which === "slowPhase0";
  const showSlowReader = which === "slowReader";
  const showSlowPhase3 = which === "slowPhase3";
  const showSlowGraph = which === "slowGraph";
  const showClozeStudy = which === "clozeStudy";
  const showStudyProgress = showSocratic || showTest || showBetween;

  els.screenApiSetup.setAttribute("aria-hidden", String(!showSetup));
  if (modeSelectEl) modeSelectEl.setAttribute("aria-hidden", String(!showModeSelectScreen));
  els.screenDocLibrary?.setAttribute("aria-hidden", String(!showDocLibrary));
  els.screenPlaceholder.setAttribute("aria-hidden", String(!showCreate));
  els.screenPrePackingAssessment?.setAttribute(
    "aria-hidden",
    String(!showPrePackingAssessment),
  );
  els.screenPrePackingResults?.setAttribute("aria-hidden", String(!showPrePackingResults));
  els.screenBlocksList.setAttribute("aria-hidden", String(!showBlocks));
  els.screenInitialAssessment.setAttribute("aria-hidden", String(!showAssessment));
  els.screenAssessmentGenerating?.setAttribute(
    "aria-hidden",
    String(!showAssessmentGenerating),
  );
  els.screenSessionReady.setAttribute("aria-hidden", String(!showReady));
  els.screenFullPackGenerating.setAttribute("aria-hidden", String(!showFullPackGenerating));
  els.screenBetweenBlocks.setAttribute("aria-hidden", String(!showBetween));
  els.screenSocratic.setAttribute("aria-hidden", String(!showSocratic));
  els.screenTest.setAttribute("aria-hidden", String(!showTest));
  els.screenComplete.setAttribute("aria-hidden", String(!showComplete));
  els.screenReviewConfig.setAttribute("aria-hidden", String(!showReviewConfig));
  els.screenReviewGenerating.setAttribute(
    "aria-hidden",
    String(!showReviewGenerating),
  );
  els.screenReview.setAttribute("aria-hidden", String(!showReview));
  els.screenReviewSummary.setAttribute("aria-hidden", String(!showReviewSummary));
  els.screenSlowScope?.setAttribute("aria-hidden", String(!showSlowScope));
  els.screenSlowPhase0?.setAttribute("aria-hidden", String(!showSlowPhase0));
  els.screenSlowReader?.setAttribute("aria-hidden", String(!showSlowReader));
  els.screenSlowPhase3?.setAttribute("aria-hidden", String(!showSlowPhase3));
  els.screenSlowGraph?.setAttribute("aria-hidden", String(!showSlowGraph));
  els.screenClozeStudy?.setAttribute("aria-hidden", String(!showClozeStudy));

  els.studyProgress.setAttribute("aria-hidden", String(!showStudyProgress));
  document.body.classList.toggle("study-active", showStudyProgress);
  document.body.classList.toggle("slow-reader-active", showSlowReader);
  if (!showTest && !showSocratic) {
    setBlockReadSidebarAvailable(false);
  } else if (showTest && els.testQaView?.hidden) {
    setBlockReadSidebarAvailable(false);
  }
  applyOfflineUiRestrictions();
  syncFloatingChrome();

  if (showSetup) {
    els.apiKeyInput.value = "";
    els.apiKeyStatus.textContent = "";
    if (els.geminiApiKeyInput) {
      const gk = getStoredGeminiKey();
      els.geminiApiKeyInput.value = gk || "";
    }
    setTimeout(() => els.apiKeyInput.focus(), 0);
  }

  if (showModeSelectScreen) {
    setTimeout(() => {
      const firstMode = document.querySelector('input[name="studyMode"]');
      if (firstMode) firstMode.focus();
    }, 0);
  }

  if (showDocLibrary) {
    setTimeout(() => els.docLibraryBackBtn?.focus?.(), 0);
  }

  if (showCreate) {
    setTimeout(() => {
      if (els.fileInput && !els.generateBlocksForm?.hidden) {
        els.fileInput.focus();
      } else if (els.continueSessionBtn && !els.modeResumePanel?.hidden) {
        els.continueSessionBtn.focus();
      }
    }, 0);
  }

  if (showBlocks) {
    // #region agent log
    fetch('http://127.0.0.1:7501/ingest/6a96a96a-b441-41a6-a2c1-f773e722183c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe9701'},body:JSON.stringify({sessionId:'fe9701',runId:'pre-fix',hypothesisId:'H3',location:'src/js/ui.js:598',message:'showScreen blocks',data:{hasImportBtn:!!els.importIndexBtn,importBtnText:els.importIndexBtn?els.importIndexBtn.textContent:'',importBtnHiddenAttr:els.importIndexBtn?els.importIndexBtn.hidden:null,hasImportRow:!!document.querySelector('.import-index-row')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    setTimeout(() => els.blocksListOutput.focus(), 0);
  }

  if (showAssessment) {
    setTimeout(() => els.assessmentSkipBtn?.focus?.(), 0);
  }

  if (showBetween) {
    els.betweenBlocksStatus.textContent = "";
    els.betweenBlocksError.hidden = true;
    els.betweenBlocksError.textContent = "";
    els.betweenBlocksInput.value = "";
    setTimeout(() => els.betweenBlocksInput.focus(), 0);
  }

  if (showTest) {
    els.testRsvpStatus.textContent = "";
    els.testError.hidden = true;
    els.testError.textContent = "";
    els.testFeedback.hidden = true;
    els.testFeedback.textContent = "";
    els.testNextBtn.hidden = true;
    els.testNextBtn.textContent = "";
  }

  const anyVisible = document.querySelector('.screen[aria-hidden="false"]');
  if (!anyVisible) {
    console.warn(`showScreen("${which}"): no visible screen — falling back to setup`);
    els.screenApiSetup.setAttribute("aria-hidden", "false");
  }
}

