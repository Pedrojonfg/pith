import { LS_RSVP_DEFAULT_WPF_KEY, LS_RSVP_DEFAULT_WPM_KEY } from "./config.js?v=20260503_7";
import { clampInt } from "./session.js?v=20260503_7";
import { els, hideSidebar, showSidebar, typesetMath } from "./ui.js?v=20260503_7";

/** @typedef {{ type: "text"|"math", content: string, preRenderedHtml?: string }} RsvpChunk */

export const rsvpState = {
  /** Full explanation markdown (persisted across WPF rebuilds). */
  sourceExplanation: "",
  /** @type {RsvpChunk[]} */
  chunks: [],
  /** Index of the chunk currently on screen while the dwell timer runs. */
  displayedChunkIndex: 0,
  wpm: 500,
  wordsPerFlash: 3,
  timerId: null,
  playing: true,
  onDone: null,
  countdownActive: false,
  /** Bumped when starting / finishing RSVP or rebuilding chunks — not on pause/play. */
  playbackGen: 0,
};

const LS_RSVP_CONTAINER_SIZE_KEY = "rsvp_container_size";
const RSVP_DESKTOP_DEFAULT_WIDTH = 500;
const RSVP_DESKTOP_DEFAULT_HEIGHT = 120;
const RSVP_MOBILE_WIDTH_VW = 90;
const RSVP_MOBILE_HEIGHT = 90;

let rsvpContainerEl = null;
let rsvpResizeObserver = null;
let lastCalculatedNormalFontSize = 16;

function isRsvpMobileViewport() {
  return window.innerWidth < 600;
}

