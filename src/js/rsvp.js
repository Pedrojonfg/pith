import {
  LS_RSVP_COMPREHENSION_EVERY_KEY,
  LS_RSVP_COMPREHENSION_PAUSE_KEY,
  LS_RSVP_DEFAULT_WPF_KEY,
  LS_RSVP_DEFAULT_WPM_KEY,
} from "./config.js?v=20260525_1";
import { clampInt } from "./session.js?v=20260525_1";
import { stripMarkdownForPlainText } from "./markdown.js?v=20260525_1";
import { els, hideSidebar, showSidebar, typesetMath } from "./ui.js?v=20260525_1";

/** @typedef {{ type: "text"|"math", content: string, preRenderedHtml?: string, paragraphStart?: boolean, afterBoldEnd?: boolean }} RsvpChunk */

export const rsvpState = {
  /** Full explanation markdown (persisted across WPF rebuilds). */
  sourceExplanation: "",
  /** @type {RsvpChunk[]} */
  chunks: [],
  /** Index of the chunk currently on screen while the dwell timer runs. */
  displayedChunkIndex: 0,
  wpm: 500,
  wordsPerFlash: 1,
  timerId: null,
  playing: true,
  onDone: null,
  countdownActive: false,
  /** Bumped when starting / finishing RSVP or rebuilding chunks — not on pause/play. */
  playbackGen: 0,
  comprehensionPauseEnabled: false,
  comprehensionEveryN: 25,
  /** Word-units shown since last comprehension pause. */
  wordsSinceComprehensionPause: 0,
  currentBlockTitle: "",
};

const LS_RSVP_CONTAINER_SIZE_KEY = "rsvp_container_size";
const RSVP_DESKTOP_DEFAULT_WIDTH = 500;
const RSVP_DESKTOP_DEFAULT_HEIGHT = 120;
const RSVP_MOBILE_WIDTH_VW = 90;
const RSVP_MOBILE_HEIGHT = 90;

let rsvpContainerEl = null;
let rsvpResizeObserver = null;
let fontProbeEl = null;
let rsvpBlockTitleEl = null;
let rsvpHandlersWired = false;

/** @typedef {{ fontSizePx: number, mathScale: number, containerWidth: number, containerHeight: number, wordsPerFlash: number, computedAt: number }} RsvpTypographyProfile */

/** @type {RsvpTypographyProfile | null} */
let typographyProfile = null;

const RSVP_PROBE_FALLBACK = "internacionalización ";
const RSVP_MATH_FONT_SCALE = 0.85;
const RSVP_MIN_FONT_PX = 16;

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

/**
 * @param {number} wordsPerFlash
 * @param {string} [explanationText]
 */
function buildTypographyProbe(wordsPerFlash, explanationText) {
  const wpf = Math.max(1, Number(wordsPerFlash) || 1);
  const word = longestWordTokenFromExplanation(explanationText);
  return word.repeat(wpf);
}

function ensureFontProbeEl() {
  if (!rsvpContainerEl) return null;
  if (fontProbeEl?.isConnected) return fontProbeEl;
  fontProbeEl = document.createElement("span");
  fontProbeEl.id = "rsvp-font-probe";
  fontProbeEl.className = "rsvp-word-display";
  fontProbeEl.setAttribute("aria-hidden", "true");
  fontProbeEl.style.cssText =
    "position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;white-space:pre;max-width:100%;";
  rsvpContainerEl.appendChild(fontProbeEl);
  return fontProbeEl;
}

