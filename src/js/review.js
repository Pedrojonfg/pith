import { deepSeekGenerateReviewBatch, deepSeekReviewSocraticTutor } from "./api.js?v=20260625_02";
import {
  assertLlmKeyPresent,
  getLlmCallingLabel,
  getSessionLlmModel,
} from "./llm.js?v=20260625_02";
import { normalizeTestQuestion, shuffleTestQuestionOptions } from "./shuffle-options.js";
import { buildMarkdown } from "./export.js?v=20260625_02";
import {
  LS_REVIEW_CONFIG_PREFIX,
  LS_REVIEW_FLASHCARDS_PREFIX,
  LS_REVIEW_SESSION_MD_KEY,
  LS_REVIEW_SESSION_RESULTS_KEY,
} from "./config.js?v=20260625_02";
import { clampInt, getMissedTestQuestions, getTotalBlocksSafe, isQuestionsStudyMode, state } from "./session.js?v=20260625_02";
import {
  clearMarkdownContainer,
  hasMathInHtml,
  renderMarkdown,
  renderMcOptionHtml,
} from "./markdown.js?v=20260625_02";
import { isMcTypingTarget, letterFromMcKey } from "./mc-keyboard.js?v=20260625_02";
import { els, showScreen, typesetMath } from "./ui.js?v=20260625_02";
import { buildReviewQueue, isOnTime, normalizeSmItem, updateSmItem } from "./sm2.js";
import { getPedagogicalFlags } from "./config/flags.js";
import { computeWhyThisExplanation } from "./pedagogy/why-this.js";
import { getSession, getSmItemsDueToday, upsertSmItem } from "./session-store.js";
import {
  filterDueSmItems,
  getReviewableItemsForProject,
} from "./review-project-scope.js";
export { getReviewableItemsForProject } from "./review-project-scope.js";
import { populateReviewScopeSelect } from "./project-library.js";
import { applyVaultReviewObservation } from "./vault/spaced-review.js";
import { applyVaultReviewItemObservation } from "./vault/vault-curation.js";
import { FACET_LABELS } from "./session-types.js";
import {
  buildGlobalReviewQueue,
  onGlobalReviewAnswer,
} from "./concept-registry/global-review.js";
import {
  buildMnemonicHintHtml,
  filterSmItemsByMnemonics,
  resolveSmItemConceptIds,
} from "./mnemonic.js?v=20260625_02";

let reviewType = "both"; // "test" | "socratic" | "both"
/** @type {((e: KeyboardEvent) => void) | null} */
let reviewMcKeydownHandler = null;
let reviewQuestions = [];
let reviewIndex = 0;
let reviewCorrect = 0;
let reviewTestTotal = 0;
let reviewAnswers = [];
let reviewGenCancelToken = { cancelled: false };
let reviewSessionContent = "";

let sm2ReviewDocId = "";
let sm2ReviewQueue = [];
let sm2ReviewIndex = 0;
let sm2ReviewActive = false;

/** @type {{ projectId: string, includeDescendants: boolean }} */
let reviewScope = { projectId: "all", includeDescendants: true };

export function getActiveReviewScope() {
  return { ...reviewScope };
}

export function setReviewScope(scope) {
  reviewScope = {
    projectId: String(scope?.projectId || "all"),
    includeDescendants: scope?.includeDescendants !== false,
  };
}

const SM2_SOURCE_LABELS = {
  rsvp_block: "RSVP block",
  cloze_item: "Cloze",
  slow_flashcard: "Slow flashcard",
  vault_concept: "Vault concept",
  vault_review_item: "Vault review",
  global_concept: "Global concept",
};

function setSm2ReviewDomVisible(active) {
  sm2ReviewActive = active;
  const llmHidden = active;
  if (els.reviewMeta) els.reviewMeta.hidden = llmHidden;
  if (els.reviewScore) els.reviewScore.hidden = llmHidden;
  if (els.reviewQuestionText) els.reviewQuestionText.hidden = llmHidden;
  if (els.reviewTestView) els.reviewTestView.hidden = true;
  if (els.reviewSocraticView) els.reviewSocraticView.hidden = true;
  if (els.reviewSm2View) els.reviewSm2View.hidden = !active;
}

function showSm2ReviewEmptyState(message) {
  setSm2ReviewDomVisible(true);
  if (els.reviewSm2Meta) els.reviewSm2Meta.textContent = "Spaced review";
  if (els.reviewSm2EarlyChip) els.reviewSm2EarlyChip.classList.add("hidden");
  if (els.reviewSm2SourceBadge) els.reviewSm2SourceBadge.textContent = "";
  if (els.reviewSm2Title) els.reviewSm2Title.textContent = "";
  if (els.reviewSm2Preview) els.reviewSm2Preview.textContent = "";
  if (els.reviewSm2QualityBtns) els.reviewSm2QualityBtns.hidden = true;
  if (els.reviewMnemonicHintHost) {
    els.reviewMnemonicHintHost.hidden = true;
    els.reviewMnemonicHintHost.innerHTML = "";
  }
  if (els.reviewSm2Empty) {
    els.reviewSm2Empty.hidden = false;
    els.reviewSm2Empty.textContent =
      message || "No items due for review right now.";
  }
  showScreen("review");
}

