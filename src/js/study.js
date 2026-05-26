import {
  deepSeekGenerateBlockJson,
  deepSeekSocraticTutor,
  deepSeekSummarySoFar,
  GapSynthesisError,
  generateAssessmentQuestions,
  generateAssessmentSynthesis,
  synthesizeAssessmentGaps,
} from "./api.js?v=20260527_1";
import {
  assertLlmKeyPresent,
  getLlmCallingLabel,
  getSessionLlmModel,
  LLM_MODEL_DEEPSEEK,
  normalizeLlmModel,
} from "./llm.js?v=20260525_1";
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
  syncConceptsFromBlock,
  updateDictionaryButtonVisibility,
} from "./dictionary.js?v=20260526_1";
import { extractSneakPeek } from "./sneakPeek.js?v=20260527_1";
import { MAX_N_TEST } from "./config.js?v=20260527_1";
import { exportOfflinePack, exportSessionMarkdown } from "./export.js?v=20260525_1";
import { triggerCommentReply } from "./guide-chat.js?v=20260525_1";
import {
  clearMarkdownContainer,
  hasMathInHtml,
  renderMarkdown,
  renderMcOptionHtml,
} from "./markdown.js?v=20260525_1";
import { cancelRsvpTimer, finishRsvp, loadRsvpDefaultsFromStorage, persistRsvpDefaults, rsvpState, setRsvpBlockTitle, setRsvpOverlayActive, setRsvpPlayState, setWordsPerFlash, startRsvpForText, wireRsvpHandlers } from "./rsvp.js?v=20260526_2";
import { extractResumePayloadFromMarkdown } from "./resume.js?v=20260525_1";
import { isOfflineMode } from "./main.js?v=20260525_1";
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
  normalizeBlockIndexArray,
  parseImportedIndexText,
  parseOfflinePackMarkdown,
  prefetchState,
  buildBlockConfigKey,
  generateQuestionsOnlyForIndex,
  recordResponse,
  resolveBlockQuestionConfig,
  resolveRegenMode,
  warnBlockGenerationProfileMismatch,
  safeParseJson,
  shouldTriggerCommentReply,
  describeSplitRunMetaForUi,
  storeDefaultQuestionConfig,
  twoPhaseConceptSplit,
  state,
  storeActiveSession,
  triggerPrefetch,
  setOnPrefetchReady,
  getPrefetchedBlock,
  hasGeneratedBlockContent,
  ensureSessionResponseState,
  applyAssessmentResults,
  gapLabelsForBlock,
  generateOfflinePack,
  mergeGapLists,
} from "./session.js?v=20260527_1";
import { els, enableUnifiedMaterialUpload, getStudyLanguage, hideSidebar, setFullPackEntryCta, setOfflinePackButtonVisibility, setPrefetchIndicator, showScreen, showSidebar, typesetMath, updateFullPackProgressUi } from "./ui.js?v=20260525_1";
import { LS_BLOCK_INDEX_KEY, LS_STUDY_NOTES_KEY } from "./config.js?v=20260525_1";

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
    title: `Conceptos hasta ahora (${concepts.length} términos)`,
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

  const nextIndex = finishedIdx + 1;
  const expectedKey = String(o.expectedPrefetchConfigKey || "");
  const isReady =
    prefetchState?.blockIndex === nextIndex &&
    prefetchState?.status === "ready" &&
    String(prefetchState?.configKey || "") === expectedKey;

  const placeholder = "Preparando siguiente bloque…";

  if (!isReady) {
    o.sneakPeekWrap.hidden = false;
    o.sneakPeekText.className = "hint";
    o.sneakPeekText.textContent = placeholder;
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
  title.textContent = "Continuar";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Cerrar";
  closeBtn.addEventListener("click", () => setTransitionOverlayOpen(false));

  header.appendChild(title);
  header.appendChild(closeBtn);

  const divider = document.createElement("div");
  divider.className = "divider";

  const sneakPeekWrap = document.createElement("div");
  sneakPeekWrap.id = "sneakPeekWrap";

  const sneakPeekLabel = document.createElement("div");
  sneakPeekLabel.className = "hint";
  sneakPeekLabel.textContent = "Siguiente bloque";

  const sneakPeekText = document.createElement("div");
  sneakPeekText.className = "hint";
  sneakPeekText.style.lineHeight = "1.5";
  sneakPeekText.style.marginBottom = "10px";
  sneakPeekText.textContent = "Preparando siguiente bloque…";

  sneakPeekWrap.appendChild(sneakPeekLabel);
  sneakPeekWrap.appendChild(sneakPeekText);

  const dictionaryWrap = document.createElement("div");

  const nextQDetails = document.createElement("details");
  nextQDetails.style.marginTop = "8px";
  nextQDetails.open = false;

  const nextQSummary = document.createElement("summary");
  nextQSummary.textContent = "Preguntas del siguiente bloque";
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
  confirmBtn.textContent = "Confirmar";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.textContent = "Volver";
  backBtn.className = "secondary";

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
  continueBtn.textContent = "Siguiente bloque";

  const adjustBtn = document.createElement("button");
  adjustBtn.type = "button";
  adjustBtn.textContent = "Ajustar siguiente bloque";
  adjustBtn.className = "secondary";

  defaultActions.appendChild(continueBtn);
  defaultActions.appendChild(adjustBtn);

  const row = document.createElement("div");
  row.className = "row";

  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.textContent = "Reintentar";
  retryBtn.hidden = true;

  const skipBtn = document.createElement("button");
  skipBtn.type = "button";
  skipBtn.textContent = "Saltar este bloque";
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

  const llmModel = getSessionLlmModel(state.activeSession);
  assertLlmKeyPresent(llmModel);

  const blocksListText = String(state.activeSession?.blocks_list_text || "").trim();
  if (!blocksListText) throw new Error("Missing confirmed blocks list.");

  const blockTitle = getBlockTitleFromList(blockIndex);
  const materialChunk = getBlockChunkFromIndex(blockIndex);
  if (!materialChunk) {
    throw new Error("Missing block chunk for this session. Please regenerate blocks.");
  }

  const cfg = resolveBlockQuestionConfig(blockIndex);
  if ((cfg.n_test || 0) <= 0 && (cfg.n_socratic || 0) <= 0) {
    console.warn(`Block ${blockIndex + 1}: invalid question config (n_test=0 and n_socratic=0).`);
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

  const cleaned =
    obj && typeof obj === "object"
      ? obj
      : { id: blockIndex + 1, title: blockTitle, explanation: "", questions: [] };

  if (cleaned.id == null) cleaned.id = blockIndex + 1;
  if (!cleaned.title) cleaned.title = blockTitle;
  if (!cleaned.explanation) cleaned.explanation = "";
  if (!Array.isArray(cleaned.questions)) cleaned.questions = [];
  cleaned.questions = shuffleTestQuestionsInList(cleaned.questions);
  if (!Array.isArray(cleaned.concepts)) cleaned.concepts = [];
  if (!cleaned._config || typeof cleaned._config !== "object") cleaned._config = {};
  cleaned._config.n_test = cfg.n_test;
  cleaned._config.n_socratic = cfg.n_socratic;
  cleaned._config.explanation_profile = cfg.explanation_profile;
  cleaned._config.gap_focus = cfg.gap_focus;

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
  setRsvpBlockTitle(getBlockTitleSafe(state.activeBlockIndex));
  startRsvpForText(block.explanation || "", onDone);
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

  const chosenBtn = btns.find((b) => b.dataset.letter === chosen);
  if (chosenBtn) {
    chosenBtn.classList.add(chosen === correct ? "is-correct" : "is-wrong");
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
    renderSocraticQuestion();
    return;
  }
  // No questions: skip directly to next block transition
  void finishQuestions(idx);
}

async function finishQuestions(blockIndex) {
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
  o.title.textContent = `Continuar al bloque ${nextIndex + 1} de ${total}`;

  o.finishedBlockIndex = idx;

  const concepts = getSortedSessionConcepts();
  const { newKeys, updatedKeys } = getConceptHighlightsForBlock(idx);
  renderDictionary({
    containerEl: o.dictionaryWrap,
    title: `Conceptos hasta ahora (${concepts.length} términos)`,
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
        keyOf(nextCfg) === keyOf(blockDefaults) ? "Perfil del bloque" : "Personalizado";
    }
  };

  renderNextCfgUi();

  const setStatusPreparing = () => {
    o.statusBarText.textContent = "Preparando siguiente bloque…";
    o.statusBarFill.style.animation = "transitionBarSlide 1.2s ease-in-out infinite";
    o.statusBarFill.style.background = "rgba(148, 163, 184, 0.75)";
    o.statusBarFill.style.transform = "translateX(-120%)";
    o.statusBarFill.style.width = "40%";
  };
  const setStatusReady = () => {
    o.statusBarText.textContent = "Listo ✓";
    o.statusBarText.style.color = "rgba(34, 197, 94, 0.95)";
    o.statusBarFill.style.animation = "none";
    o.statusBarFill.style.width = "100%";
    o.statusBarFill.style.transform = "translateX(0)";
    o.statusBarFill.style.background = "rgba(34, 197, 94, 0.85)";
  };
  const setStatusFailed = () => {
    o.statusBarText.textContent = "Error al preparar el bloque";
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
    o.error.textContent = String(message || "Error al generar el bloque.");
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
    const cleaned =
      data && typeof data === "object"
        ? { ...data }
        : { id: nextIndex + 1, title: getBlockTitleSafe(nextIndex), explanation: "", questions: [] };
    if (!cleaned._config || typeof cleaned._config !== "object") cleaned._config = {};
    cleaned._config.n_test = cfg.n_test;
    cleaned._config.n_socratic = cfg.n_socratic;
    cleaned._config.explanation_profile = cfg.explanation_profile;
    cleaned._config.gap_focus = cfg.gap_focus;
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
    o.statusBarText.textContent = "Regenerando siguiente bloque…";
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
        showRetryControls("Indica al menos una pregunta para el siguiente bloque.");
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
          o.status.textContent = "Regenerando preguntas…";
          data = await generateQuestionsOnlyForIndex(nextIndex, {
            n_test: nextCfg.n_test,
            n_socratic: nextCfg.n_socratic,
            baseBlock,
          });
          updatePrefetchSlot(data, nextCfg);
          setPrefetchIndicator("ready");
          setStatusReady();
        } else {
          o.status.textContent = "Regenerando bloque…";
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
    o.status.textContent = "Reintentando…";
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

export function wireStudyHandlers() {
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

  function setAssessmentUiDefaults() {
    if (els.assessmentChoiceWrap) els.assessmentChoiceWrap.hidden = false;
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

    state.activeSession = loadActiveSession();
    if (!state.activeSession) {
      els.startStudyingError.hidden = false;
      els.startStudyingError.textContent = "No saved session found. Generate blocks first.";
      showScreen("create");
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
    const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
    const prevToggleDisplay = sidebarToggleBtn ? sidebarToggleBtn.style.display : "";
    if (sidebarToggleBtn) sidebarToggleBtn.style.display = "none";
    hideSidebar();
    document.body.classList.add("assessment-active");

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
      if (sidebarToggleBtn) sidebarToggleBtn.style.display = prevToggleDisplay;
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

    const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
    const prevToggleDisplay = sidebarToggleBtn ? sidebarToggleBtn.style.display : "";

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
      if (sidebarToggleBtn) sidebarToggleBtn.style.display = prevToggleDisplay;
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

    hideSidebar();
    if (sidebarToggleBtn) sidebarToggleBtn.style.display = "none";
    document.body.classList.add("assessment-active");
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
    clearOfflinePackError();
    if (els.offlinePackStatus) els.offlinePackStatus.textContent = "";
    if (!els.fileExtractHint) return;
    try {
      els.fileExtractHint.textContent = "";
      const fileList = els.fileInput.files ? Array.from(els.fileInput.files) : [];
      const file = fileList[0];
      if (!file) return;
      els.fileExtractHint.textContent = "Extracting…";
      const rawMaterialText = await readFileAsText(file);
      if (String(rawMaterialText || "").includes("OFFLINE_PACK_V1")) {
        await loadOfflinePack(rawMaterialText, String(file.name || ""));
        return;
      }
      if (window.offlineMode === true) {
        window.offlineMode = false;
        window.offlinePack = null;
        setBlocksReadonlyMode({ enabled: false, bannerText: "" });
      }
      const { cleanedText, wordCount } = await readAndCleanMaterialText(file);
      state.lastRawMaterialText = String(rawMaterialText || "");
      state.lastCleanedMaterialText = cleanedText;
      state.lastCleanedMaterialWordCount = wordCount;
      els.fileExtractHint.textContent = `(~${wordCount} words extracted)`;
    } catch {
      els.fileExtractHint.textContent = "";
    }
  });

  enableUnifiedMaterialUpload();

  els.generateBlocksForm.addEventListener("submit", async (e) => {
    e.preventDefault();
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
    state.originalMaterialText = "";
    state.studyNotes = els.studyNotesInput ? String(els.studyNotesInput.value || "") : "";
    state.lastNBlocks = 0;
    state.lastUploadedFileNames = [];
    state.lastCleanedMaterialText = "";
    state.lastCleanedMaterialWordCount = 0;
    state.lastBlockIndex = null;
    window.indexWasImported = false;
    if (els.importIndexLabel) els.importIndexLabel.textContent = "";
    clearSessionConceptStorage();

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
    els.generateBlocksStatus.textContent = getLlmCallingLabel(llmModel);

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

      const { blockIndex: finalIndex, splitRunMeta } = await twoPhaseConceptSplit(cleanedText, nBlocks, {
        llmModel,
        studyNotes: String(state.studyNotes || ""),
        language: getStudyLanguage(),
        onProgress: (msg) => {
          els.generateBlocksStatus.textContent = msg;
        },
      });

      if (!Array.isArray(finalIndex) || !finalIndex.length) {
        throw new Error(
          "Block split returned no blocks. Please try generating blocks again.",
        );
      }

      state.lastBlockIndex = finalIndex;
      state.lastNBlocks = finalIndex.length;
      window.blockIndex = finalIndex;
      window.indexWasImported = false;

      renderSplitMergeSummary(splitRunMeta);
      renderBlockIndexEditor(finalIndex, { readOnly: false });
      if (els.blocksListOutput) {
        // keep the hidden textarea in a stable, pretty format (debug + fallback)
        els.blocksListOutput.value = formatBlockIndexForConfirmation(finalIndex);
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
        state.activeSession = sessionObj;
        state.activeBlockIndex = 0;
        state.activeQuestionIndex = 0;
        state.nTest = sessionObj.n_test;
        state.nSocratic = 0;
        storeActiveSession(sessionObj);
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
      showScreen("create");
      return;
    }

    if (!window.indexWasImported && !state.originalMaterialText.trim()) {
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
      clearSessionConceptStorage();

      const sessionObj = initActiveSessionFromBlocksList({
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
      // #region agent log
      fetch('http://127.0.0.1:7501/ingest/6a96a96a-b441-41a6-a2c1-f773e722183c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe9701'},body:JSON.stringify({sessionId:'fe9701',runId:'pre-fix',hypothesisId:'H5',location:'src/js/study.js:2816',message:'confirm blocks before storeActiveSession',data:{nBlocks,sessionBlocks:Array.isArray(sessionObj.blocks)?sessionObj.blocks.length:null,stateActiveSessionBefore:!!state.activeSession,indexWasImported:window.indexWasImported===true},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      storeActiveSession(sessionObj);
      state.activeSession = sessionObj;
      // #region agent log
      fetch('http://127.0.0.1:7501/ingest/6a96a96a-b441-41a6-a2c1-f773e722183c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe9701'},body:JSON.stringify({sessionId:'fe9701',runId:'pre-fix',hypothesisId:'H6',location:'src/js/study.js:2820',message:'confirm blocks after storeActiveSession',data:{storedSessionExists:!!loadActiveSession(),stateActiveSessionAfterStore:!!state.activeSession},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      goToInitialAssessment();
    } catch (err) {
      setConfirmError(err?.message ? String(err.message) : String(err));
    } finally {
      setConfirmLoading(false);
      els.confirmBlocksStatus.textContent = "";
    }
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
      showScreen("create");
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
    beginRsvpForCurrentBlock({
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

  syncOfflinePackButtonVisibility();
  updateDictionaryButtonVisibility();
}