/** @param {HTMLElement} testEl */
function binarySearchFontSizePx(testEl, containerWidth, containerHeight) {
  let lo = RSVP_MIN_FONT_PX;
  let hi = 200;
  let best = 32;

  for (let i = 0; i < 15; i++) {
    const mid = Math.floor((lo + hi) / 2);
    testEl.style.fontSize = `${mid}px`;
    const fits =
      testEl.scrollWidth <= containerWidth * 0.75 &&
      testEl.scrollHeight <= containerHeight * 0.6;
    if (fits) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return Math.max(RSVP_MIN_FONT_PX, best);
}

/**
 * @param {HTMLElement} containerEl
 * @param {number} wordsPerFlash
 * @param {string} [explanationText]
 * @returns {RsvpTypographyProfile | null}
 */
function computeRsvpTypographyProfile(containerEl, wordsPerFlash, explanationText) {
  const cw = containerEl?.clientWidth ?? 0;
  const ch = containerEl?.clientHeight ?? 0;
  if (cw <= 0 || ch <= 0) return null;

  const probe = ensureFontProbeEl();
  if (!probe) return null;

  probe.textContent = buildTypographyProbe(wordsPerFlash, explanationText);
  probe.style.transform = "";
  const fontSizePx = binarySearchFontSizePx(probe, cw, ch);

  return {
    fontSizePx,
    mathScale: RSVP_MATH_FONT_SCALE,
    containerWidth: cw,
    containerHeight: ch,
    wordsPerFlash: Math.max(1, Number(wordsPerFlash) || 1),
    computedAt: Date.now(),
  };
}

/**
 * @param {HTMLElement} displayEl
 * @param {RsvpTypographyProfile} profile
 * @param {RsvpChunk} meta
 */
function applySessionFontSize(displayEl, profile, meta) {
  if (!displayEl || !profile) return;
  if (meta.type === "math") {
    displayEl.style.fontSize = `${Math.max(8, Math.round(profile.fontSizePx * profile.mathScale))}px`;
  } else {
    displayEl.style.fontSize = `${profile.fontSizePx}px`;
  }
}

function recomputeTypographyProfile() {
  if (!rsvpContainerEl) return;
  typographyProfile = computeRsvpTypographyProfile(
    rsvpContainerEl,
    rsvpState.wordsPerFlash,
    rsvpState.sourceExplanation,
  );
  const meta = rsvpState.chunks[rsvpState.displayedChunkIndex];
  const displayEl = document.getElementById("rsvp-word-display");
  if (!displayEl || !meta || !typographyProfile) return;
  applySessionFontSize(displayEl, typographyProfile, meta);
  if (meta.type === "text") {
    centerOrpInContainer(displayEl, rsvpContainerEl);
  } else {
    displayEl.style.transform = "";
  }
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
      recomputeTypographyProfile();
    });
  }
  rsvpResizeObserver.observe(rsvpContainerEl);
  ensureRsvpBlockTitleEl();
  syncRsvpBlockTitleUi();
}

function ensureRsvpBlockTitleEl() {
  if (!rsvpContainerEl) return null;
  if (rsvpBlockTitleEl?.isConnected) return rsvpBlockTitleEl;
  const existing = rsvpContainerEl.querySelector("#rsvpBlockTitle");
  if (existing) {
    rsvpBlockTitleEl = existing;
    return existing;
  }
  const el = document.createElement("div");
  el.id = "rsvpBlockTitle";
  el.className = "rsvp-block-title";
  el.setAttribute("aria-live", "polite");
  rsvpContainerEl.appendChild(el);
  rsvpBlockTitleEl = el;
  return el;
}

function syncRsvpBlockTitleUi() {
  const el = ensureRsvpBlockTitleEl();
  if (!el) return;
  const title = String(rsvpState.currentBlockTitle || "").trim();
  el.textContent = title;
  el.hidden = !title;
  if (title) {
    el.setAttribute("title", title);
  } else {
    el.removeAttribute("title");
  }
}

window.addEventListener("resize", () => {
  if (!rsvpContainerEl) return;
  applyRsvpContainerSizing();
  recomputeTypographyProfile();
});

export function setRsvpOverlayActive(isActive) {
  els.rsvpOverlay.setAttribute("aria-hidden", String(!isActive));
  document.body.classList.toggle("rsvp-active", isActive);
  if (!isActive) els.rsvpOverlay?.classList.remove("rsvp-focus-mode");
}

export function setRsvpBlockTitle(title) {
  rsvpState.currentBlockTitle = String(title || "").trim();
  syncRsvpBlockTitleUi();
}

function isRsvpOverlayOpen() {
  return els.rsvpOverlay?.getAttribute("aria-hidden") === "false";
}

function syncRsvpFocusMode() {
  if (!els.rsvpOverlay) return;
  const focus =
    isRsvpOverlayOpen() && rsvpState.playing && !rsvpState.countdownActive;
  els.rsvpOverlay.classList.toggle("rsvp-focus-mode", focus);
}

/** @param {RsvpChunk} chunk */
function flashWordUnits(chunk) {
  if (!chunk || chunk.type === "math") return 1;
  return tokenizeWords(chunk.content || "").length || 1;
}

