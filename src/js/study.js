import { deepSeekGenerateBlockJson, deepSeekSplitIntoBlocks, deepSeekSocraticTutor, deepSeekSummarySoFar } from "./api.js?v=20260503_7";
import { commitSessionConceptsForBlock, renderDictionary, getSortedSessionConcepts, updateDictionaryButtonVisibility } from "./dictionary.js?v=20260503_7";
import { exportSessionMarkdown } from "./export.js?v=20260503_7";
import { getCommentReply, setPendingComment, triggerCommentReply } from "./guide-chat.js?v=20260503_7";
import { cancelRsvpTimer, finishRsvp, loadRsvpDefaultsFromStorage, persistRsvpDefaults, rsvpState, setRsvpOverlayActive, setRsvpPlayState, setWordsPerFlash, startRsvpForText } from "./rsvp.js?v=20260503_7";
import { extractResumePayloadFromMarkdown } from "./resume.js?v=20260503_7";
import {
  blocksListTextFromBlockIndex,
  buildBlockIndexFromResumePayload,
  buildSessionFromResumePayload,
  formatBlockIndexForConfirmation,
  getBlockChunkFromIndex,
  getBlockTitleFromList,
  getBlockTitleSafe,
  getBlocksSafe,
  getStoredKey,
  getTotalBlocksSafe,
  initActiveSessionFromBlocksList,
  loadActiveSession,
  normalizeBlockIndexArray,
  prefetchState,
  recordResponse,
  safeParseJson,
  splitMaterialIntoBlockChunks,
  state,
  storeActiveSession,
  triggerPrefetch,
  getPrefetchedBlock,
  ensureSessionResponseState,
} from "./session.js?v=20260503_7";
import { els, getStudyLanguage, setPrefetchIndicator, showScreen, typesetMath } from "./ui.js?v=20260503_7";
import { LS_BLOCK_INDEX_KEY, LS_SESSION_CONCEPTS_KEY, LS_STUDY_NOTES_KEY } from "./config.js?v=20260503_7";

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

function renderBlockIndexEditor(blocks) {
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
    titleInput.addEventListener("input", () => {
      titlePreview.textContent = normalizeWhitespace(titleInput.value) || `Block ${id}`;
      syncHiddenBlocksJsonFromEditor();
      applyBlockFilterToEditor();
    });

    const summaryLabel = document.createElement("label");
    summaryLabel.textContent = "Summary";
    const summaryTa = document.createElement("textarea");
    summaryTa.name = "blockSummary";
    summaryTa.rows = 3;
    summaryTa.value = summary;
    summaryTa.addEventListener("input", () => {
      syncHiddenBlocksJsonFromEditor();
      applyBlockFilterToEditor();
    });

    body.appendChild(titleLabel);
    body.appendChild(titleInput);
    body.appendChild(summaryLabel);
    body.appendChild(summaryTa);
    details.appendChild(body);

    els.blocksListEditor.appendChild(details);
  }

  syncHiddenBlocksJsonFromEditor();
  applyBlockFilterToEditor();
  const first = els.blocksListEditor.querySelector('input[name="blockTitle"]');
  if (first) setTimeout(() => first.focus(), 0);
}

