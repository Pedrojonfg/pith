import { storeActiveSession } from "../session.js?v=20260622_5";
import { markdownToHtml } from "../markdown.js?v=20260622_5";
import {
  buildConceptSpanIndex,
  selectHighlightSpans,
  wrapPlainTextWithPedagogyMarks,
} from "../pedagogy/concept-span-index.js";
import { getPedagogicalFlags } from "../config/flags.js";
import { els, showScreen } from "../ui.js?v=20260622_5";
import { maybeScheduleCheckpoint, hideCheckpointChip } from "./checkpoints.js?v=20260622_5";
import { matchConceptFindings } from "./gamification.js?v=20260622_5";
import { fillBlankFromAnnotation } from "./phase0.js?v=20260622_5";
import { askSlowReaderIA } from "./ai-context.js?v=20260622_5";
import {
  ANNOTATION_TYPES,
  annotationsOnPage,
  annotationHighlightClass,
  annotationMarkClass,
  buildAnnotationHighlightSegments,
  createNestedHighlightSpans,
  pickPrimaryAnnotation,
  visibleAnnotationTypes,
  findAnnotationTypeByHotkey,
  addAnnotation,
  addIAQueryAnnotation,
  addGraphLink,
  addLiteratureGraphLink,
  deleteAnnotation,
  findAnnotation,
  isIAQueryAnnotation,
  shouldShowSteelManNudge,
  updateAnnotation,
} from "./annotations.js?v=20260622_5";
import { extractWordAtOffset, getSortedSessionConcepts, lookupSessionTerm } from "../dictionary.js?v=20260622_5";
import { initPhase3Screen } from "./phase3.js?v=20260622_5";
import {
  charOffsetToPage,
  closestPageAfterRecompute,
  computePageBreakpoints,
  getPageCount,
  getPageSlice,
  invalidatePaginationCache,
} from "./pagination.js?v=20260622_5";
import { flattenHierarchy } from "../normalization/hierarchy.js?v=20260622_5";
import { renderSlowMarkdownWithImages } from "../document-images/render.js";
import { replacePithImageTokens } from "../document-images/replace-tokens.js";
import {
  hideConceptPicker,
  renderSlowSidebar,
  setAnnotationNavigator,
  showConceptPicker,
  wireSidebarToggle,
  wireSidebarIAInput,
  setIAReplyViewer,
} from "./sidebar.js?v=20260622_5";

const LONG_PRESS_MS = 500;

const SLOW_TYPO_DEFAULTS = {
  fontSizePx: 15,
  lineHeight: 1.4,
  fontFamily: '"DM Sans", sans-serif',
};

let readerState = {
  breakpoints: [],
  contentHeightUsed: 0,
  debounceTimer: null,
  pendingSelection: null,
  menuShowSecondary: false,
  noteDraft: null,
  iaOverlayOpen: false,
  iaOverlayTouchStartY: 0,
  steelManNudgeOpen: false,
  longPressTimer: null,
  longPressFired: false,
  editDraft: null,
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
  pageEl.style.fontSize = `${Number(t.fontSizePx) || SLOW_TYPO_DEFAULTS.fontSizePx}px`;
  pageEl.style.lineHeight = String(Number(t.lineHeight) || SLOW_TYPO_DEFAULTS.lineHeight);
  pageEl.style.fontFamily = String(t.fontFamily || '"DM Sans", sans-serif');
}

function getReaderContentHeight() {
  const content = document.querySelector(".slow-reader-content");
  if (content && content.clientHeight > 50) return content.clientHeight;

  const main = document.querySelector(".slow-reader-main");
  const toolbar = document.querySelector(".slow-reader-toolbar");
  if (main && toolbar) {
    const style = window.getComputedStyle(main);
    const padTop = parseFloat(style.paddingTop) || 0;
    const padBottom = parseFloat(style.paddingBottom) || 0;
    const gap = parseFloat(style.rowGap || style.gap) || 12;
    return Math.max(100, main.clientHeight - toolbar.offsetHeight - padTop - padBottom - gap);
  }

  return Math.max(300, window.innerHeight - 160);
}

function buildPaginationMeasureContent(session, typography) {
  const usesMd = usesMarkdownRender(session);
  const images = session.shared?.images || [];
  return (el, slice) => {
    applyTypographyToMeasureEl(el, typography, usesMd);
    if (usesMd) {
      const html = images.length
        ? markdownToHtml(replacePithImageTokens(slice, images, {}))
        : markdownToHtml(slice);
      el.innerHTML = html;
    } else {
      el.textContent = slice;
    }
  };
}

function applyTypographyToMeasureEl(el, typography, usesMd) {
  const t = typography && typeof typography === "object" ? typography : {};
  el.className = usesMd ? "slow-reader-page md-content" : "slow-reader-page";
  el.style.fontSize = `${Number(t.fontSizePx) || SLOW_TYPO_DEFAULTS.fontSizePx}px`;
  el.style.lineHeight = String(Number(t.lineHeight) || SLOW_TYPO_DEFAULTS.lineHeight);
  el.style.fontFamily = String(t.fontFamily || SLOW_TYPO_DEFAULTS.fontFamily);
  el.style.whiteSpace = usesMd ? "normal" : "pre-wrap";
  el.style.wordBreak = "break-word";
  el.style.width = "100%";
  el.style.boxSizing = "border-box";
}

function buildReaderSectionBoundaries(session) {
  const slow = session?.slow;
  const scope = slow?.readingScope;
  if (!scope || !session?.docHierarchy?.tree?.length) return [];
  const scopeStart = Math.max(0, Number(scope.charStart) || 0);
  const scopeEnd = Math.min(
    slow.normalizedTextFull.length,
    Number(scope.charEnd) || slow.normalizedTextFull.length,
  );
  return flattenHierarchy(session.docHierarchy.tree, 2)
    .filter((n) => n.startOffset >= scopeStart && n.startOffset < scopeEnd)
    .map((n) => ({
      charStart: n.startOffset - scopeStart,
      charEnd: Math.min(n.endOffset, scopeEnd) - scopeStart,
    }));
}

