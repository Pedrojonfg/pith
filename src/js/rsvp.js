import { LS_RSVP_DEFAULT_WPF_KEY, LS_RSVP_DEFAULT_WPM_KEY } from "./config.js";
import { clampInt } from "./session.js";
import { els, hideSidebar, showSidebar, typesetMath } from "./ui.js";

/** @typedef {{ type: "text"|"math", content: string }} RsvpChunk */

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
  const len = meta.content?.length ?? 0;
  return Math.max(Math.round(base * 2), Math.min(14000, base + len * 25));
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
      if (s[i] === "\\") {
        i += Math.min(2, s.length - i);
        continue;
      }
      if (s.startsWith("$$", i)) found = { kind: "ddollar", idx: i, openLen: 2 };
      else if (s.startsWith("\\[", i)) found = { kind: "brack", idx: i, openLen: 2 };
      else if (s.startsWith("\\(", i)) found = { kind: "paren", idx: i, openLen: 2 };
      else if (s[i] === "$") found = { kind: "dollar", idx: i, openLen: 1 };
      else i += 1;
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

/** @param {RsvpChunk} meta */
function applyChunkToDom(meta) {
  clearRsvpChunkEl();
  if (!meta) return Promise.resolve();
  if (meta.type === "text") {
    els.rsvpChunk.textContent = meta.content || "";
    return Promise.resolve();
  }
  els.rsvpChunk.textContent = meta.content || "";
  return typesetMath(els.rsvpChunk);
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
  els.rsvpWpf1.setAttribute("aria-pressed", String(v === 1));
  els.rsvpWpf2.setAttribute("aria-pressed", String(v === 2));
  els.rsvpWpf3.setAttribute("aria-pressed", String(v === 3));
}

export function loadRsvpDefaultsFromStorage() {
  const storedWpm = localStorage.getItem(LS_RSVP_DEFAULT_WPM_KEY);
  const storedWpf = localStorage.getItem(LS_RSVP_DEFAULT_WPF_KEY);
  const wpm = clampInt(storedWpm, 100, 1000, 500);
  const wpf = clampInt(storedWpf, 1, 3, 3);
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
  const next = Math.max(1, Number(nextWpf) || 1);
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
  els.rsvpWpm.value = String(rsvpState.wpm);
  els.rsvpWpmLabel.textContent = String(rsvpState.wpm);
  setWpfUi(rsvpState.wordsPerFlash);
  els.rsvpChunk.textContent = "3...";
  els.rsvpPlayPauseBtn.textContent = "Pause";

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
