import { storeActiveSession } from "../session.js?v=20260527_1";
import { els, showScreen } from "../ui.js?v=20260525_1";
import { maybeScheduleCheckpoint, clearCheckpointTimer } from "./checkpoints.js?v=20260528_1";
import { matchConceptFindings } from "./gamification.js?v=20260528_1";
import { askSlowReaderIA } from "./ai-context.js?v=20260528_1";
import {
  annotationsOnPage,
  annotationMarkClass,
  visibleAnnotationTypes,
  addAnnotation,
} from "./annotations.js?v=20260528_1";
import { initPhase3Screen } from "./phase3.js?v=20260528_1";
import {
  charOffsetToPage,
  closestPageAfterRecompute,
  computePageBreakpoints,
  getPageCount,
  getPageSlice,
  invalidatePaginationCache,
} from "./pagination.js?v=20260528_1";

let readerState = {
  breakpoints: [],
  debounceTimer: null,
};

export function getScopeText(session) {
  const slow = session?.slow;
  if (!slow) return "";
  const full = String(slow.normalizedTextFull || "");
  const scope = slow.readingScope;
  if (!scope) return full;
  const start = Math.max(0, Number(scope.charStart) || 0);
  const end = Math.min(full.length, Number(scope.charEnd) || full.length);
  return full.slice(start, end);
}

export function navigateSlowByPhase(session) {
  const phase = String(session?.slow?.phase || "scope").trim();
  switch (phase) {
    case "scope":
      showScreen("slowScope");
      break;
    case "phase0":
      showScreen("slowPhase0");
      break;
    case "phase1":
    case "phase2":
      showScreen("slowReader");
      break;
    case "phase3":
    case "complete":
      showScreen("slowPhase3");
      break;
    default:
      showScreen("slowScope");
  }
}

function applyTypographyToPage(session) {
  const pageEl = els.slowReaderPage || document.getElementById("slowReaderPage");
  const t = session?.slow?.typography || {};
  if (!pageEl) return;
  pageEl.style.fontSize = `${Number(t.fontSizePx) || 18}px`;
  pageEl.style.lineHeight = String(Number(t.lineHeight) || 1.6);
  pageEl.style.fontFamily = String(t.fontFamily || '"DM Sans", sans-serif');
}

function recomputeBreakpoints(session) {
  const scopeText = getScopeText(session);
  const container = els.slowReaderPage || document.getElementById("slowReaderPage");
  if (!container) return [];
  const oldBp = readerState.breakpoints;
  const oldPage = Number(session?.slow?.currentPageIndex) || 0;
  readerState.breakpoints = computePageBreakpoints(scopeText, container, session.slow.typography);
  if (oldBp.length && session?.slow) {
    session.slow.currentPageIndex = closestPageAfterRecompute(oldBp, oldPage, readerState.breakpoints);
  }
  return readerState.breakpoints;
}

function updateMaxReadCharEnd(session) {
  const bp = getPageSlice(readerState.breakpoints, session.slow.currentPageIndex);
  session.slow.maxReadCharEnd = Math.max(Number(session.slow.maxReadCharEnd) || 0, bp.charEnd);
}

function renderProgress(session) {
  const total = getPageCount(readerState.breakpoints);
  const idx = Number(session?.slow?.currentPageIndex) || 0;
  const fill = document.getElementById("slowReaderProgressFill");
  if (fill) fill.style.width = total ? `${((idx + 1) / total) * 100}%` : "0%";
}

function renderMarginMarks(session, pageSlice) {
  const margin = els.slowReaderMargin || document.getElementById("slowReaderMargin");
  if (!margin) return;
  margin.innerHTML = "";
  const anns = annotationsOnPage(session.slow.annotations, pageSlice);
  for (const a of anns) {
    const mark = document.createElement("span");
    mark.className = `annotation-mark annotation-mark--${annotationMarkClass(a.type)}`;
    mark.textContent = a.type;
    mark.title = a.userText || a.type;
    margin.appendChild(mark);
  }
}

export function renderSlowReaderPage(session) {
  if (!session?.slow) return;
  applyTypographyToPage(session);
  recomputeBreakpoints(session);
  const idx = Math.max(0, Number(session.slow.currentPageIndex) || 0);
  const slice = getPageSlice(readerState.breakpoints, idx);
  const scopeText = getScopeText(session);
  const pageEl = els.slowReaderPage || document.getElementById("slowReaderPage");
  if (pageEl) pageEl.textContent = scopeText.slice(slice.charStart, slice.charEnd);
  updateMaxReadCharEnd(session);
  renderProgress(session);
  renderMarginMarks(session, slice);
  maybeScheduleCheckpoint(session, readerState.breakpoints, idx, () => renderSlowReaderPage(session));
  storeActiveSession(session);
}

export function goToReaderPage(session, pageIndex) {
  const total = getPageCount(readerState.breakpoints);
  const idx = Math.min(Math.max(0, Math.floor(Number(pageIndex) || 0)), Math.max(0, total - 1));
  session.slow.currentPageIndex = idx;
  renderSlowReaderPage(session);
}

