import { getValidItems } from "./normalize.js?v=20260607_1";
import { storeActiveSession } from "../session.js?v=20260527_1";
import { markdownToHtml, renderMcOptionHtml } from "../markdown.js?v=20260525_1";
import { shuffleInPlace } from "../shuffle-options.js";
import { els, showScreen } from "../ui.js?v=20260525_1";

let activeOrder = [];
let activeIndex = 0;
let shown = 0;
let correct = 0;
let answered = false;
let shuffledOptions = [];

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

function renderSummary(session) {
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
      if (answered) return;
      answered = true;
      shown += 1;
      const idx = Number(btn.getAttribute("data-option-idx"));
      const chosen = shuffledOptions[idx];
      const isCorrect = Boolean(chosen?.is_correct);
      if (isCorrect) correct += 1;
      item.times_shown = (item.times_shown || 0) + 1;
      if (isCorrect) item.times_correct = (item.times_correct || 0) + 1;

      const feedback = host.querySelector("#clozeStudyFeedback");
      if (feedback) {
        feedback.hidden = false;
        feedback.textContent = isCorrect
          ? "Correcto"
          : `Incorrecto — respuesta: ${item.blank_text}`;
      }

      host.querySelectorAll(".cloze-option-btn").forEach((b) => {
        b.disabled = true;
        const bIdx = Number(b.getAttribute("data-option-idx"));
        if (shuffledOptions[bIdx]?.is_correct) b.classList.add("cloze-option-correct");
        if (b === btn && !isCorrect) b.classList.add("cloze-option-wrong");
      });

      const nextBtn = host.querySelector("#clozeStudyNextBtn");
      if (nextBtn) nextBtn.hidden = false;
      persistProgress(session);
    });
  });

  host.querySelector("#clozeStudyNextBtn")?.addEventListener("click", () => {
    activeIndex += 1;
    persistProgress(session);
    renderItem(session);
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

  renderItem(session);
  showScreen("clozeStudy");
}

export function wireClozeStudyHandlers() {
  els.clozeStudyBackBtn?.addEventListener("click", () => {
    showScreen("create");
  });
}
