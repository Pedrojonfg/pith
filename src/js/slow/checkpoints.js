import { parseHeadings } from "./headings.js?v=20260625_02";
import { getPageSlice, charOffsetToPage } from "./pagination.js?v=20260625_02";
import { addAnnotation } from "./annotations.js?v=20260625_02";
import { storeActiveSession } from "../session.js?v=20260625_02";
import { generateCheckpointQuestion } from "./phase0.js?v=20260625_02";
import { getStudyLanguage } from "../ui.js?v=20260625_02";

export const CHECKPOINT_DELAY_MS = 10000;
export const CHECKPOINT_CHIP_LABEL = "[= CHECKPOINT — 30 seg]";

/** Section boundaries within scope coordinates. */
export function buildSectionBoundaries(scopeText, format) {
  const text = String(scopeText || "");
  const headings = parseHeadings(text, format);
  if (!headings.length) {
    return [{ id: "full", charStart: 0, charEnd: text.length, title: "Document" }];
  }
  return headings.map((h, i) => {
    const next = headings[i + 1];
    return {
      id: String(h.label || i).toLowerCase().replace(/\s+/g, "-").slice(0, 40),
      charStart: h.charStart,
      charEnd: next ? next.charStart : text.length,
      title: h.label,
    };
  });
}

export function isLastPageOfSection(breakpoints, pageIndex, section) {
  // Legacy Slow page-fit helper; paced-reader / fixtures only — native Slow uses isLastPdfPageOfSection / scroll IO.
  const slice = getPageSlice(breakpoints, pageIndex);
  return slice.charEnd >= section.charEnd;
}

/**
 * Cumulative exclusive char ends per PDF page (index 0 → page 1).
 * Simplified / proportional mapping when text-layer lengths are unavailable.
 * @param {number} totalChars
 * @param {number} pageCount
 * @returns {number[]}
 */
export function buildProportionalPdfPageCharEnds(totalChars, pageCount) {
  const n = Math.max(0, Math.floor(Number(totalChars) || 0));
  const pages = Math.max(1, Math.floor(Number(pageCount) || 1));
  return Array.from({ length: pages }, (_, i) => Math.floor(((i + 1) * n) / pages));
}

/**
 * @param {number[]} pageLengths — text length per page in order (page 1 first)
 * @returns {number[]} cumulative exclusive ends
 */
export function pageLengthsToCharEnds(pageLengths) {
  const ends = [];
  let cum = 0;
  for (const len of pageLengths || []) {
    cum += Math.max(0, Math.floor(Number(len) || 0));
    ends.push(cum);
  }
  return ends;
}

/**
 * Scale cumulative page ends to match normalizedTextFull length when extraction drifts.
 * @param {number[]} pageCharEnds
 * @param {number} targetTotal
 * @returns {number[]}
 */
export function scalePdfPageCharEnds(pageCharEnds, targetTotal) {
  const ends = Array.isArray(pageCharEnds) ? pageCharEnds.map((e) => Math.max(0, Number(e) || 0)) : [];
  if (!ends.length) return ends;
  const last = ends[ends.length - 1] || 0;
  const target = Math.max(0, Math.floor(Number(targetTotal) || 0));
  if (target <= 0 || last <= 0 || last === target) return ends;
  return ends.map((e) => Math.round((e / last) * target));
}

/**
 * @param {number[]} pageCharEnds — cumulative exclusive ends (index 0 = page 1)
 * @param {number} charOffset
 * @returns {number} 1-indexed PDF page
 */
export function findPdfPageForCharOffset(pageCharEnds, charOffset) {
  const ends = Array.isArray(pageCharEnds) ? pageCharEnds : [];
  if (!ends.length) return 1;
  const offset = Math.max(0, Math.floor(Number(charOffset) || 0));
  for (let i = 0; i < ends.length; i += 1) {
    if (offset < ends[i]) return i + 1;
  }
  return ends.length;
}

/**
 * R-CP-2: page just left is last page overlapping the section.
 * @param {number[]} pageCharEnds
 * @param {number} page1 — 1-indexed
 * @param {{ charStart: number, charEnd: number }} section
 */
