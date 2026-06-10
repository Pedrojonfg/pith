import { LS_ACTIVE_SESSION_KEY, LS_STUDY_LANG_KEY } from "./config.js?v=20260525_1";
import {
  assertLlmKeyPresent,
  getActiveSessionLlmModel,
  llmChatCompletions,
} from "./llm.js?v=20260525_1";
import { renderMarkdown } from "./markdown.js?v=20260525_1";
import { isOfflineMode } from "./offline.js?v=20260606_1";

function safeJsonParse(raw) {
  const t = String(raw || "").trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

const GUIDE_CHAT_KEY_PREFIX = "guide_chat_";
const PENDING_COMMENT_KEY = "pending_comment";

window.pendingComment = null;
try {
  const raw = localStorage.getItem(PENDING_COMMENT_KEY);
  const parsed = safeJsonParse(raw);
  if (parsed && typeof parsed === "object" && typeof parsed.text === "string") {
    window.pendingComment = parsed;
  }
} catch {
  // ignore
}

function getActiveSessionFromStorage() {
  const raw = localStorage.getItem(LS_ACTIVE_SESSION_KEY);
  const obj = safeJsonParse(raw);
  return obj && typeof obj === "object" ? obj : null;
}

function getStudyLanguageFromStorage() {
  const raw = String(localStorage.getItem(LS_STUDY_LANG_KEY) || "").trim();
  return raw || "English";
}

function getSessionId(activeSession) {
  const id = String(activeSession?._meta?.session_id || "").trim();
  return id || "unknown_session";
}

function truncate(s, n) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= n) return t;
  return `${t.slice(0, n)}...`;
}

function paintChatHistory(history) {
  const messagesEl = document.getElementById("chat-messages");
  if (!messagesEl) return;
  messagesEl.innerHTML = "";
  if (!Array.isArray(history) || !history.length) return;
  for (const m of history) {
    if (!m || typeof m !== "object") continue;
    renderChatMessage({
      role: String(m.role || ""),
      content: String(m.content || ""),
    });
  }
}

/** Clear sidebar chat memory/storage (new session / new material). */
export function clearGuideChatStorage({ sessionId, removeAllStored = false } = {}) {
  window.guideHistory = [];
  window.pendingComment = null;
  try {
    localStorage.removeItem(PENDING_COMMENT_KEY);
  } catch {
    // ignore
  }
  try {
    if (removeAllStored) {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith(GUIDE_CHAT_KEY_PREFIX)) keys.push(k);
      }
      for (const k of keys) localStorage.removeItem(k);
    } else if (sessionId) {
      localStorage.removeItem(`${GUIDE_CHAT_KEY_PREFIX}${sessionId}`);
    }
  } catch {
    // ignore
  }
  paintChatHistory([]);
}

function buildSessionContext({ activeSession, currentBlockIndex }) {
  const title = String(activeSession?._meta?.source_files?.[0]?.name || "").trim();
  const blocks = Array.isArray(activeSession?.blocks) ? activeSession.blocks : [];
  const safeIdx = Math.max(
    0,
    Math.min(Number(currentBlockIndex) || 0, Math.max(0, blocks.length - 1)),
  );

  const lines = [];
  if (title) lines.push(`Title: ${title}`);

  const upto = Math.min(safeIdx, blocks.length - 1);
  for (let i = 0; i <= upto; i++) {
    const b = blocks[i];
    if (!b || typeof b !== "object") continue;
    const bTitle = String(b.title || "").trim() || `Block ${i + 1}`;
    const explanation = truncate(b.explanation || "", 300);
    lines.push("");
    lines.push(`Block ${i + 1}: ${bTitle}`);
    if (explanation) lines.push(`Explanation: ${explanation}`);

    const concepts = Array.isArray(b.concepts) ? b.concepts : [];
    const conceptLines = concepts
      .map((c) => {
        const term = String(c?.term || "").trim();
        const def = String(c?.definition || "").trim();
        if (!term) return null;
        return `${term}: ${def || ""}`.trim();
      })
      .filter(Boolean);

    if (conceptLines.length) {
      lines.push("Concepts:");
      for (const cl of conceptLines) lines.push(`- ${cl}`);
    }
  }

  return { title, sessionContext: lines.join("\n").trim() };
}

export function initGuideChat() {
  if (isOfflineMode()) return;
  const activeSession = getActiveSessionFromStorage();
  if (!activeSession) {
    clearGuideChatStorage();
    return;
  }
  const language = getStudyLanguageFromStorage();

  const currentBlockIndex = Number(activeSession?.current_block_index) || 0;
  const { title, sessionContext } = buildSessionContext({
    activeSession,
    currentBlockIndex,
  });

  const sessionId = getSessionId(activeSession);

  window.guideContext = {
    sessionId,
    language,
    title,
    currentBlockIndex,
    sessionContext,
  };

  let history = [];
  try {
    const raw = localStorage.getItem(`${GUIDE_CHAT_KEY_PREFIX}${sessionId}`);
    if (raw && raw.trim()) {
      const parsed = safeJsonParse(raw);
      if (Array.isArray(parsed)) history = parsed;
    }
  } catch {
    // ignore
  }
  window.guideHistory = history;
  paintChatHistory(history);
}

