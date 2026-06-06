import { llmChatCompletions, normalizeLlmModel } from "../llm.js?v=20260525_1";
import { getScopeText } from "./reader.js?v=20260528_1";

const PROXIMITY = 200;

export function comparePhase0ToAnnotations(phase0, annotations, scopeText) {
  const map = Array.isArray(phase0?.argumentMap) ? phase0.argumentMap : [];
  const anns = Array.isArray(annotations) ? annotations : [];
  const text = String(scopeText || "");
  return map.map((node, i) => {
    const anchor = Math.floor((text.length * (i + 1)) / (map.length + 1));
    const hit = anns.some((a) => {
      const mid = (a.charStart + a.charEnd) / 2;
      return Math.abs(mid - anchor) <= PROXIMITY;
    });
    return { node, hit, anchor };
  });
}

export async function generateRetrievalQuestions(session, annotations) {
  const scope = getScopeText(session);
  const anns = (annotations || []).slice(0, 12);
  const prompt = `Genera preguntas de retrieval (1 por anotación) en JSON array {annotationId, question}. Anotaciones: ${JSON.stringify(anns.map((a) => ({ id: a.id, type: a.type, text: a.userText })))}`;
  const raw = await llmChatCompletions({
    llmModel: normalizeLlmModel(session.llmModel),
    messages: [
      { role: "system", content: "Responde solo JSON array." },
      { role: "user", content: `${prompt}\n\nContexto:\n${scope.slice(0, 80000)}` },
    ],
    temperature: 0.4,
  });
  try {
    return JSON.parse(String(raw).replace(/^```json?\s*|\s*```$/gi, ""));
  } catch {
    return [];
  }
}

export function renderPhase3ModuleA(rows) {
  return (rows || [])
    .map(
      (r) =>
        `<li>${r.hit ? "✓" : "✗"} ${r.node?.text || r.node?.label || r.node?.id || "Nodo"} — ${
          r.hit ? "cubierto por anotaciones" : "oportunidad de revisión"
        }</li>`,
    )
    .join("");
}

export function renderPhase3ModuleB(questions) {
  return (questions || [])
    .map((q) => `<li><strong>${q.annotationId || ""}</strong> ${q.question || ""}</li>`)
    .join("");
}

export function renderPhase3ModuleC(session) {
  const anns = session?.slow?.annotations || [];
  const lines = anns.slice(0, 20).map((a) => `- [Pedro:${a.type}] ${a.userText || "(sin texto)"}`);
  return lines.length
    ? `<ul>${lines.map((l) => `<li>${l.replace(/^- /, "")}</li>`).join("")}</ul>`
    : "<p class='hint'>Sin anotaciones para integrar.</p>";
}

export async function initPhase3Screen(session, hostEl) {
  if (!hostEl || !session?.slow) return;
  const scopeText = getScopeText(session);
  const moduleA = comparePhase0ToAnnotations(session.slow.phase0, session.slow.annotations, scopeText);
  let moduleB = [];
  try {
    moduleB = await generateRetrievalQuestions(session, session.slow.annotations);
  } catch {
    moduleB = [];
  }
  hostEl.innerHTML = `
    <section><h2>A — Revisión argumental</h2><ul>${renderPhase3ModuleA(moduleA)}</ul></section>
    <section><h2>B — Retrieval</h2><ul>${renderPhase3ModuleB(moduleB)}</ul></section>
    <section><h2>C — Grafo</h2>${renderPhase3ModuleC(session)}</section>
  `;
  session.slow.graphEnrichedUnlocked = true;
}
