/**
 * Viewport pagination for Slow Mode — char offsets relative to scope text.
 */

const cache = new Map();

function typographyKey(typography, containerWidth) {
  const t = typography && typeof typography === "object" ? typography : {};
  return [
    Number(t.fontSizePx) || 18,
    Number(t.lineHeight) || 1.6,
    String(t.fontFamily || "DM Sans"),
    Math.floor(Number(containerWidth) || 0),
  ].join("|");
}

function cacheKey(scopeText, typography, containerWidth) {
  return `${scopeText.length}:${typographyKey(typography, containerWidth)}:${String(scopeText).slice(0, 64)}`;
}

function applyTypography(el, typography) {
  const t = typography && typeof typography === "object" ? typography : {};
  el.style.fontSize = `${Number(t.fontSizePx) || 18}px`;
  el.style.lineHeight = String(Number(t.lineHeight) || 1.6);
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
 * @returns {{ pageIndex: number, charStart: number, charEnd: number }[]}
 */
export function computePageBreakpoints(scopeText, containerEl, typography) {
  const text = String(scopeText || "");
  if (!text.length) return [{ pageIndex: 0, charStart: 0, charEnd: 0 }];

  const width = Math.max(200, Number(containerEl?.clientWidth) || 600);
  const height = Math.max(100, Number(containerEl?.clientHeight) || 480);
  const key = cacheKey(text, typography, width);
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
      applyTypography(el, typography);
      containerEl?.appendChild?.(el);
      return el;
    })();

  applyTypography(measureRoot, typography);
  measureRoot.style.width = `${width}px`;
  const fontSize = Number(typography?.fontSizePx) || 18;
  const lineHeight = Number(typography?.lineHeight) || 1.6;
  const linePx = fontSize * lineHeight;

  const measureHeight = (slice) => {
    measureRoot.textContent = slice;
    const h = measureRoot.scrollHeight || measureRoot.offsetHeight || 0;
    if (h > 0) return h;
    const charsPerLine = Math.max(16, Math.floor(width / (fontSize * 0.5)));
    const lines = Math.max(1, Math.ceil(String(slice).length / charsPerLine));
    return lines * linePx;
  };

  const breakpoints = [];
  let charStart = 0;
  let pageIndex = 0;
  while (charStart < text.length) {
    const maxChars = findMaxCharsForPage(text, charStart, height, measureHeight);
    const charEnd = Math.min(text.length, charStart + maxChars);
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