async function renderSm2ReviewItem() {
  const item = sm2ReviewQueue[sm2ReviewIndex];
  if (!item) {
    // [debug-enrich]
    console.info('[review.renderSm2ReviewItem] Queue exhausted — showing summary', {
      queueLength: sm2ReviewQueue.length,
      index: sm2ReviewIndex,
    });
    showSm2ReviewSummary();
    return;
  }

  // [debug-enrich]
  console.debug('[review.renderSm2ReviewItem] Rendering item:', {
    index: sm2ReviewIndex,
    queueLength: sm2ReviewQueue.length,
    itemId: item.id ?? null,
    sourceType: item.sourceType ?? item.source ?? null,
    docId: item.docId ?? sm2ReviewDocId ?? null,
    title: item.title ? String(item.title).slice(0, 80) : null,
  });

  setSm2ReviewDomVisible(true);
  if (els.reviewSm2Empty) els.reviewSm2Empty.hidden = true;
  if (els.reviewSm2QualityBtns) els.reviewSm2QualityBtns.hidden = false;

  const now = Date.now();
  const early = !isOnTime(item, now);
  const originDocId = String(sm2ReviewDocId || item.docId || "").trim();
  const originSession = originDocId ? await getSession(originDocId) : null;
  if (originDocId && !originSession) {
    // [debug-enrich]
    console.warn('[review.renderSm2ReviewItem] Origin session missing:', { originDocId });
  }

  if (els.reviewSm2Meta) {
    const why = computeWhyThisExplanation({
      item,
      beliefState: originSession?.shared?.knowledgeBeliefState,
      assessmentSignals: originSession?.shared?.assessmentSignals,
      now,
    });
    els.reviewSm2Meta.textContent = `Item ${sm2ReviewIndex + 1} of ${sm2ReviewQueue.length} — ${why}`;
  }
  if (els.reviewSm2EarlyChip) {
    els.reviewSm2EarlyChip.classList.toggle("hidden", !early);
  }
  if (els.reviewSm2SourceBadge) {
    const facet = String(item.facet || "").trim();
    const facetLabel = facet ? FACET_LABELS[facet] || facet : "";
    const sourceLabel = SM2_SOURCE_LABELS[item.sourceType] || item.sourceType;
    let badge = facetLabel ? `${sourceLabel} — ${facetLabel}` : sourceLabel;
    const conceptIds = resolveSmItemConceptIds(item, originSession);
    const pending = conceptIds.some((cid) => {
      const c = originSession?.shared?.conceptInventory?.find(
        (e) => String(e?.canonicalId || e?.id || "") === cid,
      );
      return c && c.questionClass !== "factual" && c.comprehensionConfirmed !== true;
    });
    if (pending) badge += " — needs deeper understanding first";
    els.reviewSm2SourceBadge.textContent = badge;
  }
  if (els.reviewSm2Title) els.reviewSm2Title.textContent = String(item.title || "Review item");
  if (els.reviewSm2Preview) {
    const preview = String(item.contentPreview || "");
    if (!sm2ReviewDocId && item.docId) {
      const docTitle = originSession?.shared?.docMeta?.titleInferred || item.docId;
      els.reviewSm2Preview.textContent = preview ? `${docTitle} — ${preview}` : docTitle;
    } else {
      els.reviewSm2Preview.textContent = preview;
    }
  }

  const conceptIds = resolveSmItemConceptIds(item, originSession);
  const hintConceptId = conceptIds[0] || "";
  if (els.reviewMnemonicHintHost) {
    const hintHtml = hintConceptId
      ? buildMnemonicHintHtml(originSession, hintConceptId)
      : "";
    if (hintHtml) {
      els.reviewMnemonicHintHost.innerHTML = hintHtml;
      els.reviewMnemonicHintHost.hidden = false;
    } else {
      els.reviewMnemonicHintHost.innerHTML = "";
      els.reviewMnemonicHintHost.hidden = true;
    }
  }
}

function showSm2ReviewSummary() {
  setSm2ReviewDomVisible(true);
  if (els.reviewSm2QualityBtns) els.reviewSm2QualityBtns.hidden = true;
  if (els.reviewSm2EarlyChip) els.reviewSm2EarlyChip.classList.add("hidden");
  if (els.reviewSm2Meta) els.reviewSm2Meta.textContent = "Review complete";
  if (els.reviewSm2SourceBadge) els.reviewSm2SourceBadge.textContent = "";
  if (els.reviewSm2Title) els.reviewSm2Title.textContent = "Session finished";
  if (els.reviewSm2Preview) {
    els.reviewSm2Preview.textContent = `You reviewed ${sm2ReviewQueue.length} item${sm2ReviewQueue.length === 1 ? "" : "s"}.`;
  }
  if (els.reviewSm2Empty) els.reviewSm2Empty.hidden = true;
}

async function handleSm2QualityClick(quality) {
  const item = sm2ReviewQueue[sm2ReviewIndex];
  if (!item) {
    // [debug-enrich]
    console.warn('[review.handleSm2QualityClick] No item at index', {
      index: sm2ReviewIndex,
      quality,
    });
    return;
  }

  // [debug-enrich]
  console.info('[review.handleSm2QualityClick] Grade submitted:', {
    quality,
    index: sm2ReviewIndex,
    itemId: item.id ?? null,
    source: item.source ?? null,
    sourceType: item.sourceType ?? null,
    docId: item.docId ?? sm2ReviewDocId ?? null,
  });

  if (item.source === "global" || item.sourceType === "global_concept") {
    onGlobalReviewAnswer({
      globalConceptId: item.globalConceptId || item.conceptId || item.sourceId,
      facet: item.facet || "recognition",
      quality,
      sourceDocId: item.docId,
    });
    sm2ReviewIndex += 1;
    if (sm2ReviewIndex >= sm2ReviewQueue.length) showSm2ReviewSummary();
    else renderSm2ReviewItem();
    return;
  }

  if (item.source === "vault" || item.sourceType === "vault_review_item") {
    applyVaultReviewItemObservation(
      item.vaultEntryId || "",
      item.sourceId || String(item.id || "").replace(/^vaultri:/, ""),
      quality,
      { facet: item.facet, docId: item.docId },
    );
    const updated = updateSmItem(item, quality);
    sm2ReviewQueue[sm2ReviewIndex] = updated;
    sm2ReviewIndex += 1;
    if (sm2ReviewIndex >= sm2ReviewQueue.length) showSm2ReviewSummary();
    else renderSm2ReviewItem();
    return;
  }

  const originDocId = String(sm2ReviewDocId || item.docId || item.originDocId || "").trim();
  if (!originDocId) {
    // Safety net: never hang the queue on malformed legacy/synthetic items
    console.warn("[review.handleSm2QualityClick] Missing originDocId — skip and advance", {
      quality,
      itemId: item.id ?? null,
      sourceType: item.sourceType ?? null,
    });
    sm2ReviewQueue.splice(sm2ReviewIndex, 1);
    if (sm2ReviewIndex >= sm2ReviewQueue.length) showSm2ReviewSummary();
    else renderSm2ReviewItem();
    return;
  }

  const updated = updateSmItem(item, quality);
  await upsertSmItem(originDocId, updated);
  sm2ReviewQueue[sm2ReviewIndex] = updated;

  if (updated.sourceType === "vault_concept") {
    const session = await getSession(originDocId);
    if (session) {
      applyVaultReviewObservation(session, updated.sourceId, {
        type: quality >= 3 ? "mcq_correct" : "mcq_wrong",
        correct: quality >= 3,
      });
    } else {
      // [debug-enrich]
      console.warn('[review.handleSm2QualityClick] Vault observe skipped — session missing', {
        originDocId,
        sourceId: updated.sourceId ?? null,
      });
    }
  }

  sm2ReviewIndex += 1;
  if (sm2ReviewIndex >= sm2ReviewQueue.length) showSm2ReviewSummary();
  else renderSm2ReviewItem();
}

/** Priority-queue spaced review for shared.smItems (single document). */
export async function runSm2ReviewSession(docId, options = {}) {
  const id = String(docId || "").trim();
  const session = await getSession(id);
  if (!session) return;

  sm2ReviewDocId = id;
  const flags = getPedagogicalFlags();
  let queue = buildReviewQueue(session.shared?.smItems || [], Date.now(), {
    gapFillPenalty: flags.GAP_FILL_PRIORITY_PENALTY,
    maxGapFillPerSession: flags.MAX_GAP_FILL_PER_SESSION,
  });
  if (options.mnemonicsOnly) {
    queue = await filterSmItemsByMnemonics(queue, getSession);
  }
  sm2ReviewQueue = queue;
  sm2ReviewIndex = 0;

  if (!sm2ReviewQueue.length) {
    showSm2ReviewEmptyState(
      options.mnemonicsOnly
        ? "No mnemonic-linked concepts due for review yet."
        : undefined,
    );
    return;
  }

  showScreen("review");
  renderSm2ReviewItem();
}

