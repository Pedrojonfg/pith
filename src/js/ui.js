import { LS_STUDY_LANG_KEY, STUDY_LANG_OPTIONS } from "./config.js?v=20260525_1";
import { getStoredGeminiKey } from "./llm.js?v=20260525_1";
import { isOfflineMode } from "./main.js?v=20260525_1";

export const els = {
  changeKeyLink: document.getElementById("changeKeyLink"),
  newSessionBtn: document.getElementById("newSessionBtn"),
  dictionaryBtn: document.getElementById("dictionaryBtn"),

  screenApiSetup: document.getElementById("screenApiSetup"),
  screenPlaceholder: document.getElementById("screenPlaceholder"),
  screenBlocksList: document.getElementById("screenBlocksList"),
  screenInitialAssessment: document.getElementById("screenInitialAssessment"),
  screenAssessmentGenerating: document.getElementById("screenAssessmentGenerating"),
  screenSessionReady: document.getElementById("screenSessionReady"),
  screenFullPackGenerating: document.getElementById("screenFullPackGenerating"),
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
  // #region agent log
  fetch('http://127.0.0.1:7501/ingest/6a96a96a-b441-41a6-a2c1-f773e722183c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe9701'},body:JSON.stringify({sessionId:'fe9701',runId:'pre-fix',hypothesisId:'H2',location:'src/js/ui.js:352',message:'enableUnifiedMaterialUpload called',data:{beforeHidden:els.loadOfflinePackBtn?els.loadOfflinePackBtn.hidden:null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (els.loadOfflinePackBtn) {
    els.loadOfflinePackBtn.hidden = false;
  }
  // #region agent log
  fetch('http://127.0.0.1:7501/ingest/6a96a96a-b441-41a6-a2c1-f773e722183c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe9701'},body:JSON.stringify({sessionId:'fe9701',runId:'pre-fix',hypothesisId:'H2',location:'src/js/ui.js:357',message:'enableUnifiedMaterialUpload applied',data:{afterHidden:els.loadOfflinePackBtn?els.loadOfflinePackBtn.hidden:null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
  const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
  if (sidebarToggleBtn) {
    sidebarToggleBtn.style.display = offline ? "none" : "";
  }
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
  if (isOfflineMode()) return;
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
  const showStudyProgress = showSocratic || showTest || showBetween;

  els.screenApiSetup.setAttribute("aria-hidden", String(!showSetup));
  els.screenPlaceholder.setAttribute("aria-hidden", String(!showCreate));
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

  els.studyProgress.setAttribute("aria-hidden", String(!showStudyProgress));
  document.body.classList.toggle("study-active", showStudyProgress);
  applyOfflineUiRestrictions();

  if (showSetup) {
    els.apiKeyInput.value = "";
    els.apiKeyStatus.textContent = "";
    if (els.geminiApiKeyInput) {
      const gk = getStoredGeminiKey();
      els.geminiApiKeyInput.value = gk || "";
    }
    setTimeout(() => els.apiKeyInput.focus(), 0);
  }

  if (showCreate) {
    setTimeout(() => els.fileInput.focus(), 0);
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
}