export function isLastPdfPageOfSection(pageCharEnds, page1, section) {
  const page = Math.max(1, Math.floor(Number(page1) || 1));
  const lastChar = Math.max(
    Number(section?.charStart) || 0,
    (Number(section?.charEnd) || 0) - 1,
  );
  return findPdfPageForCharOffset(pageCharEnds, lastChar) === page;
}

let checkpointTimer = null;
let checkpointEl = null;
let checkpointGen = 0;
/** @type {IntersectionObserver | null} */
let scrollCheckpointObserver = null;

export function clearCheckpointTimer() {
  if (checkpointTimer) clearTimeout(checkpointTimer);
  checkpointTimer = null;
}

/** Hide chip, cancel pending timer, and invalidate in-flight async show. */
export function hideCheckpointChip() {
  clearCheckpointTimer();
  checkpointGen += 1;
  if (checkpointEl) {
    checkpointEl.hidden = true;
    checkpointEl.innerHTML = "";
  }
}

function scopeTextForSession(session) {
  return String(session?.slow?.normalizedTextFull || "");
}

function checkpointsAllowed(session) {
  const slow = session?.slow;
  return Boolean(slow) && slow.phase === "phase1" && slow.checkpointsEnabled !== false;
}

async function dismissCheckpointSections(session, sectionIds) {
  const slow = session?.slow;
  if (!slow) return;
  const ids = (sectionIds || []).filter(Boolean);
  slow.checkpointsDismissed = [...new Set([...(slow.checkpointsDismissed || []), ...ids])];
  hideCheckpointChip();
  await storeActiveSession(session);
}

async function dismissCheckpointsOnPage(session, breakpoints, pageIndex) {
  const slow = session?.slow;
  if (!slow) return;
  const sections = buildSectionBoundaries(scopeTextForSession(session), slow.normalizedFormat);
  const ids = sections
    .filter((s) => isLastPageOfSection(breakpoints, pageIndex, s))
    .map((s) => s.id);
  await dismissCheckpointSections(session, ids);
}

async function dismissCheckpointsOnPdfPage(session, pageCharEnds, page1) {
  const slow = session?.slow;
  if (!slow) return;
  const sections = buildSectionBoundaries(scopeTextForSession(session), slow.normalizedFormat);
  const ids = sections
    .filter((s) => isLastPdfPageOfSection(pageCharEnds, page1, s))
    .map((s) => s.id);
  await dismissCheckpointSections(session, ids);
}

function scheduleSectionCheckpoint(session, section, dismissFn, onAnswer) {
  clearCheckpointTimer();
  if (!checkpointsAllowed(session) || !section) {
    hideCheckpointChip();
    return false;
  }
  const dismissed = new Set(session.slow.checkpointsDismissed || []);
  if (dismissed.has(section.id)) {
    hideCheckpointChip();
    return false;
  }

  checkpointTimer = setTimeout(() => {
    void showCheckpointChip(session, section, dismissFn, onAnswer);
  }, CHECKPOINT_DELAY_MS);
  return true;
}

/** Legacy pagination trigger — kept for fixtures/helpers; Slow reader uses PDF/scroll paths only (FR-004). */
export function maybeScheduleCheckpoint(session, breakpoints, pageIndex, onAnswer) {
  clearCheckpointTimer();
  if (!checkpointsAllowed(session)) {
    hideCheckpointChip();
    return;
  }

  const scopeText = scopeTextForSession(session);
  const sections = buildSectionBoundaries(scopeText, session.slow.normalizedFormat);
  const dismissed = new Set(session.slow.checkpointsDismissed || []);
  const section = sections.find(
    (s) => isLastPageOfSection(breakpoints, pageIndex, s) && !dismissed.has(s.id),
  );
  if (!section) {
    hideCheckpointChip();
    return;
  }

  scheduleSectionCheckpoint(
    session,
    section,
    () => dismissCheckpointsOnPage(session, breakpoints, pageIndex),
    onAnswer,
  );
}

/**
 * R-CP-2: after currentPdfPage advances, if leftPage was last page of an undismissed section.
 * @param {object} session
 * @param {number} leftPage1 — 1-indexed page just left
 * @param {number[]} pageCharEnds
 * @param {() => void} [onAnswer]
 */