/** Cross-document vault review from aggregated due items. */
export async function runVaultSm2ReviewSession(scope, options = {}) {
  // [debug-enrich]
  console.info('[review.runVaultSm2ReviewSession] Starting vault SM-2 review:', {
    scopeProjectId: scope?.projectId ?? reviewScope?.projectId ?? null,
    includeDescendants: scope?.includeDescendants ?? reviewScope?.includeDescendants ?? null,
    mnemonicsOnly: Boolean(options.mnemonicsOnly),
  });
  if (scope && typeof scope === "object") {
    setReviewScope(scope);
  }
  sm2ReviewDocId = "";
  let pool;
  let poolSource = "none";
  if (reviewScope.projectId === "all") {
    pool = await buildGlobalReviewQueue({ projectId: "all" });
    poolSource = pool.length ? "global_all" : "none";
    if (!pool.length) {
      pool = await getSmItemsDueToday();
      poolSource = pool.length ? "sm_items_due_today_fallback" : "none";
    }
  } else {
    pool = await buildGlobalReviewQueue({
      projectId: reviewScope.projectId,
    });
    poolSource = pool.length ? "global_project" : "none";
    if (!pool.length) {
      pool = filterDueSmItems(
        await getReviewableItemsForProject(reviewScope.projectId, {
          includeDescendants: reviewScope.includeDescendants,
        }),
      );
      poolSource = pool.length ? "project_scope_fallback" : "none";
    }
  }
  sm2ReviewQueue = pool;
  if (options.mnemonicsOnly) {
    const before = sm2ReviewQueue.length;
    sm2ReviewQueue = await filterSmItemsByMnemonics(sm2ReviewQueue, getSession);
    // [debug-enrich]
    console.info('[review.runVaultSm2ReviewSession] Mnemonics filter applied:', {
      before,
      after: sm2ReviewQueue.length,
    });
  }
  sm2ReviewIndex = 0;

  // [debug-enrich]
  console.info('[review.runVaultSm2ReviewSession] Queue ready:', {
    projectId: reviewScope.projectId,
    poolSource,
    queueLength: sm2ReviewQueue.length,
  });

  if (!sm2ReviewQueue.length) {
    // [debug-enrich]
    console.warn('[review.runVaultSm2ReviewSession] Empty queue — showing empty state', {
      projectId: reviewScope.projectId,
      poolSource,
      mnemonicsOnly: Boolean(options.mnemonicsOnly),
    });
    showSm2ReviewEmptyState(
      options.mnemonicsOnly
        ? "No mnemonic-linked concepts due for review yet."
        : undefined,
    );
    return;
  }

  showScreen("review");
  renderSm2ReviewItem();
}

export function wireSm2ReviewHandlers() {
  els.reviewSm2QualityBtns?.querySelectorAll("[data-sm2-quality]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const quality = Number(btn.getAttribute("data-sm2-quality"));
      if (!Number.isFinite(quality)) return;
      handleSm2QualityClick(quality);
    });
  });
}


export const SLOW_FLASHCARD_SOURCE = "slow_mode";

export function slowFlashcardsStorageKey(sessionId) {
  const id = String(sessionId || "").trim();
  return id ? `${LS_REVIEW_FLASHCARDS_PREFIX}${id}` : "";
}

export function normalizeSlowFlashcardPayload(payload) {
  const obj = payload && typeof payload === "object" ? payload : {};
  const front = String(obj.front || "").trim();
  const back = String(obj.back || "").trim();
  const annotationId = String(obj.annotationId || "").trim();
  if (!front || !annotationId) return null;
  return {
    front,
    back: back || "Retrieval from Slow Mode annotation",
    source: String(obj.source || SLOW_FLASHCARD_SOURCE).trim() || SLOW_FLASHCARD_SOURCE,
    annotationId,
    addedAt: Number(obj.addedAt) || Date.now(),
  };
}

export function loadSlowFlashcards(sessionId) {
  const key = slowFlashcardsStorageKey(sessionId);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw || !raw.trim()) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeSlowFlashcardPayload).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveSlowFlashcards(sessionId, cards) {
  const key = slowFlashcardsStorageKey(sessionId);
  if (!key) return;
  const list = (Array.isArray(cards) ? cards : [])
    .map(normalizeSlowFlashcardPayload)
    .filter(Boolean);
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // ignore quota / private mode
  }
}

export function getSlowFlashcardAnnotationIds(sessionId) {
  return new Set(loadSlowFlashcards(sessionId).map((c) => c.annotationId));
}

export function addSlowFlashcards(sessionId, payloads) {
  const existing = loadSlowFlashcards(sessionId);
  const byAnnId = new Map(existing.map((c) => [c.annotationId, c]));
  let added = 0;
  for (const raw of Array.isArray(payloads) ? payloads : []) {
    const norm = normalizeSlowFlashcardPayload(raw);
    if (!norm || byAnnId.has(norm.annotationId)) continue;
    byAnnId.set(norm.annotationId, norm);
    added += 1;
  }
  const next = [...byAnnId.values()].sort((a, b) => a.addedAt - b.addedAt);
  saveSlowFlashcards(sessionId, next);
  return { added, total: next.length, cards: next };
}

export function addSlowFlashcardFromPayload(sessionId, payload) {
  return addSlowFlashcards(sessionId, [payload]);
}

export function formatSlowFlashcardsForReview(cards) {
  const list = Array.isArray(cards) ? cards : [];
  if (!list.length) return "";
  const lines = ["SPACED REPETITION FLASHCARDS (from Slow Mode annotations):"];
  for (const c of list) {
    lines.push(`- Front: ${c.front}`);
    lines.push(`  Back: ${c.back}`);
  }
  return lines.join("\n");
}

function renderReviewFlashcardQueue(sessionId) {
  const card = els.screenReviewConfig?.querySelector(".card");
  if (!card) return;
  let host = card.querySelector("#reviewFlashcardQueue");
  if (!host) {
    host = document.createElement("div");
    host.id = "reviewFlashcardQueue";
    host.className = "review-flashcard-queue";
    host.hidden = true;
    const divider = document.createElement("div");
    divider.className = "divider";
    const blocksList = els.reviewBlocksList;
    if (blocksList?.parentElement) {
      blocksList.parentElement.insertBefore(divider, blocksList);
      blocksList.parentElement.insertBefore(host, blocksList);
    } else {
      card.appendChild(divider);
      card.appendChild(host);
    }
  }

  const cards = loadSlowFlashcards(sessionId);
  if (!cards.length) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }

  host.hidden = false;
  const items = cards
    .map(
      (c) =>
        `<li class="review-flashcard-item"><span class="review-flashcard-front">${escapeReviewHtml(c.front)}</span></li>`,
    )
    .join("");
  host.innerHTML = `
    <label>Flashcards from Slow Mode (${cards.length})</label>
    <p class="hint">These cards are included when you start a review session.</p>
    <ul class="review-flashcard-list" aria-label="Queued flashcards">${items}</ul>`;
}

function escapeReviewHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setReviewConfigError(msg) {
  els.reviewConfigError.hidden = false;
  els.reviewConfigError.textContent = String(msg || "");
}
function clearReviewConfigError() {
  els.reviewConfigError.hidden = true;
  els.reviewConfigError.textContent = "";
}
function setReviewGeneratingError(msg) {
  els.reviewGeneratingError.hidden = false;
  els.reviewGeneratingError.textContent = String(msg || "");
}
function clearReviewGeneratingError() {
  els.reviewGeneratingError.hidden = true;
  els.reviewGeneratingError.textContent = "";
}
function setReviewError(msg) {
  els.reviewError.hidden = false;
  els.reviewError.textContent = String(msg || "");
}
function clearReviewError() {
  els.reviewError.hidden = true;
  els.reviewError.textContent = "";
}

function setReviewType(nextType) {
  reviewType = nextType;
  const isTest = reviewType === "test";
  const isSocratic = reviewType === "socratic";
  const isBoth = reviewType === "both";
  els.reviewTypeTestBtn.setAttribute("aria-pressed", String(isTest));
  els.reviewTypeSocraticBtn.setAttribute("aria-pressed", String(isSocratic));
  els.reviewTypeBothBtn.setAttribute("aria-pressed", String(isBoth));
}

function getReviewQuestionCount() {
  return clampInt(els.reviewNQuestionsInput.value, 1, 100, 20);
}

async function getSessionMarkdownForReview() {
  if (state.activeSession) {
    const md = await buildMarkdown(state.activeSession);
    try {
      localStorage.setItem(LS_REVIEW_SESSION_MD_KEY, md);
    } catch {
      // ignore
    }
    return md;
  }
  const stored = localStorage.getItem(LS_REVIEW_SESSION_MD_KEY);
  if (stored && stored.trim()) return stored;
  return "";
}

export function extractSessionContentFromMarkdown(md, selectedIndices = null) {
  const text = String(md || "");
  if (!text.trim()) return "";
  const allowed =
    selectedIndices == null
      ? null
      : new Set(
          (Array.isArray(selectedIndices) ? selectedIndices : [])
            .map((i) => Math.floor(Number(i)))
            .filter((i) => i >= 0),
        );
  const parts = [];
  const re =
    /^##\s+Block\s+(\d+):\s+.*\n([\s\S]*?)\n###\s+Questions(?:\s*&\s*Answers)?\s*$/gim;
  let m = null;
  while ((m = re.exec(text))) {
    const blockNum = Math.max(1, Math.floor(Number(m[1]) || 1));
    const index = blockNum - 1;
    if (allowed && !allowed.has(index)) continue;
    const expl = String(m[2] || "").trim();
    if (expl) parts.push(expl);
  }
  return parts.join("\n\n").trim();
}

function getReviewBlocksForPicker() {
  const blocks = Array.isArray(state.activeSession?.blocks) ? state.activeSession.blocks : [];
  return blocks.map((b, index) => {
    const row = b && typeof b === "object" ? b : {};
    return {
      index,
      title: String(row.title || "").trim() || `Block ${index + 1}`,
    };
  });
}

function getSelectedReviewBlockIndices() {
  const cbs = els.reviewBlocksList
    ? [...els.reviewBlocksList.querySelectorAll('input[type="checkbox"][data-block-index]')]
    : [];
  if (!cbs.length) {
    return getReviewBlocksForPicker().map((b) => b.index);
  }
  return cbs
    .filter((cb) => cb.checked)
    .map((cb) => Math.floor(Number(cb.dataset.blockIndex)))
    .filter((i) => i >= 0);
}

export function getActiveReviewSessionId() {
  return String(state.activeSession?._meta?.session_id || "").trim();
}

export function reviewConfigStorageKey(sessionId) {
  const id = String(sessionId || "").trim();
  return id ? `${LS_REVIEW_CONFIG_PREFIX}${id}` : "";
}

export function loadReviewConfigDraft(sessionId, blockCount) {
  const key = reviewConfigStorageKey(sessionId);
  if (!key) return null;
  const raw = localStorage.getItem(key);
  if (!raw || !raw.trim()) return null;
  const n = Math.max(0, Math.floor(Number(blockCount) || 0));
  try {
    const obj = JSON.parse(raw);
    const focus = String(obj?.focus ?? "");
    const selectedBlocks = Array.isArray(obj?.selectedBlocks)
      ? [
          ...new Set(
            obj.selectedBlocks
              .map((v) => Math.floor(Number(v)))
              .filter((i) => i >= 0 && (n <= 0 || i < n)),
          ),
        ].sort((a, b) => a - b)
      : [];
    return { focus, selectedBlocks };
  } catch {
    return null;
  }
}

export function saveReviewConfigDraft(sessionId, { focus, selectedBlocks, blockCount } = {}) {
  const key = reviewConfigStorageKey(sessionId);
  if (!key) return;
  const n = Math.max(0, Math.floor(Number(blockCount) || 0));
  let indices = Array.isArray(selectedBlocks)
    ? selectedBlocks.map((v) => Math.floor(Number(v))).filter((i) => i >= 0)
    : [];
  if (n > 0) {
    indices = [...new Set(indices.filter((i) => i < n))].sort((a, b) => a - b);
  } else {
    indices = [...new Set(indices)].sort((a, b) => a - b);
  }
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        focus: String(focus ?? ""),
        selectedBlocks: indices,
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}

function resolvePreselectedBlockIndices(preselected, blockCount) {
  const n = Math.max(0, Math.floor(Number(blockCount) || 0));
  if (!n) return null;
  const arr = Array.isArray(preselected)
    ? [
        ...new Set(
          preselected
            .map((v) => Math.floor(Number(v)))
            .filter((i) => i >= 0 && i < n),
        ),
      ]
    : [];
  return arr.length ? arr : null;
}

function persistReviewConfigDraft() {
  const sessionId = getActiveReviewSessionId();
  if (!sessionId) return;
  const blockCount = getReviewBlocksForPicker().length;
  saveReviewConfigDraft(sessionId, {
    focus: els.reviewFocusInput ? String(els.reviewFocusInput.value || "") : "",
    selectedBlocks: getSelectedReviewBlockIndices(),
    blockCount,
  });
}