function recomputeBreakpoints(session) {
  const scopeText = getScopeText(session);
  const container = els.slowReaderPage || document.getElementById("slowReaderPage");
  if (!container) return [];
  const oldBp = readerState.breakpoints;
  const oldPage = Number(session?.slow?.currentPageIndex) || 0;
  const usesMd = usesMarkdownRender(session);
  const contentHeight = getReaderContentHeight();
  readerState.contentHeightUsed = contentHeight;
  const sectionBoundaries = buildReaderSectionBoundaries(session);
  readerState.breakpoints = computePageBreakpoints(scopeText, container, session.slow.typography, {
    availableHeight: contentHeight,
    measureMode: usesMd ? "md" : "plain",
    measureContent: buildPaginationMeasureContent(session, session.slow.typography),
    sectionBoundaries,
    sectionSnapSlack: sectionBoundaries.length ? 200 : 0,
  });
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
  const indicator = document.getElementById("slowReaderPageIndicator");
  if (indicator) {
    if (!total) indicator.textContent = "—";
    else if (total === 1) indicator.textContent = "1 página";
    else indicator.textContent = `Página ${idx + 1} de ${total}`;
  }
}

function renderTypographyLabels(session) {
  const t = session?.slow?.typography || SLOW_TYPO_DEFAULTS;
  const fontSize = Number(t.fontSizePx) || SLOW_TYPO_DEFAULTS.fontSizePx;
  const lineHeight = Number(t.lineHeight) || SLOW_TYPO_DEFAULTS.lineHeight;
  const fontLabel = document.getElementById("slowFontSizeLabel");
  const lineLabel = document.getElementById("slowLineHeightLabel");
  if (fontLabel) fontLabel.textContent = `${fontSize}`;
  if (lineLabel) lineLabel.textContent = lineHeight.toFixed(1);
}

function applyTypographyChange(session, changes) {
  if (!session?.slow) return;
  if (!session.slow.typography) session.slow.typography = { ...SLOW_TYPO_DEFAULTS };
  Object.assign(session.slow.typography, changes);
  invalidatePaginationCache();
  clearTimeout(readerState.debounceTimer);
  readerState.debounceTimer = setTimeout(() => renderSlowReaderPage(session), 150);
}

function usesMarkdownRender(session) {
  return session?.slow?.normalizedFormat !== "html_min";
}

/** @param {string} sourcePlain @param {string} visiblePlain */
function buildVisibleToSourceMap(sourcePlain, visiblePlain) {
  const map = new Array(visiblePlain.length);
  let si = 0;
  for (let vi = 0; vi < visiblePlain.length; vi += 1) {
    const ch = visiblePlain[vi];
    while (si < sourcePlain.length && sourcePlain[si] !== ch) si += 1;
    map[vi] = si < sourcePlain.length ? si : Math.max(0, sourcePlain.length - 1);
    if (si < sourcePlain.length && sourcePlain[si] === ch) si += 1;
  }
  return map;
}

function sourceOffsetToVisible(sourcePlain, visiblePlain, sourceOffset) {
  const target = Math.max(0, Math.floor(Number(sourceOffset) || 0));
  const map = buildVisibleToSourceMap(sourcePlain, visiblePlain);
  for (let vi = 0; vi < map.length; vi += 1) {
    if (map[vi] >= target) return vi;
  }
  return visiblePlain.length;
}

function visibleOffsetFromRange(pageEl, range, end = false) {
  const walker = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT);
  const targetNode = end ? range.endContainer : range.startContainer;
  const targetOffset = end ? range.endOffset : range.startOffset;
  let visible = 0;
  let node = walker.nextNode();
  while (node) {
    if (node === targetNode) return visible + targetOffset;
    visible += node.length;
    node = walker.nextNode();
  }
  return visible;
}

function createRangeAtVisibleOffset(pageEl, visibleOffset) {
  const walker = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, Math.floor(Number(visibleOffset) || 0));
  let node = walker.nextNode();
  while (node) {
    if (remaining <= node.length) {
      const range = document.createRange();
      const offset = Math.min(remaining, node.length);
      range.setStart(node, offset);
      range.setEnd(node, Math.min(offset + 1, node.length));
      return range;
    }
    remaining -= node.length;
    node = walker.nextNode();
  }
  return null;
}

function selectionToScopeOffsetsFromRendered(pageEl, slice, slicePlain) {
  const sel = window.getSelection?.();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  if (!pageEl || !pageEl.contains(sel.anchorNode)) return null;
  const range = sel.getRangeAt(0);
  const visiblePlain = pageEl.textContent || "";
  const startVisible = visibleOffsetFromRange(pageEl, range, false);
  const endVisible = visibleOffsetFromRange(pageEl, range, true);
  if (endVisible <= startVisible) return null;
  const map = buildVisibleToSourceMap(slicePlain, visiblePlain);
  const localStart = map[startVisible] ?? startVisible;
  const endIdx = Math.min(endVisible - 1, map.length - 1);
  const localEnd = endIdx >= 0 ? (map[endIdx] ?? endIdx) + 1 : localStart + range.toString().length;
  return {
    charStart: slice.charStart + localStart,
    charEnd: slice.charStart + Math.max(localStart + 1, localEnd),
    selectedText: range.toString(),
    rect:
      typeof range.getBoundingClientRect === "function"
        ? range.getBoundingClientRect()
        : { top: 0, bottom: 0, left: 0, width: 0, height: 0 },
  };
}

/** @returns {{ localStart: number, localEnd: number } | null} */
export function resolveHighlightLocalRange(slice, charStart, charEnd) {
  const pageLen = Math.max(0, slice.charEnd - slice.charStart);
  const localStart = Math.max(0, Math.floor(Number(charStart) || 0) - slice.charStart);
  const localEnd = Math.min(pageLen, Math.floor(Number(charEnd) || 0) - slice.charStart);
  if (localStart >= localEnd) return null;
  return { localStart, localEnd };
}

