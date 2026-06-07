import { getValidItems } from "./normalize.js?v=20260607_1";
import { storeActiveSession } from "../session.js?v=20260527_1";
import { markdownToHtml, renderMcOptionHtml } from "../markdown.js?v=20260525_1";
import { shuffleInPlace } from "../shuffle-options.js";
import { els, showScreen } from "../ui.js?v=20260525_1";

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

function escapeText(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getClozeData(session) {
  return session?.cloze && typeof session.cloze === "object" ? session.cloze : null;
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

function persistProgress(session) {
  const cloze = getClozeData(session);
  if (!cloze) return;
  cloze.studyIndex = activeIndex;
  cloze.studyOrder = activeOrder.slice();
  cloze.studyStats = { correct, shown };
  storeActiveSession(session);
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

function optionIndexFromKey(key) {
  const n = Number(key);
  if (n >= 1 && n <= 4) return n - 1;
  return -1;
}

function onClozeStudyKeydown(e) {
  if (e.repeat || answered) return;
  const tag = String(e.target?.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return;

  const idx = optionIndexFromKey(e.key);
  if (idx < 0 || idx >= shuffledOptions.length) return;
  e.preventDefault();

  const host = els.clozeStudyContent;
  const btn = host?.querySelector(`.cloze-option-btn[data-option-idx="${idx}"]`);
  if (btn && activeStudySession) handleOptionSelect(activeStudySession, host, idx);
}

function goToNextItem(session) {
  clearAdvanceTimer();
  activeIndex += 1;
  persistProgress(session);
  renderItem(session);
}

function handleOptionSelect(session, host, idx) {
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
    showScreen("create");
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

export function enterClozeStudyScreen(session) {
  if (!session?.cloze) return;
  const valid = getValidItems(session.cloze.items || []);
  if (!valid.length) return;

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
