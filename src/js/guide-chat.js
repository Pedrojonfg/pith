import { DS_CHAT_COMPLETIONS_URL, LS_ACTIVE_SESSION_KEY, LS_KEY, LS_STUDY_LANG_KEY } from "./config.js?v=20260503_2";

function safeJsonParse(raw) {
  const t = String(raw || "").trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
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
  const activeSession = getActiveSessionFromStorage();
  const language = getStudyLanguageFromStorage();

  const currentBlockIndex = Number(activeSession?.current_block_index) || 0;
  const { title, sessionContext } = buildSessionContext({
    activeSession,
    currentBlockIndex,
  });

  window.guideContext = {
    sessionId: getSessionId(activeSession),
    language,
    title,
    currentBlockIndex,
    sessionContext,
  };

  window.guideHistory = [];
}

export function buildGuidePrompt(userMessage, currentBlockIndex) {
  const ctx = window.guideContext || {};
  const language = String(ctx.language || getStudyLanguageFromStorage() || "English");
  const sessionContext = String(ctx.sessionContext || "");
  const idx = Number.isFinite(Number(currentBlockIndex))
    ? Number(currentBlockIndex)
    : Number(ctx.currentBlockIndex) || 0;

  const safeUser = String(userMessage || "").trim();
  const currentBlockNote = `Student is currently on block ${idx + 1}`;
  const systemPrompt = `You are a study guide tutor. Below is the COMPLETE context of the current study session. Answer questions about ANY topic in this session. Be concise, reference specific blocks when relevant, encourage deep thinking. Respond in ${language}.\n\nCOMPLETE SESSION CONTEXT:\n${sessionContext}\n\n${currentBlockNote}\n\nLatest student message:\n${safeUser}`;

  return systemPrompt;
}

export function appendChatMessage(role, content, timestamp) {
  const r = String(role || "").trim();
  const c = String(content || "");
  const ts = timestamp ? String(timestamp) : new Date().toISOString();

  if (!Array.isArray(window.guideHistory)) window.guideHistory = [];
  window.guideHistory.push({ role: r, content: c, timestamp: ts });

  const sessionId =
    String(window.guideContext?.sessionId || "").trim() || "unknown_session";
  const key = `guide_chat_${sessionId}`;
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
  el.textContent = String(content || "");
  if (isError) {
    el.style.color = "rgba(248, 113, 113, 0.95)";
    el.style.background = "rgba(248, 113, 113, 0.08)";
    el.style.border = "1px solid rgba(248, 113, 113, 0.35)";
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
  const text = String(userText || "").trim();
  if (!text) return;

  appendChatMessage("user", text, Date.now());
  renderChatMessage({ role: "user", content: text });

  const inputEl = document.getElementById("guide-input");
  if (inputEl) inputEl.value = "";

  setSendUiDisabled(true);
  try {
    const apiKey = String(localStorage.getItem(LS_KEY) || "").trim();
    if (!apiKey) throw new Error("Missing API key. Please set your DeepSeek API key.");

    const systemPrompt = buildGuidePrompt(text, currentBlockIndex);

    const history = Array.isArray(window.guideHistory) ? window.guideHistory : [];
    const msgHistory = history
      .filter((m) => m && typeof m === "object")
      .map((m) => ({ role: String(m.role || ""), content: String(m.content || "") }));

    const messages = [
      { role: "system", content: systemPrompt },
      ...msgHistory,
    ];

    const res = await fetch(DS_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 1500,
        messages,
        temperature: 0.2,
      }),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      // handled below
    }

    if (!res.ok) {
      const apiMsg =
        data?.error?.message ||
        data?.message ||
        `Request failed with status ${res.status}.`;
      throw new Error(apiMsg);
    }

    const content =
      (typeof data?.choices?.[0]?.message?.content === "string"
        ? data.choices[0].message.content
        : null) ||
      (typeof data?.response?.content?.[0]?.text === "string"
        ? data.response.content[0].text
        : null) ||
      (typeof data?.content?.[0]?.text === "string" ? data.content[0].text : null);

    const assistantText = String(content || "").trim();
    if (!assistantText) {
      throw new Error("Unexpected API response (missing message content).");
    }

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