export function highlightRange(pageEl, slice, charStart, charEnd, slicePlain = "") {
  if (!pageEl || !slice) return;
  const local = resolveHighlightLocalRange(slice, charStart, charEnd);
  if (!local) return;

  const { localStart, localEnd } = local;
  const plain = slicePlain || pageEl._slowSlicePlain || pageEl.textContent || "";
  const usesHtml = pageEl.classList.contains("md-content");

  if (usesHtml && plain) {
    const visiblePlain = pageEl.textContent || "";
    const visStart = sourceOffsetToVisible(plain, visiblePlain, localStart);
    const visEnd = sourceOffsetToVisible(plain, visiblePlain, localEnd);
    const startRange = createRangeAtVisibleOffset(pageEl, visStart);
    const endRange = createRangeAtVisibleOffset(pageEl, visEnd);
    if (!startRange || !endRange) return;
    const highlightRangeDom = document.createRange();
    highlightRangeDom.setStart(startRange.startContainer, startRange.startOffset);
    highlightRangeDom.setEnd(endRange.startContainer, endRange.startOffset);
    const span = document.createElement("span");
    span.className = "slow-highlight-pulse";
    try {
      highlightRangeDom.surroundContents(span);
    } catch {
      return;
    }
    clearTimeout(highlightRange._timer);
    highlightRange._timer = setTimeout(() => {
      const s = stateSession();
      if (pageEl.isConnected && s?.slow) renderSlowReaderPage(s);
    }, 2000);
    return;
  }

  const fullText = pageEl.textContent || "";
  const before = fullText.slice(0, localStart);
  const middle = fullText.slice(localStart, localEnd);
  const after = fullText.slice(localEnd);

  pageEl.textContent = "";
  if (before) pageEl.appendChild(document.createTextNode(before));
  const span = document.createElement("span");
  span.className = "slow-highlight-pulse";
  span.textContent = middle;
  pageEl.appendChild(span);
  if (after) pageEl.appendChild(document.createTextNode(after));

  clearTimeout(highlightRange._timer);
  highlightRange._timer = setTimeout(() => {
    const s = stateSession();
    if (pageEl.isConnected && s?.slow) renderSlowReaderPage(s);
  }, 2000);
}

function wireInlineHighlight(outerSpan, session, covering) {
  const pickAnn = () => pickPrimaryAnnotation(covering);
  outerSpan.setAttribute("role", "button");
  outerSpan.setAttribute("tabindex", "0");
  wireLongPress(outerSpan, {
    onLongPress: (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ann = pickAnn();
      if (ann) showAnnotationEditMenu(session, ann, outerSpan.getBoundingClientRect());
    },
    onTap: (e) => {
      e.stopPropagation();
      const ann = pickAnn();
      if (!ann) return;
      if (isIAQueryAnnotation(ann) && ann.aiReply) {
        showSlowIAOverlayFromAnnotation(ann);
        return;
      }
      navigateToAnnotation(session, ann);
    },
  });
}

function wrapLocalHighlightSegment(pageEl, slicePlain, segStart, segEnd, covering, session) {
  if (!covering.length || segEnd <= segStart) return;

  const usesHtml = pageEl.classList.contains("md-content");
  const visiblePlain = pageEl.textContent || "";
  let startVis = segStart;
  let endVis = segEnd;
  if (usesHtml && slicePlain) {
    startVis = sourceOffsetToVisible(slicePlain, visiblePlain, segStart);
    endVis = sourceOffsetToVisible(slicePlain, visiblePlain, segEnd);
  }
  if (endVis <= startVis) return;

  const startRange = createRangeAtVisibleOffset(pageEl, startVis);
  const endRange = createRangeAtVisibleOffset(pageEl, endVis);
  if (!startRange || !endRange) return;

  const domRange = document.createRange();
  domRange.setStart(startRange.startContainer, startRange.startOffset);
  domRange.setEnd(endRange.startContainer, endRange.startOffset);

  let contents;
  try {
    contents = domRange.extractContents();
  } catch {
    return;
  }

  const current = createNestedHighlightSpans(covering, document, contents);

  wireInlineHighlight(current, session, covering);
  domRange.insertNode(current);
}

function applyInlineAnnotationHighlights(session, pageEl, pageSlice, slicePlain) {
  if (!pageEl || !session?.slow) return;
  const segments = buildAnnotationHighlightSegments(pageSlice, slicePlain, session.slow.annotations);
  const highlighted = segments.filter((s) => s.covering.length);
  if (!highlighted.length) return;

  for (let i = highlighted.length - 1; i >= 0; i -= 1) {
    const { segStart, segEnd, covering } = highlighted[i];
    wrapLocalHighlightSegment(pageEl, slicePlain, segStart, segEnd, covering, session);
  }
}

/** Proportional Y fallback when Range measurement fails. */
export function computeMarkYFallback(charStart, pageSlice, pageHeight, markIndex = 0, markCount = 1) {
  const pageLen = Math.max(1, pageSlice.charEnd - pageSlice.charStart);
  const rel = (Math.floor(Number(charStart) || 0) - pageSlice.charStart) / pageLen;
  const usable = Math.max(0, Number(pageHeight) || 0);
  const proportional = rel * Math.max(0, usable - 16);
  if (markCount <= 1) return proportional;
  const evenly = (markIndex / Math.max(1, markCount - 1)) * Math.max(0, usable - 16);
  return Number.isFinite(proportional) ? proportional : evenly;
}

function clearLongPressTimer() {
  if (readerState.longPressTimer) clearTimeout(readerState.longPressTimer);
  readerState.longPressTimer = null;
}

function wireLongPress(el, { onLongPress, onTap } = {}) {
  if (!el) return;
  const start = (e) => {
    if (e.button != null && e.button !== 0) return;
    readerState.longPressFired = false;
    clearLongPressTimer();
    readerState.longPressTimer = setTimeout(() => {
      readerState.longPressFired = true;
      onLongPress?.(e);
    }, LONG_PRESS_MS);
  };
  const end = (e) => {
    clearLongPressTimer();
    if (!readerState.longPressFired) onTap?.(e);
  };
  const cancel = () => clearLongPressTimer();
  el.addEventListener("pointerdown", start);
  el.addEventListener("pointerup", end);
  el.addEventListener("pointerleave", cancel);
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("contextmenu", (e) => {
    if (readerState.longPressFired) e.preventDefault();
  });
}

function ensureAnnotationEditMenu() {
  let menu = document.getElementById("slowAnnotationEditMenu");
  if (menu) return menu;
  menu = document.createElement("div");
  menu.id = "slowAnnotationEditMenu";
  menu.className = "slow-annotation-edit-menu";
  menu.hidden = true;
  menu.setAttribute("role", "menu");
  menu.innerHTML = `
    <div class="slow-annotation-edit-actions" role="group" aria-label="Editar anotación">
      <button type="button" class="slow-annotation-edit-btn" data-action="type">Editar tipo</button>
      <button type="button" class="slow-annotation-edit-btn" data-action="text">Editar texto</button>
      <button type="button" class="slow-annotation-edit-btn slow-annotation-edit-btn--danger" data-action="delete">Eliminar</button>
    </div>
    <div class="slow-annotation-edit-types" hidden role="toolbar" aria-label="Cambiar tipo"></div>
    <div class="slow-annotation-edit-text" hidden>
      <label class="slow-annotation-edit-text-label">Texto de la anotación</label>
      <input type="text" class="slow-annotation-edit-text-input" spellcheck="true" />
    </div>
  `;
  document.body.appendChild(menu);
  return menu;
}

