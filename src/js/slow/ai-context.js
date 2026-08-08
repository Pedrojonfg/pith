import { llmChatCompletions, normalizeLlmModel } from "../llm.js?v=20260625_02";
import { getStudyLanguage } from "../ui.js?v=20260625_02";

/**
 * Join PDF page texts 1..maxReadPdfPage (1-indexed max → slice length).
 * @param {string[]} pageTexts — 0-indexed array of per-page strings
 * @param {number} maxReadPdfPage
 */
export function concatPdfPageTextsUpTo(pageTexts, maxReadPdfPage) {
  const max = Math.max(0, Math.floor(Number(maxReadPdfPage) || 0));
  const list = Array.isArray(pageTexts) ? pageTexts : [];
  const parts = [];
  for (let i = 0; i < max && i < list.length; i += 1) {
    parts.push(String(list[i] || ""));
  }
  return parts.join("\n\n");
}

/**
 * @param {object} slow
 * @returns {string}
 */
export function buildIAContext(slow) {
  if (String(slow?.viewerMode || "") === "pdf") {
    // Test hook / precomputed texts; production askSlowReaderIA fills via extractPdfTextThroughPage.
    if (Array.isArray(slow?._pdfIAPageTexts)) {
      return concatPdfPageTextsUpTo(slow._pdfIAPageTexts, slow.maxReadPdfPage);
    }
    return "";
  }
  const text = String(slow?.normalizedTextFull || "");
  const max = Math.max(0, Number(slow?.maxReadCharEnd) || 0);
  return text.slice(0, max);
}

const SIDEBAR_BREVITY =
  "Default: 1–3 short sentences—answer directly, no preamble, do not re-explain what the reader already saw unless essential. " +
  "Use up to 4–5 sentences only for multi-idea synthesis or when the user explicitly asks for more detail.";

function buildSlowIASystemPrompt(lang, annotationType) {
  if (annotationType === "?") {
    return (
      `Present the steel man of the indicated argument: the strongest possible version without judging validity. ` +
      `${SIDEBAR_BREVITY} Respond entirely in ${lang}.`
    );
  }
  if (annotationType === "?") {
    return (
      `Explain the indicated passage using context from text already read. No spoilers from unread text. ` +
      `${SIDEBAR_BREVITY} Respond entirely in ${lang}.`
    );
  }
  return (
    `The user is reading a philosophical text in a narrow sidebar. Respond ONLY with information from the portion already read. ` +
    `If the answer requires unread text, say so in one sentence without revealing it. ` +
    `${SIDEBAR_BREVITY} Respond entirely in ${lang}.`
  );
}

export async function askSlowReaderIA(session, userQuery, { annotationType } = {}) {
  const slow = session?.slow;
  if (!slow) throw new Error("No slow session");
  let context = buildIAContext(slow);
  if (String(slow.viewerMode || "") === "pdf" && !Array.isArray(slow._pdfIAPageTexts)) {
    try {
      const { extractPdfTextThroughPage } = await import("./pdf-reader.js");
      const maxPage = Math.max(1, Math.floor(Number(slow.maxReadPdfPage) || 1));
      context = await extractPdfTextThroughPage(session, maxPage);
    } catch (err) {
      console.warn("[ai-context] PDF IA context extract failed:", err?.message || err);
      context = "";
    }
  }
  const query = String(userQuery || "").trim();
  if (!query) throw new Error("Empty query");

  const lang = getStudyLanguage() || "English";
  const system = buildSlowIASystemPrompt(lang, annotationType);

  return llmChatCompletions({
    llmModel: normalizeLlmModel(session.llmModel),
    max_tokens: 280,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Text read so far:\n${context.slice(-120000)}\n\nQuestion: ${query}`,
      },
    ],
    temperature: 0.6,
  });
}