function totalWordUnitsInBlock() {
  let n = 0;
  for (const c of rsvpState.chunks) n += flashWordUnits(c);
  return Math.max(n, 1);
}

function wordUnitsThroughChunkIndex(indexInclusive) {
  let n = 0;
  const limit = Math.min(indexInclusive, rsvpState.chunks.length - 1);
  for (let i = 0; i <= limit; i++) n += flashWordUnits(rsvpState.chunks[i]);
  return n;
}

function updateRsvpProgressUi() {
  const len = rsvpState.chunks.length;
  if (!els.rsvpProgressLabel || !len) {
    if (els.rsvpProgressLabel) els.rsvpProgressLabel.textContent = "—";
    if (els.rsvpProgressFill) els.rsvpProgressFill.style.width = "0%";
    if (els.rsvpProgressTrack) els.rsvpProgressTrack.setAttribute("aria-valuenow", "0");
    return;
  }

  const k = Math.min(
    Math.max(0, Number(rsvpState.displayedChunkIndex) || 0),
    len - 1,
  );
  const shown = wordUnitsThroughChunkIndex(k);
  const total = totalWordUnitsInBlock();
  const pct = Math.round(((k + 1) / len) * 100);

  els.rsvpProgressLabel.textContent = `~${shown} / ${total} words · flash ${k + 1}/${len}`;
  if (els.rsvpProgressFill) els.rsvpProgressFill.style.width = `${pct}%`;
  if (els.rsvpProgressTrack) {
    els.rsvpProgressTrack.setAttribute("aria-valuenow", String(pct));
    els.rsvpProgressTrack.setAttribute("aria-valuemax", "100");
  }
}

/** @param {RsvpChunk | undefined} meta */
function mathDwellMultiplier(meta) {
  const raw = String(meta?.content || "").trim();
  if (!raw) return RSVP_MATH_DWELL_MIN;

  let mult = RSVP_MATH_DWELL_MIN;
  const len = raw.length;
  if (len > 30) mult += 0.75;
  if (len > 60) mult += 0.75;
  if (len > 120) mult += 1;
  if (/\\frac|\\dfrac|\\tfrac|\\sum|\\int|\\oint|\\prod|\\lim|matrix|cases|align/i.test(raw)) {
    mult += 1.25;
  }
  if (raw.startsWith("$$") || raw.startsWith("\\[")) mult += 0.5;
  return Math.min(RSVP_MATH_DWELL_MAX, Math.max(RSVP_MATH_DWELL_MIN, mult));
}

function bumpPlaybackGen() {
  rsvpState.playbackGen += 1;
}

export function cancelRsvpTimer() {
  if (rsvpState.timerId) clearTimeout(rsvpState.timerId);
  rsvpState.timerId = null;
}

const RSVP_MATH_DWELL_MIN = 2;
const RSVP_MATH_DWELL_MAX = 6;
const RSVP_COMPREHENSION_PAUSE_MS = 900;
const RSVP_COMPREHENSION_EVERY_DEFAULT = 25;
const RSVP_PUNCT_STRONG_MULT = 1.5;
const RSVP_PUNCT_WEAK_MULT = 1.25;
const RSVP_LONG_WORD_MULT = 1.2;
const RSVP_LONG_WORD_LETTERS = 10;
const RSVP_NAME_OR_NUMBER_MULT = 1.3;
const RSVP_SENTENCE_END_MULT = 1.35;
const RSVP_PARAGRAPH_START_MS = 200;
const RSVP_AFTER_BOLD_MS = 150;
/** Private-use sentinel inserted after `**bold**` / `__bold__` before tokenization. */
const RSVP_BOLD_END_MARKER = "\uE000";

const rsvpGraphemeSegmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

function durationMsBaseTextChunk() {
  const wpm = Math.max(1, Number(rsvpState.wpm) || 500);
  const wpf = Math.max(1, Number(rsvpState.wordsPerFlash) || 1);
  return Math.max(20, Math.round((60000 * wpf) / wpm));
}

/** @param {string} word */
function wordToGraphemes(word) {
  const s = String(word ?? "");
  if (!s) return [];
  if (rsvpGraphemeSegmenter) {
    return [...rsvpGraphemeSegmenter.segment(s)].map(seg => seg.segment);
  }
  return [...s];
}

/** @param {string} word */
function countLetterGraphemes(word) {
  let n = 0;
  for (const g of wordToGraphemes(word)) {
    if (/\p{L}/u.test(g)) n += 1;
  }
  return n;
}

