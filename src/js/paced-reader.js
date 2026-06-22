import { LS_RSVP_READING_MODE_KEY } from "./config.js?v=20260622_10";
import { markdownToHtml } from "./markdown.js?v=20260622_10";
import { els, hideSidebar, showSidebar, typesetMath } from "./ui.js?v=20260622_10";
import {
  computePageBreakpoints,
  getPageCount,
  getPageSlice,
  invalidatePaginationCache,
} from "./slow/pagination.js?v=20260622_10";

const TYPO_DEFAULTS = {
  fontSizePx: 16,
  lineHeight: 1.5,
  fontFamily: '"DM Sans", sans-serif',
};

export const pacedReaderState = {
  sourceText: "",
  blockTitle: "",
  currentPageIndex: 0,
  typography: { ...TYPO_DEFAULTS },
  breakpoints: [],
  contentHeightUsed: 0,
  onDone: null,
  debounceTimer: null,
};

let handlersWired = false;
let pacedMeasureHost = null;

export function loadReadingModePref() {
  try {
    const v = localStorage.getItem(LS_RSVP_READING_MODE_KEY);
    return v === "paced" ? "paced" : "rsvp";
  } catch {
    return "rsvp";
  }
}

export function isPacedReaderPreferred() {
  return loadReadingModePref() === "paced";
}

export function setReadingModePref(mode) {
  const next = mode === "paced" ? "paced" : "rsvp";
  try {
    localStorage.setItem(LS_RSVP_READING_MODE_KEY, next);
  } catch {
    // ignore storage errors
  }
  return next;
}

export function setPacedReaderOverlayActive(isActive) {
  if (els.pacedReaderOverlay) {
    els.pacedReaderOverlay.setAttribute("aria-hidden", String(!isActive));
  }
  document.body.classList.toggle("paced-reader-active", isActive);
}

export function isPacedReaderActive() {
  return els.pacedReaderOverlay?.getAttribute("aria-hidden") === "false";
}

function applyTypographyToPage() {
  const pageEl = els.pacedReaderPage;
  if (!pageEl) return;
  const t = pacedReaderState.typography;
  pageEl.style.fontSize = `${Number(t.fontSizePx) || TYPO_DEFAULTS.fontSizePx}px`;
  pageEl.style.lineHeight = String(Number(t.lineHeight) || TYPO_DEFAULTS.lineHeight);
  pageEl.style.fontFamily = String(t.fontFamily || TYPO_DEFAULTS.fontFamily);
}

function getContentHeight() {
  const minSensible = Math.max(160, Math.floor(window.innerHeight * 0.35));
  const content = document.querySelector(".paced-reader-content");
  if (content && content.clientHeight >= minSensible) return content.clientHeight;

  const main = document.querySelector(".paced-reader-main");
  const toolbar = document.querySelector(".paced-reader-toolbar");
  if (main && toolbar) {
    const style = window.getComputedStyle(main);
    const padTop = parseFloat(style.paddingTop) || 0;
    const padBottom = parseFloat(style.paddingBottom) || 0;
    const gap = parseFloat(style.rowGap || style.gap) || 12;
    const derived = main.clientHeight - toolbar.offsetHeight - padTop - padBottom - gap;
    if (derived >= minSensible) return derived;
  }

  return Math.max(300, window.innerHeight - 160);
}

function resolvePacedColumnWidth(pageEl) {
  const measured = Math.max(
    Number(pageEl?.clientWidth) || 0,
    Number(pageEl?.closest?.(".paced-reader-page-wrap")?.clientWidth) || 0,
    Number(document.querySelector(".paced-reader-main")?.clientWidth) || 0,
  );
  if (measured >= 120) return Math.min(measured, 68 * 16);
  return Math.min(Math.max(280, window.innerWidth - 48), 68 * 16);
}

function ensurePacedMeasureHost(columnWidth) {
  if (!pacedMeasureHost) {
    pacedMeasureHost = document.createElement("div");
    pacedMeasureHost.setAttribute("data-paced-measure-host", "1");
    pacedMeasureHost.style.position = "absolute";
    pacedMeasureHost.style.visibility = "hidden";
    pacedMeasureHost.style.pointerEvents = "none";
    pacedMeasureHost.style.left = "-9999px";
    pacedMeasureHost.style.top = "0";
    pacedMeasureHost.style.boxSizing = "border-box";
    document.body.appendChild(pacedMeasureHost);
  }
  pacedMeasureHost.style.width = `${Math.max(200, Math.floor(Number(columnWidth) || 0))}px`;
  return pacedMeasureHost;
}

