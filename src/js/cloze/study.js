import { prioritizeByAssessmentSignals } from "../assessment-signals.js?v=20260622_7";
import { getActiveSession } from "../session-store.js";
import { mapClozeResultToQuality, registerOrUpdateSmItem } from "../sm2-ingest.js";
import { promoteFromCloze } from "../concept-registry/ingest.js";
import { getValidItems } from "./normalize.js?v=20260622_7";
import { storeActiveSession } from "../session.js?v=20260622_7";
import { markdownToHtml, renderMcOptionHtml } from "../markdown.js?v=20260622_7";
import { isMcTypingTarget, letterFromMcKey } from "../mc-keyboard.js?v=20260622_7";
import { shuffleInPlace } from "../shuffle-options.js";
import { els, showScreen } from "../ui.js?v=20260622_7";

const CLOZE_CORRECT_ADVANCE_MS = 250;

let activeOrder = [];
let activeIndex = 0;
let shown = 0;
let correct = 0;
let answered = false;
let shuffledOptions = [];
let activeStudySession = null;
let advanceTimerId = null;
let keydownBound = false;
/** @type {(() => void) | null} */
let clozeStudyCompleteExit = null;

export function setClozeStudyCompleteExitHandler(handler) {
  clozeStudyCompleteExit = typeof handler === "function" ? handler : null;
}

function escapeText(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getClozeData(session) {
  return session?.cloze && typeof session.cloze === "object" ? session.cloze : null;
}

function itemsForSignalMatch(items) {
  return items.map((item) => ({
    ...item,
    canonicalId: item.canonicalId || item.node_id || item.concept_id,
    conceptLabel: item.conceptLabel || item.label || item.blank_text,
  }));
}

/**
 * @param {object} session
 * @param {{ shared?: { assessmentSignals?: object[] } } | null} [doc]
 */
export function applyAssessmentPrioritizedOrder(session, doc = null) {
  const cloze = getClozeData(session);
  if (!cloze) return;
  const valid = getValidItems(cloze.items || []);
  if (!valid.length) return;

  const signals = Array.isArray(doc?.shared?.assessmentSignals)
    ? doc.shared.assessmentSignals
    : [];
  if (!signals.length) {
    const ids = valid.map((item) => item.id);
    shuffleInPlace(ids);
    cloze.studyOrder = ids;
    return;
  }

  const prioritized = prioritizeByAssessmentSignals(itemsForSignalMatch(valid), signals);
  cloze.studyOrder = prioritized.map((item) => item.id);
}

function buildStudyOrder(session) {
  const cloze = getClozeData(session);
  if (Array.isArray(cloze?.studyOrder) && cloze.studyOrder.length) {
    return cloze.studyOrder.slice();
  }
  const valid = getValidItems(cloze?.items || []);
  const ids = valid.map((item) => item.id);
  shuffleInPlace(ids);
  return ids;
}

function itemById(session, id) {
  const valid = getValidItems(getClozeData(session)?.items || []);
  return valid.find((item) => item.id === id) || null;
}

async function persistProgress(session) {
  const cloze = getClozeData(session);
  if (!cloze) return;
  cloze.studyIndex = activeIndex;
  cloze.studyOrder = activeOrder.slice();
  cloze.studyStats = { correct, shown };
  await storeActiveSession(session);
}

function clearAdvanceTimer() {
  if (advanceTimerId) {
    clearTimeout(advanceTimerId);
    advanceTimerId = null;
  }
}

function detachClozeStudyKeydown() {
  if (!keydownBound) return;
  document.removeEventListener("keydown", onClozeStudyKeydown);
  keydownBound = false;
}

function attachClozeStudyKeydown() {
  if (keydownBound) return;
  document.addEventListener("keydown", onClozeStudyKeydown);
  keydownBound = true;
}

function optionIndexFromLetter(letter) {
  const upper = String(letter || "").toUpperCase();
  const code = upper.charCodeAt(0);
  if (code < 65 || code > 68) return -1;
  return code - 65;
}

function onClozeStudyKeydown(e) {
  if (e.repeat || isMcTypingTarget(e.target)) return;
  const host = els.clozeStudyContent;

  if (answered) {
    if (e.key === "Enter") {
      const nextBtn = host?.querySelector("#clozeStudyNextBtn");
      if (nextBtn && !nextBtn.hidden && activeStudySession) {
        e.preventDefault();
        goToNextItem(activeStudySession);
      }
    }
    return;
  }

  const letter = letterFromMcKey(e.key);
  const idx = optionIndexFromLetter(letter);
  if (idx < 0 || idx >= shuffledOptions.length) return;
  e.preventDefault();

  const btn = host?.querySelector(`.cloze-option-btn[data-option-idx="${idx}"]`);
  if (btn && activeStudySession) handleOptionSelect(activeStudySession, host, idx);
}

function goToNextItem(session) {
  clearAdvanceTimer();
  activeIndex += 1;
  persistProgress(session);
  renderItem(session);
}

async function handleOptionSelect(session, host, idx) {
  if (answered) return;
  answered = true;
  shown += 1;

  const item = itemById(session, activeOrder[activeIndex]);
  if (!item) return;

  const chosen = shuffledOptions[idx];
  const isCorrect = Boolean(chosen?.is_correct);
  if (isCorrect) correct += 1;
  item.times_shown = (item.times_shown || 0) + 1;
  if (isCorrect) item.times_correct = (item.times_correct || 0) + 1;

  try {
    const doc = await getActiveSession();
    if (doc?.docId) {
      await registerOrUpdateSmItem(doc.docId, {
        sourceType: "cloze_item",
        sourceId: String(item.id),
        title: String(item.blank_text || item.stem || "").slice(0, 80),
        contentPreview: String(item.correct_answer || item.answer || ""),
        quality: mapClozeResultToQuality(isCorrect ? "EASY" : "FAIL"),
      });
      const conceptId = String(item.concept_id || item.conceptId || "").trim();
      if (conceptId) {
        void promoteFromCloze({
          docId: doc.docId,
          conceptId,
          quality: mapClozeResultToQuality(isCorrect ? "EASY" : "FAIL"),
        });
      }
    }
  } catch (err) {
    console.warn("[sm2-ingest] cloze ingest failed", err);
  }

  const feedback = host.querySelector("#clozeStudyFeedback");
  const nextBtn = host.querySelector("#clozeStudyNextBtn");

  host.querySelectorAll(".cloze-option-btn").forEach((b) => {
    b.disabled = true;
    const bIdx = Number(b.getAttribute("data-option-idx"));
    if (shuffledOptions[bIdx]?.is_correct) b.classList.add("cloze-option-correct");
    const selected = bIdx === idx;
    if (selected && !isCorrect) b.classList.add("cloze-option-wrong");
  });

  if (isCorrect) {
    if (feedback) feedback.hidden = true;
    if (nextBtn) nextBtn.hidden = true;
    persistProgress(session);
    advanceTimerId = setTimeout(() => goToNextItem(session), CLOZE_CORRECT_ADVANCE_MS);
    return;
  }

  if (feedback) {
    feedback.hidden = false;
    feedback.textContent = `Incorrecto — respuesta: ${item.blank_text}`;
  }
  if (nextBtn) nextBtn.hidden = false;
  persistProgress(session);
}

function renderSummary(session) {
  clearAdvanceTimer();
  detachClozeStudyKeydown();
  const host = els.clozeStudyContent;
  if (!host) return;
  host.innerHTML = `
    <h2>Sesión completada</h2>
    <p class="hint">${correct} / ${shown} correctas</p>
    <button type="button" id="clozeStudyExitBtn" class="btn-primary">Volver</button>
  `;
  host.querySelector("#clozeStudyExitBtn")?.addEventListener("click", () => {
    if (clozeStudyCompleteExit) clozeStudyCompleteExit();
    else showScreen("create");
  });
}

function renderItem(session) {
  const host = els.clozeStudyContent;
  const meta = els.clozeStudyMeta;
  if (!host) return;

  if (activeIndex >= activeOrder.length) {
    renderSummary(session);
    return;
  }

  const item = itemById(session, activeOrder[activeIndex]);
  if (!item) {
    activeIndex += 1;
    persistProgress(session);
    renderItem(session);
    return;
  }

  clearAdvanceTimer();
  activeStudySession = session;
  shuffledOptions = item.options.slice();
  shuffleInPlace(shuffledOptions);
  answered = false;

  if (meta) {
    meta.textContent = `Ítem ${activeIndex + 1} / ${activeOrder.length} · ${item.difficulty || "medium"}`;
  }

  const optionsHtml = shuffledOptions
    .map(
      (opt, idx) => `
      <button type="button" class="cloze-option-btn" data-option-idx="${idx}">
        ${renderMcOptionHtml(String.fromCharCode(65 + idx), opt.text)}
      </button>`,
    )
    .join("");

  host.innerHTML = `
    <div class="cloze-study-prompt md-content">${markdownToHtml(item.sentence_with_blank) || escapeText(item.sentence_with_blank)}</div>
    <div class="cloze-study-options" role="group" aria-label="Opciones">${optionsHtml}</div>
    <p id="clozeStudyFeedback" class="cloze-study-feedback hint" hidden aria-live="polite"></p>
    <button type="button" id="clozeStudyNextBtn" class="btn-primary" hidden>Siguiente</button>
  `;

  host.querySelectorAll(".cloze-option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-option-idx"));
      handleOptionSelect(session, host, idx);
    });
  });

  host.querySelector("#clozeStudyNextBtn")?.addEventListener("click", () => {
    goToNextItem(session);
  });
}