/** Spritz-style ORP index by letter (grapheme) count. @param {string} word */
function getOrpLetterIndex(word) {
  const len = countLetterGraphemes(word);
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  if (len <= 9) return 2;
  return 3;
}

/** @param {string} word */
function splitWordAtOrp(word) {
  const graphemes = wordToGraphemes(word);
  if (!graphemes.length) return { before: "", orp: "", after: "" };

  const targetLetter = getOrpLetterIndex(word);
  let letterIdx = 0;
  let orpGraphemeIdx = 0;

  for (let i = 0; i < graphemes.length; i++) {
    if (!/\p{L}/u.test(graphemes[i])) continue;
    orpGraphemeIdx = i;
    if (letterIdx === targetLetter) break;
    letterIdx += 1;
  }

  return {
    before: graphemes.slice(0, orpGraphemeIdx).join(""),
    orp: graphemes[orpGraphemeIdx] || "",
    after: graphemes.slice(orpGraphemeIdx + 1).join(""),
  };
}

/** @param {string} word @returns {"strong"|"weak"|null} */
function trailingPunctuationKind(word) {
  const w = String(word || "").trimEnd();
  if (!w) return null;
  const last = w[w.length - 1];
  if (/[.!?…]/.test(last)) return "strong";
  if (/[,;:]/.test(last)) return "weak";
  if (last === "—" || last === "–") return "weak";
  return null;
}

/** @param {string} word */
function looksLikeProperName(word) {
  const alphaStart = String(word).search(/[a-zA-ZÀ-ÿ]/);
  if (alphaStart === -1) return false;
  const alphaWord = String(word)
    .slice(alphaStart)
    .replace(/[^\p{L}]/gu, "");
  if (alphaWord.length < 2) return false;
  const first = alphaWord[0];
  if (first !== first.toUpperCase()) return false;
  if (alphaWord === alphaWord.toUpperCase()) return false;
  return true;
}

/** Adaptive dwell for one flash (P0 timing). @param {RsvpChunk | undefined} meta */
function dwellMsForChunk(meta) {
  const base = durationMsBaseTextChunk();
  if (!meta || meta.type === "math") {
    return Math.round(base * mathDwellMultiplier(meta));
  }

  const words = tokenizeWords(meta.content || "");
  if (!words.length) return base;

  const lastWord = words[words.length - 1];
  let factor = 1;

  const punct = trailingPunctuationKind(lastWord);
  if (punct === "strong") factor *= RSVP_PUNCT_STRONG_MULT;
  else if (punct === "weak") factor *= RSVP_PUNCT_WEAK_MULT;

  let maxLetters = 0;
  for (const w of words) {
    maxLetters = Math.max(maxLetters, countLetterGraphemes(w));
  }
  if (maxLetters >= RSVP_LONG_WORD_LETTERS) factor *= RSVP_LONG_WORD_MULT;

  for (const w of words) {
    if (looksLikeProperName(w) || /\d/.test(w)) {
      factor *= RSVP_NAME_OR_NUMBER_MULT;
      break;
    }
  }

  let ms = Math.round(base * factor);

  if (isSentenceTerminalWord(lastWord)) {
    ms = Math.round(ms * RSVP_SENTENCE_END_MULT);
  }
  if (meta.paragraphStart) {
    ms += RSVP_PARAGRAPH_START_MS;
  }
  if (meta.afterBoldEnd) {
    ms += RSVP_AFTER_BOLD_MS;
  }

  return Math.max(20, ms);
}

function finalPauseMs() {
  const b = durationMsBaseTextChunk();
  return Math.min(1000, Math.max(520, Math.round(b * 1.15)));
}

/** Letter–hyphen–letter compounds (not numeric ranges like 3-5). */
const RSVP_HYPHEN_BREAK_RE = /(?<=\p{L})-(?=\p{L})/u;

/**
 * Split internal hyphens into RSVP units; hyphen stays on the leading part.
 * @param {string} token Whitespace token (trailing spaces preserved on the last part).
 * @returns {string[]}
 */
