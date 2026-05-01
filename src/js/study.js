import { deepSeekGenerateBlockJson, deepSeekSplitIntoBlocks, deepSeekSocraticTutor, deepSeekSummarySoFar } from "./api.js";
import { commitSessionConceptsForBlock, renderBetweenBlocksDictionary, renderConceptDictionaryInto, setDictionaryOverlayOpen, getSortedSessionConcepts, updateDictionaryButtonVisibility } from "./dictionary.js";
import { exportSessionMarkdown } from "./export.js";
import { cancelRsvpTimer, finishRsvp, loadRsvpDefaultsFromStorage, persistRsvpDefaults, rsvpState, setRsvpOverlayActive, setRsvpPlayState, setWordsPerFlash, startRsvpForText } from "./rsvp.js";
import {
  blocksListTextFromBlockIndex,
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
  recordResponse,
  safeParseJson,
  state,
  storeActiveSession,
  ensureSessionResponseState,
} from "./session.js";
import { els, getStudyLanguage, showScreen, typesetMath } from "./ui.js";

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

function readFileAsText(file) {
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

function cleanMaterialText(rawText) {
  const raw = String(rawText || "");
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(raw);
  if (!looksLikeHtml) {
    const stripped = stripScriptAndStyleBlocks(stripDataUriAttributes(raw));
    return stripped.trim();
  }
  return extractCleanTextFromHtml(raw);
}

async function readAndCleanMaterialText(file) {
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
  els.studyProgressLabel.textContent = `Block ${idx + 1} of ${total}`;
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

function showBetweenBlocksPrompt() {
  const total = Math.max(1, getTotalBlocksSafe());
  const isLastBlock = state.activeBlockIndex >= total - 1;
  if (isLastBlock) {
    showSessionComplete();
    return;
  }
  const nextIndex = state.activeBlockIndex + 1;
  const nextTitle = getBlockTitleSafe(nextIndex);
  els.betweenBlocksHeader.textContent = "Before the next block";
  els.betweenBlocksMeta.textContent = `Next: Block ${nextIndex + 1} of ${total}: ${nextTitle}`;
  try {
    commitSessionConceptsForBlock(state.activeBlockIndex);
  } catch {
    // ignore concept commit errors
  }
  renderBetweenBlocksDictionary({ nextBlockIndex: nextIndex });
  showScreen("between");
}

function setBetweenBlocksError(message) {
  els.betweenBlocksError.hidden = false;
  els.betweenBlocksError.textContent = message;
}
function clearBetweenBlocksError() {
  els.betweenBlocksError.hidden = true;
  els.betweenBlocksError.textContent = "";
}
function setBetweenBlocksLoading(isLoading) {
  els.betweenBlocksSkipBtn.disabled = isLoading;
  els.betweenBlocksSendBtn.disabled = isLoading;
  els.betweenBlocksInput.disabled = isLoading;
  els.betweenBlocksStatus.textContent = isLoading ? "Continuing…" : "";
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
  const prevComment = String(state.activeSession?._pending_comment_for_next_block || "").trim();
  const materialChunk = getBlockChunkFromIndex(blockIndex);
  if (!materialChunk) {
    throw new Error("Missing block chunk for this session. Please regenerate blocks.");
  }

  const obj = await deepSeekGenerateBlockJson({
    apiKey,
    mode,
    blocksListText,
    materialText: materialChunk,
    blockIndex,
    blockTitle,
    previousComment: prevComment,
    language: getStudyLanguage(),
  });

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
  state.activeSession._pending_comment_for_next_block = "";
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
  state.activeQuestionIndex = 0;
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
      showTestQuestions();
      renderTestQuestion();
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
      renderSocraticQuestion();
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
      renderTestQuestion();
      return;
    }
    if (!isLastBlock) {
      showBetweenBlocksPrompt();
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

async function continueToNextBlock({ commentText }) {
  clearBetweenBlocksError();
  try {
    setBetweenBlocksLoading(true);
    const nextIndex = state.activeBlockIndex + 1;
    state.activeSession._pending_comment_for_next_block = String(commentText || "").trim();
    state.activeBlockIndex = nextIndex;
    state.activeQuestionIndex = 0;
    state.activeSession.current_block_index = state.activeBlockIndex;
    storeActiveSession(state.activeSession, { bumpRev: true });
    updateStudyProgressUi();
    if (state.studyMode === "socratic") {
      showScreen("socratic");
      await startSocraticBlock();
    } else if (state.studyMode === "test") {
      showScreen("test");
      await startTestBlock();
    } else {
      throw new Error("Missing study mode.");
    }
  } catch (err) {
    setBetweenBlocksError(err?.message ? String(err.message) : String(err));
  } finally {
    setBetweenBlocksLoading(false);
  }
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
        language: getStudyLanguage(),
      });

      const parsed = safeParseJson(blocksList);
      const normalized = normalizeBlockIndexArray(parsed);
      if (!normalized || normalized.length !== nBlocks) {
        throw new Error(
          "DeepSeek returned an unexpected blocks JSON. Please try generating blocks again.",
        );
      }
      state.lastBlockIndex = normalized;
      els.blocksListOutput.value = formatBlockIndexForConfirmation(normalized);
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

      const edited = safeParseJson(els.blocksListOutput.value || "");
      if (!Array.isArray(edited)) {
        throw new Error(
          "Blocks must be valid JSON (array of {id,title,summary}). Please fix and try again.",
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
    state.activeQuestionIndex = 0;
    updateStudyProgressUi();
    if (state.studyMode === "socratic") {
      showScreen("socratic");
      await startSocraticBlock();
      return;
    }
    if (state.studyMode === "test") {
      showScreen("test");
      await startTestBlock();
      return;
    }
    els.startStudyingError.hidden = false;
    els.startStudyingError.textContent = 'Unsupported "session_mode". Use "test" or "socratic".';
  });

  els.betweenBlocksSkipBtn.addEventListener("click", async () => {
    await continueToNextBlock({ commentText: "" });
  });
  els.betweenBlocksSendBtn.addEventListener("click", async () => {
    const msg = String(els.betweenBlocksInput.value || "").trim();
    await continueToNextBlock({ commentText: msg });
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
    }
    renderSocraticQuestion();
  });

  els.socraticNextBlockBtn.addEventListener("click", () => {
    const blocks = getBlocksSafe();
    if (state.activeBlockIndex < blocks.length - 1) {
      showBetweenBlocksPrompt();
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

  updateDictionaryButtonVisibility();
}