export function maybeSchedulePdfCheckpoint(session, leftPage1, pageCharEnds, onAnswer) {
  clearCheckpointTimer();
  if (!checkpointsAllowed(session)) {
    hideCheckpointChip();
    return;
  }

  const page = Math.max(1, Math.floor(Number(leftPage1) || 1));
  const ends = Array.isArray(pageCharEnds) ? pageCharEnds : [];
  const sections = buildSectionBoundaries(scopeTextForSession(session), session.slow.normalizedFormat);
  const dismissed = new Set(session.slow.checkpointsDismissed || []);
  const section = sections.find(
    (s) => isLastPdfPageOfSection(ends, page, s) && !dismissed.has(s.id),
  );
  if (!section) {
    hideCheckpointChip();
    return;
  }

  scheduleSectionCheckpoint(
    session,
    section,
    () => dismissCheckpointsOnPdfPage(session, ends, page),
    onAnswer,
  );
}

/**
 * R-CP-3: section heading left the viewport top → schedule for that section id.
 * @param {object} session
 * @param {string} sectionId
 * @param {() => void} [onAnswer]
 */
export function maybeScheduleScrollCheckpoint(session, sectionId, onAnswer) {
  clearCheckpointTimer();
  if (!checkpointsAllowed(session)) {
    hideCheckpointChip();
    return;
  }

  const id = String(sectionId || "");
  if (!id) {
    hideCheckpointChip();
    return;
  }

  const sections = buildSectionBoundaries(scopeTextForSession(session), session.slow.normalizedFormat);
  const section = sections.find((s) => s.id === id);
  const dismissed = new Set(session.slow.checkpointsDismissed || []);
  if (!section || dismissed.has(section.id)) {
    hideCheckpointChip();
    return;
  }

  scheduleSectionCheckpoint(
    session,
    section,
    () => dismissCheckpointSections(session, [section.id]),
    onAnswer,
  );
}

/**
 * Bind section ids onto heading elements in document order (markdown h1–h6).
 * @param {Element | null | undefined} rootEl
 * @param {{ id: string, title?: string }[]} sections
 * @returns {{ el: Element, section: { id: string } }[]}
 */