function hideAnnotationEditMenu() {
  const menu = document.getElementById("slowAnnotationEditMenu");
  if (!menu) return;
  menu.hidden = true;
  readerState.editDraft = null;
  menu.querySelector(".slow-annotation-edit-actions")?.removeAttribute("hidden");
  menu.querySelector(".slow-annotation-edit-types")?.setAttribute("hidden", "");
  menu.querySelector(".slow-annotation-edit-text")?.setAttribute("hidden", "");
}

async function showAnnotationEditMenu(session, annotation, anchorRect) {
  if (!session?.slow || !annotation) return;
  hideAnnotationMenu();
  hideConceptPicker();
  const menu = ensureAnnotationEditMenu();
  readerState.editDraft = { annId: annotation.id, mode: "actions" };
  const actions = menu.querySelector(".slow-annotation-edit-actions");
  const typesPanel = menu.querySelector(".slow-annotation-edit-types");
  const textPanel = menu.querySelector(".slow-annotation-edit-text");
  actions?.removeAttribute("hidden");
  typesPanel?.setAttribute("hidden", "");
  textPanel?.setAttribute("hidden", "");

  const onDelete = async () => {
    deleteAnnotation(session, annotation.id);
    await storeActiveSession(session);
    hideAnnotationEditMenu();
    renderSlowReaderPage(session);
  };
  const onEditType = () => {
    readerState.editDraft = { annId: annotation.id, mode: "type" };
    actions?.setAttribute("hidden", "");
    typesPanel?.removeAttribute("hidden");
    typesPanel.innerHTML = "";
    const types = visibleAnnotationTypes(session.slow.criticalMode, { showSecondary: true });
    for (const t of types) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slow-annotation-type-btn";
      btn.textContent = `${t.symbol} ${t.label}`;
      btn.addEventListener("click", async () => {
        updateAnnotation(session, annotation.id, { type: t.symbol });
        await storeActiveSession(session);
        hideAnnotationEditMenu();
        renderSlowReaderPage(session);
      });
      typesPanel.appendChild(btn);
    }
    positionAnnotationMenu(menu, anchorRect);
  };
  const onEditText = () => {
    readerState.editDraft = { annId: annotation.id, mode: "text" };
    actions?.setAttribute("hidden", "");
    textPanel?.removeAttribute("hidden");
    const input = menu.querySelector(".slow-annotation-edit-text-input");
    if (input) {
      input.value = String(annotation.userText || "");
      input.focus();
      input.select();
    }
    positionAnnotationMenu(menu, anchorRect);
  };

  for (const btn of menu.querySelectorAll(".slow-annotation-edit-btn")) {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  }
  menu.querySelector('[data-action="type"]')?.addEventListener("click", onEditType);
  menu.querySelector('[data-action="text"]')?.addEventListener("click", onEditText);
  menu.querySelector('[data-action="delete"]')?.addEventListener("click", onDelete);

  const textInput = menu.querySelector(".slow-annotation-edit-text-input");
  if (textInput && !textInput.dataset.wired) {
    textInput.dataset.wired = "1";
    textInput.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const draft = readerState.editDraft;
      if (!draft?.annId) return;
      updateAnnotation(session, draft.annId, { userText: textInput.value.trim() });
      await storeActiveSession(session);
      hideAnnotationEditMenu();
      renderSlowReaderPage(session);
    });
  }

  positionAnnotationMenu(menu, anchorRect);
}