function selectionToScopeOffsets(session) {
  const sel = window.getSelection?.();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const pageEl = els.slowReaderPage;
  if (!pageEl || !pageEl.contains(sel.anchorNode)) return null;
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(pageEl);
  pre.setEnd(range.startContainer, range.startOffset);
  const startInPage = pre.toString().length;
  const selected = range.toString().length;
  const slice = getPageSlice(readerState.breakpoints, session.slow.currentPageIndex);
  return {
    charStart: slice.charStart + startInPage,
    charEnd: slice.charStart + startInPage + selected,
  };
}

function showAnnotationMenu(session, offsets) {
  let menu = document.getElementById("slowAnnotationMenu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "slowAnnotationMenu";
    menu.className = "slow-annotation-menu";
    document.body.appendChild(menu);
  }
  menu.innerHTML = "";
  const types = visibleAnnotationTypes(session.slow.criticalMode);
  for (const t of types) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${t.symbol} ${t.label}`;
    btn.addEventListener("click", async () => {
      const text = window.prompt("Nota (opcional):") ?? "";
      const ann = addAnnotation(session, { type: t.symbol, ...offsets, userText: text });
      menu.hidden = true;
      if (ann) matchConceptFindings(session, ann);
      if (t.symbol === "⚑" || t.symbol === "⇑") {
        try {
          const reply = await askSlowReaderIA(session, text || "Explica este fragmento", {
            annotationType: t.symbol,
          });
          ann.aiReply = reply;
        } catch {
          // ignore IA errors in annotation flow
        }
      }
      renderSlowReaderPage(session);
    });
    menu.appendChild(btn);
  }
  menu.hidden = false;
}

let wired = false;

export function initSlowReader(session) {
  if (!session?.slow) return;
  session.slow.phase = session.slow.phase === "phase2" ? session.slow.phase : "phase1";
  if (!session.slow.typography) {
    session.slow.typography = { fontSizePx: 18, lineHeight: 1.6, fontFamily: '"DM Sans", sans-serif' };
  }

  renderSlowReaderPage(session);

  if (wired) return;
  wired = true;

  els.slowReaderPrevBtn?.addEventListener("click", () => {
    goToReaderPage(stateSession(), (stateSession()?.slow?.currentPageIndex || 0) - 1);
  });
  els.slowReaderNextBtn?.addEventListener("click", () => {
    goToReaderPage(stateSession(), (stateSession()?.slow?.currentPageIndex || 0) + 1);
  });

  els.slowFocusModeBtn?.addEventListener("click", () => {
    const layout = document.getElementById("slowReaderLayout");
    const pressed = els.slowFocusModeBtn.getAttribute("aria-pressed") === "true";
    const next = !pressed;
    els.slowFocusModeBtn.setAttribute("aria-pressed", String(next));
    layout?.classList.toggle("focus-mode", next);
  });

  els.slowReaderCompleteBtn?.addEventListener("click", () => {
    const s = stateSession();
    if (!s?.slow) return;
    clearCheckpointTimer();
    s.slow.phase = "phase3";
    storeActiveSession(s);
    showScreen("slowPhase3");
    void initPhase3Screen(s, document.getElementById("slowPhase3Content"));
  });

  els.slowReaderPage?.addEventListener("mouseup", () => {
    const s = stateSession();
    const offsets = selectionToScopeOffsets(s);
    if (offsets && offsets.charEnd > offsets.charStart) showAnnotationMenu(s, offsets);
  });

  let touchStartX = 0;
  els.slowReaderPage?.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches?.[0]?.clientX || 0;
  }, { passive: true });
  els.slowReaderPage?.addEventListener("touchend", (e) => {
    const dx = (e.changedTouches?.[0]?.clientX || 0) - touchStartX;
    if (Math.abs(dx) < 40) return;
    const s = stateSession();
    if (dx < 0) goToReaderPage(s, (s?.slow?.currentPageIndex || 0) + 1);
    else goToReaderPage(s, (s?.slow?.currentPageIndex || 0) - 1);
  }, { passive: true });

  document.getElementById("slowFontSmallerBtn")?.addEventListener("click", () => {
    const s = stateSession();
    if (!s?.slow?.typography) return;
    s.slow.typography.fontSizePx = Math.max(14, (s.slow.typography.fontSizePx || 18) - 2);
    invalidatePaginationCache();
    clearTimeout(readerState.debounceTimer);
    readerState.debounceTimer = setTimeout(() => renderSlowReaderPage(s), 150);
  });
  document.getElementById("slowFontLargerBtn")?.addEventListener("click", () => {
    const s = stateSession();
    if (!s?.slow?.typography) return;
    s.slow.typography.fontSizePx = Math.min(28, (s.slow.typography.fontSizePx || 18) + 2);
    invalidatePaginationCache();
    clearTimeout(readerState.debounceTimer);
    readerState.debounceTimer = setTimeout(() => renderSlowReaderPage(s), 150);
  });
}

/** @type {null | (() => object|null)} */
let sessionGetter = null;

export function setSlowSessionGetter(fn) {
  sessionGetter = typeof fn === "function" ? fn : null;
}

function stateSession() {
  return sessionGetter ? sessionGetter() : null;
}

export { charOffsetToPage, getPageSlice };