export function markCheckpointSectionHeadings(rootEl, sections) {
  if (!rootEl || typeof rootEl.querySelectorAll !== "function") return [];
  const list = Array.isArray(sections) ? sections.filter((s) => s && s.id && s.id !== "full") : [];
  if (!list.length) return [];
  const headingEls = Array.from(rootEl.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  const marked = [];
  const n = Math.min(headingEls.length, list.length);
  for (let i = 0; i < n; i += 1) {
    const el = headingEls[i];
    const section = list[i];
    el.setAttribute("data-checkpoint-section-id", section.id);
    marked.push({ el, section });
  }
  return marked;
}

/**
 * True when a heading left the scroll root through the top edge.
 * @param {IntersectionObserverEntry} entry
 */
export function didHeadingExitViewportTop(entry) {
  if (!entry || entry.isIntersecting) return false;
  const rootTop = entry.rootBounds != null ? entry.rootBounds.top : 0;
  return entry.boundingClientRect.top < rootTop;
}

/**
 * R-CP-3: IntersectionObserver on section headings.
 * @param {{
 *   rootEl: Element,
 *   scrollRoot: Element,
 *   getSession: () => object | null | undefined,
 *   onAnswer?: () => void,
 * }} opts
 * @returns {() => void} disconnect
 */
export function attachScrollCheckpointObserver(opts) {
  detachScrollCheckpointObserver();
  const rootEl = opts?.rootEl;
  const scrollRoot = opts?.scrollRoot;
  const getSession = opts?.getSession;
  const onAnswer = opts?.onAnswer;
  const session = typeof getSession === "function" ? getSession() : null;
  if (!rootEl || !scrollRoot || !checkpointsAllowed(session)) return () => {};
  if (typeof IntersectionObserver === "undefined") return () => {};

  const sections = buildSectionBoundaries(
    scopeTextForSession(session),
    session.slow.normalizedFormat,
  );
  const marked = markCheckpointSectionHeadings(rootEl, sections);
  if (!marked.length) return () => {};

  scrollCheckpointObserver = new IntersectionObserver(
    (entries) => {
      const s = typeof getSession === "function" ? getSession() : null;
      if (!checkpointsAllowed(s)) return;
      for (const entry of entries) {
        if (!didHeadingExitViewportTop(entry)) continue;
        const sectionId = entry.target?.getAttribute?.("data-checkpoint-section-id");
        if (!sectionId) continue;
        maybeScheduleScrollCheckpoint(s, sectionId, onAnswer);
      }
    },
    {
      root: scrollRoot,
      // Small negative top margin: fire just as heading crosses past the top (R-CP-3).
      rootMargin: "-8px 0px 0px 0px",
      threshold: 0,
    },
  );

  for (const { el } of marked) scrollCheckpointObserver.observe(el);

  return detachScrollCheckpointObserver;
}

export function detachScrollCheckpointObserver() {
  if (scrollCheckpointObserver) {
    scrollCheckpointObserver.disconnect();
    scrollCheckpointObserver = null;
  }
}

function getSectionText(session, section) {
  return scopeTextForSession(session).slice(section.charStart, section.charEnd);
}

export async function resolveCheckpointQuestion(session, section) {
  const slow = session?.slow;
  if (!slow) return "";
  const cached = slow.checkpointQuestions?.[section.id];
  if (cached) return cached;

  const question = await generateCheckpointQuestion({
    section,
    argumentMap: slow.phase0?.argumentMap,
    sectionText: getSectionText(session, section),
    llmModel: session.llmModel || session._meta?.llm_model,
    phase0Skipped: slow.phase0Status === "skipped",
  });

  slow.checkpointQuestions = { ...(slow.checkpointQuestions || {}), [section.id]: question };
  await storeActiveSession(session);
  return question;
}

async function showCheckpointChip(session, section, dismissFn, onAnswer) {
  const slow = session?.slow;
  if (
    !slow ||
    slow.checkpointsEnabled === false ||
    (slow.checkpointsDismissed || []).includes(section.id)
  ) {
    return;
  }

  const gen = ++checkpointGen;
  if (!checkpointEl) {
    checkpointEl = document.createElement("div");
    checkpointEl.id = "slowCheckpointChip";
    checkpointEl.className = "slow-checkpoint-chip";
    document.body.appendChild(checkpointEl);
  }
  checkpointEl.innerHTML = "";
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "slow-checkpoint-dismiss";
  dismiss.setAttribute("aria-label", "Dismiss checkpoint");
  dismiss.textContent = "×";
  const onDismiss = (e) => {
    e.preventDefault();
    e.stopPropagation();
    void dismissFn();
  };
  dismiss.addEventListener("click", onDismiss);

  const label = document.createElement("span");
  label.className = "slow-checkpoint-label";
  label.textContent = CHECKPOINT_CHIP_LABEL;

  const questionEl = document.createElement("p");
  questionEl.className = "slow-checkpoint-question";
  questionEl.textContent = "…";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "slow-checkpoint-input";
  const lang = getStudyLanguage() || "English";
  input.placeholder = /spanish|español|^es/i.test(lang) ? "Tu respuesta…" : "Your answer…";

  const send = document.createElement("button");
  send.type = "button";
  send.textContent = "→";
  send.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text) return;
    await addAnnotation(session, {
      type: "?",
      charStart: section.charEnd - 1,
      charEnd: section.charEnd,
      userText: text,
    });
    await dismissFn();
    if (typeof onAnswer === "function") onAnswer();
  });

  checkpointEl.append(label, dismiss, questionEl, input, send);
  checkpointEl.hidden = false;

  let startX = 0;
  checkpointEl.addEventListener(
    "touchstart",
    (e) => {
      startX = e.changedTouches?.[0]?.clientX || 0;
    },
    { once: true, passive: true },
  );
  checkpointEl.addEventListener(
    "touchend",
    (e) => {
      const dx = (e.changedTouches?.[0]?.clientX || 0) - startX;
      if (Math.abs(dx) > 50) void dismissFn();
    },
    { once: true, passive: true },
  );

  try {
    const question = await resolveCheckpointQuestion(session, section);
    if (gen !== checkpointGen || checkpointEl.hidden) return;
    questionEl.textContent = question;
  } catch {
    if (gen !== checkpointGen || checkpointEl.hidden) return;
    questionEl.textContent = "…";
  }
}

export { charOffsetToPage };
