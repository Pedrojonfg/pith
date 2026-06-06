import { storeActiveSession } from "../session.js?v=20260527_1";
import { els, showScreen } from "../ui.js?v=20260525_1";
import { maybeScheduleCheckpoint, clearCheckpointTimer } from "./checkpoints.js?v=20260528_1";
import { matchConceptFindings } from "./gamification.js?v=20260528_1";
import { askSlowReaderIA } from "./ai-context.js?v=20260528_1";
import {
  ANNOTATION_TYPES,
  annotationsOnPage,
  annotationMarkClass,
  visibleAnnotationTypes,
  findAnnotationTypeByHotkey,
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
  pendingSelection: null,
  menuShowSecondary: false,
  noteDraft: null,
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
  hideAnnotationMenu();
  readerState.pendingSelection = null;
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
  if (selected <= 0) return null;
  const slice = getPageSlice(readerState.breakpoints, session.slow.currentPageIndex);
  return {
    charStart: slice.charStart + startInPage,
    charEnd: slice.charStart + startInPage + selected,
    selectedText: range.toString(),
    rect: range.getBoundingClientRect(),
  };
}

function isSlowReaderActive() {
  return els.screenSlowReader?.getAttribute("aria-hidden") === "false";
}

function ensureAnnotationMenu() {
  let menu = document.getElementById("slowAnnotationMenu");
  if (menu) return menu;
  menu = document.createElement("div");
  menu.id = "slowAnnotationMenu";
  menu.className = "slow-annotation-menu";
  menu.hidden = true;
  menu.innerHTML = `
    <div class="slow-annotation-types" role="toolbar" aria-label="Annotation types"></div>
    <div class="slow-annotation-note" hidden>
      <label class="slow-annotation-note-label"></label>
      <input type="text" class="slow-annotation-note-input" placeholder="Nota (opcional) — Enter para guardar" spellcheck="true" />
    </div>
    <p class="slow-annotation-hint">Pulsa 1–9 para marcar · Esc cancelar</p>
  `;
  document.body.appendChild(menu);
  return menu;
}

function positionAnnotationMenu(menu, rect) {
  if (!menu || !rect) return;
  menu.hidden = false;
  menu.style.visibility = "hidden";
  menu.style.top = "0";
  menu.style.left = "0";
  const pad = 10;
  const anchor = rect.width || rect.height ? rect : { top: 120, bottom: 140, left: window.innerWidth / 2, width: 0, height: 0 };
  const menuRect = menu.getBoundingClientRect();
  let top = anchor.bottom + pad;
  let left = anchor.left + anchor.width / 2 - menuRect.width / 2;
  if (top + menuRect.height > window.innerHeight - 12) {
    top = anchor.top - menuRect.height - pad;
  }
  left = Math.max(12, Math.min(left, window.innerWidth - menuRect.width - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - menuRect.height - 12));
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
  menu.style.visibility = "";
}

function hideAnnotationMenu() {
  const menu = document.getElementById("slowAnnotationMenu");
  if (!menu) return;
  menu.hidden = true;
  readerState.noteDraft = null;
  const notePanel = menu.querySelector(".slow-annotation-note");
  const typesPanel = menu.querySelector(".slow-annotation-types");
  notePanel?.setAttribute("hidden", "");
  typesPanel?.removeAttribute("hidden");
  menu.querySelector(".slow-annotation-hint")?.removeAttribute("hidden");
}

function syncPendingSelection(session) {
  if (!session?.slow || readerState.noteDraft) return;
  const captured = selectionToScopeOffsets(session);
  if (!captured) {
    readerState.pendingSelection = null;
    hideAnnotationMenu();
    return;
  }
  readerState.pendingSelection = captured;
  showAnnotationMenu(session, captured);
}

function renderAnnotationTypeButtons(session, menu) {
  const typesPanel = menu.querySelector(".slow-annotation-types");
  if (!typesPanel) return;
  typesPanel.innerHTML = "";
  const types = visibleAnnotationTypes(session.slow.criticalMode, {
    showSecondary: readerState.menuShowSecondary,
  });
  for (const t of types) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slow-annotation-type-btn";
    btn.dataset.hotkey = t.hotkey;
    btn.title = `${t.label} (${t.hotkey})`;
    btn.innerHTML = `<span class="slow-annotation-kbd">${t.hotkey}</span><span class="slow-annotation-symbol">${t.symbol}</span><span class="slow-annotation-label">${t.label}</span>`;
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => beginAnnotationNote(session, t));
    typesPanel.appendChild(btn);
  }
  const hasSecondary = ANNOTATION_TYPES.some((t) => t.tier === "secondary");
  if (hasSecondary && !readerState.menuShowSecondary) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "slow-annotation-type-btn slow-annotation-more-btn";
    more.textContent = "···";
    more.title = "Más tipos";
    more.addEventListener("mousedown", (e) => e.preventDefault());
    more.addEventListener("click", () => {
      readerState.menuShowSecondary = true;
      showAnnotationMenu(session, readerState.pendingSelection);
    });
    typesPanel.appendChild(more);
  }
  const hint = menu.querySelector(".slow-annotation-hint");
  if (hint && types.length) {
    const keys = types.map((t) => t.hotkey).join(" · ");
    hint.textContent = `Pulsa ${keys} para marcar · Esc cancelar`;
  }
}

