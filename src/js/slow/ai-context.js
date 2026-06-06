import { llmChatCompletions, normalizeLlmModel } from "../llm.js?v=20260525_1";
import { getStudyLanguage } from "../ui.js?v=20260525_1";
import { getScopeText } from "./reader.js?v=20260528_1";

export function buildIAContext(slow) {
  const text = getScopeText({ slow });
  const max = Math.max(0, Number(slow?.maxReadCharEnd) || 0);
  return text.slice(0, max);
}

export async function askSlowReaderIA(session, userQuery, { annotationType } = {}) {
  const slow = session?.slow;
  if (!slow) throw new Error("No slow session");
  const context = buildIAContext(slow);
  const query = String(userQuery || "").trim();
  if (!query) throw new Error("Empty query");

  const lang = getStudyLanguage() || "English";

  let system =
    `The user is reading a philosophical text. Respond ONLY with information from the portion already read. ` +
    `Maximum 3 sentences. Respond entirely in ${lang}. If the answer requires unread text, say so without revealing it.`;
  if (annotationType === "⇑") {
    system =
      `Present the steel man of the indicated argument: the strongest possible version without judging validity. ` +
      `Max 3 sentences. Respond entirely in ${lang}.`;
  } else if (annotationType === "⚑") {
    system =
      `Explain the indicated passage using context from text already read. Max 3 sentences, no spoilers. ` +
      `Respond entirely in ${lang}.`;
  }

  return llmChatCompletions({
    llmModel: normalizeLlmModel(session.llmModel),
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Text read so far:\n${context.slice(-120000)}\n\nQuestion: ${query}`,
      },
    ],
    temperature: 0.2,
  });
}