function charOffsetFromPoint(pageEl, clientX, clientY, pageSlice) {
  if (!pageEl || !pageSlice) return null;
  const doc = pageEl.ownerDocument;
  let range = null;
  if (doc.caretRangeFromPoint) {
    range = doc.caretRangeFromPoint(clientX, clientY);
  } else if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(clientX, clientY);
    if (pos) {
      range = doc.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }
  if (!range || !pageEl.contains(range.startContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(pageEl);
  pre.setEnd(range.startContainer, range.startOffset);
  return pageSlice.charStart + pre.toString().length;
}

function showDictionaryPopup({ term, definition, rect }) {
  showSlowIAOverlay({
    query: term,
    reply: definition || "Sin definición en el diccionario de sesión.",
  });
}

async function handleWordLongPress(session, clientX, clientY) {
  const pageEl = els.slowReaderPage || document.getElementById("slowReaderPage");
  if (!pageEl || !session?.slow) return;
  const slice = getPageSlice(readerState.breakpoints, session.slow.currentPageIndex);
  const pageText = pageEl.textContent || "";
  const charOffset = charOffsetFromPoint(pageEl, clientX, clientY, slice);
  if (charOffset == null) return;
  const localOffset = charOffset - slice.charStart;
  const word = extractWordAtOffset(pageText, localOffset);
  if (!word) return;

  const hit = lookupSessionTerm(word, {
    sessionConcepts: getSortedSessionConcepts(),
    phase0Concepts: session.slow.phase0?.conceptsToFind || [],
  });
  const rect = { top: clientY - 8, bottom: clientY + 8, left: clientX, width: 0, height: 16 };
  if (hit) {
    showDictionaryPopup({ term: hit.term, definition: hit.definition, rect });
    return;
  }

  const query = `¿Qué significa «${word}» en este contexto?`;
  showSlowIAOverlay({ query, loading: true });
  try {
    const reply = await askSlowReaderIA(session, query);
    showSlowIAOverlay({ query, reply });
  } catch {
    showSlowIAOverlay({
      query,
      reply: "No se pudo obtener respuesta. Inténtalo de nuevo.",
    });
  }
}

function measureMarkY(pageEl, marginEl, charOffsetInPage, slicePlain = "") {
  if (!pageEl || !marginEl) return null;
  const plain = slicePlain || pageEl._slowSlicePlain || "";
  let range = null;
  if (plain) {
    const visiblePlain = pageEl.textContent || "";
    const visOffset = sourceOffsetToVisible(plain, visiblePlain, charOffsetInPage);
    range = createRangeAtVisibleOffset(pageEl, visOffset);
  } else {
    const textNode = pageEl.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null;
    const len = textNode.length;
    const offset = Math.max(0, Math.min(Math.floor(charOffsetInPage), len));
    range = document.createRange();
    range.setStart(textNode, offset);
    range.setEnd(textNode, Math.min(offset + 1, len));
  }
  if (!range) return null;
  try {
    const rangeRect = range.getBoundingClientRect();
    const marginRect = marginEl.getBoundingClientRect();
    if (!rangeRect.height && !rangeRect.width && rangeRect.top === 0) return null;
    return rangeRect.top - marginRect.top;
  } catch {
    return null;
  }
}

function renderMarginMarks(session, pageSlice) {
  const margin = els.slowReaderMargin || document.getElementById("slowReaderMargin");
  const pageEl = els.slowReaderPage || document.getElementById("slowReaderPage");
  if (!margin) return;
  margin.innerHTML = "";
  const anns = annotationsOnPage(session.slow.annotations, pageSlice);
  const pageHeight = pageEl?.clientHeight || margin.clientHeight || 400;

  const slicePlain = pageEl?._slowSlicePlain || "";
  anns.forEach((a, index) => {
    const charOffsetInPage = a.charStart - pageSlice.charStart;
    let y = pageEl ? measureMarkY(pageEl, margin, charOffsetInPage, slicePlain) : null;
    if (y == null || !Number.isFinite(y)) {
      y = computeMarkYFallback(a.charStart, pageSlice, pageHeight, index, anns.length);
    }

    const mark = document.createElement("span");
    mark.className = `annotation-mark annotation-mark--${annotationMarkClass(a.type)}`;
    mark.textContent = a.type;
    mark.title = a.userText || a.type;
    mark.dataset.annId = a.id;
    mark.style.top = `${Math.max(0, y)}px`;
    if (isIAQueryAnnotation(a) && a.aiReply) {
      mark.classList.add("annotation-mark--ia");
      mark.setAttribute("role", "button");
      mark.setAttribute("aria-label", `Ver respuesta IA: ${a.userText || a.type}`);
    }
    wireLongPress(mark, {
      onLongPress: (e) => {
        e.preventDefault();
        e.stopPropagation();
        showAnnotationEditMenu(session, a, mark.getBoundingClientRect());
      },
      onTap: (e) => {
        e.stopPropagation();
        if (isIAQueryAnnotation(a) && a.aiReply) {
          showSlowIAOverlayFromAnnotation(a);
          return;
        }
        navigateToAnnotation(session, a);
      },
    });
    margin.appendChild(mark);
  });
}

export function getReadAnchor(session) {
  const idx = Math.max(0, Number(session?.slow?.currentPageIndex) || 0);
  const slice = getPageSlice(readerState.breakpoints, idx);
  const charEnd = Math.max(Number(session?.slow?.maxReadCharEnd) || 0, slice.charEnd);
  const charStart = Math.max(0, charEnd - 1);
  return { charStart, charEnd: Math.max(charStart + 1, charEnd) };
}

function ensureIAOverlay() {
  let overlay = document.getElementById("slowIAOverlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "slowIAOverlay";
  overlay.className = "slow-ia-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "slowIAOverlayQuery");
  overlay.innerHTML = `
    <div class="slow-ia-overlay-panel">
      <button type="button" class="slow-ia-overlay-close" aria-label="Cerrar respuesta IA">×</button>
      <p id="slowIAOverlayQuery" class="slow-ia-overlay-query"></p>
      <p class="slow-ia-overlay-reply"></p>
    </div>
  `;
  document.body.appendChild(overlay);

  const panel = overlay.querySelector(".slow-ia-overlay-panel");
  overlay.querySelector(".slow-ia-overlay-close")?.addEventListener("click", () => hideSlowIAOverlay());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hideSlowIAOverlay();
  });
  panel?.addEventListener("touchstart", (e) => {
    readerState.iaOverlayTouchStartY = e.changedTouches?.[0]?.clientY || 0;
  }, { passive: true });
  panel?.addEventListener("touchend", (e) => {
    const dy = (e.changedTouches?.[0]?.clientY || 0) - readerState.iaOverlayTouchStartY;
    if (dy > 50) hideSlowIAOverlay();
  }, { passive: true });

  return overlay;
}

export function isSlowIAOverlayOpen() {
  return Boolean(readerState.iaOverlayOpen);
}

export function showSlowIAOverlay({ query = "", reply = "", loading = false } = {}) {
  const overlay = ensureIAOverlay();
  const queryEl = overlay.querySelector(".slow-ia-overlay-query");
  const replyEl = overlay.querySelector(".slow-ia-overlay-reply");
  if (queryEl) queryEl.textContent = String(query || "").trim() || "Consulta IA";
  if (replyEl) {
    replyEl.textContent = loading ? "Pensando…" : String(reply || "").trim();
    replyEl.classList.toggle("slow-ia-overlay-reply--loading", loading);
  }
  overlay.hidden = false;
  readerState.iaOverlayOpen = true;
  overlay.querySelector(".slow-ia-overlay-close")?.focus();
}

export function showSlowIAOverlayFromAnnotation(ann) {
  const query =
    ann?.userText ||
    (ann?.type === "⇑" ? "Steel man del fragmento" : "Explica este fragmento");
  showSlowIAOverlay({ query, reply: ann?.aiReply || "" });
}

export function hideSlowIAOverlay() {
  const overlay = document.getElementById("slowIAOverlay");
  if (overlay) overlay.hidden = true;
  readerState.iaOverlayOpen = false;
  const pageEl = els.slowReaderPage || document.getElementById("slowReaderPage");
  if (pageEl) {
    if (!pageEl.hasAttribute("tabindex")) pageEl.setAttribute("tabindex", "-1");
    pageEl.focus({ preventScroll: true });
  }
}

function ensureSteelManNudgeModal() {
  let modal = document.getElementById("slowSteelManNudge");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "slowSteelManNudge";
  modal.className = "slow-steelman-nudge";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "slowSteelManNudgeTitle");
  modal.innerHTML = `
    <div class="slow-steelman-nudge-panel">
      <p id="slowSteelManNudgeTitle" class="slow-steelman-nudge-title">¿Has formulado el mejor argumento del autor?</p>
      <p class="slow-steelman-nudge-hint">Antes de objetar, conviene articular la versión más fuerte del texto (steel man).</p>
      <div class="slow-steelman-nudge-actions">
        <button type="button" class="btn btn-primary slow-steelman-nudge-steel">Pedir steel man</button>
        <button type="button" class="btn btn-secondary slow-steelman-nudge-continue">Continuar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

export function isSlowSteelManNudgeOpen() {
  return Boolean(readerState.steelManNudgeOpen);
}

export function hideSteelManNudgeModal() {
  const modal = document.getElementById("slowSteelManNudge");
  if (modal) modal.hidden = true;
  readerState.steelManNudgeOpen = false;
}

export async function showSteelManNudgeModal(session, ann, { onSteelMan, onContinue } = {}) {
  const modal = ensureSteelManNudgeModal();
  modal.hidden = false;
  readerState.steelManNudgeOpen = true;
  const steelBtn = modal.querySelector(".slow-steelman-nudge-steel");
  const continueBtn = modal.querySelector(".slow-steelman-nudge-continue");
  const handleSteel = () => {
    hideSteelManNudgeModal();
    onSteelMan?.();
  };
  const handleContinue = async () => {
    if (session?.slow && ann?.id) {
      updateAnnotation(session, ann.id, { skippedSteelMan: true });
      await storeActiveSession(session);
    }
    hideSteelManNudgeModal();
    onContinue?.();
  };
  steelBtn?.replaceWith(steelBtn.cloneNode(true));
  continueBtn?.replaceWith(continueBtn.cloneNode(true));
  modal.querySelector(".slow-steelman-nudge-steel")?.addEventListener("click", handleSteel);
  modal.querySelector(".slow-steelman-nudge-continue")?.addEventListener("click", handleContinue);
  modal.querySelector(".slow-steelman-nudge-steel")?.focus();
}

async function runSteelManIAFlow(session, ann, userText = "", typeSymbol = "⇑") {
  if (!session?.slow || !ann) return;
  const queryText =
    userText ||
    (typeSymbol === "⇑" ? "Steel man del fragmento" : "Explica este fragmento");
  showSlowIAOverlay({ query: queryText, loading: true });
  try {
    const reply = await askSlowReaderIA(session, userText || "Explica este fragmento", {
      annotationType: typeSymbol,
    });
    ann.aiReply = reply;
    await storeActiveSession(session);
    showSlowIAOverlay({ query: queryText, reply });
    renderSlowSidebar(session, {
      breakpoints: readerState.breakpoints,
      scopeText: getScopeText(session),
    });
  } catch {
    showSlowIAOverlay({
      query: queryText,
      reply: "No se pudo obtener respuesta. Inténtalo de nuevo.",
    });
  }
}

async function requestSteelManForRange(session, offsets, userText = "") {
  if (!session?.slow || !offsets) return null;
  const steelType = ANNOTATION_TYPES.find((t) => t.symbol === "⇑");
  if (!steelType) return null;
  const ann = await addAnnotation(session, {
    type: steelType.symbol,
    charStart: offsets.charStart,
    charEnd: offsets.charEnd,
    userText,
  });
  await storeActiveSession(session);
  renderSlowReaderPage(session);
  if (ann) await runSteelManIAFlow(session, ann, userText);
  return ann;
}

function maybeShowSteelManNudge(session, ann) {
  if (!session?.slow || !ann) return;
  if (!shouldShowSteelManNudge(session.slow.annotations, ann)) return;
  showSteelManNudgeModal(session, ann, {
    onSteelMan: () => {
      void requestSteelManForRange(session, {
        charStart: ann.charStart,
        charEnd: ann.charEnd,
      });
    },
  });
}

async function handleSidebarIAQuery(session, queryText) {
  if (!session?.slow) return;
  const savedPage = session.slow.currentPageIndex;
  const anchor = getReadAnchor(session);
  showSlowIAOverlay({ query: queryText, loading: true });
  try {
    const reply = await askSlowReaderIA(session, queryText);
    await addIAQueryAnnotation(session, {
      userText: queryText,
      charStart: anchor.charStart,
      charEnd: anchor.charEnd,
      aiReply: reply,
    });
    await storeActiveSession(session);
    showSlowIAOverlay({ query: queryText, reply });
    renderSlowSidebar(session, {
      breakpoints: readerState.breakpoints,
      scopeText: getScopeText(session),
    });
  } catch {
    showSlowIAOverlay({
      query: queryText,
      reply: "No se pudo obtener respuesta. Inténtalo de nuevo.",
    });
  }
  session.slow.currentPageIndex = savedPage;
}

export function getReaderBreakpoints() {
  return readerState.breakpoints;
}

function navigateToAnnotation(session, annotation) {
  if (!session?.slow || !annotation) return;
  const page = charOffsetToPage(readerState.breakpoints, annotation.charStart);
  goToReaderPage(session, page);
  const slice = getPageSlice(readerState.breakpoints, session.slow.currentPageIndex);
  const pageEl = els.slowReaderPage || document.getElementById("slowReaderPage");
  const scopeText = getScopeText(session);
  const slicePlain = scopeText.slice(slice.charStart, slice.charEnd);
  highlightRange(pageEl, slice, annotation.charStart, annotation.charEnd, slicePlain);
}

setAnnotationNavigator(navigateToAnnotation);

function showFindingToast(conceptTerm) {
  let toast = document.getElementById("slowFindingToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "slowFindingToast";
    toast.className = "slow-finding-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = `✦  HALLAZGO · ${conceptTerm}`;
  toast.hidden = false;
  clearTimeout(showFindingToast._timer);
  showFindingToast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 3500);
}

function renderFillableMapPanel(session) {
  const slow = session?.slow;
  let panel = document.getElementById("slowFillableMapPanel");
  if (!slow?.fillableMapMode || !slow.phase0?.fillableBlanks?.length) {
    if (panel) panel.hidden = true;
    return;
  }
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "slowFillableMapPanel";
    panel.className = "slow-fillable-map-panel";
    panel.setAttribute("aria-label", "Fillable argument map");
    const toolbar = document.querySelector(".slow-reader-toolbar");
    if (toolbar) toolbar.insertAdjacentElement("afterend", panel);
    else document.body.appendChild(panel);
  }
  panel.hidden = false;
  panel.innerHTML = "";
  const title = document.createElement("p");
  title.className = "slow-fillable-map-title";
  title.textContent = "Mapa rellenable";
  panel.appendChild(title);
  const list = document.createElement("ul");
  list.className = "slow-fillable-map-list";
  for (const blank of slow.phase0.fillableBlanks) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.className = "slow-fillable-map-node";
    label.textContent = `${blank.nodeId}:`;
    const value = document.createElement("span");
    value.className = "slow-fillable-map-value";
    if (blank.userText) {
      const page =
        blank.pageIndex != null ? ` (p. ${Number(blank.pageIndex) + 1})` : "";
      value.textContent = `${blank.userText}${page}`;
    } else {
      value.textContent = "___";
      value.classList.add("slow-fillable-map-empty");
    }
    li.appendChild(label);
    li.appendChild(value);
    list.appendChild(li);
  }
  panel.appendChild(list);
}

function applyPedagogyToSlicePlain(session, slicePlain, slice) {
  const inv = session?.shared?.conceptInventory;
  if (!Array.isArray(inv) || !inv.length) return slicePlain;
  const scopeText = getScopeText(session);
  const spans = buildConceptSpanIndex(scopeText, inv);
  const highlights = selectHighlightSpans(spans, getPedagogicalFlags().HIGHLIGHT_WORD_BUDGET);
  const pageSpans = spans
    .filter((s) => s.end > slice.charStart && s.start < slice.charEnd)
    .map((s) => ({
      ...s,
      start: Math.max(0, s.start - slice.charStart),
      end: Math.min(slicePlain.length, s.end - slice.charStart),
    }));
  const pageHighlights = highlights
    .filter((s) => s.end > slice.charStart && s.start < slice.charEnd)
    .map((s) => ({
      ...s,
      start: Math.max(0, s.start - slice.charStart),
      end: Math.min(slicePlain.length, s.end - slice.charStart),
    }));
  return wrapPlainTextWithPedagogyMarks(slicePlain, pageSpans, pageHighlights);
}

export async function renderSlowReaderPage(session, opts = {}) {
  if (!session?.slow) return;
  applyTypographyToPage(session);
  recomputeBreakpoints(session);
  const idx = Math.max(0, Number(session.slow.currentPageIndex) || 0);
  const slice = getPageSlice(readerState.breakpoints, idx);
  const scopeText = getScopeText(session);
  const pageEl = els.slowReaderPage || document.getElementById("slowReaderPage");
  const slicePlain = scopeText.slice(slice.charStart, slice.charEnd);
  const pedagogyPlain = applyPedagogyToSlicePlain(session, slicePlain, slice);
  if (pageEl) {
    if (usesMarkdownRender(session)) {
      pageEl.classList.add("md-content");
      const images = session.shared?.images || [];
      if (images.length) {
        pageEl.innerHTML = await renderSlowMarkdownWithImages(pedagogyPlain, images);
      } else {
        pageEl.innerHTML = markdownToHtml(pedagogyPlain);
      }
      pageEl._slowSlicePlain = slicePlain;
    } else {
      pageEl.classList.remove("md-content");
      if (pedagogyPlain.includes("<span")) pageEl.innerHTML = pedagogyPlain;
      else pageEl.textContent = pedagogyPlain;
      pageEl._slowSlicePlain = slicePlain;
    }
    applyInlineAnnotationHighlights(session, pageEl, slice, slicePlain);
  }
  updateMaxReadCharEnd(session);
  renderProgress(session);
  renderTypographyLabels(session);
  renderMarginMarks(session, slice);
  renderFillableMapPanel(session);
  renderSlowSidebar(session, { breakpoints: readerState.breakpoints, scopeText });
  maybeScheduleCheckpoint(session, readerState.breakpoints, idx, () => renderSlowReaderPage(session));
  await storeActiveSession(session);

  if (!opts.skipLayoutRetry && isSlowReaderActive()) {
    requestAnimationFrame(() => {
      const h = getReaderContentHeight();
      if (h > 50 && Math.abs(h - readerState.contentHeightUsed) > 4) {
        renderSlowReaderPage(session, { skipLayoutRetry: true });
      }
    });
  }
}

export function goToReaderPage(session, pageIndex) {
  const total = getPageCount(readerState.breakpoints);
  const idx = Math.min(Math.max(0, Math.floor(Number(pageIndex) || 0)), Math.max(0, total - 1));
  session.slow.currentPageIndex = idx;
  hideAnnotationMenu();
  hideAnnotationEditMenu();
  hideConceptPicker();
  hideCheckpointChip();
  readerState.pendingSelection = null;
  renderSlowReaderPage(session);
}

function selectionToScopeOffsets(session) {
  const sel = window.getSelection?.();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const pageEl = els.slowReaderPage;
  if (!pageEl || !pageEl.contains(sel.anchorNode)) return null;
  const slice = getPageSlice(readerState.breakpoints, session.slow.currentPageIndex);
  const scopeText = getScopeText(session);
  const slicePlain = scopeText.slice(slice.charStart, slice.charEnd);
  if (usesMarkdownRender(session)) {
    return selectionToScopeOffsetsFromRendered(pageEl, slice, slicePlain);
  }
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(pageEl);
  pre.setEnd(range.startContainer, range.startOffset);
  const startInPage = pre.toString().length;
  const selected = range.toString().length;
  if (selected <= 0) return null;
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
  if (typeDef.symbol === "🔗") {
    input.placeholder = "URL o nota de literatura — Enter para guardar";
  } else if (typeDef.symbol === "⟷") {
    input.placeholder = "Describe la conexión — Enter para elegir concepto";
  } else {
    input.placeholder = "Nota (opcional) — Enter para guardar";
  }
  notePanel.hidden = false;
  positionAnnotationMenu(menu, readerState.pendingSelection.rect);
  input.focus();
}

async function commitAnnotation(session, typeDef, offsets, userText) {
  if (!session?.slow || !typeDef || !offsets) return;
  const anchorRect = readerState.pendingSelection?.rect;
  const ann = await addAnnotation(session, {
    type: typeDef.symbol,
    charStart: offsets.charStart,
    charEnd: offsets.charEnd,
    userText,
  });
  hideAnnotationMenu();
  readerState.pendingSelection = null;
  window.getSelection?.()?.removeAllRanges?.();
  if (ann) {
    const finding = matchConceptFindings(session, ann);
    if (finding?.revealedInPhase1) showFindingToast(finding.conceptTerm);
    if (session.slow.fillableMapMode) {
      fillBlankFromAnnotation(session, ann, session.slow.currentPageIndex);
    }
    if (typeDef.symbol === "🔗" && userText) {
      addLiteratureGraphLink(session, ann.id, userText);
      await storeActiveSession(session);
    }
  }
  renderSlowReaderPage(session);

  if (typeDef.symbol === "⟷" && ann) {
    const picked = await showConceptPicker(session, { anchorRect });
    if (picked) {
      addGraphLink(session, ann.id, { termId: picked.termId, relation: userText });
      await storeActiveSession(session);
      renderSlowReaderPage(session);
    }
  }

  if (typeDef.symbol === "⚑" || typeDef.symbol === "⇑") {
    await runSteelManIAFlow(session, ann, userText, typeDef.symbol);
  }
  if (["⊘", "↯", "⚠"].includes(typeDef.symbol)) {
    maybeShowSteelManNudge(session, ann);
  }
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

  if (isSlowIAOverlayOpen()) {
    if (e.key === "Escape") {
      e.preventDefault();
      hideSlowIAOverlay();
    }
    return;
  }

  if (isSlowSteelManNudgeOpen()) {
    if (e.key === "Escape") {
      e.preventDefault();
      const session = stateSession();
      const modal = document.getElementById("slowSteelManNudge");
      modal?.querySelector(".slow-steelman-nudge-continue")?.click();
    }
    return;
  }

  const editMenu = document.getElementById("slowAnnotationEditMenu");
  if (editMenu && !editMenu.hidden) {
    if (e.key === "Escape") {
      e.preventDefault();
      const draft = readerState.editDraft;
      if (draft?.mode === "type" || draft?.mode === "text") {
        const ann = findAnnotation(session, draft.annId);
        if (ann) showAnnotationEditMenu(session, ann, editMenu.getBoundingClientRect());
        else hideAnnotationEditMenu();
      } else {
        hideAnnotationEditMenu();
      }
    }
    return;
  }

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

  const activeTag = document.activeElement?.tagName;
  const inFormField = activeTag === "INPUT" || activeTag === "TEXTAREA";

  if (!inFormField && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    const idx = Number(session.slow.currentPageIndex) || 0;
    e.preventDefault();
    goToReaderPage(session, e.key === "ArrowLeft" ? idx - 1 : idx + 1);
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

export async function initSlowReader(session) {
  if (!session?.slow) return;
  session.slow.phase = session.slow.phase === "phase2" ? session.slow.phase : "phase1";
  if (!session.slow.typography) {
    session.slow.typography = { ...SLOW_TYPO_DEFAULTS };
  }

  document.getElementById("slowReaderLayout")?.classList.remove("focus-mode");

  renderSlowReaderPage(session);
  wireSidebarToggle(stateSession);
  setIAReplyViewer(showSlowIAOverlayFromAnnotation);
  wireSidebarIAInput(stateSession, handleSidebarIAQuery);

  if (wired) return;
  wired = true;

  els.slowReaderPrevBtn?.addEventListener("click", () => {
    goToReaderPage(stateSession(), (stateSession()?.slow?.currentPageIndex || 0) - 1);
  });
  els.slowReaderNextBtn?.addEventListener("click", () => {
    goToReaderPage(stateSession(), (stateSession()?.slow?.currentPageIndex || 0) + 1);
  });

  els.slowReaderCompleteBtn?.addEventListener("click", async () => {
    const s = stateSession();
    if (!s?.slow) return;
    hideCheckpointChip();
    s.slow.phase = "phase3";
    await storeActiveSession(s);
    showScreen("slowPhase3");
    void initPhase3Screen(
      s,
      document.getElementById("slowPhase3Content"),
      document.getElementById("slowPhase3Modules"),
    );
  });

  els.slowReaderPage?.addEventListener("mouseup", () => {
    syncPendingSelection(stateSession());
  });

  document.addEventListener("selectionchange", onSlowReaderSelectionChange);
  document.addEventListener("keydown", onSlowReaderKeydown);

  let touchStartX = 0;
  let touchStartY = 0;
  let pageLongPressTimer = null;
  let pageLongPressFired = false;

  els.slowReaderPage?.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches?.[0]?.clientX || 0;
    touchStartY = e.changedTouches?.[0]?.clientY || 0;
    pageLongPressFired = false;
    if (pageLongPressTimer) clearTimeout(pageLongPressTimer);
    const x = touchStartX;
    const y = touchStartY;
    pageLongPressTimer = setTimeout(() => {
      pageLongPressFired = true;
      void handleWordLongPress(stateSession(), x, y);
    }, LONG_PRESS_MS);
  }, { passive: true });
  els.slowReaderPage?.addEventListener("touchend", (e) => {
    if (pageLongPressTimer) clearTimeout(pageLongPressTimer);
    pageLongPressTimer = null;
    if (pageLongPressFired) return;
    const dx = (e.changedTouches?.[0]?.clientX || 0) - touchStartX;
    if (Math.abs(dx) < 40) return;
    const s = stateSession();
    if (dx < 0) goToReaderPage(s, (s?.slow?.currentPageIndex || 0) + 1);
    else goToReaderPage(s, (s?.slow?.currentPageIndex || 0) - 1);
  }, { passive: true });
  els.slowReaderPage?.addEventListener("touchcancel", () => {
    if (pageLongPressTimer) clearTimeout(pageLongPressTimer);
    pageLongPressTimer = null;
  }, { passive: true });

  els.slowReaderPage?.addEventListener("contextmenu", (e) => {
    if (!isSlowReaderActive()) return;
    e.preventDefault();
    void handleWordLongPress(stateSession(), e.clientX, e.clientY);
  });

  document.getElementById("slowFontSmallerBtn")?.addEventListener("click", () => {
    const s = stateSession();
    if (!s?.slow) return;
    const current = Number(s.slow.typography?.fontSizePx) || SLOW_TYPO_DEFAULTS.fontSizePx;
    applyTypographyChange(s, { fontSizePx: Math.max(12, current - 1) });
  });
  document.getElementById("slowFontLargerBtn")?.addEventListener("click", () => {
    const s = stateSession();
    if (!s?.slow) return;
    const current = Number(s.slow.typography?.fontSizePx) || SLOW_TYPO_DEFAULTS.fontSizePx;
    applyTypographyChange(s, { fontSizePx: Math.min(24, current + 1) });
  });

  document.getElementById("slowLineSmallerBtn")?.addEventListener("click", () => {
    const s = stateSession();
    if (!s?.slow) return;
    const current = Number(s.slow.typography?.lineHeight) || SLOW_TYPO_DEFAULTS.lineHeight;
    applyTypographyChange(s, { lineHeight: Math.max(1.2, Math.round((current - 0.1) * 10) / 10) });
  });
  document.getElementById("slowLineLargerBtn")?.addEventListener("click", () => {
    const s = stateSession();
    if (!s?.slow) return;
    const current = Number(s.slow.typography?.lineHeight) || SLOW_TYPO_DEFAULTS.lineHeight;
    applyTypographyChange(s, { lineHeight: Math.min(2.0, Math.round((current + 0.1) * 10) / 10) });
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

export {
  buildVisibleToSourceMap,
  sourceOffsetToVisible,
  selectionToScopeOffsetsFromRendered,
  charOffsetToPage,
  getPageSlice,
};
