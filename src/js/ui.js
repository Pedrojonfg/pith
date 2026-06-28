import { isPwaStandalone } from "./pwa-install.js";
import { LS_STUDY_LANG_KEY, STUDY_LANG_OPTIONS } from "./config.js?v=20260625_02";
import {
  getSourceFidelityStrictPreference,
} from "./config/flags.js";
import { renderMarkdown } from "./markdown.js?v=20260625_02";
import { isOfflineMode } from "./offline.js?v=20260625_02";
import {
  isMnemonicButtonVisiblePref,
  setMnemonicButtonVisiblePref,
  syncMnemonicButtonVisibility,
} from "./mnemonic.js?v=20260625_02";

/** @type {null | (() => { title?: string, explanation?: string })} */
let blockReadContentProvider = null;

/** @type {() => string} */
let resolveChromeStudyMode = () => "rsvp";

/** @type {() => boolean} */
let resolveChromeHasConcepts = () => false;

let currentScreenId = "settings";
let settingsReturnScreen = "appHome";

export function getCurrentScreenId() {
  return currentScreenId;
}

/**
 * @param {{ timeLabel?: string, blocksLabel?: string, questionsLabel?: string, correctRatePct?: number | null }} summary
 */
export function updateSessionCompleteSummary(summary = {}) {
  const timeLabel = String(summary.timeLabel ?? "—");
  const blocksLabel = String(summary.blocksLabel ?? "—");
  const questionsLabel = String(summary.questionsLabel ?? "—");
  if (els.sessionCompleteTime) els.sessionCompleteTime.textContent = timeLabel;
  if (els.sessionCompleteBlocks) els.sessionCompleteBlocks.textContent = blocksLabel;
  if (els.sessionCompleteQuestions) els.sessionCompleteQuestions.textContent = questionsLabel;

  const rateEl = els.sessionCompleteCorrect;
  if (!rateEl) return;
  const rate = summary.correctRatePct;
  rateEl.classList.remove("is-good", "is-warn", "is-bad");
  if (rate == null || !Number.isFinite(rate)) {
    rateEl.textContent = "—";
    return;
  }
  const pct = Math.round(rate);
  rateEl.textContent = `${pct}%`;
  if (pct > 70) rateEl.classList.add("is-good");
  else if (pct >= 50) rateEl.classList.add("is-warn");
  else rateEl.classList.add("is-bad");
}
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

/** @returns {'rsvp'|'slow'|'cloze'|'questions'|'recall'} */
function normalizeChromeStudyMode(mode) {
  const m = String(mode || "").trim();
  if (m === "slow") return "slow";
  if (m === "cloze") return "cloze";
  if (m === "questions") return "questions";
  if (m === "recall") return "recall";
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
  "review",
  "reviewGenerating",
  "reviewSummary",
  "clozeStudy",
  "recall",
  "slowReader",
]);

const INSTALL_PWA_SCREENS = new Set(["appHome"]);

export function openSettingsScreen(returnTo = null) {
  settingsReturnScreen = returnTo || currentScreenId || "appHome";
  showScreen("settings");
}

export function closeSettingsScreen() {
  showScreen(settingsReturnScreen || "appHome");
}

export function resolveChromeVisibility(ctx) {
  const studyMode = normalizeChromeStudyMode(ctx.studyMode);
  const isRsvp = studyMode === "rsvp";
  const isGuideStudyMode =
    studyMode === "rsvp" ||
    studyMode === "cloze" ||
    studyMode === "questions" ||
    studyMode === "recall";
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
    (screenId !== "clozeStudy" || studyMode === "cloze") &&
    (screenId !== "recall" || studyMode === "recall");

  const showGuideFab =
    isGuideStudyMode &&
    onGuideStudyScreen &&
    !ctx.offline &&
    !assessmentActive &&
    !guideToggleSuppressed;

  return { showBlockReadFab, showGuideFab };
}

/**
 * @param {{ label: string, onClick?: () => void }[]} segments
 * @returns {HTMLElement}
 */