function renderReviewBlockPicker(preselectedIndices = null) {
  if (!els.reviewBlocksList) return;
  const items = getReviewBlocksForPicker();
  els.reviewBlocksList.innerHTML = "";
  if (!items.length) {
    els.reviewBlocksList.hidden = true;
    if (els.reviewBlocksSelectAllBtn) els.reviewBlocksSelectAllBtn.hidden = true;
    if (els.reviewBlocksDeselectAllBtn) els.reviewBlocksDeselectAllBtn.hidden = true;
    return;
  }
  els.reviewBlocksList.hidden = false;
  if (els.reviewBlocksSelectAllBtn) els.reviewBlocksSelectAllBtn.hidden = false;
  if (els.reviewBlocksDeselectAllBtn) els.reviewBlocksDeselectAllBtn.hidden = false;

  const preselected = resolvePreselectedBlockIndices(preselectedIndices, items.length);
  const preSet = preselected ? new Set(preselected) : null;

  for (const { index, title } of items) {
    const id = `reviewBlockCb_${index}`;
    const label = document.createElement("label");
    label.className = "review-block-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = id;
    cb.dataset.blockIndex = String(index);
    cb.checked = preSet ? preSet.has(index) : true;
    label.appendChild(cb);
    label.append(` Block ${index + 1}: ${title}`);
    els.reviewBlocksList.appendChild(label);
  }
}

function setAllReviewBlocksChecked(checked) {
  if (!els.reviewBlocksList) return;
  for (const cb of els.reviewBlocksList.querySelectorAll('input[type="checkbox"]')) {
    cb.checked = checked;
  }
}

function getReviewFocusNotes() {
  return els.reviewFocusInput ? String(els.reviewFocusInput.value || "").trim() : "";
}

export async function buildSessionContentForReview(selectedIndices = null) {
  const selected = new Set(
    (Array.isArray(selectedIndices) ? selectedIndices : [])
      .map((i) => Math.floor(Number(i)))
      .filter((i) => i >= 0),
  );
  const filterBlocks = selected.size > 0;
  const isSelected = (index) => !filterBlocks || selected.has(index);

  const md = await getSessionMarkdownForReview();
  const parsed = extractSessionContentFromMarkdown(md, filterBlocks ? [...selected] : null);
  const baseExplanations =
    parsed ||
    (() => {
      const blocks = Array.isArray(state.activeSession?.blocks) ? state.activeSession.blocks : [];
      return blocks
        .map((b, i) => {
          if (!isSelected(i)) return "";
          return b && typeof b === "object" ? String(b.explanation || "").trim() : "";
        })
        .filter(Boolean)
        .join("\n\n")
        .trim();
    })();

  const outlineLines = [];
  const blocks = Array.isArray(state.activeSession?.blocks) ? state.activeSession.blocks : [];
  if (blocks.length) {
    outlineLines.push("SESSION OUTLINE (blocks in scope for this review):");
    for (let i = 0; i < blocks.length; i += 1) {
      if (!isSelected(i)) continue;
      const b = blocks[i] && typeof blocks[i] === "object" ? blocks[i] : {};
      const title = String(b.title || "").trim() || `Block ${i + 1}`;
      outlineLines.push(`- Block ${i + 1}: ${title}`);
    }
  }

  const extras = [];

  const missed = state.activeSession ? getMissedTestQuestions(state.activeSession) : [];
  const scopedMissed = missed.filter((m) => isSelected(Number(m.blockIndex)));
  if (scopedMissed.length) {
    const lines = [];
    lines.push("WEAK SPOTS (missed questions):");
    for (const m of scopedMissed.slice(0, 40)) {
      const q = String(m.question || "").trim();
      lines.push(
        `- Block ${Number(m.blockIndex) + 1}, Q${Number(m.questionIndex) + 1}: ${q || "(missing)"} | Your: ${
          m.user_answer || "(blank)"
        } | Correct: ${m.correct_answer || "(unknown)"}`,
      );
    }
    extras.push(lines.join("\n"));
  }

  // Include user notes from the sidebar if present (best effort).
  const gh = Array.isArray(window?.guideHistory) ? window.guideHistory : [];
  const userNotes = gh
    .filter((m) => m && typeof m === "object")
    .filter((m) => String(m.role || "").trim().toLowerCase() === "user")
    .map((m) => String(m.content || "").trim())
    .filter(Boolean)
    .slice(-20);
  if (userNotes.length) {
    extras.push(`SIDEBAR NOTES:\n${userNotes.map((t) => `- ${t}`).join("\n")}`);
  }

  const sessionId = getActiveReviewSessionId();
  const flashcardSection = formatSlowFlashcardsForReview(loadSlowFlashcards(sessionId));
  if (flashcardSection) extras.push(flashcardSection);

  const out = [outlineLines.join("\n").trim(), baseExplanations, ...extras]
    .filter((section) => section && String(section).trim())
    .join("\n\n")
    .trim();
  return out;
}

function parseJsonArrayFromModel(content) {
  const raw = String(content || "").trim();
  if (!raw) throw new Error("Empty model response.");
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new Error("Response is not a JSON array.");
    return arr;
  } catch {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start >= 0 && end > start) {
      const slice = raw.slice(start, end + 1);
      const arr = JSON.parse(slice);
      if (!Array.isArray(arr)) throw new Error("Response is not a JSON array.");
      return arr;
    }
    throw new Error("Failed to parse JSON array from model response.");
  }
}

function updateReviewScoreUi() {
  if (reviewTestTotal <= 0) {
    els.reviewScore.textContent = "";
    return;
  }
  els.reviewScore.textContent = `${reviewCorrect} / ${reviewTestTotal} correct`;
}

function normalizeReviewQuestion(q) {
  const obj = q && typeof q === "object" ? q : {};
  const type = String(obj.type || "").trim().toLowerCase();
  const question = String(obj.question || "").trim();
  if (!question) return null;
  const safeType =
    type === "test" || type === "socratic"
      ? type
      : reviewType === "socratic"
        ? "socratic"
        : "test";
  if (safeType === "socratic") {
    return {
      type: "socratic",
      question,
      feedback: obj.feedback != null ? String(obj.feedback).trim() : "",
    };
  }
  // Keep full model fields (choices, option_A, etc.) — same path as session block generation.
  return shuffleTestQuestionOptions(normalizeTestQuestion({ ...obj, type: "test", question }));
}

function collectQuestionsFromSessionBlocks(blockIndices, typeFilter = "both") {
  const blocks = Array.isArray(state.activeSession?.blocks) ? state.activeSession.blocks : [];
  const rt = String(typeFilter || "both").trim().toLowerCase();
  const out = [];
  for (const bi of blockIndices) {
    const idx = Math.max(0, Math.floor(Number(bi) || 0));
    const block = blocks[idx];
    if (!block || typeof block !== "object") continue;
    const qs = Array.isArray(block.questions) ? block.questions : [];
    for (const q of qs) {
      if (!q || typeof q !== "object") continue;
      const t = String(q.type || "").trim().toLowerCase();
      if (rt === "test" && t !== "test") continue;
      if (rt === "socratic" && t !== "socratic") continue;
      const norm = normalizeReviewQuestion(q);
      if (norm) out.push(norm);
    }
  }
  return out;
}

