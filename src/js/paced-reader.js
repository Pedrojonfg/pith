import { LS_RSVP_READING_MODE_KEY } from "./config.js?v=20260527_1";
import { markdownToHtml } from "./markdown.js?v=20260525_1";
import { els, hideSidebar, showSidebar, typesetMath } from "./ui.js?v=20260525_1";
import {
  computePageBreakpoints,
  getPageCount,
  getPageSlice,
  invalidatePaginationCache,
} from "./slow/pagination.js?v=20260528_1";

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
  const content = document.querySelector(".paced-reader-content");
  if (content && content.clientHeight > 50) return content.clientHeight;

  const main = document.querySelector(".paced-reader-main");
  const toolbar = document.querySelector(".paced-reader-toolbar");
  if (main && toolbar) {
    const style = window.getComputedStyle(main);
    const padTop = parseFloat(style.paddingTop) || 0;
    const padBottom = parseFloat(style.paddingBottom) || 0;
    const gap = parseFloat(style.rowGap || style.gap) || 12;
    return Math.max(100, main.clientHeight - toolbar.offsetHeight - padTop - padBottom - gap);
  }

  return Math.max(300, window.innerHeight - 160);
}

function buildMeasureContent(typography) {
  return (el, slice) => {
    el.className = "slow-reader-page md-content";
    el.style.fontSize = `${Number(typography.fontSizePx) || TYPO_DEFAULTS.fontSizePx}px`;
    el.style.lineHeight = String(Number(typography.lineHeight) || TYPO_DEFAULTS.lineHeight);
    el.style.fontFamily = String(typography.fontFamily || TYPO_DEFAULTS.fontFamily);
    el.style.whiteSpace = "normal";
    el.style.wordBreak = "break-word";
    el.style.width = "100%";
    el.style.boxSizing = "border-box";
    el.innerHTML = markdownToHtml(slice);
  };
}

function recomputeBreakpoints() {
  const text = String(pacedReaderState.sourceText || "");
  const pageEl = els.pacedReaderPage;
  if (!pageEl) return [];
  const oldPage = pacedReaderState.currentPageIndex;
  const contentHeight = getContentHeight();
  pacedReaderState.contentHeightUsed = contentHeight;
  pacedReaderState.breakpoints = computePageBreakpoints(text, pageEl, pacedReaderState.typography, {
    availableHeight: contentHeight,
    measureMode: "md",
    measureContent: buildMeasureContent(pacedReaderState.typography),
  });
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
  renderPacedReaderPage();
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