function setMode(nextMode) {
  state.sessionMode = nextMode;
  const isTest = state.sessionMode === "test";
  els.modeTestBtn.setAttribute("aria-pressed", String(isTest));
  els.modeSocraticBtn.setAttribute("aria-pressed", String(!isTest));
  els.modeHint.textContent = isTest
    ? "Multiple-choice questions (A/B/C/D)"
    : "Open-ended reasoning questions";
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

function countWords(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return 0;
  return raw.split(" ").filter(Boolean).length;
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
  const raw = await readFileAsText(file);
  const cleanedText = cleanMaterialText(raw);
  return {
    cleanedText,
    wordCount: countWords(cleanedText),
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
  showScreen("complete");
}

let transitionOverlayEls = null;
let lastConsumedPendingGuideReplyTs = null;
const prefetchStartedAtByIndex = new Map();

function setTransitionOverlayOpen(isOpen) {
  const o = getOrCreateTransitionOverlay();
  o.wrap.setAttribute("aria-hidden", String(!isOpen));
  if (isOpen) {
    o.status.textContent = "";
    o.error.hidden = true;
    o.error.textContent = "";
    o.textarea.disabled = false;
    o.continueBtn.disabled = false;
    o.retryBtn.hidden = true;
    o.skipBtn.hidden = true;
    o.textarea.value = "";
    setTimeout(() => o.textarea.focus(), 0);
  }
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

  const dictionaryWrap = document.createElement("div");

  const label = document.createElement("label");
  label.textContent = "Any questions for the guide? (optional)";

  const textarea = document.createElement("textarea");
  textarea.className = "answer-textarea";
  textarea.rows = 4;
  textarea.spellcheck = true;

  const row = document.createElement("div");
  row.className = "row";

  const continueBtn = document.createElement("button");
  continueBtn.type = "button";
  continueBtn.textContent = "Continue";

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

  row.appendChild(continueBtn);
  row.appendChild(retryBtn);
  row.appendChild(skipBtn);
  row.appendChild(status);

  card.appendChild(header);
  card.appendChild(divider);
  card.appendChild(dictionaryWrap);
  card.appendChild(divider.cloneNode(true));
  card.appendChild(label);
  card.appendChild(textarea);
  card.appendChild(row);
  card.appendChild(error);
  card.appendChild(statusBar);
  wrap.appendChild(card);
  document.body.appendChild(wrap);

  transitionOverlayEls = {
    wrap,
    title,
    dictionaryWrap,
    textarea,
    continueBtn,
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

function ensureGuideResponseCardVisible({ replyText } = {}) {
  const text = String(replyText || "").trim();
  if (!text) return;

  const card = document.createElement("div");
  card.className = "response-box";
  card.style.border = "1px solid rgba(99, 102, 241, 0.45)";
  card.style.background = "rgba(99, 102, 241, 0.08)";
  card.style.marginTop = "10px";

  const title = document.createElement("div");
  title.style.fontWeight = "600";
  title.textContent = "Guide response";

  const subtitle = document.createElement("div");
  subtitle.className = "hint";
  subtitle.style.marginTop = "4px";
  subtitle.textContent = "Re: your question from the previous block";

  const body = document.createElement("div");
  body.style.whiteSpace = "pre-wrap";
  body.style.marginTop = "10px";
  body.textContent = text;

  card.appendChild(title);
  card.appendChild(subtitle);
  card.appendChild(body);

  if (els.screenTest?.getAttribute("aria-hidden") === "false" && els.testQaView) {
    els.testQaView.prepend(card);
    return;
  }
  if (els.screenSocratic?.getAttribute("aria-hidden") === "false") {
    const cardEl = els.screenSocratic.querySelector(".card");
    if (cardEl) cardEl.appendChild(card);
  }
}

async function ensureBlockGenerated(blockIndex) {
  const blocks = getBlocksSafe();
  const existing = blocks[blockIndex];
  if (existing && typeof existing === "object") return existing;

  const apiKey = getStoredKey();
  if (!apiKey) throw new Error("Missing API key. Click “Change API key” to set it.");

  const blocksListText = String(state.activeSession?.blocks_list_text || "").trim();
  if (!blocksListText) throw new Error("Missing confirmed blocks list.");

  const mode = String(state.activeSession?.session_mode || "");
  if (mode !== "test" && mode !== "socratic") {
    throw new Error('Unsupported "session_mode". Use "test" or "socratic".');
  }

  const blockTitle = getBlockTitleFromList(blockIndex);
  const materialChunk = getBlockChunkFromIndex(blockIndex);
  if (!materialChunk) {
    throw new Error("Missing block chunk for this session. Please regenerate blocks.");
  }

  const blockRequest = {
    apiKey,
    mode,
    blocksListText,
    materialText: materialChunk,
    blockIndex,
    blockTitle,
    language: getStudyLanguage(),
  };

  let obj = null;
  try {
    obj = await deepSeekGenerateBlockJson(blockRequest);
  } catch (err) {
    const message = err?.message ? String(err.message) : String(err);
    if (!message.includes("valid JSON")) throw err;
    obj = await deepSeekGenerateBlockJson(blockRequest);
  }

  const cleaned =
    obj && typeof obj === "object"
      ? obj
      : { id: blockIndex + 1, title: blockTitle, explanation: "", questions: [] };

  if (cleaned.id == null) cleaned.id = blockIndex + 1;
  if (!cleaned.title) cleaned.title = blockTitle;
  if (!cleaned.explanation) cleaned.explanation = "";
  if (!Array.isArray(cleaned.questions)) cleaned.questions = [];
  if (!Array.isArray(cleaned.concepts)) cleaned.concepts = [];

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
  const qs = Array.isArray(block?.questions) ? block.questions : [];
  return qs.filter((q) => q && typeof q === "object" && q.type === "socratic");
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
  startRsvpForText(block.explanation || "", onDone);
}

async function startTestBlock() {
  clearTestError();
  setTestMeta();
  updateStudyProgressUi();

  els.testFeedback.hidden = true;
  els.testFeedback.textContent = "";
  els.testNextBtn.hidden = true;
  els.testNextBtn.textContent = "";
  els.testOptions.innerHTML = "";
  els.testQuestionText.textContent = "";
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

  beginRsvpForCurrentBlock({
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
  els.socraticResponseBox.textContent = "";
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

  beginRsvpForCurrentBlock({
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
  els.testFeedback.textContent = "";
  els.testNextBtn.hidden = true;
  els.testNextBtn.textContent = "";

  const blocks = getBlocksSafe();
  const block = blocks[state.activeBlockIndex];
  if (!block) {
    setTestError("Missing block.");
    return;
  }

  const qs = getBlockTestQuestions(block);
  const q = qs[state.activeQuestionIndex];
  if (!q || !q.question) {
    setTestError("Missing question.");
    return;
  }

  els.testQuestionText.textContent = String(q.question);
  els.testOptions.innerHTML = "";
  typesetMath(els.testQuestionText);

  const letters = ["A", "B", "C", "D"];
  for (const letter of letters) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.letter = letter;
    const optText = q?.options && q.options[letter] != null ? String(q.options[letter]) : "";
    btn.textContent = `${letter}. ${optText}`;
    btn.addEventListener("click", () => {
      handleTestAnswer({
        chosen: letter,
        correct: String(q.answer || ""),
        feedback: String(q.feedback || ""),
      });
    });
    els.testOptions.appendChild(btn);
  }
  typesetMath(els.testOptions);
}

function handleTestAnswer({ chosen, correct, feedback }) {
  const btns = Array.from(els.testOptions.querySelectorAll("button"));
  for (const b of btns) b.disabled = true;

  const blocks = getBlocksSafe();
  const block = blocks[state.activeBlockIndex];
  const qs = getBlockTestQuestions(block);
  const q = qs[state.activeQuestionIndex];
  const optText = q?.options && q.options[chosen] != null ? String(q.options[chosen]) : "";
  const userAnswer = optText ? `${chosen}. ${optText}` : String(chosen || "");
  recordResponse({
    blockIndex: state.activeBlockIndex,
    questionIndex: state.activeQuestionIndex,
    questionType: "test",
    questionText: q?.question != null ? String(q.question) : "",
    userAnswer,
    feedback: String(feedback || ""),
    correctAnswer: String(correct || ""),
  });

  const chosenBtn = btns.find((b) => b.dataset.letter === chosen);
  if (chosenBtn) {
    chosenBtn.classList.add(chosen === correct ? "is-correct" : "is-wrong");
  }

  els.testFeedback.hidden = false;
  els.testFeedback.textContent = feedback || "";
  typesetMath(els.testFeedback);

  const isLastQuestion = state.activeQuestionIndex >= qs.length - 1;
  const isLastBlock = state.activeBlockIndex >= blocks.length - 1;

  els.testNextBtn.hidden = false;
  els.testNextBtn.textContent = isLastQuestion
    ? isLastBlock
      ? "Finish"
      : "Next block"
    : "Next question";

  els.testNextBtn.onclick = () => {
    if (!isLastQuestion) {
      state.activeQuestionIndex += 1;
      if (state.activeSession && typeof state.activeSession === "object") {
        state.activeSession.active_question_index = state.activeQuestionIndex;
        storeActiveSession(state.activeSession);
      }
      renderTestQuestion();
      return;
    }
    if (!isLastBlock) {
      void finishQuestions(state.activeBlockIndex);
      return;
    }
    showSessionComplete();
  };
}

function renderSocraticQuestion() {
  clearSocraticError();
  els.socraticStatus.textContent = "";
  els.socraticResponseBox.hidden = true;
  els.socraticResponseBox.textContent = "";
  els.socraticAnswer.value = "";
  els.socraticNextQuestionBtn.hidden = true;
  els.socraticNextBlockBtn.hidden = true;

  const blocks = getBlocksSafe();
  const block = blocks[state.activeBlockIndex];
  if (!block) {
    setSocraticError("No blocks found in session.");
    return;
  }

  const socQs = getBlockSocraticQuestions(block);
  const q = socQs[state.activeQuestionIndex];
  if (!q || !q.question) {
    setSocraticError("No Socratic questions found for this block.");
    return;
  }

  const total = Math.max(1, getTotalBlocksSafe());
  const blockTitle = getBlockTitleSafe(state.activeBlockIndex);
  els.socraticHeader.textContent = "Socratic";
  els.socraticMeta.textContent = `Block ${state.activeBlockIndex + 1} of ${total}: ${blockTitle}`;
  els.socraticQuestionTitle.textContent = `Question ${
    state.activeQuestionIndex + 1
  } of ${socQs.length}`;
  els.socraticQuestionText.textContent = String(q.question);
  typesetMath(els.socraticQuestionText);

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
    triggerPrefetch(nextIdx);
  }

  // 2) triggerCommentReply() — fire and forget
  triggerCommentReply();

  // 3) showRSVP(N) — uses already-generated block data (not prefetch)
  state.activeBlockIndex = idx;
  state.activeQuestionIndex = 0;
  if (state.activeSession && typeof state.activeSession === "object") {
    state.activeSession.current_block_index = idx;
    state.activeSession.active_question_index = 0;
    storeActiveSession(state.activeSession, { bumpRev: true });
  }

  updateStudyProgressUi();

  if (state.studyMode === "socratic") {
    showScreen("socratic");
    void startSocraticBlock();
    return;
  }
  if (state.studyMode === "test") {
    showScreen("test");
    void startTestBlock();
  }
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

async function generateBlockDirect(blockIndex, { timeoutMs } = {}) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  const p = import("./api.js?v=20260503_7").then((m) => m.generateBlock(idx));
  const data = await withTimeout(p, timeoutMs, "Block generation timed out");
  if (state.activeSession && typeof state.activeSession === "object") {
    if (!Array.isArray(state.activeSession.blocks)) state.activeSession.blocks = [];
    state.activeSession.blocks[idx] = data;
    storeActiveSession(state.activeSession, { bumpRev: true });
  }
  return data;
}

function finishRSVP(blockIndex) {
  // 1) Show duda response section if a reply exists (and hasn't been consumed)
  const reply = getCommentReply();
  if (reply) {
    const history = Array.isArray(window.guideHistory) ? window.guideHistory : [];
    let replyTs = null;
    for (let i = history.length - 1; i >= 0; i--) {
      const m = history[i];
      if (!m || typeof m !== "object") continue;
      if (String(m.role || "") !== "assistant") continue;
      const meta = m.meta && typeof m.meta === "object" ? m.meta : null;
      if (meta?.fromPendingComment === true) {
        const ts = Number(m.timestamp);
        replyTs = Number.isFinite(ts) ? ts : null;
        break;
      }
    }

    if (replyTs != null && replyTs !== lastConsumedPendingGuideReplyTs) {
      ensureGuideResponseCardVisible({ replyText: reply });
      lastConsumedPendingGuideReplyTs = replyTs; // clear after displaying
    }
  }

  // 2) showQuestions(N)
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

  if (state.studyMode === "test") {
    showScreen("test");
    showTestQuestions();
    renderTestQuestion();
    return;
  }
  if (state.studyMode === "socratic") {
    showScreen("socratic");
    renderSocraticQuestion();
  }
}

async function finishQuestions(blockIndex) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  const total = Math.max(1, getTotalBlocksSafe());
  if (idx >= total - 1) {
    showSessionComplete();
    return;
  }

  // Commit concepts for this block (best-effort)
  try {
    commitSessionConceptsForBlock(idx);
  } catch {
    // ignore
  }

  // 2) Show comment textarea (optional) + continue
  const o = getOrCreateTransitionOverlay();
  const nextIndex = idx + 1;
  o.title.textContent = `Continue to Block ${nextIndex + 1} of ${total}`;

  // 1) Dictionary is the first element, immediately rendered (collapsible if > 10 terms)
  const concepts = getSortedSessionConcepts();
  renderDictionary({
    containerEl: o.dictionaryWrap,
    title: `Concepts so far (${concepts.length} terms)`,
    concepts,
    collapsedByDefault: concepts.length > 10,
  });

  // 3) Start waiting for the prefetched block immediately in the background
  const startedAt = prefetchStartedAtByIndex.get(nextIndex) || Date.now();
  let prefetchedData = null;
  let prefetchedError = null;
  let continueRequested = false;

  const setStatusPreparing = () => {
    o.statusBarText.textContent = "Preparing next block...";
    o.statusBarFill.style.animation = "transitionBarSlide 1.2s ease-in-out infinite";
    o.statusBarFill.style.background = "rgba(148, 163, 184, 0.75)";
    o.statusBarFill.style.transform = "translateX(-120%)";
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
    o.statusBarText.textContent = "Preparing next block failed";
    o.statusBarText.style.color = "rgba(248, 113, 113, 0.95)";
    o.statusBarFill.style.animation = "none";
    o.statusBarFill.style.width = "100%";
    o.statusBarFill.style.transform = "translateX(0)";
    o.statusBarFill.style.background = "rgba(248, 113, 113, 0.6)";
  };

  // Reset status bar text color (it may have been set previously)
  o.statusBarText.style.color = "";

  const alreadyReady =
    prefetchState.blockIndex === nextIndex && prefetchState.status === "ready";
  if (alreadyReady) {
    setStatusReady();
  } else {
    setStatusPreparing();
  }

  let autoRetried = false;

  const showRetryingCard = () => {
    o.error.hidden = false;
    o.error.textContent = "Block generation failed. Retrying...";
  };

  const showRetryControls = (message) => {
    o.error.hidden = false;
    o.error.textContent = String(message || "Block generation failed.");
    o.retryBtn.hidden = false;
    o.skipBtn.hidden = false;
  };

  o.retryBtn.hidden = true;
  o.skipBtn.hidden = true;

  const prefetchedPromise = getPrefetchedBlock(nextIndex)
    .then((data) => {
      prefetchedData = data;
      setPrefetchIndicator("ready");
      setStatusReady();
      return data;
    })
    .catch((err) => {
      prefetchedError = err;
      setPrefetchIndicator("failed");
      setStatusFailed();
      throw err;
    });

  o.continueBtn.onclick = async () => {
    o.error.hidden = true;
    o.error.textContent = "";
    o.status.textContent = "";

    const comment = String(o.textarea.value || "").trim();
    if (comment) setPendingComment(comment);

    if (prefetchedError && !autoRetried) {
      autoRetried = true;
      showRetryingCard();
      try {
        setPrefetchIndicator("generating");
        const data = await generateBlockDirect(nextIndex, { timeoutMs: 30_000 });
        prefetchedData = data;
        prefetchedError = null;
        setPrefetchIndicator("ready");
        setStatusReady();
      } catch (err) {
        prefetchedError = err;
        setPrefetchIndicator("failed");
        setStatusFailed();
        showRetryControls(err?.message ? String(err.message) : String(err));
        return;
      }
    } else if (prefetchedError) {
      showRetryControls(
        prefetchedError?.message ? String(prefetchedError.message) : String(prefetchedError),
      );
      return;
    }

    if (prefetchedData) {
      setTransitionOverlayOpen(false);
      startBlock(nextIndex);
      return;
    }

    // Not ready yet: keep the screen open and auto-continue when ready.
    continueRequested = true;
    const elapsed = Date.now() - startedAt;
    const remainingMs = Math.max(0, 30_000 - elapsed);
    const remainingSec = Math.max(1, Math.round(remainingMs / 1000));
    o.status.textContent = `Finishing up… (~${remainingSec}s)`;
    try {
      const data = await prefetchedPromise;
      if (!continueRequested) return;
      if (state.activeSession && typeof state.activeSession === "object") {
        if (!Array.isArray(state.activeSession.blocks)) state.activeSession.blocks = [];
        state.activeSession.blocks[nextIndex] = data;
        storeActiveSession(state.activeSession, { bumpRev: true });
      }
      o.status.textContent = "";
      setTransitionOverlayOpen(false);
      startBlock(nextIndex);
    } catch (err) {
      prefetchedError = err;
      setPrefetchIndicator("failed");
      setStatusFailed();
      if (!autoRetried) {
        autoRetried = true;
        showRetryingCard();
        try {
          setPrefetchIndicator("generating");
          const data2 = await generateBlockDirect(nextIndex, { timeoutMs: 30_000 });
          prefetchedData = data2;
          prefetchedError = null;
          setPrefetchIndicator("ready");
          setStatusReady();
          o.status.textContent = "";
          setTransitionOverlayOpen(false);
          startBlock(nextIndex);
          return;
        } catch (err2) {
          prefetchedError = err2;
          setPrefetchIndicator("failed");
          setStatusFailed();
          showRetryControls(err2?.message ? String(err2.message) : String(err2));
          o.status.textContent = "";
          return;
        }
      }
      showRetryControls(err?.message ? String(err.message) : String(err));
      o.status.textContent = "";
    }
  };

  o.retryBtn.onclick = async () => {
    o.error.hidden = true;
    o.error.textContent = "";
    o.status.textContent = "Retrying…";
    try {
      setPrefetchIndicator("generating");
      const data = await generateBlockDirect(nextIndex, { timeoutMs: 10_000 });
      prefetchedData = data;
      prefetchedError = null;
      setPrefetchIndicator("ready");
      setStatusReady();
      o.status.textContent = "";
      setTransitionOverlayOpen(false);
      startBlock(nextIndex);
    } catch (err) {
      prefetchedError = err;
      setPrefetchIndicator("failed");
      setStatusFailed();
      showRetryControls(err?.message ? String(err.message) : String(err));
      o.status.textContent = "";
    }
  };

  o.skipBtn.onclick = () => {
    const skipIndex = nextIndex + 1; // skip this block, attempt N+2
    setTransitionOverlayOpen(false);
    startBlock(skipIndex);
  };

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

export function wireStudyHandlers() {
  els.modeTestBtn.addEventListener("click", () => setMode("test"));
  els.modeSocraticBtn.addEventListener("click", () => setMode("socratic"));
  setMode("test");
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
    els.studyNotesInput.addEventListener("input", () => {
      const v = String(els.studyNotesInput.value || "");
      state.studyNotes = v;
      try {
        localStorage.setItem(LS_STUDY_NOTES_KEY, v);
      } catch {
        // ignore
      }
    });
  }

  els.fileInput.addEventListener("change", async () => {
    if (!els.fileExtractHint) return;
    try {
      els.fileExtractHint.textContent = "";
      const fileList = els.fileInput.files ? Array.from(els.fileInput.files) : [];
      const file = fileList[0];
      if (!file) return;
      els.fileExtractHint.textContent = "Extracting…";
      const { cleanedText, wordCount } = await readAndCleanMaterialText(file);
      state.lastCleanedMaterialText = cleanedText;
      state.lastCleanedMaterialWordCount = wordCount;
      els.fileExtractHint.textContent = `(~${wordCount} words extracted)`;
    } catch {
      els.fileExtractHint.textContent = "";
    }
  });

  els.generateBlocksForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearGenerateError();
    els.generateBlocksStatus.textContent = "";
    state.originalMaterialText = "";
    state.studyNotes = els.studyNotesInput ? String(els.studyNotesInput.value || "") : "";
    state.lastNBlocks = 0;
    state.lastUploadedFileNames = [];
    state.lastCleanedMaterialText = "";
    state.lastCleanedMaterialWordCount = 0;
    state.lastBlockIndex = null;

    const apiKey = getStoredKey();
    if (!apiKey) {
      setGenerateError("Missing API key. Click “Change API key” to set it.");
      showScreen("setup");
      return;
    }

    const fileList = els.fileInput.files ? Array.from(els.fileInput.files) : [];
    state.lastUploadedFileNames = fileList.map((f) => String(f?.name || "")).filter(Boolean);
    const file = fileList[0];
    if (!file) {
      setGenerateError("Please choose a file (.pdf, .html, or .txt).");
      return;
    }

    const nBlocks = Number(els.blocksInput.value);
    if (!Number.isFinite(nBlocks) || nBlocks < 5 || nBlocks > 60) {
      setGenerateError("Blocks must be a number between 5 and 60.");
      return;
    }

    setGenerateLoading(true);
    els.generateBlocksStatus.textContent = "Calling DeepSeek…";

    try {
      const { cleanedText, wordCount } = await readAndCleanMaterialText(file);
      state.lastCleanedMaterialText = cleanedText;
      state.lastCleanedMaterialWordCount = wordCount;
      if (els.fileExtractHint) {
        els.fileExtractHint.textContent = `(~${wordCount} words extracted)`;
      }
      if (!cleanedText.trim()) {
        throw new Error("File appears to be empty.");
      }
      state.originalMaterialText = cleanedText;
      state.lastNBlocks = nBlocks;

      const blocksList = await deepSeekSplitIntoBlocks({
        apiKey,
        nBlocks,
        materialText: cleanedText,
        studyNotes: String(state.studyNotes || ""),
        language: getStudyLanguage(),
      });

      const parsed = safeParseJson(blocksList);
      const normalized = normalizeBlockIndexArray(parsed, { requireChunk: false });
      if (!normalized || normalized.length !== nBlocks) {
        throw new Error(
          "DeepSeek returned an unexpected blocks JSON. Please try generating blocks again.",
        );
      }
      const localChunks = splitMaterialIntoBlockChunks(cleanedText, nBlocks);
      state.lastBlockIndex = normalized.map((b, i) => ({
        ...b,
        chunk: String(b.chunk || localChunks[i] || "").trim(),
      }));
      renderBlockIndexEditor(normalized);
      if (els.blocksListOutput) {
        // keep the hidden textarea in a stable, pretty format (debug + fallback)
        els.blocksListOutput.value = formatBlockIndexForConfirmation(normalized);
      }
      showScreen("blocks");
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

    const apiKey = getStoredKey();
    if (!apiKey) {
      setConfirmError("Missing API key. Click “Change API key” to set it.");
      showScreen("setup");
      return;
    }

    const nBlocks = Number(state.lastNBlocks);
    if (!Number.isFinite(nBlocks) || nBlocks <= 0) {
      setConfirmError("Missing blocks count from previous step. Regenerate blocks.");
      showScreen("create");
      return;
    }

    if (!state.originalMaterialText.trim()) {
      setConfirmError(
        "Missing original material from previous step. Please re-upload and regenerate blocks.",
      );
      showScreen("create");
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
        merged.push({
          id,
          title: e.title,
          summary: e.summary,
          chunk: String(b.chunk || ""),
        });
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

      const sessionObj = initActiveSessionFromBlocksList({
        mode: state.sessionMode,
        nBlocks,
        blocksListText: confirmedBlocksListText,
      });
      if (!sessionObj._meta || typeof sessionObj._meta !== "object") {
        sessionObj._meta = {};
      }
      const notes = String(state.studyNotes || "").trim();
      if (notes) {
        sessionObj._meta.study_notes = notes;
      }
      if (Array.isArray(state.lastUploadedFileNames) && state.lastUploadedFileNames.length) {
        sessionObj._meta.source_files = state.lastUploadedFileNames.map((name) => ({
          name: String(name || ""),
        }));
      }
      storeActiveSession(sessionObj);
      els.sessionReadyMeta.textContent = `Session ready. Blocks: ${nBlocks}`;
      showScreen("ready");
    } catch (err) {
      setConfirmError(err?.message ? String(err.message) : String(err));
    } finally {
      setConfirmLoading(false);
      els.confirmBlocksStatus.textContent = "";
    }
  });

  els.startStudyingBtn.addEventListener("click", async () => {
    els.startStudyingError.hidden = true;
    els.startStudyingError.textContent = "";
    els.startStudyingStatus.textContent = "";

    state.activeSession = loadActiveSession();
    if (!state.activeSession) {
      els.startStudyingError.hidden = false;
      els.startStudyingError.textContent = "No saved session found. Generate blocks first.";
      showScreen("create");
      return;
    }
    const mode = String(state.activeSession?.session_mode || "");
    state.studyMode = mode === "test" || mode === "socratic" ? mode : null;
    ensureSessionResponseState();
    state.activeBlockIndex = Math.max(0, Number(state.activeSession?.current_block_index) || 0);
    const savedQ = state.activeSession?.active_question_index;
    state.activeQuestionIndex =
      savedQ != null && Number.isFinite(Number(savedQ))
        ? Math.max(0, Math.floor(Number(savedQ)))
        : 0;
    updateStudyProgressUi();
    if (state.studyMode === "socratic") {
      startBlock(state.activeBlockIndex);
      return;
    }
    if (state.studyMode === "test") {
      startBlock(state.activeBlockIndex);
      return;
    }
    els.startStudyingError.hidden = false;
    els.startStudyingError.textContent = 'Unsupported "session_mode". Use "test" or "socratic".';
  });

  els.socraticSubmitBtn.addEventListener("click", async () => {
    clearSocraticError();
    els.socraticStatus.textContent = "";
    els.socraticResponseBox.hidden = true;
    els.socraticResponseBox.textContent = "";

    const apiKey = getStoredKey();
    if (!apiKey) {
      setSocraticError("Missing API key. Click “Change API key” to set it.");
      showScreen("setup");
      return;
    }

    const blocks = getBlocksSafe();
    const block = blocks[state.activeBlockIndex];
    if (!block) {
      setSocraticError("Missing block.");
      return;
    }

    const socQs = getBlockSocraticQuestions(block);
    const q = socQs[state.activeQuestionIndex];
    if (!q || !q.question) {
      setSocraticError("Missing question.");
      return;
    }

    const answer = String(els.socraticAnswer.value || "").trim();
    if (!answer) {
      setSocraticError("Please write an answer before submitting.");
      return;
    }

    recordResponse({
      blockIndex: state.activeBlockIndex,
      questionIndex: state.activeQuestionIndex,
      questionType: "socratic",
      questionText: String(q.question || ""),
      userAnswer: answer,
      feedback: "",
      correctAnswer: "",
    });

    setSocraticLoading(true);
    els.socraticStatus.textContent = "Calling DeepSeek…";
    try {
      const resp = await deepSeekSocraticTutor({
        apiKey,
        blockTitle: String(block.title || `Block ${state.activeBlockIndex + 1}`),
        question: String(q.question),
        studentAnswer: answer,
      });

      els.socraticResponseBox.hidden = false;
      els.socraticResponseBox.textContent = resp;
      typesetMath(els.socraticResponseBox);

      recordResponse({
        blockIndex: state.activeBlockIndex,
        questionIndex: state.activeQuestionIndex,
        questionType: "socratic",
        questionText: String(q.question || ""),
        userAnswer: answer,
        feedback: resp,
        correctAnswer: "",
      });

      const isLastQuestion = state.activeQuestionIndex >= socQs.length - 1;
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
    const blocks = getBlocksSafe();
    const block = blocks[state.activeBlockIndex];
    if (!block) return;
    const socQs = getBlockSocraticQuestions(block);
    if (state.activeQuestionIndex < socQs.length - 1) {
      state.activeQuestionIndex += 1;
      if (state.activeSession && typeof state.activeSession === "object") {
        state.activeSession.active_question_index = state.activeQuestionIndex;
        storeActiveSession(state.activeSession);
      }
    }
    renderSocraticQuestion();
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
    showTestQuestions();
    renderTestQuestion();
  });

  els.testRestartBlockBtn.addEventListener("click", () => {
    clearTestError();
    els.testFeedback.hidden = true;
    els.testFeedback.textContent = "";
    state.activeQuestionIndex = 0;
    if (state.activeSession && typeof state.activeSession === "object") {
      state.activeSession.active_question_index = 0;
      storeActiveSession(state.activeSession);
    }
    beginRsvpForCurrentBlock({
      onDone: () => {
        showScreen("test");
        updateStudyProgressUi();
        showTestQuestions();
        renderTestQuestion();
      },
    });
  });

  els.dictionaryBtn.addEventListener("click", () => {
    const concepts = getSortedSessionConcepts();
    renderConceptDictionaryInto({
      listEl: els.dictionaryOverlayList,
      defEl: els.dictionaryOverlayDef,
      concepts,
    });
    setDictionaryOverlayOpen(true);
  });
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
      const explanations = state.activeSession?.blocks
        ?.filter((b) => b != null)
        .map((b) => b.explanation);
      const n = Array.isArray(explanations) ? explanations.length : 0;
      if (!n) {
        if (els.summaryOverlayTitle) els.summaryOverlayTitle.textContent = "Summary so far";
        if (els.summaryOverlayBody) els.summaryOverlayBody.textContent = "";
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
      }
      setSummaryOverlayError("");
      setSummaryOverlayOpen(true);

      try {
        const apiKey = getStoredKey();
        if (!apiKey) throw new Error("Missing API key.");

        const language = getStudyLanguage();
        const userPrompt = explanations.join("\n\n");
        const out = await deepSeekSummarySoFar({ apiKey, language, userPrompt });
        if (els.summaryOverlayBody) els.summaryOverlayBody.textContent = out;
        setSummaryOverlayError("");
      } catch (err) {
        if (els.summaryOverlayBody) els.summaryOverlayBody.textContent = "";
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

  els.rsvpPlayPauseBtn.addEventListener("click", () => {
    if (rsvpState.countdownActive) return;
    setRsvpPlayState(!rsvpState.playing);
  });
  els.rsvpSkipBtn.addEventListener("click", () => finishRsvp());
  els.rsvpWpm.addEventListener("input", () => {
    const v = Number(els.rsvpWpm.value);
    rsvpState.wpm = Number.isFinite(v) ? v : 500;
    els.rsvpWpmLabel.textContent = String(rsvpState.wpm);
    if (els.rsvpOverlay.getAttribute("aria-hidden") === "false" && rsvpState.playing) {
      // reschedule via play toggle
      setRsvpPlayState(true);
    }
    persistRsvpDefaults();
  });
  els.rsvpWpf1.addEventListener("click", () => setWordsPerFlash(1));
  els.rsvpWpf2.addEventListener("click", () => setWordsPerFlash(2));
  els.rsvpWpf3.addEventListener("click", () => setWordsPerFlash(3));
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;
    if (els.rsvpOverlay.getAttribute("aria-hidden") !== "false") return;
    e.preventDefault();
    setRsvpPlayState(!rsvpState.playing);
  });

  if (els.resumeSessionBtn) {
    els.resumeSessionBtn.addEventListener("click", async () => {
      clearResumeError();
      if (els.resumeSessionStatus) els.resumeSessionStatus.textContent = "";
      const apiKey = getStoredKey();
      if (!apiKey) {
        setResumeError('Missing API key. Click "Change API key" to set it.');
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
        try {
          localStorage.setItem(LS_SESSION_CONCEPTS_KEY, JSON.stringify(session_concepts || []));
        } catch {
          // ignore
        }
        if (!sessionObj._meta || typeof sessionObj._meta !== "object") sessionObj._meta = {};
        sessionObj._meta.source_files = [{ name: String(origFile.name || "") }];
        storeActiveSession(sessionObj);
        state.activeSession = sessionObj;
        state.sessionMode = sessionObj.session_mode;
        state.studyMode = sessionObj.session_mode;
        state.originalMaterialText = cleanedText;
        state.lastCleanedMaterialText = cleanedText;
        state.lastCleanedMaterialWordCount = wordCount;
        state.lastNBlocks = sessionObj.n_blocks;
        state.lastUploadedFileNames = [String(origFile.name || "")];
        state.lastBlockIndex = blockIdxArr;
        if (pointer.session_complete) {
          state.activeBlockIndex = Math.max(0, sessionObj.n_blocks - 1);
          state.activeQuestionIndex = 0;
          showScreen("complete");
        } else {
          state.activeBlockIndex = pointer.current_block_index;
          state.activeQuestionIndex = pointer.active_question_index;
          showScreen("ready");
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

  updateDictionaryButtonVisibility();
}

