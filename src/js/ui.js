import { LS_STUDY_LANG_KEY, STUDY_LANG_OPTIONS } from "./config.js";

export const els = {
  changeKeyLink: document.getElementById("changeKeyLink"),
  newSessionBtn: document.getElementById("newSessionBtn"),
  dictionaryBtn: document.getElementById("dictionaryBtn"),

  screenApiSetup: document.getElementById("screenApiSetup"),
  screenPlaceholder: document.getElementById("screenPlaceholder"),
  screenBlocksList: document.getElementById("screenBlocksList"),
  screenSessionReady: document.getElementById("screenSessionReady"),
  screenBetweenBlocks: document.getElementById("screenBetweenBlocks"),
  screenSocratic: document.getElementById("screenSocratic"),
  screenTest: document.getElementById("screenTest"),
  screenComplete: document.getElementById("screenComplete"),
  screenReviewConfig: document.getElementById("screenReviewConfig"),
  screenReviewGenerating: document.getElementById("screenReviewGenerating"),
  screenReview: document.getElementById("screenReview"),
  screenReviewSummary: document.getElementById("screenReviewSummary"),

  apiKeyForm: document.getElementById("apiKeyForm"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  apiKeyStatus: document.getElementById("apiKeyStatus"),

  studyProgress: document.getElementById("studyProgress"),
  studyProgressLabel: document.getElementById("studyProgressLabel"),
  studyProgressTitle: document.getElementById("studyProgressTitle"),
  studyProgressFill: document.getElementById("studyProgressFill"),
  saveSessionInlineBtn: document.getElementById("saveSessionInlineBtn"),
  summarySoFarBtn: document.getElementById("summarySoFarBtn"),

  saveSessionBtn: document.getElementById("saveSessionBtn"),
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
  fileInput: document.getElementById("fileInput"),
  fileExtractHint: document.getElementById("fileExtractHint"),
  blocksInput: document.getElementById("blocksInput"),
  languageSelect: document.getElementById("languageSelect"),
  studyNotesInput: document.getElementById("studyNotesInput"),
  modeTestBtn: document.getElementById("modeTestBtn"),
  modeSocraticBtn: document.getElementById("modeSocraticBtn"),
  modeHint: document.getElementById("modeHint"),
  generateBlocksBtn: document.getElementById("generateBlocksBtn"),
  generateBlocksStatus: document.getElementById("generateBlocksStatus"),
  generateBlocksError: document.getElementById("generateBlocksError"),
  blocksListOutput: document.getElementById("blocksListOutput"),
  confirmBlocksBtn: document.getElementById("confirmBlocksBtn"),
  confirmBlocksStatus: document.getElementById("confirmBlocksStatus"),
  confirmBlocksError: document.getElementById("confirmBlocksError"),
  sessionReadyMeta: document.getElementById("sessionReadyMeta"),
  startStudyingBtn: document.getElementById("startStudyingBtn"),
  startStudyingStatus: document.getElementById("startStudyingStatus"),
  startStudyingError: document.getElementById("startStudyingError"),

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
  rsvpWpm: document.getElementById("rsvpWpm"),
  rsvpWpmLabel: document.getElementById("rsvpWpmLabel"),
  rsvpWpf1: document.getElementById("rsvpWpf1"),
  rsvpWpf2: document.getElementById("rsvpWpf2"),
  rsvpWpf3: document.getElementById("rsvpWpf3"),
  rsvpPlayPauseBtn: document.getElementById("rsvpPlayPauseBtn"),
  rsvpSkipBtn: document.getElementById("rsvpSkipBtn"),

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

/** @returns {Promise<void>} */
export function typesetMath(containerEl) {
  try {
    const mj = window.MathJax;
    if (!mj || typeof mj.typesetPromise !== "function") return Promise.resolve();
    if (!containerEl) return Promise.resolve();
    return mj.typesetPromise([containerEl]).catch(() => undefined);
  } catch {
    return Promise.resolve();
  }
}

export function toggleSidebar() {
  const sidebar = document.getElementById("guide-sidebar");
  if (!sidebar) return;
  if (sidebar.classList.contains("disabled")) return;
  sidebar.classList.toggle("collapsed");
}

export function hideSidebar() {
  const sidebar = document.getElementById("guide-sidebar");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  if (sidebar) {
    sidebar.classList.add("disabled");
    sidebar.style.opacity = "0.5";
  }
  if (toggleBtn) {
    toggleBtn.disabled = true;
    toggleBtn.setAttribute("aria-disabled", "true");
    toggleBtn.style.opacity = "0.5";
  }
}

export function showSidebar() {
  const sidebar = document.getElementById("guide-sidebar");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  if (sidebar) {
    sidebar.classList.remove("disabled");
    sidebar.style.opacity = "";
  }
  if (toggleBtn) {
    toggleBtn.disabled = false;
    toggleBtn.setAttribute("aria-disabled", "false");
    toggleBtn.style.opacity = "";
  }
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

export function showScreen(which) {
  const showSetup = which === "setup";
  const showCreate = which === "create";
  const showBlocks = which === "blocks";
  const showReady = which === "ready";
  const showBetween = which === "between";
  const showSocratic = which === "socratic";
  const showTest = which === "test";
  const showComplete = which === "complete";
  const showReviewConfig = which === "reviewConfig";
  const showReviewGenerating = which === "reviewGenerating";
  const showReview = which === "review";
  const showReviewSummary = which === "reviewSummary";
  const showStudyProgress = showSocratic || showTest || showBetween;

  els.screenApiSetup.setAttribute("aria-hidden", String(!showSetup));
  els.screenPlaceholder.setAttribute("aria-hidden", String(!showCreate));
  els.screenBlocksList.setAttribute("aria-hidden", String(!showBlocks));
  els.screenSessionReady.setAttribute("aria-hidden", String(!showReady));
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

  els.studyProgress.setAttribute("aria-hidden", String(!showStudyProgress));
  document.body.classList.toggle("study-active", showStudyProgress);

  if (showSetup) {
    els.apiKeyInput.value = "";
    els.apiKeyStatus.textContent = "";
    setTimeout(() => els.apiKeyInput.focus(), 0);
  }

  if (showCreate) {
    setTimeout(() => els.fileInput.focus(), 0);
  }

  if (showBlocks) {
    setTimeout(() => els.blocksListOutput.focus(), 0);
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
}