function splitHyphenatedToken(token) {
  const raw = String(token ?? "");
  if (!raw || !RSVP_HYPHEN_BREAK_RE.test(raw.replace(/\s+$/, ""))) return [raw];

  const trailing = raw.match(/\s+$/)?.[0] || "";
  const core = trailing ? raw.slice(0, -trailing.length) : raw;
  const parts = core.split(RSVP_HYPHEN_BREAK_RE);
  if (parts.length <= 1) return [raw];

  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    if (i < parts.length - 1) {
      out.push(`${parts[i]}-`);
    } else {
      out.push(parts[i] + trailing);
    }
  }
  return out;
}

/** @param {string[]} words */
function expandHyphenatedWords(words) {
  /** @type {string[]} */
  const out = [];
  for (const w of words) {
    const parts = splitHyphenatedToken(w);
    if (parts.length <= 1) out.push(w);
    else out.push(...parts);
  }
  return out;
}

function tokenizeWords(text) {
  const raw = String(text || "");
  if (!raw.trim()) return [];
  // Preserve original spacing by keeping trailing whitespace with each token.
  const words = raw.match(/\S+\s*/g) || [];
  return expandHyphenatedWords(words);
}

/** Longest token in explanation (by letter graphemes) for typography probe. @param {string} explanationText */
function longestWordTokenFromExplanation(explanationText) {
  const src = String(explanationText ?? "");
  if (!src.trim()) return RSVP_PROBE_FALLBACK;

  let best = "";
  let bestScore = 0;

  for (const seg of segmentTextAndMath(src)) {
    if (seg.type !== "text") continue;
    const plain = markdownToRsvpPlainText(seg.raw);
    for (const para of splitTextParagraphs(plain)) {
      for (const word of tokenizeWords(para)) {
        const score = countLetterGraphemes(word) || String(word).trim().length;
        if (
          score > bestScore ||
          (score === bestScore && String(word).length > best.length)
        ) {
          best = word;
          bestScore = score;
        }
      }
    }
  }

  if (!String(best).trim()) return RSVP_PROBE_FALLBACK;
  return String(best).endsWith(" ") ? best : `${best} `;
}

/** True when a token ends a sentence (. ? ! …), ignoring common abbreviations. */
function isSentenceTerminalWord(word) {
  let w = String(word || "").trim();
  if (!w) return false;
  if (/^[A-Za-zÀ-ÿ]{1,3}\.$/.test(w)) return false;
  w = w.replace(/[\s"'«»")\]}]+$/, "");
  return /(?:\.{3}|[.!?…])(?:['"«»")\]}]*)$/.test(w);
}

/** Markdown segment → plain RSVP text; marks end of each bold span for timing. */
function markdownToRsvpPlainText(raw) {
  let s = String(raw || "");
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, inner) => inner + RSVP_BOLD_END_MARKER);
  s = s.replace(/__([^_]+)__/g, (_, inner) => inner + RSVP_BOLD_END_MARKER);
  return stripMarkdownForPlainText(s);
}

function wordEndsBoldSpan(word) {
  return String(word || "").includes(RSVP_BOLD_END_MARKER);
}

function stripBoldEndMarkers(text) {
  return String(text || "").split(RSVP_BOLD_END_MARKER).join("");
}

/** Split text on blank lines so RSVP never mixes paragraphs in one flash. */
function splitTextParagraphs(text) {
  return String(text || "")
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);
}

/**
 * Group words up to wordsPerFlash, flushing at sentence ends (never mix sentences).
 * Long sentences may still span multiple flashes when they exceed WPF.
 */
function chunkWordsBySentence(words, wordsPerFlash) {
  const wpf = Math.max(1, Number(wordsPerFlash) || 1);
  /** @type {string[]} */
  const out = [];
  /** @type {string[]} */
  let buf = [];

  for (const word of words) {
    buf.push(word);
    if (isSentenceTerminalWord(word) || wordEndsBoldSpan(word) || buf.length >= wpf) {
      out.push(buf.join(""));
      buf = [];
    }
  }
  if (buf.length) out.push(buf.join(""));
  return out.filter(s => String(s).trim());
}

/** @param {string} word */
function appendWordWithOrp(wordSpan, word) {
  const parts = splitWordAtOrp(String(word ?? ""));
  const before = document.createElement("span");
  before.className = "rsvp-before";
  before.textContent = parts.before;
  const orp = document.createElement("span");
  orp.className = "rsvp-orp";
  orp.textContent = parts.orp;
  const after = document.createElement("span");
  after.className = "rsvp-after";
  after.textContent = parts.after;
  wordSpan.append(before, orp, after);
}