/** Start review using questions already generated in the active session (Questions mode / block review). */
export function startReviewFromSessionBlocks({ blockIndices, reviewType: type = "both" } = {}) {
  const rt = type === "test" || type === "socratic" ? type : "both";
  const indices = Array.isArray(blockIndices)
    ? blockIndices.map((i) => Math.max(0, Math.floor(Number(i) || 0)))
    : [];
  // [debug-enrich]
  console.info("[review.startReviewFromSessionBlocks] Start:", {
    indexCount: indices.length,
    reviewType: rt,
  });
  if (!indices.length) {
    // [debug-enrich]
    console.error("[review.startReviewFromSessionBlocks] No blocks selected");
    throw new Error("Select at least one block to review.");
  }
  const collected = collectQuestionsFromSessionBlocks(indices, rt);
  if (!collected.length) {
    // [debug-enrich]
    console.error("[review.startReviewFromSessionBlocks] No questions in selected blocks:", {
      indices,
      reviewType: rt,
    });
    throw new Error("No questions available for review in the selected blocks.");
  }

  resetReviewRun();
  reviewType = rt;
  reviewQuestions = collected;
  reviewIndex = 0;
  reviewCorrect = 0;
  reviewTestTotal = reviewQuestions.filter((q) => q && q.type === "test").length;
  reviewAnswers = new Array(reviewQuestions.length).fill(null);
  // [debug-enrich]
  console.info("[review.startReviewFromSessionBlocks] Loaded:", {
    questionCount: reviewQuestions.length,
    testTotal: reviewTestTotal,
  });
  showScreen("review");
  renderReviewQuestion();
}

function detachReviewMcKeydown() {
  if (!reviewMcKeydownHandler) return;
  document.removeEventListener("keydown", reviewMcKeydownHandler);
  reviewMcKeydownHandler = null;
}

function attachReviewMcKeydown(q) {
  detachReviewMcKeydown();
  if (!q || q.type !== "test") return;

  reviewMcKeydownHandler = (e) => {
    if (e.repeat || isMcTypingTarget(e.target)) return;
    if (els.screenReview?.getAttribute("aria-hidden") === "true") return;

    const answered = reviewAnswers[reviewIndex] != null;
    if (answered) {
      if (e.key === "Enter" && !els.reviewNextBtn.hidden) {
        e.preventDefault();
        els.reviewNextBtn.click();
      }
      return;
    }

    const letter = letterFromMcKey(e.key);
    if (!letter) return;
    const btn = els.reviewTestOptions?.querySelector(`button[data-letter="${letter}"]`);
    if (!btn || btn.disabled) return;
    e.preventDefault();
    btn.click();
  };
  document.addEventListener("keydown", reviewMcKeydownHandler);
}

function renderReviewQuestion() {
  detachReviewMcKeydown();
  clearReviewError();
  const total = reviewQuestions.length;
  const q = reviewQuestions[reviewIndex];
  // [debug-enrich]
  console.debug("[review.renderReviewQuestion] Render:", {
    reviewIndex,
    total,
    type: q?.type || null,
    hasQuestion: Boolean(q),
  });
  if (!q) {
    // [debug-enrich]
    console.error("[review.renderReviewQuestion] No question at index:", { reviewIndex, total });
    setReviewError("No questions loaded.");
    return;
  }

  els.reviewMeta.textContent = `Question ${reviewIndex + 1} of ${total}`;
  updateReviewScoreUi();

  void renderMarkdown(els.reviewQuestionText, String(q.question || ""));

  els.reviewTestView.hidden = true;
  els.reviewSocraticView.hidden = true;
  els.reviewTestOptions.innerHTML = "";
  els.reviewTestFeedback.hidden = true;
  clearMarkdownContainer(els.reviewTestFeedback);
  els.reviewNextBtn.hidden = true;

  els.reviewSocraticAnswer.value = "";
  els.reviewSocraticResponseBox.hidden = true;
  clearMarkdownContainer(els.reviewSocraticResponseBox);
  els.reviewSocraticStatus.textContent = "";
  els.reviewSocraticNextBtn.hidden = true;

  if (q.type === "test") {
    els.reviewTestView.hidden = false;
    const qTest = normalizeTestQuestion(q);
    const opts = qTest.options && typeof qTest.options === "object" ? qTest.options : {};
    const letters = ["A", "B", "C", "D"];
    for (const letter of letters) {
      const label = opts[letter] != null ? String(opts[letter]).trim() : "";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.letter = letter;
      btn.innerHTML = renderMcOptionHtml(letter, label);
      if (hasMathInHtml(btn.innerHTML)) void typesetMath(btn);
      btn.addEventListener("click", () => {
        const correct = String(qTest.answer || "").trim();
        const isCorrect = correct && letter === correct;
        reviewAnswers[reviewIndex] = {
          type: "test",
          user_answer: letter,
          correct_answer: correct,
          correct: !!isCorrect,
        };
        if (isCorrect) reviewCorrect += 1;

        const all = Array.from(els.reviewTestOptions.querySelectorAll("button"));
        for (const b of all) b.disabled = true;
        for (const b of all) {
          const l = String(b.dataset.letter || "");
          if (correct && l === correct) b.classList.add("is-correct");
          if (l === letter && !isCorrect) b.classList.add("is-wrong");
        }

        updateReviewScoreUi();

        const fb =
          qTest.feedback ||
          (correct ? `Correct answer: ${correct}` : "") ||
          (isCorrect ? "Correct." : "Incorrect.");
        els.reviewTestFeedback.hidden = false;
        void renderMarkdown(els.reviewTestFeedback, fb);

        const isLast = reviewIndex >= total - 1;
        els.reviewNextBtn.hidden = false;
        els.reviewNextBtn.textContent = isLast ? "Finish" : "Next";
      });
      els.reviewTestOptions.appendChild(btn);
    }
    attachReviewMcKeydown(q);
    return;
  }

  els.reviewSocraticView.hidden = false;
  setTimeout(() => els.reviewSocraticAnswer.focus(), 0);
}

