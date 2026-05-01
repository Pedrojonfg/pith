import {
  LS_ACTIVE_SESSION_KEY,
  LS_BLOCK_INDEX_KEY,
  LS_KEY,
} from "./config.js";

export const state = {
  sessionMode: "test",
  studyMode: null,
  originalMaterialText: "",
  lastNBlocks: 0,
  lastUploadedFileNames: [],
  lastCleanedMaterialText: "",
  lastCleanedMaterialWordCount: 0,
  lastBlockIndex: null,
  activeSession: null,
  activeBlockIndex: 0,
  activeQuestionIndex: 0,
};

export function clampInt(n, min, max, fallback) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

export function getStoredKey() {
  const v = localStorage.getItem(LS_KEY);
  if (!v) return null;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : null;
}

export function saveKey(key) {
  localStorage.setItem(LS_KEY, key);
}

export function storeActiveSession(sessionObj, { bumpRev } = {}) {
  if (bumpRev && sessionObj && typeof sessionObj === "object") {
    if (!sessionObj._meta || typeof sessionObj._meta !== "object") {
      sessionObj._meta = {};
    }
    if (!sessionObj._meta.session_id) {
      sessionObj._meta.session_id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
    const prev = Number(sessionObj._meta.rev || 0);
    sessionObj._meta.rev = Number.isFinite(prev) && prev >= 0 ? prev + 1 : 1;
  }
  localStorage.setItem(LS_ACTIVE_SESSION_KEY, JSON.stringify(sessionObj));
}

export function loadActiveSession() {
  const raw = localStorage.getItem(LS_ACTIVE_SESSION_KEY);
  if (raw && raw.trim()) {
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") return obj;
    } catch {
      // ignore
    }
  }
  return null;
}

export function getBlocksSafe() {
  return Array.isArray(state.activeSession?.blocks) ? state.activeSession.blocks : [];
}

export function getTotalBlocksSafe() {
  const blocks = getBlocksSafe();
  const n = Number(state.activeSession?.n_blocks);
  if (Number.isFinite(n) && n > 0) return n;
  return blocks.length;
}

export function ensureSessionResponseState() {
  if (!state.activeSession || typeof state.activeSession !== "object") return;
  if (!state.activeSession._meta || typeof state.activeSession._meta !== "object") {
    state.activeSession._meta = {};
  }
  if (!state.activeSession._meta.session_id) {
    state.activeSession._meta.session_id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
  if (state.activeSession._meta.rev == null) {
    state.activeSession._meta.rev = 0;
  }
  if (!state.activeSession._meta.started_at) {
    state.activeSession._meta.started_at = new Date().toISOString();
  }
  if (!state.activeSession._responses || typeof state.activeSession._responses !== "object") {
    state.activeSession._responses = { blocks: {} };
  }
  if (
    !state.activeSession._responses.blocks ||
    typeof state.activeSession._responses.blocks !== "object"
  ) {
    state.activeSession._responses.blocks = {};
  }
}

export function recordResponse({
  blockIndex,
  questionIndex,
  questionType,
  questionText,
  userAnswer,
  feedback,
  correctAnswer,
}) {
  ensureSessionResponseState();
  const blocks = state.activeSession?._responses?.blocks;
  if (!blocks || typeof blocks !== "object") return;
  const bKey = String(blockIndex);
  const qKey = String(questionIndex);
  if (!blocks[bKey] || typeof blocks[bKey] !== "object") {
    blocks[bKey] = { questions: {} };
  }
  if (!blocks[bKey].questions || typeof blocks[bKey].questions !== "object") {
    blocks[bKey].questions = {};
  }
  blocks[bKey].questions[qKey] = {
    type: questionType,
    question: questionText,
    user_answer: userAnswer,
    feedback: feedback,
    correct_answer: correctAnswer,
    answered_at: new Date().toISOString(),
  };
  storeActiveSession(state.activeSession, { bumpRev: true });
}

export function loadBlockIndex() {
  const raw = localStorage.getItem(LS_BLOCK_INDEX_KEY);
  if (raw && raw.trim()) {
    try {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj)) return obj;
    } catch {
      // ignore
    }
  }
  return null;
}

export function getBlockIndexEntry(blockIndex) {
  const id = Number(blockIndex) + 1;
  const arr = loadBlockIndex();
  if (!Array.isArray(arr)) return null;
  return arr.find((b) => b && typeof b === "object" && Number(b.id) === id) || null;
}

export function getBlockChunkFromIndex(blockIndex) {
  const entry = getBlockIndexEntry(blockIndex);
  const chunk =
    entry && typeof entry === "object" ? String(entry.chunk || "").trim() : "";
  return chunk;
}

export function parseBlockTitlesFromList(text) {
  const raw = String(text || "");
  const lines = raw.split("\n");
  const map = {};
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s*[\.\)\-:]\s*(.+?)\s*$/);
    if (!m) continue;
    const idx = Number(m[1]);
    if (!Number.isFinite(idx) || idx <= 0) continue;
    const rest = String(m[2] || "").trim();
    if (!rest) continue;
    const split = rest.split(/\s+(?:—|–|-)\s+/);
    const title = String(split[0] || rest).trim();
    if (!title) continue;
    map[String(idx)] = title;
  }
  return map;
}

export function safeParseJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function normalizeBlockIndexArray(arr) {
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") return null;
    const id = Number(item.id);
    const title = String(item.title || "").trim();
    const summary = String(item.summary || "").trim();
    const chunk = String(item.chunk || "").trim();
    if (!Number.isFinite(id) || id <= 0) return null;
    if (!title) return null;
    if (!summary) return null;
    if (!chunk) return null;
    out.push({ id, title, summary, chunk });
  }
  out.sort((a, b) => a.id - b.id);
  return out;
}

export function formatBlockIndexForConfirmation(arr) {
  const safe = Array.isArray(arr) ? arr : [];
  const view = safe
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((b) => ({
      id: Number(b.id),
      title: String(b.title || ""),
      summary: String(b.summary || ""),
    }));
  return JSON.stringify(view, null, 2);
}

export function blocksListTextFromBlockIndex(arr) {
  const safe = Array.isArray(arr) ? arr : [];
  const lines = safe
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((b) => {
      const id = Number(b.id);
      const title = String(b.title || "").trim();
      const summary = String(b.summary || "").trim();
      return `${id}. ${title}${summary ? ` — ${summary}` : ""}`;
    });
  return lines.join("\n").trim();
}

export function getBlockTitleFromList(blockIndex) {
  const titles = parseBlockTitlesFromList(state.activeSession?.blocks_list_text);
  const key = String(blockIndex + 1);
  const t = titles[key];
  return t ? String(t) : `Block ${blockIndex + 1}`;
}

export function getBlockTitleSafe(blockIndex) {
  const blocks = getBlocksSafe();
  const b = blocks[blockIndex];
  const t = b && typeof b === "object" ? String(b.title || "").trim() : "";
  return t || getBlockTitleFromList(blockIndex);
}

export function initActiveSessionFromBlocksList({ mode, nBlocks, blocksListText }) {
  const n = Math.max(1, Number(nBlocks) || 1);
  return {
    session_mode: mode,
    n_blocks: n,
    blocks_list_text: String(blocksListText || ""),
    current_block_index: 0,
    blocks: Array.from({ length: n }, () => null),
  };
}