/** @param {string} content */
function renderRsvpTextChunk(content) {
  const raw = String(content ?? "").trimEnd();
  const words = tokenizeWords(raw);
  const anchorIndex = Math.floor((words.length - 1) / 2);

  const display = document.createElement("span");
  display.className = "rsvp-word-display";
  display.id = "rsvp-word-display";

  for (let i = 0; i < words.length; i++) {
    const wordSpan = document.createElement("span");
    wordSpan.className = "rsvp-word";
    if (i === anchorIndex) {
      appendWordWithOrp(wordSpan, words[i]);
    } else {
      wordSpan.textContent = words[i];
    }
    display.appendChild(wordSpan);
  }

  return display;
}

/** @param {HTMLElement} displayEl @param {HTMLElement} containerEl */
function centerOrpInContainer(displayEl, containerEl) {
  if (!displayEl || !containerEl) return;
  displayEl.style.transform = "";
  const orp = displayEl.querySelector(".rsvp-orp");
  if (!orp) return;
  const containerRect = containerEl.getBoundingClientRect();
  const orpRect = orp.getBoundingClientRect();
  const delta =
    containerRect.left + containerRect.width / 2 - (orpRect.left + orpRect.width / 2);
  displayEl.style.transform = `translateX(${delta}px)`;
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
      const plain = markdownToRsvpPlainText(seg.raw);
      for (const para of splitTextParagraphs(plain)) {
        const paraChunks = chunkWordsBySentence(tokenizeWords(para), wpf);
        for (let i = 0; i < paraChunks.length; i++) {
          const t = paraChunks[i];
          if (t) {
            chunks.push({
              type: "text",
              content: stripBoldEndMarkers(t),
              paragraphStart: i === 0,
              afterBoldEnd: wordEndsBoldSpan(t),
            });
          }
        }
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

/** @param {HTMLElement} displayEl */
function triggerRsvpFlashFade(displayEl) {
  if (!displayEl) return;
  const prefersReduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return;

  displayEl.style.opacity = "0";
  displayEl.style.transition = "opacity 60ms ease-out";
  requestAnimationFrame(() => {
    displayEl.style.opacity = "1";
  });
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
  if (!typographyProfile && rsvpContainerEl) {
    recomputeTypographyProfile();
  }
  if (meta.type === "text") {
    const display = renderRsvpTextChunk(String(meta.content || ""));
    els.rsvpChunk.appendChild(display);
    if (typographyProfile) {
      applySessionFontSize(display, typographyProfile, meta);
    }
    if (rsvpContainerEl) {
      centerOrpInContainer(display, rsvpContainerEl);
    }
    triggerRsvpFlashFade(display);
    return Promise.resolve();
  }
  const mathDisplay = document.createElement("span");
  mathDisplay.id = "rsvp-word-display";
  mathDisplay.className = "rsvp-word-display";
  mathDisplay.style.transform = "";
  if (meta.preRenderedHtml) {
    mathDisplay.innerHTML = meta.preRenderedHtml;
    els.rsvpChunk.appendChild(mathDisplay);
    if (typographyProfile) {
      applySessionFontSize(mathDisplay, typographyProfile, meta);
    }
    triggerRsvpFlashFade(mathDisplay);
    return Promise.resolve();
  }
  const el = document.createElement("span");
  el.textContent = meta.content || "";
  mathDisplay.appendChild(el);
  els.rsvpChunk.appendChild(mathDisplay);
  if (typographyProfile) {
    applySessionFontSize(mathDisplay, typographyProfile, meta);
  }
  return typesetMath(el).then(() => {
    triggerRsvpFlashFade(mathDisplay);
  });
}

/**
 * Visible time for chunk k: read time for chunk k.
 * Last chunk adds a short settling pause before leaving RSVP.
 */
function dwellMsAfterShowingIndex(k, len) {
  const meta = rsvpState.chunks[k];
  let ms = dwellMsForChunk(meta);

  if (rsvpState.comprehensionPauseEnabled && meta) {
    const units = flashWordUnits(meta);
    rsvpState.wordsSinceComprehensionPause += units;
    const every = Math.max(
      5,
      Number(rsvpState.comprehensionEveryN) || RSVP_COMPREHENSION_EVERY_DEFAULT,
    );
    if (rsvpState.wordsSinceComprehensionPause >= every) {
      ms += RSVP_COMPREHENSION_PAUSE_MS;
      rsvpState.wordsSinceComprehensionPause = 0;
    }
  }

  return k === len - 1 ? ms + finalPauseMs() : ms;
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
  updateRsvpProgressUi();

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

function loadRsvpComprehensionFromStorage() {
  try {
    const enabled = localStorage.getItem(LS_RSVP_COMPREHENSION_PAUSE_KEY) === "1";
    const every = clampInt(
      localStorage.getItem(LS_RSVP_COMPREHENSION_EVERY_KEY),
      5,
      200,
      RSVP_COMPREHENSION_EVERY_DEFAULT,
    );
    rsvpState.comprehensionPauseEnabled = enabled;
    rsvpState.comprehensionEveryN = every;
    if (els.rsvpComprehensionPause) els.rsvpComprehensionPause.checked = enabled;
    if (els.rsvpComprehensionEvery) els.rsvpComprehensionEvery.value = String(every);
  } catch {
    // ignore
  }
}

function persistRsvpComprehensionSettings() {
  try {
    localStorage.setItem(
      LS_RSVP_COMPREHENSION_PAUSE_KEY,
      rsvpState.comprehensionPauseEnabled ? "1" : "0",
    );
    localStorage.setItem(
      LS_RSVP_COMPREHENSION_EVERY_KEY,
      String(rsvpState.comprehensionEveryN),
    );
  } catch {
    // ignore
  }
}

function syncComprehensionFromUi() {
  if (els.rsvpComprehensionPause) {
    rsvpState.comprehensionPauseEnabled = !!els.rsvpComprehensionPause.checked;
  }
  if (els.rsvpComprehensionEvery) {
    rsvpState.comprehensionEveryN = clampInt(
      els.rsvpComprehensionEvery.value,
      5,
      200,
      RSVP_COMPREHENSION_EVERY_DEFAULT,
    );
    els.rsvpComprehensionEvery.value = String(rsvpState.comprehensionEveryN);
  }
  persistRsvpComprehensionSettings();
}

export function loadRsvpDefaultsFromStorage() {
  const storedWpm = localStorage.getItem(LS_RSVP_DEFAULT_WPM_KEY);
  const storedWpf = localStorage.getItem(LS_RSVP_DEFAULT_WPF_KEY);
  const wpm = clampInt(storedWpm, 100, 1000, 500);
  const wpf = clampInt(storedWpf, 1, 10, 1);
  rsvpState.wpm = wpm;
  rsvpState.wordsPerFlash = wpf;
  els.rsvpWpm.value = String(wpm);
  els.rsvpWpmLabel.textContent = String(wpm);
  setWpfUi(wpf);
  loadRsvpComprehensionFromStorage();
}

export function persistRsvpDefaults() {
  try {
    localStorage.setItem(LS_RSVP_DEFAULT_WPM_KEY, String(rsvpState.wpm));
    localStorage.setItem(LS_RSVP_DEFAULT_WPF_KEY, String(rsvpState.wordsPerFlash));
  } catch {
    // ignore storage errors
  }
  persistRsvpComprehensionSettings();
}

/**
 * Step forward/back one flash. When playing, restarts timer from new chunk.
 * @param {number} delta -1 | 1
 */
export function stepRsvpChunk(delta) {
  if (!isRsvpOverlayOpen() || rsvpState.countdownActive) return;
  const len = rsvpState.chunks.length;
  if (!len) return;

  const next = Math.min(
    len - 1,
    Math.max(0, (Number(rsvpState.displayedChunkIndex) || 0) + delta),
  );
  if (next === rsvpState.displayedChunkIndex) return;

  cancelRsvpTimer();
  bumpPlaybackGen();
  rsvpState.displayedChunkIndex = next;

  if (rsvpState.playing) {
    void showChunkByIndex(next, rsvpState.playbackGen);
    return;
  }

  void applyChunkToDom(rsvpState.chunks[next]).then(() => {
    updateRsvpProgressUi();
  });
}

function shouldIgnoreRsvpKeyTarget(e) {
  const t = e.target;
  if (!t || !(t instanceof HTMLElement)) return false;
  if (t.tagName === "TEXTAREA") return true;
  if (t.tagName === "INPUT") {
    const type = String(t.getAttribute("type") || "").toLowerCase();
    if (type !== "checkbox") return true;
  }
  return t.isContentEditable;
}

function onRsvpKeydown(e) {
  if (!isRsvpOverlayOpen()) return;
  if (shouldIgnoreRsvpKeyTarget(e)) return;

  if (e.code === "Space") {
    if (rsvpState.countdownActive) return;
    e.preventDefault();
    setRsvpPlayState(!rsvpState.playing);
    return;
  }
  if (rsvpState.countdownActive) return;

  if (e.code === "ArrowLeft") {
    e.preventDefault();
    stepRsvpChunk(-1);
    return;
  }
  if (e.code === "ArrowRight") {
    e.preventDefault();
    stepRsvpChunk(1);
    return;
  }
  if (e.code === "Escape") {
    e.preventDefault();
    finishRsvp();
  }
}

/** Wire RSVP overlay controls and keyboard (call once from study bootstrap). */
export function wireRsvpHandlers() {
  if (rsvpHandlersWired) return;
  rsvpHandlersWired = true;

  els.rsvpPlayPauseBtn?.addEventListener("click", () => {
    if (rsvpState.countdownActive) return;
    setRsvpPlayState(!rsvpState.playing);
  });
  els.rsvpSkipBtn?.addEventListener("click", () => finishRsvp());
  els.rsvpWpm?.addEventListener("input", () => {
    const v = Number(els.rsvpWpm.value);
    rsvpState.wpm = Number.isFinite(v) ? v : 500;
    els.rsvpWpmLabel.textContent = String(rsvpState.wpm);
    if (isRsvpOverlayOpen() && rsvpState.playing && !rsvpState.countdownActive) {
      restartPlaybackTail();
    }
    persistRsvpDefaults();
  });
  for (const btn of els.rsvpWpfButtons || []) {
    btn.addEventListener("click", () => {
      const next = Number(btn.dataset.wpf);
      if (!Number.isFinite(next)) return;
      setWordsPerFlash(next);
    });
  }
  els.rsvpComprehensionPause?.addEventListener("change", () => {
    syncComprehensionFromUi();
    rsvpState.wordsSinceComprehensionPause = 0;
  });
  els.rsvpComprehensionEvery?.addEventListener("change", () => {
    syncComprehensionFromUi();
    rsvpState.wordsSinceComprehensionPause = 0;
  });
  document.addEventListener("keydown", onRsvpKeydown);
}

export function finishRsvp() {
  bumpPlaybackGen();
  cancelRsvpTimer();
  rsvpState.countdownActive = false;
  rsvpState.wordsSinceComprehensionPause = 0;
  typographyProfile = null;
  clearRsvpChunkEl();
  updateRsvpProgressUi();
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
  recomputeTypographyProfile();
  bumpPlaybackGen();
  const gen = rsvpState.playbackGen;
  void showChunkByIndex(0, gen);
}

export function setRsvpPlayState(nextPlaying) {
  rsvpState.playing = nextPlaying;
  els.rsvpPlayPauseBtn.textContent = rsvpState.playing ? "Pause" : "Play";
  syncRsvpFocusMode();
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

  void preRenderMathChunks(rsvpState.chunks, rsvpState.playbackGen);

  if (midSession) {
    recomputeTypographyProfile();
  }

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
  rsvpState.wordsSinceComprehensionPause = 0;

  hideSidebar();
  setRsvpOverlayActive(true);
  syncRsvpFocusMode();
  ensureRsvpContainer();
  syncRsvpBlockTitleUi();

  // Ensure the container size is adequate on first load.
  const container =
    document.getElementById("rsvp-container") ||
    rsvpContainerEl ||
    els.rsvpOverlay.querySelector(".rsvp-container");
  if (container && (container.offsetWidth < 300 || container.offsetHeight < 80)) {
    container.style.width = "500px";
    container.style.height = "150px";
  }

  recomputeTypographyProfile();

  els.rsvpWpm.value = String(rsvpState.wpm);
  els.rsvpWpmLabel.textContent = String(rsvpState.wpm);
  setWpfUi(rsvpState.wordsPerFlash);
  els.rsvpChunk.textContent = "3...";
  els.rsvpPlayPauseBtn.textContent = "Pause";
  updateRsvpProgressUi();

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
      syncRsvpFocusMode();
      beginPlaybackLoop();
      return;
    }
    els.rsvpChunk.textContent = steps[i];
    i += 1;
    rsvpState.timerId = setTimeout(tick, 1000);
  };
  tick();
}