function buildMeasureContent(typography, columnWidth) {
  const widthPx = Math.max(200, Math.floor(Number(columnWidth) || 0));
  return (el, slice) => {
    el.className = "md-content";
    el.style.fontSize = `${Number(typography.fontSizePx) || TYPO_DEFAULTS.fontSizePx}px`;
    el.style.lineHeight = String(Number(typography.lineHeight) || TYPO_DEFAULTS.lineHeight);
    el.style.fontFamily = String(typography.fontFamily || TYPO_DEFAULTS.fontFamily);
    el.style.whiteSpace = "normal";
    el.style.wordBreak = "break-word";
    el.style.width = `${widthPx}px`;
    el.style.height = "auto";
    el.style.overflow = "visible";
    el.style.boxSizing = "border-box";
    el.innerHTML = markdownToHtml(slice);
  };
}

function recomputeBreakpoints() {
  const text = String(pacedReaderState.sourceText || "");
  const pageEl = els.pacedReaderPage;
  if (!pageEl) return [];
  const oldPage = pacedReaderState.currentPageIndex;
  const columnWidth = resolvePacedColumnWidth(pageEl);
  const measureContainer = ensurePacedMeasureHost(columnWidth);
  const contentHeight = getContentHeight();
  pacedReaderState.contentHeightUsed = contentHeight;
  pacedReaderState.breakpoints = computePageBreakpoints(
    text,
    measureContainer,
    pacedReaderState.typography,
    {
      availableHeight: contentHeight,
      measureMode: "md-paced",
      measureContent: buildMeasureContent(pacedReaderState.typography, columnWidth),
    },
  );
  const total = getPageCount(pacedReaderState.breakpoints);
  pacedReaderState.currentPageIndex = Math.min(
    Math.max(0, oldPage),
    Math.max(0, total - 1),
  );
  return pacedReaderState.breakpoints;
}

function renderTypographyLabels() {
  const t = pacedReaderState.typography;
  const fontSize = Number(t.fontSizePx) || TYPO_DEFAULTS.fontSizePx;
  const lineHeight = Number(t.lineHeight) || TYPO_DEFAULTS.lineHeight;
  if (els.pacedFontSizeLabel) els.pacedFontSizeLabel.textContent = String(fontSize);
  if (els.pacedLineHeightLabel) els.pacedLineHeightLabel.textContent = lineHeight.toFixed(1);
}

function renderProgress() {
  const total = getPageCount(pacedReaderState.breakpoints);
  const idx = pacedReaderState.currentPageIndex;
  if (els.pacedReaderPageIndicator) {
    if (!total) els.pacedReaderPageIndicator.textContent = "—";
    else if (total === 1) els.pacedReaderPageIndicator.textContent = "1 page";
    else els.pacedReaderPageIndicator.textContent = `Page ${idx + 1} of ${total}`;
  }
}

function syncBlockTitle() {
  const title = String(pacedReaderState.blockTitle || "").trim();
  if (els.pacedReaderBlockTitle) {
    els.pacedReaderBlockTitle.textContent = title;
    els.pacedReaderBlockTitle.hidden = !title;
  }
}

export function renderPacedReaderPage(opts = {}) {
  applyTypographyToPage();
  recomputeBreakpoints();
  const idx = pacedReaderState.currentPageIndex;
  const slice = getPageSlice(pacedReaderState.breakpoints, idx);
  const text = String(pacedReaderState.sourceText || "");
  const slicePlain = text.slice(slice.charStart, slice.charEnd);
  const pageEl = els.pacedReaderPage;
  if (pageEl) {
    pageEl.classList.add("md-content");
    pageEl.innerHTML = markdownToHtml(slicePlain);
    void typesetMath(pageEl);
  }
  renderProgress();
  renderTypographyLabels();
  syncBlockTitle();

  if (!opts.skipLayoutRetry && isPacedReaderActive()) {
    requestAnimationFrame(() => {
      const h = getContentHeight();
      if (h > 50 && Math.abs(h - pacedReaderState.contentHeightUsed) > 4) {
        invalidatePaginationCache();
        renderPacedReaderPage({ skipLayoutRetry: true });
      }
    });
  }
}

