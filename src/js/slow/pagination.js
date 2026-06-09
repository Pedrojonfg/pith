/**
 * Viewport pagination for Slow Mode — char offsets relative to scope text.
 */

const cache = new Map();

function typographyKey(typography, containerWidth) {
  const t = typography && typeof typography === "object" ? typography : {};
  return [
    Number(t.fontSizePx) || 15,
    Number(t.lineHeight) || 1.4,
    String(t.fontFamily || "DM Sans"),
    Math.floor(Number(containerWidth) || 0),
  ].join("|");
}

function cacheKey(scopeText, typography, containerWidth, containerHeight, measureMode) {
  return [
    scopeText.length,
    typographyKey(typography, containerWidth),
    Math.floor(Number(containerHeight) || 0),
    measureMode || "plain",
    String(scopeText).slice(0, 64),
  ].join(":");
}

/** Small slack so subpixel rounding does not force scroll within a page. */
const PAGE_HEIGHT_SAFETY_PX = 6;

/**
 * If a section starts within (cut, cut + slack], snap page end to that boundary.
 * @param {{ charStart: number }[]} sectionBoundaries
 */
export function snapPageEndToSection(cut, sectionBoundaries, slack, textLength) {
  const end = Math.min(Number(textLength) || 0, Math.max(0, Number(cut) || 0));
  const slackVal = Math.max(0, Number(slack) || 0);
  let snap = null;
  for (const b of sectionBoundaries) {
    const start = Math.floor(Number(b?.charStart) || 0);
    if (start > end && start <= end + slackVal) {
      if (snap === null || start < snap) snap = start;
    }
  }
  return snap !== null ? snap : end;
}

function applyTypography(el, typography) {
  const t = typography && typeof typography === "object" ? typography : {};
  el.style.fontSize = `${Number(t.fontSizePx) || 15}px`;
  el.style.lineHeight = String(Number(t.lineHeight) || 1.4);
  el.style.fontFamily = String(t.fontFamily || '"DM Sans", sans-serif');
  el.style.whiteSpace = "pre-wrap";
  el.style.wordBreak = "break-word";
  el.style.width = "100%";
}

/**
 * @param {HTMLElement} containerEl
 * @param {object} typography
 * @param {(text: string) => number} measureHeight
 */
function findMaxCharsForPage(scopeText, start, containerHeight, measureHeight) {
  const text = String(scopeText || "");
  const len = text.length;
  if (start >= len) return 0;
  let lo = 1;
  let hi = len - start;
  let best = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const slice = text.slice(start, start + mid);
    const h = measureHeight(slice);
    if (h <= containerHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return Math.max(1, best);
}

/**
 * @param {object} [options]
 * @param {number} [options.availableHeight] Visible reading area height (px)
 * @param {(el: HTMLElement, slice: string) => void} [options.measureContent] Render slice like the live page
 * @param {string} [options.measureMode] Cache discriminator, e.g. "md" | "plain"
 * @returns {{ pageIndex: number, charStart: number, charEnd: number }[]}
 */
export function computePageBreakpoints(scopeText, containerEl, typography, options = {}) {
  const text = String(scopeText || "");
  if (!text.length) return [{ pageIndex: 0, charStart: 0, charEnd: 0 }];

  const width = Math.max(200, Number(containerEl?.clientWidth) || 600);
  const height = Math.max(
    100,
    Number(options.availableHeight ?? containerEl?.clientHeight) || 480,
  );
  const measureMode = options.measureMode || (options.measureContent ? "custom" : "plain");
  const key = cacheKey(text, typography, width, height, measureMode);
  if (cache.has(key)) return cache.get(key);

  const measureRoot =
    containerEl?.querySelector?.("[data-slow-measure]") ||
    (() => {
      const el = document.createElement("div");
      el.setAttribute("data-slow-measure", "1");
      el.style.position = "absolute";
      el.style.visibility = "hidden";
      el.style.pointerEvents = "none";
      el.style.left = "-9999px";
      el.style.top = "0";
      el.style.width = `${width}px`;
      el.style.boxSizing = "border-box";
      applyTypography(el, typography);
      containerEl?.appendChild?.(el);
      return el;
    })();

  applyTypography(measureRoot, typography);
  measureRoot.style.width = `${width}px`;
  const fontSize = Number(typography?.fontSizePx) || 15;
  const lineHeight = Number(typography?.lineHeight) || 1.4;
  const linePx = fontSize * lineHeight;
  const fitHeight = Math.max(50, height - PAGE_HEIGHT_SAFETY_PX);
  const renderSlice = typeof options.measureContent === "function" ? options.measureContent : null;

  const measureHeight = (slice) => {
    if (renderSlice) {
      renderSlice(measureRoot, slice);
    } else {
      measureRoot.className = "";
      measureRoot.innerHTML = "";
      measureRoot.textContent = slice;
    }
    const h = measureRoot.scrollHeight || measureRoot.offsetHeight || 0;
    if (h > 0) return h;
    const charsPerLine = Math.max(16, Math.floor(width / (fontSize * 0.5)));
    const lines = Math.max(1, Math.ceil(String(slice).length / charsPerLine));
    return lines * linePx;
  };

  const sectionBoundaries = Array.isArray(options.sectionBoundaries)
    ? options.sectionBoundaries
    : [];
  const sectionSnapSlack = Number(options.sectionSnapSlack) || 0;

  const breakpoints = [];
  let charStart = 0;
  let pageIndex = 0;
  while (charStart < text.length) {
    const maxChars = findMaxCharsForPage(text, charStart, fitHeight, measureHeight);
    let charEnd = Math.min(text.length, charStart + maxChars);
    if (sectionSnapSlack > 0 && sectionBoundaries.length) {
      charEnd = snapPageEndToSection(charEnd, sectionBoundaries, sectionSnapSlack, text.length);
    }
    breakpoints.push({ pageIndex, charStart, charEnd });
    if (charEnd <= charStart) break;
    charStart = charEnd;
    pageIndex += 1;
  }

  if (!breakpoints.length) breakpoints.push({ pageIndex: 0, charStart: 0, charEnd: text.length });
  cache.set(key, breakpoints);
  return breakpoints;
}

export function invalidatePaginationCache() {
  cache.clear();
}

export function getPageCount(breakpoints) {
  return Array.isArray(breakpoints) && breakpoints.length ? breakpoints.length : 0;
}

export function getPageSlice(breakpoints, pageIndex) {
  const idx = Math.max(0, Math.floor(Number(pageIndex) || 0));
  const bp = Array.isArray(breakpoints) ? breakpoints[idx] : null;
  if (!bp) return { charStart: 0, charEnd: 0 };
  return { charStart: bp.charStart, charEnd: bp.charEnd };
}

export function charOffsetToPage(breakpoints, charOffset) {
  const off = Math.max(0, Math.floor(Number(charOffset) || 0));
  const list = Array.isArray(breakpoints) ? breakpoints : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (off >= list[i].charStart) return list[i].pageIndex;
  }
  return 0;
}

/** After typography change, pick page whose charStart is closest to current offset. */
export function closestPageAfterRecompute(oldBreakpoints, oldPageIndex, newBreakpoints) {
  const oldSlice = getPageSlice(oldBreakpoints, oldPageIndex);
  const target = oldSlice.charStart;
  let best = 0;
  let bestDist = Infinity;
  for (const bp of newBreakpoints || []) {
    const dist = Math.abs(bp.charStart - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = bp.pageIndex;
    }
  }
  return best;
}