export function renderBreadcrumb(segments) {
  const nav = document.createElement("nav");
  nav.className = "study-breadcrumb";
  nav.setAttribute("aria-label", "Breadcrumb");

  const list = (Array.isArray(segments) ? segments : []).filter(
    (segment) => segment && String(segment.label || "").trim(),
  );

  list.forEach((segment, index) => {
    if (index > 0) {
      const sep = document.createElement("span");
      sep.className = "study-breadcrumb-sep";
      sep.setAttribute("aria-hidden", "true");
      sep.textContent = "›";
      nav.appendChild(sep);
    }

    const label = String(segment.label).trim();
    const onClick = typeof segment.onClick === "function" ? segment.onClick : null;

    if (onClick) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "study-breadcrumb-link";
      btn.textContent = label;
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        onClick();
      });
      nav.appendChild(btn);
      return;
    }

    const span = document.createElement("span");
    span.className =
      index === list.length - 1 ? "study-breadcrumb-current" : "study-breadcrumb-text";
    if (index === list.length - 1) span.setAttribute("aria-current", "page");
    span.textContent = label;
    nav.appendChild(span);
  });

  return nav;
}

/**
 * @param {import("./session-types.js").ProjectStore} store
 * @param {{ selectedId?: string, onSelect?: (projectId: string) => void }} [options]
 * @returns {HTMLElement}
 */
export function renderProjectPicker(store, { selectedId, onSelect } = {}) {
  const root = document.createElement("div");
  root.className = "project-picker";
  root.setAttribute("role", "listbox");
  root.setAttribute("aria-label", "Project");

  const rows = flattenProjectsForPicker(store);
  const effectiveSelected = selectedId || null;

  const renderRow = (project, depth) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "project-picker-option";
    btn.setAttribute("role", "option");
    btn.dataset.projectId = project.id;
    btn.style.setProperty("--project-picker-indent", `${depth * 14}px`);

    const isSelected = project.id === effectiveSelected;
    btn.classList.toggle("project-picker-option--selected", isSelected);
    btn.setAttribute("aria-selected", isSelected ? "true" : "false");

    if (project.color) {
      const swatch = document.createElement("span");
      swatch.className = "project-picker-swatch";
      swatch.style.backgroundColor = project.color;
      swatch.setAttribute("aria-hidden", "true");
      btn.appendChild(swatch);
    }

    const labelEl = document.createElement("span");
    labelEl.className = "project-picker-label";
    labelEl.textContent = project.name || String(project.id);
    btn.appendChild(labelEl);

    btn.addEventListener("click", () => {
      if (typeof onSelect === "function") onSelect(project.id);
    });
    root.appendChild(btn);
  };

  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "project-picker-empty hint";
    empty.textContent = "No projects yet. Create one from the library.";
    root.appendChild(empty);
    return root;
  }

  for (const { project, depth } of rows) {
    renderRow(project, depth);
  }
  return root;
}

/**
 * @param {import("./session-types.js").ProjectStore | null | undefined} store
 * @returns {{ project: import("./session-types.js").Project, depth: number }[]}
 */
function flattenProjectsForPicker(store) {
  const projects = Array.isArray(store?.projects) ? store.projects : [];
  /** @type {Map<string|null, import("./session-types.js").Project[]>} */
  const byParent = new Map();

  for (const project of projects) {
    if (!project || typeof project.id !== "string") continue;
    const parentKey = project.parentId ?? null;
    if (!byParent.has(parentKey)) byParent.set(parentKey, []);
    byParent.get(parentKey).push(project);
  }

  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }

  /** @type {{ project: import("./session-types.js").Project, depth: number }[]} */
  const rows = [];

  /** @param {string|null} parentId @param {number} depth */
  const walk = (parentId, depth) => {
    const children = byParent.get(parentId) || [];
    for (const project of children) {
      rows.push({ project, depth });
      walk(project.id, depth + 1);
    }
  };

  walk(null, 0);
  return rows;
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

  syncGlobalChromeVisibility();
  syncMnemonicButtonVisibility(currentScreenId);
}

function syncGlobalChromeVisibility() {
  const screenId = String(currentScreenId || "");
  const inSlowReader =
    screenId === "slowReader" || document.body.classList.contains("slow-reader-active");

  if (els.settingsBtn) {
    els.settingsBtn.hidden = inSlowReader;
  }
  const installBtn = document.getElementById("installPwaBtn");
  if (installBtn) {
    if (isPwaStandalone(window)) {
      installBtn.hidden = true;
    } else {
      installBtn.hidden = !INSTALL_PWA_SCREENS.has(screenId);
    }
  }
}