function goToPage(pageIndex) {
  const total = getPageCount(pacedReaderState.breakpoints);
  pacedReaderState.currentPageIndex = Math.min(
    Math.max(0, Math.floor(Number(pageIndex) || 0)),
    Math.max(0, total - 1),
  );
  renderPacedReaderPage();
}

function applyTypographyChange(changes) {
  Object.assign(pacedReaderState.typography, changes);
  invalidatePaginationCache();
  clearTimeout(pacedReaderState.debounceTimer);
  pacedReaderState.debounceTimer = setTimeout(() => renderPacedReaderPage(), 150);
}

export function finishPacedRead({ skipCallback = false } = {}) {
  clearTimeout(pacedReaderState.debounceTimer);
  pacedReaderState.debounceTimer = null;
  pacedReaderState.breakpoints = [];
  if (els.pacedReaderPage) els.pacedReaderPage.innerHTML = "";
  setPacedReaderOverlayActive(false);
  showSidebar();
  const done = pacedReaderState.onDone;
  pacedReaderState.onDone = null;
  if (!skipCallback && typeof done === "function") done();
}

export function startPacedReadForText(explanationText, { title = "", onDone } = {}) {
  pacedReaderState.sourceText =
    explanationText !== undefined && explanationText !== null ? String(explanationText) : "";
  pacedReaderState.blockTitle = title ? String(title) : "";
  pacedReaderState.currentPageIndex = 0;
  pacedReaderState.onDone = onDone;
  if (!pacedReaderState.typography) pacedReaderState.typography = { ...TYPO_DEFAULTS };

  hideSidebar();
  setPacedReaderOverlayActive(true);
  syncBlockTitle();
  invalidatePaginationCache();
  requestAnimationFrame(() => renderPacedReaderPage());
}

export function wirePacedReaderHandlers({ onSwitchToRsvp } = {}) {
  if (handlersWired) return;
  handlersWired = true;

  els.pacedReaderPrevBtn?.addEventListener("click", () => {
    goToPage(pacedReaderState.currentPageIndex - 1);
  });
  els.pacedReaderNextBtn?.addEventListener("click", () => {
    goToPage(pacedReaderState.currentPageIndex + 1);
  });
  els.pacedReaderContinueBtn?.addEventListener("click", () => finishPacedRead());
  els.pacedSwitchToRsvpBtn?.addEventListener("click", () => {
    if (typeof onSwitchToRsvp === "function") onSwitchToRsvp();
  });

  els.pacedFontSmallerBtn?.addEventListener("click", () => {
    const next = Math.max(12, (Number(pacedReaderState.typography.fontSizePx) || 16) - 1);
    applyTypographyChange({ fontSizePx: next });
  });
  els.pacedFontLargerBtn?.addEventListener("click", () => {
    const next = Math.min(24, (Number(pacedReaderState.typography.fontSizePx) || 16) + 1);
    applyTypographyChange({ fontSizePx: next });
  });
  els.pacedLineSmallerBtn?.addEventListener("click", () => {
    const next = Math.max(1.2, (Number(pacedReaderState.typography.lineHeight) || 1.5) - 0.1);
    applyTypographyChange({ lineHeight: Math.round(next * 10) / 10 });
  });
  els.pacedLineLargerBtn?.addEventListener("click", () => {
    const next = Math.min(2.2, (Number(pacedReaderState.typography.lineHeight) || 1.5) + 0.1);
    applyTypographyChange({ lineHeight: Math.round(next * 10) / 10 });
  });

  document.addEventListener("keydown", (e) => {
    if (!isPacedReaderActive()) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goToPage(pacedReaderState.currentPageIndex - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goToPage(pacedReaderState.currentPageIndex + 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finishPacedRead();
    }
  });

  window.addEventListener("resize", () => {
    if (!isPacedReaderActive()) return;
    clearTimeout(pacedReaderState.debounceTimer);
    pacedReaderState.debounceTimer = setTimeout(() => renderPacedReaderPage(), 150);
  });
}