export function refreshGuideContext() {
  const activeSession = getActiveSessionFromStorage();
  const language = getStudyLanguageFromStorage();
  const currentBlockIndex = Number(activeSession?.current_block_index) || 0;
  const { title, sessionContext } = buildSessionContext({
    activeSession,
    currentBlockIndex,
  });
  const sessionId = getSessionId(activeSession);
  window.guideContext = {
    sessionId,
    language,
    title,
    currentBlockIndex,
    sessionContext,
  };
  let history = [];
  try {
    const raw = localStorage.getItem(`${GUIDE_CHAT_KEY_PREFIX}${sessionId}`);
    if (raw && raw.trim()) {
      const parsed = safeJsonParse(raw);
      if (Array.isArray(parsed)) history = parsed;
    }
  } catch {
    // ignore
  }
  window.guideHistory = history;
  paintChatHistory(history);
}

const GUIDE_SIDEBAR_STYLE = `Response style — this appears in a narrow sidebar chat, not a lecture:
- Default: short and direct. Most answers fit in 1–4 sentences.
- Lead with the answer; skip preamble, restating the question, and block recaps unless essential.
- Use a brief bullet list (≤4 items) only when listing distinct points; avoid nested lists.
- Expand (up to ~2 short paragraphs) only when the student explicitly asks for depth, examples, or step-by-step explanation, or when a short answer would be misleading for a genuinely multi-part question.
- Reference block numbers in passing when useful; do not summarize whole blocks.
- At most one short follow-up question when it deepens thinking — never a list of questions.`;

export function buildGuidePrompt(userMessage, currentBlockIndex) {
  const ctx = window.guideContext || {};
  const sessionContext = String(ctx.sessionContext || "");
  const idx = Number.isFinite(Number(currentBlockIndex))
    ? Number(currentBlockIndex)
    : Number(ctx.currentBlockIndex) || 0;

  const safeUser = String(userMessage || "").trim();
  const currentBlockNote = `Student is currently on block ${idx + 1}`;
  const systemPrompt =
    `You are a study guide tutor. Below is the COMPLETE context of the current study session. Answer questions about ANY topic in this session.\n\n` +
    `${GUIDE_SIDEBAR_STYLE}\n\n` +
    `Respond in the same language as the student's latest message.\n\n` +
    `COMPLETE SESSION CONTEXT:\n${sessionContext}\n\n${currentBlockNote}\n\nLatest student message:\n${safeUser}`;

  return systemPrompt;
}

export function appendChatMessage(role, content, timestamp) {
  const r = String(role || "").trim();
  const c = String(content || "");
  const ts =
    typeof timestamp === "number"
      ? timestamp
      : timestamp
        ? Number(timestamp) || String(timestamp)
        : Date.now();

  if (!Array.isArray(window.guideHistory)) window.guideHistory = [];
  window.guideHistory.push({ role: r, content: c, timestamp: ts });

  const sessionId =
    String(window.guideContext?.sessionId || "").trim() || "unknown_session";
  const key = `${GUIDE_CHAT_KEY_PREFIX}${sessionId}`;
  try {
    localStorage.setItem(key, JSON.stringify(window.guideHistory));
  } catch {
    // ignore storage errors
  }
}

export function getGuideHistory() {
  return Array.isArray(window.guideHistory) ? window.guideHistory : [];
}

