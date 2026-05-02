import { LS_RSVP_DEFAULT_WPF_KEY, LS_RSVP_DEFAULT_WPM_KEY } from "./config.js";
import { clampInt } from "./session.js";
import { els, hideSidebar, showSidebar } from "./ui.js";

export const rsvpState = {
  words: [],
  chunks: [],
  idx: 0,
  playing: true,
  wpm: 500,
  wordsPerFlash: 3,
  timerId: null,
  onDone: null,
  countdownActive: false,
};

export function setRsvpOverlayActive(isActive) {
  els.rsvpOverlay.setAttribute("aria-hidden", String(!isActive));
  document.body.classList.toggle("rsvp-active", isActive);
}

export function cancelRsvpTimer() {
  if (rsvpState.timerId) clearTimeout(rsvpState.timerId);
  rsvpState.timerId = null;
}

function durationMsForChunk() {
  const wpm = Math.max(1, Number(rsvpState.wpm) || 500);
  const wpf = Math.max(1, Number(rsvpState.wordsPerFlash) || 1);
  return Math.max(20, Math.round((60000 * wpf) / wpm));
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

function showCurrentRsvpChunk() {
  els.rsvpChunk.textContent = rsvpState.chunks[rsvpState.idx] || "";
}

export function finishRsvp() {
  cancelRsvpTimer();
  rsvpState.countdownActive = false;
  setRsvpOverlayActive(false);
  showSidebar();
  if (typeof rsvpState.onDone === "function") rsvpState.onDone();
}

function scheduleRsvpNext({ immediate }) {
  cancelRsvpTimer();
  if (!rsvpState.playing) return;
  if (rsvpState.idx >= rsvpState.chunks.length) {
    finishRsvp();
    return;
  }
  const ms = immediate ? 0 : durationMsForChunk();
  rsvpState.timerId = setTimeout(() => {
    showCurrentRsvpChunk();
    rsvpState.idx += 1;
    scheduleRsvpNext({ immediate: false });
  }, ms);
}

export function setRsvpPlayState(nextPlaying) {
  rsvpState.playing = nextPlaying;
  els.rsvpPlayPauseBtn.textContent = rsvpState.playing ? "Pause" : "Play";
  if (rsvpState.playing) scheduleRsvpNext({ immediate: false });
  else cancelRsvpTimer();
}

export function setWordsPerFlash(nextWpf) {
  const prev = Math.max(1, Number(rsvpState.wordsPerFlash) || 1);
  const next = Math.max(1, Number(nextWpf) || 1);
  if (prev === next) return;

  const currentWordPos = rsvpState.idx * prev;
  rsvpState.wordsPerFlash = next;
  setWpfUi(next);
  rsvpState.chunks = chunkWords(rsvpState.words || [], next);
  rsvpState.idx = Math.min(rsvpState.chunks.length, Math.floor(currentWordPos / next));
  if (!rsvpState.countdownActive) {
    if (rsvpState.idx < rsvpState.chunks.length) showCurrentRsvpChunk();
    if (rsvpState.playing) scheduleRsvpNext({ immediate: false });
  }
  persistRsvpDefaults();
}

export function startRsvpForText(explanationText, onDone) {
  const words = tokenizeWords(explanationText);
  rsvpState.words = words;
  rsvpState.chunks = chunkWords(words, rsvpState.wordsPerFlash);
  rsvpState.idx = 0;
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

  cancelRsvpTimer();
  const steps = ["3...", "2...", "1..."];
  let i = 0;
  const tick = () => {
    if (i >= steps.length) {
      els.rsvpChunk.textContent = "";
      rsvpState.playing = true;
      rsvpState.countdownActive = false;
      els.rsvpPlayPauseBtn.textContent = "Pause";
      scheduleRsvpNext({ immediate: true });
      return;
    }
    els.rsvpChunk.textContent = steps[i];
    i += 1;
    rsvpState.timerId = setTimeout(tick, 1000);
  };
  tick();
}