function loadStoredRsvpContainerSize() {
  try {
    const raw = localStorage.getItem(LS_RSVP_CONTAINER_SIZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const width = Number(parsed?.width);
    const height = Number(parsed?.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return { width: Math.round(width), height: Math.round(height) };
  } catch {
    return null;
  }
}

function persistRsvpContainerSize(width, height) {
  if (isRsvpMobileViewport()) return;
  try {
    localStorage.setItem(
      LS_RSVP_CONTAINER_SIZE_KEY,
      JSON.stringify({ width: Math.round(width), height: Math.round(height) }),
    );
  } catch {
    // ignore storage errors
  }
}

function calcRSVPFontSize(containerWidth, containerHeight, wordCount) {
  const testEl = document.getElementById("rsvp-word-display");
  if (!testEl) return lastCalculatedNormalFontSize;
  if (!Number.isFinite(containerWidth) || !Number.isFinite(containerHeight)) {
    return lastCalculatedNormalFontSize;
  }
  // Keep signature aligned with caller context; longer flashes naturally
  // measure larger through scrollWidth/scrollHeight.
  void wordCount;
  let lo = 8;
  let hi = 120;
  let best = 16;
  for (let i = 0; i < 12; i += 1) {
    const mid = (lo + hi) / 2;
    testEl.style.fontSize = `${mid}px`;
    const fits =
      testEl.scrollWidth <= containerWidth * 0.85 &&
      testEl.scrollHeight <= containerHeight * 0.7;
    if (fits) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  testEl.style.fontSize = `${best}px`;
  lastCalculatedNormalFontSize = best;
  return best;
}

function isLatexLikeChunk(meta) {
  const text = String(meta?.content || "");
  return text.includes("\\") || text.includes("$");
}

function applyRsvpFontSizingForChunk(meta) {
  const displayEl = document.getElementById("rsvp-word-display");
  if (!displayEl || !rsvpContainerEl || !meta) return;
  if (isLatexLikeChunk(meta)) {
    displayEl.style.fontSize = `${Math.max(8, lastCalculatedNormalFontSize * 0.6)}px`;
    return;
  }
  const wc = String(meta.content || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  calcRSVPFontSize(rsvpContainerEl.clientWidth, rsvpContainerEl.clientHeight, wc);
}

function applyRsvpContainerSizing() {
  if (!rsvpContainerEl) return;
  if (isRsvpMobileViewport()) {
    rsvpContainerEl.style.resize = "none";
    rsvpContainerEl.style.width = `${RSVP_MOBILE_WIDTH_VW}vw`;
    rsvpContainerEl.style.height = `${RSVP_MOBILE_HEIGHT}px`;
    return;
  }
  rsvpContainerEl.style.resize = "both";
  const stored = loadStoredRsvpContainerSize();
  const width = stored?.width || RSVP_DESKTOP_DEFAULT_WIDTH;
  const height = stored?.height || RSVP_DESKTOP_DEFAULT_HEIGHT;
  rsvpContainerEl.style.width = `${width}px`;
  rsvpContainerEl.style.height = `${height}px`;
}

function ensureRsvpContainer() {
  if (rsvpContainerEl && rsvpContainerEl.isConnected) return;
  const existing = els.rsvpOverlay.querySelector(".rsvp-container");
  if (existing) {
    rsvpContainerEl = existing;
  } else {
    const container = document.createElement("div");
    container.className = "rsvp-container";
    if (els.rsvpChunk.parentNode) {
      els.rsvpChunk.parentNode.insertBefore(container, els.rsvpChunk);
      container.appendChild(els.rsvpChunk);
    }
    rsvpContainerEl = container;
  }
  applyRsvpContainerSizing();
  if (!rsvpResizeObserver) {
    rsvpResizeObserver = new ResizeObserver(() => {
      if (!rsvpContainerEl) return;
      if (!isRsvpMobileViewport()) {
        persistRsvpContainerSize(rsvpContainerEl.clientWidth, rsvpContainerEl.clientHeight);
      }
      const currentMeta = rsvpState.chunks[rsvpState.displayedChunkIndex];
      applyRsvpFontSizingForChunk(currentMeta);
    });
  }
  rsvpResizeObserver.observe(rsvpContainerEl);
}

window.addEventListener("resize", () => {
  if (!rsvpContainerEl) return;
  applyRsvpContainerSizing();
  const currentMeta = rsvpState.chunks[rsvpState.displayedChunkIndex];
  applyRsvpFontSizingForChunk(currentMeta);
});

export function setRsvpOverlayActive(isActive) {
  els.rsvpOverlay.setAttribute("aria-hidden", String(!isActive));
  document.body.classList.toggle("rsvp-active", isActive);
}

function bumpPlaybackGen() {
  rsvpState.playbackGen += 1;
}

export function cancelRsvpTimer() {
  if (rsvpState.timerId) clearTimeout(rsvpState.timerId);
  rsvpState.timerId = null;
}

function durationMsBaseTextChunk() {
  const wpm = Math.max(1, Number(rsvpState.wpm) || 500);
  const wpf = Math.max(1, Number(rsvpState.wordsPerFlash) || 1);
  return Math.max(20, Math.round((60000 * wpf) / wpm));
}

/** @param {RsvpChunk} meta */
function durationMsVisibleForChunk(meta) {
  const base = durationMsBaseTextChunk();
  if (!meta || meta.type !== "math") return base;
  return Math.round(base * 5);
}

function finalPauseMs() {
  const b = durationMsBaseTextChunk();
  return Math.min(1000, Math.max(520, Math.round(b * 1.15)));
}

function tokenizeWords(text) {
  const raw = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return [];
  return raw.split(" ").filter(Boolean);
}

function chunkWords(words, wordsPerFlash) {
  const wpf = Math.max(1, Number(wordsPerFlash) || 1);
  const out = [];
  for (let i = 0; i < words.length; i += wpf) {
    out.push(words.slice(i, i + wpf).join(" "));
  }
  return out;
}

function getORP(word) {
  const len = String(word || "").replace(/[^a-zA-Z]/g, "").length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

/** True if odd number of `\` chars immediately precede `idx`. */
function isEscapedAt(str, idx) {
  let n = 0;
  for (let j = idx - 1; j >= 0 && str[j] === "\\"; j -= 1) n += 1;
  return n % 2 === 1;
}

function findFirstUnescaped(s, from, needle) {
  let i = from;
  while (i <= s.length - needle.length) {
    const idx = s.indexOf(needle, i);
    if (idx === -1) return -1;
    if (!isEscapedAt(s, idx)) return idx;
    i = idx + needle.length;
  }
  return -1;
}

function findClosingInlineDollar(s, openEnd) {
  let i = openEnd;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\") {
      i += Math.min(2, s.length - i);
      continue;
    }
    if (ch !== "$") {
      i += 1;
      continue;
    }
    if (s[i + 1] === "$") {
      i += 2;
      continue;
    }
    return i;
  }
  return -1;
}

/**
 * @returns {{ type: 'text', raw: string } | { type: 'math', raw: string }[]}
 */
function segmentTextAndMath(raw) {
  const s = String(raw || "");
  const out = [];
  let pos = 0;

  while (pos < s.length) {
    /** @type {null | { kind: string; idx: number; openLen: number }} */
    let found = null;
    let i = pos;
    while (i < s.length && !found) {
      if (s.startsWith("$$", i)) {
        found = { kind: "ddollar", idx: i, openLen: 2 };
      } else if (s.startsWith("\\[", i) && !isEscapedAt(s, i)) {
        found = { kind: "brack", idx: i, openLen: 2 };
      } else if (s.startsWith("\\(", i) && !isEscapedAt(s, i)) {
        found = { kind: "paren", idx: i, openLen: 2 };
      } else if (s[i] === "$") {
        found = { kind: "dollar", idx: i, openLen: 1 };
      } else if (s[i] === "\\") {
        i += Math.min(2, s.length - i);
        continue;
      } else {
        i += 1;
      }
    }

    if (!found) {
      const tail = s.slice(pos);
      if (tail) out.push({ type: "text", raw: tail });
      break;
    }

    if (found.idx > pos) out.push({ type: "text", raw: s.slice(pos, found.idx) });

    const bodyStart = found.idx + found.openLen;
    let closeEndExclusive = -1;

    if (found.kind === "ddollar") {
      const ci = findFirstUnescaped(s, bodyStart, "$$");
      if (ci !== -1) closeEndExclusive = ci + 2;
    } else if (found.kind === "brack") {
      const ci = findFirstUnescaped(s, bodyStart, "\\]");
      if (ci !== -1) closeEndExclusive = ci + 2;
    } else if (found.kind === "paren") {
      const ci = findFirstUnescaped(s, bodyStart, "\\)");
      if (ci !== -1) closeEndExclusive = ci + 2;
    } else {
      const ci = findClosingInlineDollar(s, bodyStart);
      if (ci !== -1) closeEndExclusive = ci + 1;
    }

    if (closeEndExclusive === -1) {
      pos = found.idx + 1;
      continue;
    }

    out.push({ type: "math", raw: s.slice(found.idx, closeEndExclusive) });
    pos = closeEndExclusive;
  }

  return out;
}

/**
 * @param {string} explanationText
 * @param {number} wordsPerFlash
 * @returns {RsvpChunk[]}
 */
function buildChunksFromExplanation(explanationText, wordsPerFlash) {
  const wpf = Math.max(1, Number(wordsPerFlash) || 1);
  /** @type {RsvpChunk[]} */
  const chunks = [];

  for (const seg of segmentTextAndMath(explanationText)) {
    if (seg.type === "text") {
      for (const t of chunkWords(tokenizeWords(seg.raw), wpf)) {
        if (t) chunks.push({ type: "text", content: t });
      }
    } else {
      const trimmed = String(seg.raw || "").trim();
      if (!trimmed) continue;
      chunks.push({ type: "math", content: trimmed });
    }
  }
  return chunks;
}

function clearRsvpChunkEl() {
  els.rsvpChunk.innerHTML = "";
}

/**
 * Pre-renders all math chunks into a hidden off-screen container, caching the
 * resulting innerHTML on each chunk. Uses a fresh element per chunk so MathJax
 * never re-encounters a previously-processed node and skips re-rendering.
 *
 * @param {RsvpChunk[]} chunks
 * @param {number} genCapture
 */
async function preRenderMathChunks(chunks, genCapture) {
  const mathChunks = chunks.filter(c => c.type === "math" && !c.preRenderedHtml);
  if (!mathChunks.length) return;

  const container = document.createElement("div");
  container.style.cssText = "position:absolute;left:-9999px;top:-9999px;pointer-events:none";
  document.body.appendChild(container);
  try {
    for (const chunk of mathChunks) {
      if (genCapture !== rsvpState.playbackGen) break;
      const el = document.createElement("span");
      el.textContent = chunk.content;
      container.appendChild(el);
      await typesetMath(el);
      chunk.preRenderedHtml = el.innerHTML;
      container.removeChild(el);
    }
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}

/** @param {RsvpChunk} meta */
function applyChunkToDom(meta) {
  clearRsvpChunkEl();
  if (!meta) return Promise.resolve();
  if (meta.type === "text") {
    const word = String(meta.content || "");
    const orpIndex = Math.min(getORP(word), Math.max(word.length - 1, 0));
    const display = document.createElement("span");
    display.className = "rsvp-word-display";
    display.id = "rsvp-word-display";

    const before = document.createElement("span");
    before.className = "rsvp-before";
    before.textContent = word.slice(0, orpIndex);

    const orp = document.createElement("span");
    orp.className = "rsvp-orp";
    orp.textContent = word[orpIndex] || "";

    const after = document.createElement("span");
    after.className = "rsvp-after";
    after.textContent = word.slice(orpIndex + 1);

    display.append(before, orp, after);
    els.rsvpChunk.appendChild(display);
    applyRsvpFontSizingForChunk(meta);
    return Promise.resolve();
  }
  // Fast path: use pre-rendered HTML (no MathJax call needed, no flicker)
  const mathDisplay = document.createElement("span");
  mathDisplay.id = "rsvp-word-display";
  mathDisplay.className = "rsvp-word-display";
  if (meta.preRenderedHtml) {
    mathDisplay.innerHTML = meta.preRenderedHtml;
    els.rsvpChunk.appendChild(mathDisplay);
    applyRsvpFontSizingForChunk(meta);
    return Promise.resolve();
  }
  // Fallback: render on-demand with a FRESH child element so MathJax always
  // sees an unprocessed node and never skips re-rendering due to its cache.
  const el = document.createElement("span");
  el.textContent = meta.content || "";
  mathDisplay.appendChild(el);
  els.rsvpChunk.appendChild(mathDisplay);
  applyRsvpFontSizingForChunk(meta);
  return typesetMath(el);
}

/**
 * Visible time for chunk k: read time for chunk k.
 * Last chunk adds a short settling pause before leaving RSVP.
 */
function dwellMsAfterShowingIndex(k, len) {
  const meta = rsvpState.chunks[k];
  const base = durationMsVisibleForChunk(meta);
  return k === len - 1 ? base + finalPauseMs() : base;
}

/**
 * Show chunk `k`, then after dwell advance or finish.
 * @param {number} genCapture
 */
async function showChunkByIndex(k, genCapture) {
  if (
    genCapture !== rsvpState.playbackGen ||
    !rsvpState.playing ||
    k >= rsvpState.chunks.length
  ) {
    return;
  }

  rsvpState.displayedChunkIndex = k;
  await applyChunkToDom(rsvpState.chunks[k]);

  if (genCapture !== rsvpState.playbackGen || !rsvpState.playing) {
    return;
  }

  const len = rsvpState.chunks.length;
  const wait = dwellMsAfterShowingIndex(k, len);

  cancelRsvpTimer();
  rsvpState.timerId = setTimeout(() => {
    rsvpState.timerId = null;
    if (genCapture !== rsvpState.playbackGen || !rsvpState.playing) {
      return;
    }
    if (k >= len - 1) {
      finishRsvp();
      return;
    }
    void showChunkByIndex(k + 1, genCapture);
  }, wait);
}

function restartPlaybackTail() {
  cancelRsvpTimer();
  if (!rsvpState.chunks.length) {
    finishRsvp();
    return;
  }
  bumpPlaybackGen();
  const gen = rsvpState.playbackGen;
  void showChunkByIndex(
    Math.min(rsvpState.displayedChunkIndex, rsvpState.chunks.length - 1),
    gen,
  );
}

function setWpfUi(wpf) {
  const v = Number(wpf);
  for (const btn of els.rsvpWpfButtons || []) {
    const btnWpf = Number(btn.dataset.wpf);
    btn.setAttribute("aria-pressed", String(btnWpf === v));
  }
}

export function loadRsvpDefaultsFromStorage() {
  const storedWpm = localStorage.getItem(LS_RSVP_DEFAULT_WPM_KEY);
  const storedWpf = localStorage.getItem(LS_RSVP_DEFAULT_WPF_KEY);
  const wpm = clampInt(storedWpm, 100, 1000, 500);
  const wpf = clampInt(storedWpf, 1, 10, 3);
  rsvpState.wpm = wpm;
  rsvpState.wordsPerFlash = wpf;
  els.rsvpWpm.value = String(wpm);
  els.rsvpWpmLabel.textContent = String(wpm);
  setWpfUi(wpf);
}

export function persistRsvpDefaults() {
  try {
    localStorage.setItem(LS_RSVP_DEFAULT_WPM_KEY, String(rsvpState.wpm));
    localStorage.setItem(LS_RSVP_DEFAULT_WPF_KEY, String(rsvpState.wordsPerFlash));
  } catch {
    // ignore storage errors
  }
}

export function finishRsvp() {
  bumpPlaybackGen();
  cancelRsvpTimer();
  rsvpState.countdownActive = false;
  clearRsvpChunkEl();
  setRsvpOverlayActive(false);
  showSidebar();
  if (typeof rsvpState.onDone === "function") rsvpState.onDone();
}

function beginPlaybackLoop() {
  cancelRsvpTimer();
  if (!rsvpState.chunks.length) {
    finishRsvp();
    return;
  }
  bumpPlaybackGen();
  const gen = rsvpState.playbackGen;
  void showChunkByIndex(0, gen);
}

export function setRsvpPlayState(nextPlaying) {
  rsvpState.playing = nextPlaying;
  els.rsvpPlayPauseBtn.textContent = rsvpState.playing ? "Pause" : "Play";
  if (!rsvpState.playing) {
    cancelRsvpTimer();
    return;
  }
  if (
    !rsvpState.countdownActive &&
    els.rsvpOverlay.getAttribute("aria-hidden") === "false" &&
    rsvpState.chunks.length > 0
  ) {
    restartPlaybackTail();
  }
}

export function setWordsPerFlash(nextWpf) {
  const prev = Math.max(1, Number(rsvpState.wordsPerFlash) || 1);
  const next = Math.min(10, Math.max(1, Number(nextWpf) || 1));
  if (prev === next) return;

  const overlayOpen = els.rsvpOverlay.getAttribute("aria-hidden") === "false";
  const midSession = overlayOpen && !rsvpState.countdownActive && rsvpState.sourceExplanation;

  bumpPlaybackGen();
  cancelRsvpTimer();

  const oldChunks = rsvpState.chunks;
  const oldLen = Math.max(oldChunks.length || 0, 1);
  const oldShown = Math.min(
    Number(rsvpState.displayedChunkIndex) || 0,
    Math.max((oldChunks.length || 1) - 1, 0),
  );

  rsvpState.wordsPerFlash = next;
  setWpfUi(next);

  const src =
    typeof rsvpState.sourceExplanation === "string" ? rsvpState.sourceExplanation : "";
  rsvpState.chunks = buildChunksFromExplanation(src, rsvpState.wordsPerFlash);
  const newLen = Math.max(rsvpState.chunks.length, 1);
  let mapped = Math.round((oldShown / Math.max(oldLen - 1, 1)) * Math.max(newLen - 1, 0));
  if (!Number.isFinite(mapped) || mapped < 0) mapped = 0;
  rsvpState.displayedChunkIndex = Math.min(mapped, Math.max(rsvpState.chunks.length - 1, 0));

  if (!rsvpState.chunks.length) {
    persistRsvpDefaults();
    if (midSession) finishRsvp();
    return;
  }

  // Re-render math for the new chunking. The fallback in applyChunkToDom
  // handles any chunk that hasn't finished pre-rendering yet.
  void preRenderMathChunks(rsvpState.chunks, rsvpState.playbackGen);

  if (midSession && rsvpState.playing) {
    const gen = rsvpState.playbackGen;
    void showChunkByIndex(rsvpState.displayedChunkIndex, gen);
  }

  persistRsvpDefaults();
}

export function startRsvpForText(explanationText, onDone) {
  bumpPlaybackGen();
  cancelRsvpTimer();

  rsvpState.sourceExplanation =
    explanationText !== undefined && explanationText !== null
      ? String(explanationText)
      : "";

  rsvpState.chunks = buildChunksFromExplanation(
    rsvpState.sourceExplanation,
    rsvpState.wordsPerFlash,
  );
  rsvpState.displayedChunkIndex = 0;
  rsvpState.playing = false;
  rsvpState.onDone = onDone;
  rsvpState.countdownActive = true;

  hideSidebar();
  setRsvpOverlayActive(true);
  ensureRsvpContainer();
  els.rsvpWpm.value = String(rsvpState.wpm);
  els.rsvpWpmLabel.textContent = String(rsvpState.wpm);
  setWpfUi(rsvpState.wordsPerFlash);
  els.rsvpChunk.textContent = "3...";
  els.rsvpPlayPauseBtn.textContent = "Pause";

  // Pre-render all math chunks during the 3-second countdown so the first
  // flash is always instant (no MathJax async latency mid-playback).
  void preRenderMathChunks(rsvpState.chunks, rsvpState.playbackGen);

  const steps = ["3...", "2...", "1..."];
  let i = 0;
  const countdownGen = rsvpState.playbackGen;
  const tick = () => {
    if (countdownGen !== rsvpState.playbackGen) return;
    if (i >= steps.length) {
      els.rsvpChunk.textContent = "";
      rsvpState.playing = true;
      rsvpState.countdownActive = false;
      els.rsvpPlayPauseBtn.textContent = "Pause";
      beginPlaybackLoop();
      return;
    }
    els.rsvpChunk.textContent = steps[i];
    i += 1;
    rsvpState.timerId = setTimeout(tick, 1000);
  };
  tick();
}