export const els = {
  settingsBtn: document.getElementById("settingsBtn"),
  settingsBackBtn: document.getElementById("settingsBackBtn"),
  knowledgeVaultLink: document.getElementById("knowledgeVaultLink"),
  knowledgeVaultOverlay: document.getElementById("knowledgeVaultOverlay"),
  knowledgeVaultCloseBtn: document.getElementById("knowledgeVaultCloseBtn"),
  knowledgeVaultPanel: document.getElementById("knowledgeVaultPanel"),
  knowledgeVaultPanelBody: document.getElementById("knowledgeVaultPanelBody"),

  screenSettings: document.getElementById("screenSettings"),
  screenAuth: document.getElementById("screenAuth"),
  btnSignInGoogle: document.getElementById("btnSignInGoogle"),
  authStatus: document.getElementById("authStatus"),
  btnSignOut: document.getElementById("btnSignOut"),
  screenAppHome: document.getElementById("screenAppHome"),
  screenVaultBranch: document.getElementById("screenVaultBranch"),
  btnAppHomeVault: document.getElementById("btnAppHomeVault"),
  btnAppHomeSessions: document.getElementById("btnAppHomeSessions"),
  vaultBranchBackBtn: document.getElementById("vaultBranchBackBtn"),
  btnVaultBranchKnowledge: document.getElementById("btnVaultBranchKnowledge"),
  btnVaultBranchConceptGraph: document.getElementById("btnVaultBranchConceptGraph"),
  btnVaultIngestOnly: document.getElementById("btnVaultIngestOnly"),
  ingestOnlyFileInput: document.getElementById("ingestOnlyFileInput"),
  btnVaultBranchReview: document.getElementById("btnVaultBranchReview"),
  vaultKnowledgeFringe: document.getElementById("vaultKnowledgeFringe"),
  vaultOuterFringeList: document.getElementById("vaultOuterFringeList"),
  vaultInnerFringeList: document.getElementById("vaultInnerFringeList"),
  screenModeSelect: document.getElementById("screenModeSelect"),
  modeSelectBackBtn: document.getElementById("modeSelectBackBtn"),
  screenCreateSessionStart: document.getElementById("screenCreateSessionStart"),
  createSessionStartBackBtn: document.getElementById("createSessionStartBackBtn"),
  createSessionStartBreadcrumb: document.getElementById("createSessionStartBreadcrumb"),
  createSessionStartFileInput: document.getElementById("createSessionStartFileInput"),
  createSessionStartFileList: document.getElementById("createSessionStartFileList"),
  createSessionStartAddFileBtn: document.getElementById("createSessionStartAddFileBtn"),
  createSessionStartNameInput: document.getElementById("createSessionStartNameInput"),
  createSessionStartStatus: document.getElementById("createSessionStartStatus"),
  createSessionStartInsight: document.getElementById("createSessionStartInsight"),
  createSessionStartContinueBtn: document.getElementById("createSessionStartContinueBtn"),
  createSessionNoFileBtn: document.getElementById("createSessionNoFileBtn"),
  screenBookSearch: document.getElementById("screenBookSearch"),
  bookSearchBackBtn: document.getElementById("bookSearchBackBtn"),
  bookSearchTitleInput: document.getElementById("bookSearchTitleInput"),
  bookSearchAuthorInput: document.getElementById("bookSearchAuthorInput"),
  bookSearchError: document.getElementById("bookSearchError"),
  bookSearchPanelSearch: document.getElementById("bookSearchPanelSearch"),
  bookSearchPanelConfirm: document.getElementById("bookSearchPanelConfirm"),
  bookSearchPanelLevelC: document.getElementById("bookSearchPanelLevelC"),
  bookSearchLookupBtn: document.getElementById("bookSearchLookupBtn"),
  bookSearchSkipBtn: document.getElementById("bookSearchSkipBtn"),
  bookSearchConfirmBtn: document.getElementById("bookSearchConfirmBtn"),
  bookSearchRetryBtn: document.getElementById("bookSearchRetryBtn"),
  bookSearchLevelCContinueBtn: document.getElementById("bookSearchLevelCContinueBtn"),
  bookSearchLevelCRetryBtn: document.getElementById("bookSearchLevelCRetryBtn"),
  bookSearchCoverImg: document.getElementById("bookSearchCoverImg"),
  bookSearchConfirmTitle: document.getElementById("bookSearchConfirmTitle"),
  bookSearchConfirmAuthor: document.getElementById("bookSearchConfirmAuthor"),
  bookSearchTocBadge: document.getElementById("bookSearchTocBadge"),
  screenInterviewCapture: document.getElementById("screenInterviewCapture"),
  interviewCaptureBackBtn: document.getElementById("interviewCaptureBackBtn"),
  interviewSessionNameInput: document.getElementById("interviewSessionNameInput"),
  interviewTurnMeta: document.getElementById("interviewTurnMeta"),
  interviewQuestionText: document.getElementById("interviewQuestionText"),
  interviewAnswerInput: document.getElementById("interviewAnswerInput"),
  interviewCaptureStatus: document.getElementById("interviewCaptureStatus"),
  interviewCaptureError: document.getElementById("interviewCaptureError"),
  interviewSubmitAnswerBtn: document.getElementById("interviewSubmitAnswerBtn"),
  interviewFinishBtn: document.getElementById("interviewFinishBtn"),
  screenDocLibrary: document.getElementById("screenDocLibrary"),
  docLibraryList: document.getElementById("docLibraryList"),
  docLibraryProjectList: document.getElementById("docLibraryProjectList"),
  docLibraryBreadcrumb: document.getElementById("docLibraryBreadcrumb"),
  docLibraryBackBtn: document.getElementById("docLibraryBackBtn"),
  btnNewProject: document.getElementById("btnNewProject"),
  btnNewSubproject: document.getElementById("btnNewSubproject"),
  btnCreateProjectSession: document.getElementById("btnCreateProjectSession"),
  modeSelectBreadcrumb: document.getElementById("modeSelectBreadcrumb"),
  sessionHubActions: document.getElementById("sessionHubActions"),
  btnUploadToVault: document.getElementById("btnUploadToVault"),
  screenUploadToVaultCandidates: document.getElementById("screenUploadToVaultCandidates"),
  uploadVaultBackBtn: document.getElementById("uploadVaultBackBtn"),
  uploadVaultStatus: document.getElementById("uploadVaultStatus"),
  uploadVaultError: document.getElementById("uploadVaultError"),
  uploadVaultCandidateList: document.getElementById("uploadVaultCandidateList"),
  uploadVaultAutoNotes: document.getElementById("uploadVaultAutoNotes"),
  vaultUploadResumeBanner: document.getElementById("vaultUploadResumeBanner"),
  vaultUploadResumeLabel: document.getElementById("vaultUploadResumeLabel"),
  btnVaultUploadResume: document.getElementById("btnVaultUploadResume"),
  btnUploadVaultCommit: document.getElementById("btnUploadVaultCommit"),
  btnUploadVaultRetry: document.getElementById("btnUploadVaultRetry"),
  reviewConfigBreadcrumb: document.getElementById("reviewConfigBreadcrumb"),
  reviewScopeSelect: document.getElementById("reviewScopeSelect"),
  reviewIncludeSubprojects: document.getElementById("reviewIncludeSubprojects"),
  screenRetrievalHub: document.getElementById("screenRetrievalHub"),
  retrievalHubTitle: document.getElementById("retrievalHubTitle"),
  retrievalHubLead: document.getElementById("retrievalHubLead"),
  retrievalHubVaultSummary: document.getElementById("retrievalHubVaultSummary"),
  retrievalHubOptions: document.getElementById("retrievalHubOptions"),
  retrievalHubBackBtn: document.getElementById("retrievalHubBackBtn"),
  btnVaultReview: document.getElementById("btnVaultReview"),
  vaultReviewBadge: document.getElementById("vaultReviewBadge"),
  btnPracticeRetrieval: document.getElementById("btnPracticeRetrieval"),
  reviewSm2View: document.getElementById("reviewSm2View"),
  reviewSm2Meta: document.getElementById("reviewSm2Meta"),
  reviewSm2EarlyChip: document.getElementById("reviewSm2EarlyChip"),
  reviewSm2SourceBadge: document.getElementById("reviewSm2SourceBadge"),
  reviewSm2Title: document.getElementById("reviewSm2Title"),
  reviewSm2Preview: document.getElementById("reviewSm2Preview"),
  reviewMnemonicHintHost: document.getElementById("reviewMnemonicHintHost"),
  reviewSm2QualityBtns: document.getElementById("reviewSm2QualityBtns"),
  reviewSm2Empty: document.getElementById("reviewSm2Empty"),
  recommendationPanel: document.getElementById("recommendationPanel"),
  recommendationFlowTitle: document.getElementById("recommendationFlowTitle"),
  recommendationReasoning: document.getElementById("recommendationReasoning"),
  recommendationTime: document.getElementById("recommendationTime"),
  recommendationStartBtn: document.getElementById("recommendationStartBtn"),
  modeSelectChooseManualBtn: document.getElementById("modeSelectChooseManualBtn"),
  modeSelectUseRecommendedBtn: document.getElementById("modeSelectUseRecommendedBtn"),
  modeSelectManual: document.getElementById("modeSelectManual"),
  modeSelectContinuity: document.getElementById("modeSelectContinuity"),
  modeSelectPreparationFailed: document.getElementById("modeSelectPreparationFailed"),
  modeSelectRetryPreparationBtn: document.getElementById("modeSelectRetryPreparationBtn"),
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
  screenSessionReady: document.getElementById("screenSessionReady"),
  screenFullPackGenerating: document.getElementById("screenFullPackGenerating"),
  screenSocratic: document.getElementById("screenSocratic"),
  screenTest: document.getElementById("screenTest"),
  assessmentRunnerRetry: document.getElementById("assessmentRunnerRetry"),
  testAssessmentChrome: document.getElementById("testAssessmentChrome"),
  screenComplete: document.getElementById("screenComplete"),
  sessionCompleteTime: document.getElementById("sessionCompleteTime"),
  sessionCompleteBlocks: document.getElementById("sessionCompleteBlocks"),
  sessionCompleteQuestions: document.getElementById("sessionCompleteQuestions"),
  sessionCompleteCorrect: document.getElementById("sessionCompleteCorrect"),
  screenReviewConfig: document.getElementById("screenReviewConfig"),
  screenReviewGenerating: document.getElementById("screenReviewGenerating"),
  screenReview: document.getElementById("screenReview"),
  screenReviewSummary: document.getElementById("screenReviewSummary"),

  screenRecall: document.getElementById("screenRecall"),
  recallBackBtn: document.getElementById("recallBackBtn"),
  recallProgress: document.getElementById("recallProgress"),
  recallTypeBadge: document.getElementById("recallTypeBadge"),
  recallQuestionText: document.getElementById("recallQuestionText"),
  recallAnswer: document.getElementById("recallAnswer"),
  recallSubmitBtn: document.getElementById("recallSubmitBtn"),
  recallNextBtn: document.getElementById("recallNextBtn"),
  recallStatus: document.getElementById("recallStatus"),
  recallFeedbackPanel: document.getElementById("recallFeedbackPanel"),
  recallQualityBadge: document.getElementById("recallQualityBadge"),
  recallCritique: document.getElementById("recallCritique"),
  recallSuggested: document.getElementById("recallSuggested"),
  recallSuggestedText: document.getElementById("recallSuggestedText"),
  recallConceptPeek: document.getElementById("recallConceptPeek"),
  recallConceptPeekList: document.getElementById("recallConceptPeekList"),
  recallError: document.getElementById("recallError"),

  studyProgress: document.getElementById("studyProgress"),
  studyProgressLabel: document.getElementById("studyProgressLabel"),
  studyProgressTitle: document.getElementById("studyProgressTitle"),
  studyProgressFill: document.getElementById("studyProgressFill"),
  summarySoFarBtn: document.getElementById("summarySoFarBtn"),

  downloadOfflinePackBtn: document.getElementById("downloadOfflinePackBtn"),
  reviewSessionBtn: document.getElementById("reviewSessionBtn"),

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
  alreadyKnowMaterial: document.getElementById("alreadyKnowMaterial"),
  offlinePackError: document.getElementById("offlinePackError"),
  blocksInput: document.getElementById("blocksInput"),
  recommendBlocksStatus: document.getElementById("recommendBlocksStatus"),
  recommendBlocksWhy: document.getElementById("recommendBlocksWhy"),
  languageSelect: document.getElementById("languageSelect"),
  studyNotesInput: document.getElementById("studyNotesInput"),
  sourceFidelityStandardRadio: document.getElementById("sourceFidelityStandardRadio"),
  sourceFidelityStrictRadio: document.getElementById("sourceFidelityStrictRadio"),
  sourceFidelityStrictHint: document.getElementById("sourceFidelityStrictHint"),
  generateBlocksBtn: document.getElementById("generateBlocksBtn"),
  generateBlocksStatus: document.getElementById("generateBlocksStatus"),
  generateBlocksError: document.getElementById("generateBlocksError"),
  generateBlocksRetryPreparationBtn: document.getElementById("generateBlocksRetryPreparationBtn"),
  blocksFilterInput: document.getElementById("blocksFilterInput"),
  blocksExpandAllBtn: document.getElementById("blocksExpandAllBtn"),
  blocksCollapseAllBtn: document.getElementById("blocksCollapseAllBtn"),
  blocksClearFilterBtn: document.getElementById("blocksClearFilterBtn"),
  blocksListEditor: document.getElementById("blocksListEditor"),
  blocksReadonlyBanner: document.getElementById("blocksReadonlyBanner"),
  confirmBlocksBtn: document.getElementById("confirmBlocksBtn"),
  confirmBlocksStatus: document.getElementById("confirmBlocksStatus"),
  confirmBlocksError: document.getElementById("confirmBlocksError"),

  sessionReadyMeta: document.getElementById("sessionReadyMeta"),
  studyFileInputRow: document.getElementById("studyFileInputRow"),
  rsvpOfflinePackRow: document.getElementById("rsvpOfflinePackRow"),
  rsvpAssessmentOption: document.getElementById("rsvpAssessmentOption"),
  rsvpRunAssessment: document.getElementById("rsvpRunAssessment"),
  rsvpCommentsGroup: document.getElementById("rsvpCommentsGroup"),
  createBackToModesBtn: document.getElementById("createBackToModesBtn"),
  createModeLabel: document.getElementById("createModeLabel"),
  rsvpBlocksCountGroup: document.getElementById("rsvpBlocksCountGroup"),
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
  slowScopeFileLabel: document.getElementById("slowScopeFileLabel"),
  slowScopeFileSelect: document.getElementById("slowScopeFileSelect"),
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
  rsvpWpmRecommendedMarker: document.getElementById("rsvpWpmRecommendedMarker"),
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
  keyTermsGlossaryBtn: document.getElementById("keyTermsGlossaryBtn"),
  keyTermsGlossaryDialog: document.getElementById("keyTermsGlossaryDialog"),
  keyTermsGlossaryBody: document.getElementById("keyTermsGlossaryBody"),
  keyTermsGlossaryClose: document.getElementById("keyTermsGlossaryClose"),
  blockFidelityBanner: document.getElementById("blockFidelityBanner"),
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

export function showInventoryStatusBanner(message, { id = "inventory-status-banner" } = {}) {
  if (typeof document === "undefined" || !message) return null;
  let banner = document.getElementById(id);
  if (!banner) {
    banner = document.createElement("div");
    banner.id = id;
    banner.setAttribute("role", "status");
    banner.style.position = "fixed";
    banner.style.left = "50%";
    banner.style.top = "12px";
    banner.style.transform = "translateX(-50%)";
    banner.style.zIndex = "3500";
    banner.style.maxWidth = "min(560px, 92vw)";
    banner.style.padding = "10px 36px 10px 12px";
    banner.style.borderRadius = "6px";
    banner.style.border = "1px solid rgba(255,255,255,0.12)";
    banner.style.background = "#1e2430";
    banner.style.color = "#e8edf5";
    banner.style.fontSize = "13px";
    banner.style.lineHeight = "1.45";
    banner.style.boxShadow = "0 4px 20px rgba(0,0,0,0.35)";

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.setAttribute("aria-label", "Dismiss");
    dismiss.textContent = "×";
    dismiss.style.position = "absolute";
    dismiss.style.right = "8px";
    dismiss.style.top = "6px";
    dismiss.style.border = "none";
    dismiss.style.background = "transparent";
    dismiss.style.color = "inherit";
    dismiss.style.fontSize = "18px";
    dismiss.style.cursor = "pointer";
    dismiss.addEventListener("click", () => banner.remove());
    banner.style.position = "fixed";
    banner.appendChild(dismiss);

    const text = document.createElement("span");
    text.className = "inventory-status-banner-text";
    banner.insertBefore(text, dismiss);
    document.body.appendChild(banner);
  }
  const textEl = banner.querySelector(".inventory-status-banner-text");
  if (textEl) textEl.textContent = String(message);
  return banner;
}

function ensureFullPackCtaSubtitle() {
  if (els.fullPackCtaSubtitle) return els.fullPackCtaSubtitle;
  if (!els.generateFullPackBtn) return null;
  const subtitle = document.createElement("div");
  subtitle.id = "fullPackCtaSubtitle";
  subtitle.className = "hint";
  subtitle.style.marginTop = "6px";
  subtitle.style.fontSize = "12px";
  subtitle.textContent = "Pre-generates all blocks — works without internet after without internet after";
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
    els.generateFullPackBtn.textContent = "Generate offline pack";
  }
  const subtitle = ensureFullPackCtaSubtitle();
  if (subtitle) {
    const n = Math.max(0, Math.floor(Number(nBlocks) || 0));
    subtitle.textContent = `Pre-generates all ${n} blocks — works without internet after without internet after`;
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
  // Offline pack load removed from create screen — no-op.
}

function ensureOfflineModeBanner() {
  if (els.offlineModeBanner) return els.offlineModeBanner;
  if (!els.studyProgress) return null;
  const banner = document.createElement("div");
  banner.id = "offlineModeBanner";
  banner.className = "hint";
  banner.textContent = "Offline mode";
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

export function initSourceFidelityStrictUi() {
  if (!els.sourceFidelityStandardRadio || !els.sourceFidelityStrictRadio) return;
  const strictOn = getSourceFidelityStrictPreference();
  syncSourceFidelityStrictUi(strictOn);
}

export function wireSourceFidelityStrictUi(onChange) {
  const handler = typeof onChange === "function" ? onChange : () => {};
  if (!els.sourceFidelityStandardRadio || !els.sourceFidelityStrictRadio) return;
  if (els.sourceFidelityStandardRadio.dataset.fidelityWired === "1") return;
  els.sourceFidelityStandardRadio.dataset.fidelityWired = "1";
  const syncFromRadios = () => {
    const strict = els.sourceFidelityStrictRadio.checked === true;
    syncSourceFidelityStrictUi(strict);
    handler(strict);
  };
  els.sourceFidelityStandardRadio.addEventListener("change", syncFromRadios);
  els.sourceFidelityStrictRadio.addEventListener("change", syncFromRadios);
}

export function initMnemonicSettingsUi() {
  const toggle = document.getElementById("mnemonicBtnVisibleToggle");
  if (!toggle || toggle.dataset.mnemonicSettingsWired === "1") return;
  toggle.dataset.mnemonicSettingsWired = "1";
  toggle.checked = isMnemonicButtonVisiblePref();
  toggle.addEventListener("change", () => {
    setMnemonicButtonVisiblePref(toggle.checked);
    syncMnemonicButtonVisibility(currentScreenId);
  });
}

export function syncSourceFidelityStrictUi(strictOn) {
  const on = strictOn === true;
  if (els.sourceFidelityStandardRadio) els.sourceFidelityStandardRadio.checked = !on;
  if (els.sourceFidelityStrictRadio) els.sourceFidelityStrictRadio.checked = on;
  if (els.sourceFidelityStrictHint) els.sourceFidelityStrictHint.hidden = !on;
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

function setScreenAriaHidden(el, visible) {
  if (!el) return;
  if (!visible && el.contains(document.activeElement)) {
    document.body.focus();
  }
  el.setAttribute("aria-hidden", String(!visible));
}

export function showScreen(which) {
  if (which === "setup") which = "settings";
  currentScreenId = which;
  const showSettings = which === "settings";
  const showAuth = which === "auth";
  const showAppHome = which === "appHome";
  const showVaultBranch = which === "vaultBranch";
  const showUploadToVault = which === "uploadToVaultCandidates";
  const showCreateSessionStart = which === "createSessionStart";
  const showBookSearch = which === "bookSearch";
  const showInterviewCapture = which === "interviewCapture";
  const showModeSelect = which === "modeSelect";
  const showDocLibrary = which === "docLibrary";
  const showRetrievalHub = which === "retrievalHub";
  const modeSelectEl = showModeSelect ? resolveModeSelectScreenEl() : els.screenModeSelect;
  const showModeSelectScreen = showModeSelect && !!modeSelectEl;
  const showCreate = which === "create" || (showModeSelect && !modeSelectEl);
  const showPrePackingAssessment = which === "prePackingAssessment";
  const showPrePackingResults = which === "prePackingResults";
  const showBlocks = which === "blocks";
  const showReady = which === "ready";
  const showFullPackGenerating = which === "fullPackGenerating";
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
  const showRecall = which === "recall";
  const showStudyProgress = showSocratic || showTest;

  setScreenAriaHidden(els.screenSettings, showSettings);
  setScreenAriaHidden(els.screenAuth, showAuth);
  setScreenAriaHidden(els.screenAppHome, showAppHome);
  setScreenAriaHidden(els.screenVaultBranch, showVaultBranch);
  setScreenAriaHidden(els.screenUploadToVaultCandidates, showUploadToVault);
  setScreenAriaHidden(els.screenCreateSessionStart, showCreateSessionStart);
  setScreenAriaHidden(els.screenBookSearch, showBookSearch);
  setScreenAriaHidden(els.screenInterviewCapture, showInterviewCapture);
  setScreenAriaHidden(modeSelectEl, showModeSelectScreen);
  setScreenAriaHidden(els.screenDocLibrary, showDocLibrary);
  setScreenAriaHidden(els.screenRetrievalHub, showRetrievalHub);
  setScreenAriaHidden(els.screenPlaceholder, showCreate);
  setScreenAriaHidden(els.screenPrePackingAssessment, showPrePackingAssessment);
  setScreenAriaHidden(els.screenPrePackingResults, showPrePackingResults);
  setScreenAriaHidden(els.screenBlocksList, showBlocks);
  setScreenAriaHidden(els.screenSessionReady, showReady);
  setScreenAriaHidden(els.screenFullPackGenerating, showFullPackGenerating);
  setScreenAriaHidden(els.screenSocratic, showSocratic);
  setScreenAriaHidden(els.screenTest, showTest);
  setScreenAriaHidden(els.screenComplete, showComplete);
  setScreenAriaHidden(els.screenReviewConfig, showReviewConfig);
  setScreenAriaHidden(els.screenReviewGenerating, showReviewGenerating);
  setScreenAriaHidden(els.screenReview, showReview);
  setScreenAriaHidden(els.screenReviewSummary, showReviewSummary);
  setScreenAriaHidden(els.screenSlowScope, showSlowScope);
  setScreenAriaHidden(els.screenSlowPhase0, showSlowPhase0);
  setScreenAriaHidden(els.screenSlowReader, showSlowReader);
  setScreenAriaHidden(els.screenSlowPhase3, showSlowPhase3);
  setScreenAriaHidden(els.screenSlowGraph, showSlowGraph);
  setScreenAriaHidden(els.screenClozeStudy, showClozeStudy);
  setScreenAriaHidden(els.screenRecall, showRecall);

  setScreenAriaHidden(els.studyProgress, showStudyProgress);
  document.body.classList.toggle("study-active", showStudyProgress);
  document.body.classList.toggle("slow-reader-active", showSlowReader);
  document.body.classList.toggle("recall-active", showRecall);
  if (!showTest && !showSocratic) {
    setBlockReadSidebarAvailable(false);
  } else if (showTest && els.testQaView?.hidden) {
    setBlockReadSidebarAvailable(false);
  }
  applyOfflineUiRestrictions();
  syncFloatingChrome();

  if (showModeSelectScreen) {
    setTimeout(() => {
      const firstMode = document.querySelector('input[name="studyMode"]');
      if (firstMode) firstMode.focus();
    }, 0);
  }

  if (showDocLibrary) {
    setTimeout(() => els.docLibraryBackBtn?.focus?.(), 0);
  }

  if (showCreateSessionStart) {
    setTimeout(() => {
      if (els.createSessionStartFileInput && !els.createSessionStartFileInput.disabled) {
        els.createSessionStartFileInput.focus();
      } else {
        els.createSessionStartNameInput?.focus?.();
      }
    }, 0);
  }

  if (showRetrievalHub) {
    setTimeout(() => {
      const first = els.retrievalHubOptions?.querySelector("[data-retrieval-mode]");
      if (first) first.focus();
      else els.retrievalHubBackBtn?.focus?.();
    }, 0);
  }

  if (showCreate) {
    setTimeout(() => {
      if (els.fileInput && !els.generateBlocksForm?.hidden) {
        els.fileInput.focus();
      }
    }, 0);
  }

  if (showBlocks) {
    setTimeout(() => els.blocksListEditor?.focus?.(), 0);
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

  if (showRecall) {
    setTimeout(() => els.recallAnswer?.focus?.(), 0);
  }

  const anyVisible = document.querySelector('.screen[aria-hidden="false"]');
  if (!anyVisible) {
    console.warn(`showScreen("${which}"): no visible screen — falling back to settings to settings`);
    els.screenSettings?.setAttribute("aria-hidden", "false");
  }
}