function renderChatMessage({ role, content, isError } = {}) {
  const messagesEl = document.getElementById("chat-messages");
  if (!messagesEl) return;
  const el = document.createElement("div");
  el.className = `chat-message ${role === "user" ? "message-user" : "message-assistant"}`;
  // Render into a fresh child so MathJax never reuses a processed node.
  const child = document.createElement("div");
  el.appendChild(child);
  if (isError) {
    child.textContent = String(content || "");
    el.style.color = "rgba(248, 113, 113, 0.95)";
    el.style.background = "rgba(248, 113, 113, 0.08)";
    el.style.border = "1px solid rgba(248, 113, 113, 0.35)";
  } else {
    void renderMarkdown(child, content);
  }
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setSendUiDisabled(isDisabled) {
  const sendBtn = document.getElementById("guide-send-btn");
  if (!sendBtn) return;
  if (isDisabled) {
    sendBtn.disabled = true;
    sendBtn.dataset.prevText = String(sendBtn.textContent || "");
    sendBtn.textContent = "Sending...";
  } else {
    sendBtn.disabled = false;
    const prev = String(sendBtn.dataset.prevText || "").trim();
    sendBtn.textContent = prev || "Send";
  }
}

export async function sendGuideMessage(userText, currentBlockIndex) {
  if (isOfflineMode()) return;
  const text = String(userText || "").trim();
  if (!text) return;

  appendChatMessage("user", text, Date.now());
  renderChatMessage({ role: "user", content: text });

  const inputEl = document.getElementById("guide-input");
  if (inputEl) inputEl.value = "";

  setSendUiDisabled(true);
  try {
    const llmModel = getActiveSessionLlmModel();
    assertLlmKeyPresent(llmModel);

    const systemPrompt = buildGuidePrompt(text, currentBlockIndex);

    const history = Array.isArray(window.guideHistory) ? window.guideHistory : [];
    const msgHistory = history
      .filter((m) => m && typeof m === "object")
      .map((m) => ({ role: String(m.role || ""), content: String(m.content || "") }));

    const messages = [
      { role: "system", content: systemPrompt },
      ...msgHistory,
    ];

    const assistantText = await llmChatCompletions({
      llmModel,
      max_tokens: 512,
      messages,
      temperature: 0.2,
    });

    appendChatMessage("assistant", assistantText, Date.now());
    renderChatMessage({ role: "assistant", content: assistantText });
  } catch (err) {
    renderChatMessage({
      role: "assistant",
      content: `Error: ${String(err?.message || err || "Unknown error")}`,
      isError: true,
    });
  } finally {
    setSendUiDisabled(false);
    const messagesEl = document.getElementById("chat-messages");
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

export function setPendingComment(text) {
  const t = String(text || "").trim();
  if (!t) return;
  const blockIndex = Number(window.guideContext?.currentBlockIndex) || 0;
  const pending = { text: t, blockIndex, timestamp: Date.now() };
  window.pendingComment = pending;
  try {
    localStorage.setItem(PENDING_COMMENT_KEY, JSON.stringify(pending));
  } catch {
    // ignore
  }
}

async function sendGuideMessageSilent(userText, currentBlockIndex, meta) {
  const text = String(userText || "").trim();
  if (!text) return null;

  if (!Array.isArray(window.guideHistory)) window.guideHistory = [];
  window.guideHistory.push({
    role: "user",
    content: text,
    timestamp: Date.now(),
    meta: meta && typeof meta === "object" ? meta : undefined,
  });

  const llmModel = getActiveSessionLlmModel();
  assertLlmKeyPresent(llmModel);

  const systemPrompt = buildGuidePrompt(text, currentBlockIndex);

  const history = Array.isArray(window.guideHistory) ? window.guideHistory : [];
  const msgHistory = history
    .filter((m) => m && typeof m === "object")
    .map((m) => ({ role: String(m.role || ""), content: String(m.content || "") }));

  const messages = [{ role: "system", content: systemPrompt }, ...msgHistory];

  const assistantText = await llmChatCompletions({
    llmModel,
    max_tokens: 512,
    messages,
    temperature: 0.2,
  });

  const assistantMsg = {
    role: "assistant",
    content: assistantText,
    timestamp: Date.now(),
    meta: meta && typeof meta === "object" ? meta : undefined,
  };
  window.guideHistory.push(assistantMsg);

  const sessionId =
    String(window.guideContext?.sessionId || "").trim() || "unknown_session";
  const key = `${GUIDE_CHAT_KEY_PREFIX}${sessionId}`;
  try {
    localStorage.setItem(key, JSON.stringify(window.guideHistory));
  } catch {
    // ignore
  }

  return assistantText;
}

export function triggerCommentReply() {
  if (isOfflineMode()) return;
  const pending = window.pendingComment;
  if (!pending) return;

  const pendingTs = Number(pending.timestamp) || Date.now();
  const blockIndex = Number.isFinite(Number(pending.blockIndex))
    ? Number(pending.blockIndex)
    : Number(window.guideContext?.currentBlockIndex) || 0;

  (async () => {
    try {
      const meta = { fromPendingComment: true, pendingCommentTimestamp: pendingTs };
      await sendGuideMessageSilent(pending.text, blockIndex, meta);
    } catch (err) {
      // silent fail; guide chat remains usable
      try {
        console.log(`Guide comment reply failed: ${String(err?.message || err || "Unknown error")}`);
      } catch {
        // ignore
      }
    } finally {
      window.pendingComment = null;
      try {
        localStorage.removeItem(PENDING_COMMENT_KEY);
      } catch {
        // ignore
      }
    }
  })();
}

export function getCommentReply() {
  const history = Array.isArray(window.guideHistory) ? window.guideHistory : [];
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (!m || typeof m !== "object") continue;
    if (String(m.role || "") !== "assistant") continue;

    const meta = m.meta && typeof m.meta === "object" ? m.meta : null;
    const fromPending = meta?.fromPendingComment === true;
    const pendingTs = Number(meta?.pendingCommentTimestamp);
    const msgTs = Number(m.timestamp);

    if (fromPending) return String(m.content || "");
    if (Number.isFinite(pendingTs) && Number.isFinite(msgTs) && Math.abs(msgTs - pendingTs) <= 2 * 60 * 1000) {
      return String(m.content || "");
    }
    return null;
  }
  return null;
}