function showAnnotationMenu(session, selection) {
  if (!selection || !session?.slow) return;
  const menu = ensureAnnotationMenu();
  renderAnnotationTypeButtons(session, menu);
  const notePanel = menu.querySelector(".slow-annotation-note");
  notePanel?.setAttribute("hidden", "");
  menu.querySelector(".slow-annotation-types")?.removeAttribute("hidden");
  menu.querySelector(".slow-annotation-hint")?.removeAttribute("hidden");
  positionAnnotationMenu(menu, selection.rect);
}

function beginAnnotationNote(session, typeDef) {
  if (!session?.slow || !readerState.pendingSelection || !typeDef) return;
  const menu = ensureAnnotationMenu();
  readerState.noteDraft = {
    type: typeDef.symbol,
    offsets: {
      charStart: readerState.pendingSelection.charStart,
      charEnd: readerState.pendingSelection.charEnd,
    },
  };
  menu.querySelector(".slow-annotation-types")?.setAttribute("hidden", "");
  menu.querySelector(".slow-annotation-hint")?.setAttribute("hidden", "");
  const notePanel = menu.querySelector(".slow-annotation-note");
  const label = menu.querySelector(".slow-annotation-note-label");
  const input = menu.querySelector(".slow-annotation-note-input");
  if (!notePanel || !label || !input) return;
  label.textContent = `${typeDef.symbol} ${typeDef.label}`;
  input.value = "";
  notePanel.hidden = false;
  positionAnnotationMenu(menu, readerState.pendingSelection.rect);
  input.focus();
}

async function commitAnnotation(session, typeDef, offsets, userText) {
  if (!session?.slow || !typeDef || !offsets) return;
  const ann = addAnnotation(session, {
    type: typeDef.symbol,
    charStart: offsets.charStart,
    charEnd: offsets.charEnd,
    userText,
  });
  hideAnnotationMenu();
  readerState.pendingSelection = null;
  window.getSelection?.()?.removeAllRanges?.();
  if (ann) matchConceptFindings(session, ann);
  if (typeDef.symbol === "⚑" || typeDef.symbol === "⇑") {
    try {
      const reply = await askSlowReaderIA(session, userText || "Explica este fragmento", {
        annotationType: typeDef.symbol,
      });
      ann.aiReply = reply;
    } catch {
      // ignore IA errors in annotation flow
    }
  }
  renderSlowReaderPage(session);
}

function tryHotkeyAnnotation(session, key) {
  if (!readerState.pendingSelection || readerState.noteDraft) return false;
  const typeDef =
    findAnnotationTypeByHotkey(key, session.slow.criticalMode, {
      showSecondary: readerState.menuShowSecondary,
    }) ||
    findAnnotationTypeByHotkey(key, session.slow.criticalMode, { showSecondary: true });
  if (!typeDef) return false;
  beginAnnotationNote(session, typeDef);
  return true;
}

function onSlowReaderKeydown(e) {
  if (!isSlowReaderActive()) return;
  const session = stateSession();
  if (!session?.slow) return;

  const menu = document.getElementById("slowAnnotationMenu");
  const noteInput = menu?.querySelector(".slow-annotation-note-input");
  const inNoteInput = noteInput && document.activeElement === noteInput;

  if (inNoteInput) {
    if (e.key === "Enter") {
      e.preventDefault();
      const draft = readerState.noteDraft;
      if (!draft) return;
      const typeDef = ANNOTATION_TYPES.find((t) => t.symbol === draft.type);
      void commitAnnotation(session, typeDef, draft.offsets, noteInput.value.trim());
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      readerState.noteDraft = null;
      showAnnotationMenu(session, readerState.pendingSelection);
      return;
    }
    return;
  }

  if (e.key === "Escape") {
    if (!menu || menu.hidden) return;
    e.preventDefault();
    hideAnnotationMenu();
    readerState.pendingSelection = null;
    return;
  }

  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!readerState.pendingSelection) return;

  const key = e.key.length === 1 ? e.key.toLowerCase() : "";
  if (!key) return;
  if (tryHotkeyAnnotation(session, key)) {
    e.preventDefault();
  }
}

function onSlowReaderSelectionChange() {
  if (!isSlowReaderActive() || readerState.noteDraft) return;
  syncPendingSelection(stateSession());
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
    syncPendingSelection(stateSession());
  });

  document.addEventListener("selectionchange", onSlowReaderSelectionChange);
  document.addEventListener("keydown", onSlowReaderKeydown);

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

  window.addEventListener("resize", () => {
    const s = stateSession();
    if (!s?.slow || els.screenSlowReader?.getAttribute("aria-hidden") !== "false") return;
    invalidatePaginationCache();
    clearTimeout(readerState.debounceTimer);
    readerState.debounceTimer = setTimeout(() => renderSlowReaderPage(s), 200);
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
