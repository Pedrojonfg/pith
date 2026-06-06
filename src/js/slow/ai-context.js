import { llmChatCompletions, normalizeLlmModel } from "../llm.js?v=20260525_1";
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

  let system =
    "El usuario lee un texto filosófico. Responde SOLO con información del fragmento ya leído. " +
    "Máximo 3 oraciones. Si la respuesta requiere texto no leído, dilo sin revelarlo.";
  if (annotationType === "⇑") {
    system =
      "Presenta el steel man del argumento señalado: la versión más fuerte posible sin evaluar validez. Máx. 3 oraciones.";
  } else if (annotationType === "⚑") {
    system =
      "Explica el fragmento señalado con contexto del texto ya leído. Máx. 3 oraciones, sin spoilers.";
  }

  return llmChatCompletions({
    llmModel: normalizeLlmModel(session.llmModel),
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Texto leído:\n${context.slice(-120000)}\n\nPregunta: ${query}`,
      },
    ],
    temperature: 0.2,
  });
}
