import { LS_STUDY_LANG_KEY, STUDY_LANG_OPTIONS } from "./config.js?v=20260503_7";

export const els = {
  changeKeyLink: document.getElementById("changeKeyLink"),
  newSessionBtn: document.getElementById("newSessionBtn"),
  dictionaryBtn: document.getElementById("dictionaryBtn"),

  screenApiSetup: document.getElementById("screenApiSetup"),
  screenPlaceholder: document.getElementById("screenPlaceholder"),
  screenBlocksList: document.getElementById("screenBlocksList"),
  screenInitialAssessment: document.getElementById("screenInitialAssessment"),
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
  resumeMaterialInput: document.getElementById("resumeMaterialInput"),
  resumeMdInput: document.getElementById("resumeMdInput"),
  resumeSessionBtn: document.getElementById("resumeSessionBtn"),
  resumeSessionStatus: document.getElementById("resumeSessionStatus"),
  resumeSessionError: document.getElementById("resumeSessionError"),
  blocksInput: document.getElementById("blocksInput"),
  languageSelect: document.getElementById("languageSelect"),
  studyNotesInput: document.getElementById("studyNotesInput"),
  nTestMinusBtn: document.getElementById("nTestMinusBtn"),
  nTestPlusBtn: document.getElementById("nTestPlusBtn"),
  nTestValue: document.getElementById("nTestValue"),
  nSocraticMinusBtn: document.getElementById("nSocraticMinusBtn"),
  nSocraticPlusBtn: document.getElementById("nSocraticPlusBtn"),
  nSocraticValue: document.getElementById("nSocraticValue"),
  questionsPreviewLabel: document.getElementById("questionsPreviewLabel"),
  generateBlocksBtn: document.getElementById("generateBlocksBtn"),
  generateBlocksStatus: document.getElementById("generateBlocksStatus"),
  generateBlocksError: document.getElementById("generateBlocksError"),
  blocksFilterInput: document.getElementById("blocksFilterInput"),
  blocksExpandAllBtn: document.getElementById("blocksExpandAllBtn"),
  blocksCollapseAllBtn: document.getElementById("blocksCollapseAllBtn"),
  blocksClearFilterBtn: document.getElementById("blocksClearFilterBtn"),
  blocksListEditor: document.getElementById("blocksListEditor"),
  blocksListOutput: document.getElementById("blocksListOutput"),
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
  rsvpWpfButtons: Array.from(document.querySelectorAll("[data-wpf]")),
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
  const showAssessment = which === "assessment";
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
  els.screenInitialAssessment.setAttribute("aria-hidden", String(!showAssessment));
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
}