async function showReviewSummary() {
  detachReviewMcKeydown();
  const total = reviewQuestions.length;
  const hasAnyTest = reviewQuestions.some((q) => q && q.type === "test");
  const wrong = [];
  const scoredTotal = reviewQuestions.filter((q) => q && q.type === "test").length;
  const pct = scoredTotal ? Math.round((reviewCorrect / scoredTotal) * 100) : 0;
  const socraticTotal = reviewQuestions.filter((q) => q && q.type === "socratic").length;

  if (!hasAnyTest) {
    els.reviewSummaryMeta.textContent = `Completed ${total} Socratic questions.`;
    els.reviewWrongList.hidden = true;
    els.reviewWrongList.textContent = "";
  } else {
    els.reviewSummaryMeta.textContent = `${reviewCorrect} / ${scoredTotal} correct (${pct}%)`;
    for (let i = 0; i < reviewQuestions.length; i += 1) {
      const q = reviewQuestions[i];
      if (!q || q.type !== "test") continue;
      const a = reviewAnswers[i];
      if (!a || a.correct) continue;
      wrong.push({
        question: String(q.question || ""),
        user: String(a.user_answer || ""),
        correct: String(a.correct_answer || ""),
      });
    }

    if (wrong.length) {
      const lines = [];
      lines.push("Wrong answers:");
      lines.push("");
      for (const w of wrong) {
        lines.push(`- Q: ${w.question}`);
        lines.push(`  - Your answer: ${w.user || "(blank)"}`);
        lines.push(`  - Correct: ${w.correct || "(unknown)"}`);
      }
      els.reviewWrongList.hidden = false;
      els.reviewWrongList.textContent = lines.join("\n");
    } else {
      els.reviewWrongList.hidden = true;
      els.reviewWrongList.textContent = "";
    }
  }

  // Persist review results so the main session markdown export can include them.
  try {
    const sessionId = String(state.activeSession?._meta?.session_id || "");
    const rev = Number(state.activeSession?._meta?.rev || 0);
    const safeWrong = Array.isArray(wrong) ? wrong : [];

    const socraticAnswers = [];
    if (Array.isArray(reviewQuestions) && Array.isArray(reviewAnswers)) {
      for (let i = 0; i < reviewQuestions.length; i += 1) {
        const q = reviewQuestions[i];
        const a = reviewAnswers[i];
        if (!q || q.type !== "socratic") continue;
        if (!a || typeof a !== "object") continue;
        socraticAnswers.push({
          question: String(q.question || ""),
          user_answer: String(a.user_answer || ""),
        });
        if (socraticAnswers.length >= 30) break;
      }
    }

    localStorage.setItem(
      LS_REVIEW_SESSION_RESULTS_KEY,
      JSON.stringify({
        session_id: sessionId || null,
        rev: Number.isFinite(rev) ? rev : null,
        reviewed_at: Date.now(),
        reviewType,
        totalQuestions: total,
        testQuestions: hasAnyTest ? scoredTotal : 0,
        correct: hasAnyTest ? reviewCorrect : 0,
        pct: hasAnyTest ? pct : 0,
        socraticQuestions: socraticTotal,
        wrong: safeWrong,
        socraticAnswers,
      }),
    );

    // Keep the cached session markdown in sync too (used as review context).
    if (state.activeSession) {
      try {
        const md = await buildMarkdown(state.activeSession);
        localStorage.setItem(LS_REVIEW_SESSION_MD_KEY, md);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  showScreen("reviewSummary");
}

function resetReviewRun() {
  detachReviewMcKeydown();
  reviewQuestions = [];
  reviewIndex = 0;
  reviewCorrect = 0;
  reviewTestTotal = 0;
  reviewAnswers = [];
  reviewSessionContent = "";
  clearReviewConfigError();
  clearReviewGeneratingError();
  clearReviewError();
  els.reviewGeneratingLabel.textContent = "Generating questions…";
  els.reviewGeneratingFill.style.width = "0%";
  els.reviewTestFeedback.hidden = true;
  clearMarkdownContainer(els.reviewTestFeedback);
  els.reviewSocraticResponseBox.hidden = true;
  els.reviewSocraticResponseBox.textContent = "";
  els.reviewSocraticStatus.textContent = "";
  els.reviewNextBtn.hidden = true;
  els.reviewSocraticNextBtn.hidden = true;
}

function showReviewConfig() {
  resetReviewRun();
  els.reviewConfigStatus.textContent = "";
  els.reviewNQuestionsInput.value = String(getReviewQuestionCount());
  const sessionId = getActiveReviewSessionId();
  const blockCount = getReviewBlocksForPicker().length;
  const draft = loadReviewConfigDraft(sessionId, blockCount);
  renderReviewBlockPicker(draft?.selectedBlocks ?? null);
  if (els.reviewFocusInput) {
    els.reviewFocusInput.value = draft ? String(draft.focus || "") : "";
  }
  renderReviewFlashcardQueue(sessionId);
  populateReviewScopeSelect();
  setReviewType(reviewType);
  showScreen("reviewConfig");
}

async function startReviewGeneration() {
  clearReviewConfigError();
  clearReviewGeneratingError();

  const llmModel = getSessionLlmModel(state.activeSession);
  try {
    assertLlmKeyPresent(llmModel);
  } catch (err) {
    setReviewConfigError(err?.message ? String(err.message) : String(err));
    return;
  }

  const nQuestions = getReviewQuestionCount();
  if (!state.activeSession) {
    setReviewConfigError("No active session found to review.");
    return;
  }

  const selectedBlocks = getSelectedReviewBlockIndices();
  if (!selectedBlocks.length) {
    setReviewConfigError("Select at least one block to review.");
    return;
  }

  const sessionContent = await buildSessionContentForReview(selectedBlocks);
  if (!sessionContent) {
    setReviewConfigError("Could not extract session content for review.");
    return;
  }

  const reviewInstructions = getReviewFocusNotes();
  reviewSessionContent = sessionContent;
  reviewGenCancelToken = { cancelled: false };
  showScreen("reviewGenerating");

  const total = nQuestions;
  let done = 0;
  const batches = [];
  for (let i = 0; i < total; i += 20) {
    batches.push(Math.min(20, total - i));
  }

  const all = [];
  for (const batchSize of batches) {
    if (reviewGenCancelToken.cancelled) return;
    els.reviewGeneratingLabel.textContent = `Generating questions… (${done}/${total})`;
    els.reviewGeneratingFill.style.width = `${Math.round((done / total) * 100)}%`;

    const content = await deepSeekGenerateReviewBatch({
      llmModel,
      sessionContent,
      reviewInstructions,
      type: reviewType,
      batchSize,
    });

    const arr = parseJsonArrayFromModel(content);
    if (arr.length !== batchSize) {
      throw new Error(`Model returned ${arr.length} items, expected ${batchSize}.`);
    }

    for (const item of arr) {
      const norm = normalizeReviewQuestion(item);
      if (norm) all.push(norm);
    }

    done += batchSize;
    els.reviewGeneratingLabel.textContent = `Generating questions… (${done}/${total})`;
    els.reviewGeneratingFill.style.width = `${Math.round((done / total) * 100)}%`;
  }

  if (reviewGenCancelToken.cancelled) return;
  if (all.length !== total) {
    throw new Error(`Generated ${all.length} usable questions, expected ${total}.`);
  }

  reviewQuestions = all;
  reviewIndex = 0;
  reviewCorrect = 0;
  reviewTestTotal = reviewQuestions.filter((q) => q && q.type === "test").length;
  reviewAnswers = new Array(reviewQuestions.length).fill(null);

  showScreen("review");
  renderReviewQuestion();
}

export async function getCurrentSm2ReviewConceptIds() {
  const item = sm2ReviewQueue[sm2ReviewIndex];
  if (!item) return [];
  const docId = String(sm2ReviewDocId || item.docId || "").trim();
  const session = docId ? await getSession(docId) : null;
  return resolveSmItemConceptIds(item, session);
}

export async function wireReviewHandlers() {
  if (els.reviewSessionBtn) {
    els.reviewSessionBtn.addEventListener("click", () => {
      if (isQuestionsStudyMode(state.activeSession)) {
        const total = Math.max(1, getTotalBlocksSafe());
        const indices = Array.from({ length: total }, (_, i) => i);
        try {
          startReviewFromSessionBlocks({ blockIndices: indices, reviewType: "both" });
          return;
        } catch {
          // fall through to config screen if no questions yet
        }
      }
      showReviewConfig();
    });
  }

  els.reviewTypeTestBtn.addEventListener("click", () => setReviewType("test"));
  els.reviewTypeSocraticBtn.addEventListener("click", () => setReviewType("socratic"));
  els.reviewTypeBothBtn.addEventListener("click", () => setReviewType("both"));

  els.reviewCancelBtn.addEventListener("click", () => showScreen("complete"));

  if (els.reviewBlocksSelectAllBtn) {
    els.reviewBlocksSelectAllBtn.addEventListener("click", () => {
      setAllReviewBlocksChecked(true);
      persistReviewConfigDraft();
    });
  }
  if (els.reviewBlocksDeselectAllBtn) {
    els.reviewBlocksDeselectAllBtn.addEventListener("click", () => {
      setAllReviewBlocksChecked(false);
      persistReviewConfigDraft();
    });
  }
  if (els.reviewBlocksList) {
    els.reviewBlocksList.addEventListener("change", () => persistReviewConfigDraft());
  }
  if (els.reviewFocusInput) {
    els.reviewFocusInput.addEventListener("input", () => persistReviewConfigDraft());
  }

  els.reviewScopeSelect?.addEventListener("change", () => {
    const projectId = els.reviewScopeSelect.value || "all";
    setReviewScope({
      projectId,
      includeDescendants: Boolean(els.reviewIncludeSubprojects?.checked),
    });
    populateReviewScopeSelect();
  });
  els.reviewIncludeSubprojects?.addEventListener("change", () => {
    setReviewScope({
      projectId: els.reviewScopeSelect?.value || "all",
      includeDescendants: Boolean(els.reviewIncludeSubprojects.checked),
    });
    populateReviewScopeSelect();
  });

  els.reviewStartBtn.addEventListener("click", async () => {
    els.reviewConfigStatus.textContent = "";
    els.reviewConfigStatus.textContent = "Preparing…";
    try {
      await startReviewGeneration();
    } catch (err) {
      setReviewGeneratingError(err?.message ? String(err.message) : String(err));
    } finally {
      els.reviewConfigStatus.textContent = "";
    }
  });

  const spacedStartBtn = document.getElementById("reviewSpacedStartBtn");
  spacedStartBtn?.addEventListener("click", async () => {
    const docId = String((await getActiveSession())?.docId || "").trim();
    if (!docId) {
      setReviewConfigError("No active document session for spaced review.");
      return;
    }
    clearReviewConfigError();
    const mnemonicsOnly = Boolean(document.getElementById("reviewMnemonicsOnly")?.checked);
    runSm2ReviewSession(docId, { mnemonicsOnly });
  });

  els.reviewGeneratingCancelBtn.addEventListener("click", () => {
    reviewGenCancelToken.cancelled = true;
    showScreen("complete");
  });

  els.reviewQuitBtn.addEventListener("click", () => {
    if (sm2ReviewActive) {
      sm2ReviewActive = false;
      showScreen("modeSelect");
      return;
    }
    showScreen("complete");
  });

  wireSm2ReviewHandlers();

  els.reviewNextBtn.addEventListener("click", () => {
    const isLast = reviewIndex >= reviewQuestions.length - 1;
    if (isLast) {
      void showReviewSummary();
      return;
    }
    reviewIndex += 1;
    renderReviewQuestion();
  });

  els.reviewSocraticSendBtn.addEventListener("click", async () => {
    clearReviewError();
    els.reviewSocraticResponseBox.hidden = true;
    clearMarkdownContainer(els.reviewSocraticResponseBox);
    els.reviewSocraticNextBtn.hidden = true;

    const q = reviewQuestions[reviewIndex];
    if (!q || q.type !== "socratic") {
      setReviewError("Missing Socratic question.");
      return;
    }

    const llmModel = getSessionLlmModel(state.activeSession);
    try {
      assertLlmKeyPresent(llmModel);
    } catch (err) {
      setReviewError(err?.message ? String(err.message) : String(err));
      return;
    }

    const answer = String(els.reviewSocraticAnswer.value || "").trim();
    if (!answer) {
      setReviewError("Please write an answer before submitting.");
      return;
    }

    els.reviewSocraticStatus.textContent = getLlmCallingLabel(llmModel);
    els.reviewSocraticSendBtn.disabled = true;
    try {
      const resp = await deepSeekReviewSocraticTutor({
        llmModel,
        sessionContent: reviewSessionContent,
        question: String(q.question || ""),
        studentAnswer: answer,
      });
      els.reviewSocraticResponseBox.hidden = false;
      void renderMarkdown(els.reviewSocraticResponseBox, resp);

      reviewAnswers[reviewIndex] = {
        type: "socratic",
        user_answer: answer,
        feedback: resp,
      };

      const isLast = reviewIndex >= reviewQuestions.length - 1;
      els.reviewSocraticNextBtn.hidden = false;
      els.reviewSocraticNextBtn.textContent = isLast ? "Finish" : "Next";
    } catch (err) {
      setReviewError(err?.message ? String(err.message) : String(err));
    } finally {
      els.reviewSocraticSendBtn.disabled = false;
      els.reviewSocraticStatus.textContent = "";
    }
  });

  els.reviewSocraticNextBtn.addEventListener("click", () => {
    const isLast = reviewIndex >= reviewQuestions.length - 1;
    if (isLast) {
      void showReviewSummary();
      return;
    }
    reviewIndex += 1;
    renderReviewQuestion();
  });

  els.reviewSummaryBackBtn.addEventListener("click", () => showScreen("complete"));
  els.reviewSummaryNewBtn.addEventListener("click", () => showReviewConfig());
}