export async function enterClozeStudyScreen(session, doc = null) {
  if (!session?.cloze) return;
  const valid = getValidItems(session.cloze.items || []);
  if (!valid.length) return;

  if (!Array.isArray(session.cloze.studyOrder) || !session.cloze.studyOrder.length) {
    applyAssessmentPrioritizedOrder(session, doc);
    await storeActiveSession(session);
  }

  activeOrder = buildStudyOrder(session);
  activeIndex = Math.min(Number(session.cloze.studyIndex) || 0, activeOrder.length);
  const stats = session.cloze.studyStats || {};
  correct = Number(stats.correct) || 0;
  shown = Number(stats.shown) || 0;

  attachClozeStudyKeydown();
  renderItem(session);
  showScreen("clozeStudy");
}

export function wireClozeStudyHandlers() {
  els.clozeStudyBackBtn?.addEventListener("click", () => {
    clearAdvanceTimer();
    detachClozeStudyKeydown();
    showScreen("create");
  });
}

/** Concept ids for the current cloze study item (for mnemonic prefill). */
export function getActiveClozeConceptIds() {
  const session = activeStudySession;
  if (!session || !activeOrder.length) return [];
  const itemId = activeOrder[Math.min(activeIndex, activeOrder.length - 1)];
  const item = itemById(session, itemId);
  const cid = String(item?.concept_id || item?.conceptId || "").trim();
  return cid ? [cid] : [];
}
