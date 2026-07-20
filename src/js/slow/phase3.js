import { llmChatCompletions, normalizeLlmModel } from "../llm.js?v=20260625_02";
import { getStudyLanguage } from "../ui.js?v=20260625_02";
import {
  annotationsToFlashcardPayload,
  renderPhase3GamificationPanel,
} from "./gamification.js?v=20260625_02";
import { getScopeText } from "./reader.js?v=20260625_02";
import { charOffsetToPage } from "./pagination.js?v=20260625_02";
import {
  addSlowFlashcardFromPayload,
  getActiveReviewSessionId,
  getSlowFlashcardAnnotationIds,
  loadSlowFlashcards,
} from "../review.js?v=20260625_02";
import { getActiveSession } from "../session-store.js";
import { SLOW_PHASE3_GENERATIVE_RULES } from "../pedagogy/generative-pedagogy.js";
import { registerOrUpdateSmItem } from "../sm2-ingest.js";
import {
  PROXIMITY,
  resolveArgumentMapNodeAnchor,
} from "../graph/proximity.js?v=20260625_02";

export { PROXIMITY, resolveArgumentMapNodeAnchor };

export const FLASHCARD_CONVERTIBLE_TYPES = ["→", "≈", "⊘", "↯"];

const RELEVANT_ANNOTATION_TYPES = new Set([
  "≈",
  "?",
  "→",
  "⟷",
  "⊘",
  "↯",
  "⚠",
  "★",
  "⇑",
]);

export const PHASE3_MODULE_DEFS = [
  { id: "A", label: "Revisión", title: "A — Revisión argumental" },
  { id: "B", label: "Retrieval", title: "B — Retrieval" },
  { id: "C", label: "Grafo", title: "C — Grafo" },
];

/** Spec §7 — annotation type → retrieval question pattern (UI hint). */
export const RETRIEVAL_PROMPT_TEMPLATES = {
  "≈": {
    es: "Explica el concepto sin usar las palabras del texto.",
    en: "Explain the concept without using the text's words.",
  },
  "?": {
    es: "Tu propia pregunta como retrieval.",
    en: "Your own question as retrieval practice.",
  },
  "→": {
    es: "Reconstruye tu auto-explicación desde memoria.",
    en: "Reconstruct your self-explanation from memory.",
  },
  "⟷": {
    es: "Resume la conexión que identificaste entre ideas.",
    en: "Summarize the connection you identified between ideas.",
  },
  "⊘": {
    es: "¿Cómo respondería el autor a que esto no está argumentado?",
    en: "How would the author respond that this is not argued?",
  },
  "↯": {
    es: "¿Qué premisa implícita necesitaría el argumento para ser válido?",
    en: "What implicit premise would the argument need to be valid?",
  },
  "⚠": {
    es: "¿Cuál es la forma correcta de hacer este argumento?",
    en: "What is the correct way to make this argument?",
  },
  "★": {
    es: "¿Por qué este movimiento argumentativo es sólido?",
    en: "Why is this argumentative move solid?",
  },
  "⇑": {
    es: "Formula el argumento más fuerte posible para este punto.",
    en: "Formulate the strongest possible argument for this point.",
  },
};

/** IA hints aligned with slow_mode_spec.md §7 table. */
export const RETRIEVAL_IA_HINTS = {
  "≈": "Explain the concept without using the text's words",
  "?": "Use the user's own question verbatim as the retrieval question",
  "→": "Ask them to reconstruct their self-explanation from memory (front: their note)",
  "⟷": "Ask them to summarize the connection they identified between ideas",
  "⊘": "Ask how the author would respond to the objection that X is not argued",
  "↯": "Ask what implicit premise the argument would need to be valid",
  "⚠": "Ask what the correct form of this argument would be",
  "★": "Ask why this argumentative move is solid",
  "⇑": "Ask them to formulate the strongest possible argument for X",
};

export const DEVILS_ADVOCATE_TYPES = new Set(["⊘", "↯", "⚠"]);

function isSpanishLang(lang) {
  const v = String(lang || "").trim().toLowerCase();
  return v.startsWith("es") || v.includes("spanish") || v.includes("español");
}

function annotationMid(ann) {
  return (Number(ann?.charStart) + Number(ann?.charEnd)) / 2;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(text, max = 80) {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function comparePhase0ToAnnotations(phase0, annotations, scopeText, options = {}) {
  const map = Array.isArray(phase0?.argumentMap) ? phase0.argumentMap : [];
  const allAnns = Array.isArray(annotations) ? annotations : [];
  const relevant = allAnns.filter(
    (a) => RELEVANT_ANNOTATION_TYPES.has(a.type) && String(a.userText || "").trim(),
  );
  const fillableBlanks = phase0?.fillableBlanks || options.fillableBlanks || [];
  const text = String(scopeText || "");

  return map.map((node) => {
    const resolved = resolveArgumentMapNodeAnchor(node, text, fillableBlanks, allAnns);
    const anchor = resolved.anchor;
    if (anchor == null) {
      return {
        node,
        hit: false,
        anchor: null,
        source: resolved.source,
        matchedAnnotation: null,
        pageIndex: null,
        snippet: "",
      };
    }

    let matchedAnnotation = null;
    let bestDist = Infinity;
    for (const ann of relevant) {
      const dist = Math.abs(annotationMid(ann) - anchor);
      if (dist <= PROXIMITY && dist < bestDist) {
        bestDist = dist;
        matchedAnnotation = ann;
      }
    }

    return {
      node,
      hit: Boolean(matchedAnnotation),
      anchor,
      source: resolved.source,
      matchedAnnotation,
      pageIndex: matchedAnnotation ? null : resolved.pageIndex,
      snippet: matchedAnnotation ? truncate(matchedAnnotation.userText) : "",
    };
  });
}

export function getEligiblePhase3Modules(session) {
  const slow = session?.slow;
  if (!slow) return [];
  const eligible = [];
  if (Array.isArray(slow.phase0?.argumentMap) && slow.phase0.argumentMap.length) {
    eligible.push("A");
  }
  if (Array.isArray(slow.annotations) && slow.annotations.length) {
    eligible.push("B");
    eligible.push("C");
  }
  return eligible;
}

export function normalizePhase3Selection(session, selected) {
  const eligible = getEligiblePhase3Modules(session);
  const raw = Array.isArray(selected) ? selected : eligible;
  const picked = raw.filter((id) => eligible.includes(id));
  return picked.length ? picked : eligible;
}

export function computePhase3ConceptStats(session) {
  const concepts = Array.isArray(session?.slow?.phase0?.conceptsToFind)
    ? session.slow.phase0.conceptsToFind
    : [];
  const total = concepts.length ? Math.min(5, concepts.length) : 0;
  const findings = Array.isArray(session?.slow?.findings) ? session.slow.findings : [];
  const foundTerms = new Set(findings.map((f) => String(f.conceptTerm || "").toLowerCase()).filter(Boolean));
  let found = foundTerms.size;
  if (!found && concepts.length) {
    const anns = session?.slow?.annotations || [];
    found = concepts.filter((c) => {
      const term = String(c.term || "").toLowerCase();
      return term && anns.some((a) => String(a.userText || "").toLowerCase().includes(term));
    }).length;
  }
  return { found, total: total || concepts.length || 0 };
}

export function computePhase3WeakPointStats(session) {
  const slow = session?.slow;
  const criticalPoints = Array.isArray(slow?.phase0?.criticalExaminePoints)
    ? slow.phase0.criticalExaminePoints.filter(Boolean)
    : [];
  const criticalAnns = (slow?.annotations || []).filter((a) => ["⊘", "↯", "⚠"].includes(a.type));
  const total = criticalPoints.length || Math.min(3, criticalAnns.length || 3);
  let found = 0;
  if (criticalPoints.length) {
    const corpus = (slow?.annotations || [])
      .map((a) => String(a.userText || "").toLowerCase())
      .join(" ");
    found = criticalPoints.filter((p) => {
      const key = String(p || "").toLowerCase().slice(0, 24);
      return key.length >= 4 && corpus.includes(key.slice(0, 12));
    }).length;
  } else {
    found = criticalAnns.filter((a) => String(a.userText || "").trim()).length;
  }
  return { found: Math.min(found, total || found), total: total || 0 };
}

function pageLabelForRow(row, breakpoints) {
  const ann = row.matchedAnnotation;
  if (ann && Array.isArray(breakpoints) && breakpoints.length) {
    return charOffsetToPage(breakpoints, ann.charStart) + 1;
  }
  if (row.pageIndex != null) return Number(row.pageIndex) + 1;
  if (row.anchor != null && Array.isArray(breakpoints) && breakpoints.length) {
    return charOffsetToPage(breakpoints, row.anchor) + 1;
  }
  return null;
}

export function renderPhase3ModuleA(rows, session, { lang, breakpoints } = {}) {
  const es = isSpanishLang(lang);
  const conceptStats = computePhase3ConceptStats(session);
  const weakStats = computePhase3WeakPointStats(session);
  const reviewCopy = es ? "oportunidad de revisión" : "review opportunity";
  const coveredCopy = es ? "cubierto por tus anotaciones" : "covered by your notes";

  const items = (rows || [])
    .map((r) => {
      const label = r.node?.text || r.node?.label || r.node?.id || "Node";
      const page = pageLabelForRow(r, breakpoints);
      const pageStr = page != null ? (es ? `pág. ${page}` : `p. ${page}`) : es ? "pág. —" : "p. —";
      const status = r.hit ? "✓" : "✗";
      const statusText = r.hit ? coveredCopy : reviewCopy;
      const snippet = r.snippet
        ? `<span class="slow-phase3-snippet">«${escapeHtml(r.snippet)}»</span>`
        : "";
      return `<li class="slow-phase3-review-row ${r.hit ? "is-covered" : "is-review"}">
        <span class="slow-phase3-status" aria-hidden="true">${status}</span>
        <div class="slow-phase3-review-body">
          <strong>${escapeHtml(label)}</strong>
          <span class="slow-phase3-meta">${escapeHtml(pageStr)} · ${escapeHtml(statusText)}</span>
          ${snippet}
        </div>
      </li>`;
    })
    .join("");

  const conceptsLabel = es
    ? `Conceptos: ${conceptStats.found}/${conceptStats.total || 5}`
    : `Concepts: ${conceptStats.found}/${conceptStats.total || 5}`;
  const weakLabel = es
    ? `Puntos débiles: ${weakStats.found}/${weakStats.total || 3}`
    : `Weak points: ${weakStats.found}/${weakStats.total || 3}`;

  return `<ul class="slow-phase3-review-list">${items || `<li class="hint">${es ? "Sin nodos en el mapa argumental." : "No argument map nodes."}</li>`}</ul>
    <footer class="slow-phase3-module-footer">
      <span>${escapeHtml(conceptsLabel)}</span>
      <span>${escapeHtml(weakLabel)}</span>
    </footer>`;
}

export function buildRetrievalPromptTemplate(annotation, lang) {
  const es = isSpanishLang(lang);
  const bucket = RETRIEVAL_PROMPT_TEMPLATES[annotation?.type];
  if (bucket) return es ? bucket.es : bucket.en;
  return es
    ? "Responde desde memoria antes de volver al texto."
    : "Answer from memory before returning to the text.";
}

function snippetForQuestion(text, max = 60) {
  return truncate(String(text || "").trim(), max);
}

/** Local per-type retrieval question — spec §7 table (no LLM). */
export function buildRetrievalQuestionLocal(annotation, lang) {
  const es = isSpanishLang(lang);
  const note = snippetForQuestion(annotation?.userText, 80);
  const type = annotation?.type;

  if (type === "?") {
    return String(annotation?.userText || "").trim();
  }

  const byType = {
    "≈": es
      ? `Explica «${note}» sin usar las palabras del texto.`
      : `Explain «${note}» without using the text's words.`,
    "→": es
      ? `Reconstruye desde memoria tu auto-explicación sobre «${note}».`
      : `From memory, reconstruct your self-explanation about «${note}».`,
    "⟷": es
      ? `Resume la conexión que identificaste: «${note}».`
      : `Summarize the connection you identified: «${note}».`,
    "⊘": es
      ? `¿Cómo respondería el autor a la objeción de que «${note}» no está argumentado?`
      : `How would the author respond to the objection that «${note}» is not argued?`,
    "↯": es
      ? `¿Qué premisa implícita necesitaría el argumento relacionado con «${note}» para ser válido?`
      : `What implicit premise would the argument related to «${note}» need to be valid?`,
    "⚠": es
      ? `¿Cuál es la forma correcta de hacer el argumento que criticaste («${note}»)?`
      : `What is the correct way to make the argument you criticized («${note}»)?`,
    "★": es
      ? `¿Por qué el movimiento argumentativo que marcaste («${note}») es sólido?`
      : `Why is the argumentative move you marked («${note}») solid?`,
    "⇑": es
      ? `Formula el argumento más fuerte posible para «${note}».`
      : `Formulate the strongest possible argument for «${note}».`,
  };

  return byType[type] || buildRetrievalPromptTemplate(annotation, lang);
}

/** Local inverse devil's advocate — spec §7 closing loop (no LLM). */
export function buildDevilsAdvocateQuestionLocal(annotation, lang) {
  const es = isSpanishLang(lang);
  const note = snippetForQuestion(annotation?.userText, 80);
  const type = annotation?.type;

  if (type === "⊘") {
    return es
      ? `Marcaste que «${note}» no está argumentada. ¿Cómo respondería el autor a esta objeción? Formula su mejor defensa antes de evaluar si hay respuesta en el texto.`
      : `You marked that «${note}» is not argued. How would the author respond to this objection? State their best defense before checking whether the text answers it.`;
  }
  if (type === "↯") {
    return es
      ? `Señalaste un gap de inferencia: «${note}». ¿Cómo defendería el autor el nexo? Formula su mejor réplica antes de evaluar el texto.`
      : `You flagged an inference gap: «${note}». How would the author defend the link? State their best reply before evaluating the text.`;
  }
  if (type === "⚠") {
    return es
      ? `Identificaste una posible falacia: «${note}». ¿Cómo reconstruiría el autor este argumento de forma válida? Anticipa su defensa antes de juzgar.`
      : `You identified a possible fallacy: «${note}». How would the author reconstruct this argument validly? Anticipate their defense before judging.`;
  }
  return "";
}

function eligibleRetrievalAnnotations(annotations) {
  return (Array.isArray(annotations) ? annotations : [])
    .filter((a) => RELEVANT_ANNOTATION_TYPES.has(a.type) && String(a.userText || "").trim())
    .slice(0, 12);
}

function parseJsonArray(raw) {
  try {
    const parsed = JSON.parse(String(raw).replace(/^```json?\s*|\s*```$/gi, ""));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function annotationContextSlice(scopeText, annotation, radius = 400) {
  const text = String(scopeText || "");
  const start = Math.max(0, Number(annotation?.charStart) || 0);
  const end = Math.min(text.length, Number(annotation?.charEnd) || start);
  const mid = Math.floor((start + end) / 2);
  return text.slice(Math.max(0, mid - radius), Math.min(text.length, mid + radius));
}

export function buildRetrievalQuestionShells(annotations, lang) {
  return eligibleRetrievalAnnotations(annotations).map((ann) => ({
    annotationId: ann.id,
    type: ann.type,
    sourceSnippet: truncate(ann.userText, 100),
    prompt: buildRetrievalPromptTemplate(ann, lang),
    question: buildRetrievalQuestionLocal(ann, lang),
    kind: "retrieval",
  }));
}

/**
 * Per-type retrieval questions — spec §7 table; optional IA refinement.
 */
export async function generateRetrievalByType(session, annotations, { llmCall = llmChatCompletions } = {}) {
  const lang = getStudyLanguage() || "English";
  const shells = buildRetrievalQuestionShells(annotations, lang);
  const anns = eligibleRetrievalAnnotations(annotations);
  if (!anns.length) return shells;

  const typeGuide = anns
    .map((a) => `- ${a.id} [${a.type}]: ${RETRIEVAL_IA_HINTS[a.type] || "retrieval from memory"}`)
    .join("\n");

  try {
    const raw = await llmCall({
      llmModel: normalizeLlmModel(session?.llmModel),
      messages: [
        {
          role: "system",
          content:
            `Generate one retrieval question per annotation as JSON array {annotationId, question}. ` +
            `Follow the per-type rules exactly. For type "?" use the user's note verbatim. ` +
            `${SLOW_PHASE3_GENERATIVE_RULES} ` +
            `Respond entirely in ${lang}. Return ONLY JSON.`,
        },
        {
          role: "user",
          content:
            `Per-type rules:\n${typeGuide}\n\n` +
            `Annotations:\n${JSON.stringify(
              anns.map((a) => ({ id: a.id, type: a.type, text: a.userText })),
            )}\n\n` +
            `Context:\n${getScopeText(session).slice(0, 80000)}`,
        },
      ],
      temperature: 0.1,
    });
    const merged = new Map(parseJsonArray(raw).map((row) => [String(row.annotationId), String(row.question || "").trim()]));
    return shells.map((shell) => {
      const iaQ = merged.get(String(shell.annotationId));
      return iaQ ? { ...shell, question: iaQ } : shell;
    });
  } catch {
    return shells;
  }
}

/**
 * Inverse devil's advocate — one Socratic question per ⊘/↯/⚠ (IA with local fallback).
 */
export async function generateDevilsAdvocateQuestions(
  session,
  annotations,
  { llmCall = llmChatCompletions } = {},
) {
  const lang = getStudyLanguage() || "English";
  const scope = getScopeText(session);
  const critical = (Array.isArray(annotations) ? annotations : [])
    .filter((a) => DEVILS_ADVOCATE_TYPES.has(a.type) && String(a.userText || "").trim())
    .slice(0, 8);

  const shells = critical.map((ann) => ({
    annotationId: ann.id,
    type: ann.type,
    sourceSnippet: truncate(ann.userText, 100),
    question: buildDevilsAdvocateQuestionLocal(ann, lang),
    kind: "devils-advocate",
  }));

  if (!critical.length) return shells;

  try {
    const raw = await llmCall({
      llmModel: normalizeLlmModel(session?.llmModel),
      messages: [
        {
          role: "system",
          content:
            `Generate exactly one inverse devil's advocate question per critical annotation as JSON array ` +
            `{annotationId, question}. Each question must be Socratic: ask the reader to formulate the ` +
            `author's best defense or reply BEFORE evaluating the text. Types: ⊘ unjustified premise, ` +
            `↯ inference gap, ⚠ fallacy. ${SLOW_PHASE3_GENERATIVE_RULES} Respond entirely in ${lang}. Return ONLY JSON.`,
        },
        {
          role: "user",
          content: critical
            .map(
              (a) =>
                `${a.id} [${a.type}]: ${a.userText}\nContext:\n${annotationContextSlice(scope, a).slice(0, 2000)}`,
            )
            .join("\n\n---\n\n"),
        },
      ],
      temperature: 0.1,
    });
    const merged = new Map(parseJsonArray(raw).map((row) => [String(row.annotationId), String(row.question || "").trim()]));
    return shells.map((shell) => {
      const iaQ = merged.get(String(shell.annotationId));
      return iaQ ? { ...shell, question: iaQ } : shell;
    });
  } catch {
    return shells;
  }
}

function renderRetrievalItem(q, lang, { variant = "retrieval" } = {}) {
  const es = isSpanishLang(lang);
  const question = String(q.question || q.prompt || "").trim();
  const variantClass = variant === "devils-advocate" ? " is-devils-advocate" : "";
  const badge =
    variant === "devils-advocate"
      ? `<span class="slow-retrieval-badge">${escapeHtml(es ? "Abogado del diablo" : "Devil's advocate")}</span>`
      : "";
  const promptLine =
    variant === "retrieval" && q.prompt && q.question && q.prompt !== q.question
      ? `<p class="slow-retrieval-hint">${escapeHtml(q.prompt)}</p>`
      : "";
  return `<li class="slow-retrieval-item${variantClass}" data-annotation-id="${escapeHtml(q.annotationId)}" data-kind="${escapeHtml(variant)}">
        <div class="slow-retrieval-head">
          <span class="slow-retrieval-type" aria-label="tipo">${escapeHtml(q.type)}</span>
          ${badge}
          <span class="slow-retrieval-source">«${escapeHtml(q.sourceSnippet)}»</span>
        </div>
        <p class="slow-retrieval-prompt">${escapeHtml(question)}</p>
        ${promptLine}
        <textarea class="slow-retrieval-answer" rows="2" placeholder="${escapeHtml(
          es ? "Tu respuesta…" : "Your answer…",
        )}" aria-label="${escapeHtml(
          variant === "devils-advocate"
            ? es
              ? "Réplica del autor"
              : "Author's reply"
            : es
              ? "Respuesta retrieval"
              : "Retrieval answer",
        )}"></textarea>
      </li>`;
}

export function renderPhase3ModuleB(shells, lang, { devilsAdvocate = [], flashcardPanelHtml = "" } = {}) {
  const es = isSpanishLang(lang);
  const hint = es
    ? "Responde desde memoria antes de volver al texto."
    : "Answer from memory before returning to the text.";
  const devilHint = es
    ? "Anticipa la mejor defensa del autor antes de evaluar el texto."
    : "Anticipate the author's best defense before evaluating the text.";
  if (!shells?.length && !devilsAdvocate?.length && !flashcardPanelHtml) {
    return `<p class="hint">${es ? "Añade anotaciones con texto para practicar retrieval." : "Add annotations with text to practice retrieval."}</p>`;
  }
  const retrievalItems = (shells || [])
    .map((q) => renderRetrievalItem(q, lang, { variant: "retrieval" }))
    .join("");
  const devilItems = (devilsAdvocate || [])
    .map((q) => renderRetrievalItem(q, lang, { variant: "devils-advocate" }))
    .join("");
  const retrievalBlock = shells?.length
    ? `<p class="hint">${escapeHtml(hint)}</p><ul class="slow-retrieval-list">${retrievalItems}</ul>`
    : "";
  const devilBlock = devilItems
    ? `<h3 class="slow-devils-heading">${escapeHtml(es ? "Abogado del diablo inverso" : "Inverse devil's advocate")}</h3>
       <p class="hint">${escapeHtml(devilHint)}</p>
       <ul class="slow-retrieval-list slow-devils-list">${devilItems}</ul>`
    : "";
  return `${retrievalBlock}${devilBlock}${flashcardPanelHtml}`;
}

export function getConvertibleFlashcardAnnotations(session) {
  const set = new Set(FLASHCARD_CONVERTIBLE_TYPES);
  return (session?.slow?.annotations || []).filter(
    (a) => set.has(a.type) && String(a.userText || "").trim(),
  );
}

export function renderPhase3FlashcardPanel(session, lang, sessionId) {
  const es = isSpanishLang(lang);
  const converted = getSlowFlashcardAnnotationIds(sessionId);
  const annotations = getConvertibleFlashcardAnnotations(session);
  if (!annotations.length) {
    return "";
  }

  const title = es ? "Flashcards para repaso" : "Flashcards for review";
  const hint = es
    ? "Convierte anotaciones →/≈/⊘/↯ a tarjetas del flujo de review."
    : "Convert →/≈/⊘/↯ annotations into cards for the review flow.";
  const convertLabel = es ? "Convertir" : "Convert";
  const convertedLabel = es ? "En cola" : "Queued";

  const items = annotations
    .map((ann) => {
      const isConverted = converted.has(ann.id);
      const snippet = truncate(ann.userText, 100);
      return `<li class="slow-flashcard-item${isConverted ? " is-converted" : ""}" data-annotation-id="${escapeHtml(ann.id)}">
        <div class="slow-flashcard-head">
          <span class="slow-flashcard-type" aria-label="tipo">${escapeHtml(ann.type)}</span>
          <span class="slow-flashcard-source">«${escapeHtml(snippet)}»</span>
        </div>
        <button type="button" class="slow-flashcard-convert-btn btn-secondary" data-convert-flashcard="1" data-annotation-id="${escapeHtml(ann.id)}" ${isConverted ? "disabled aria-pressed=\"true\"" : ""}>
          ${isConverted ? `✓ ${escapeHtml(convertedLabel)}` : escapeHtml(convertLabel)}
        </button>
      </li>`;
    })
    .join("");

  return `<section class="slow-flashcard-panel" aria-label="${escapeHtml(title)}">
    <h3 class="slow-flashcard-title">${escapeHtml(title)}</h3>
    <p class="hint slow-flashcard-hint">${escapeHtml(hint)}</p>
    <ul class="slow-flashcard-list">${items}</ul>
    <p class="slow-flashcard-status hint" role="status" aria-live="polite" hidden></p>
  </section>`;
}

export async function wirePhase3FlashcardConvert(hostEl, session) {
  if (!hostEl || !session?.slow) return;
  const panel = hostEl.querySelector(".slow-flashcard-panel");
  if (!panel) return;

  const lang = getStudyLanguage() || "English";
  const es = isSpanishLang(lang);
  const statusEl = panel.querySelector(".slow-flashcard-status");

  const showStatus = (msg) => {
    if (!statusEl) return;
    statusEl.textContent = String(msg || "");
    statusEl.hidden = !msg;
  };

  panel.querySelectorAll("[data-convert-flashcard]").forEach((btn) => {
    if (btn.disabled || btn.dataset.phase3Wired === "1") return;
    btn.dataset.phase3Wired = "1";
    btn.addEventListener("click", async () => {
      const annId = String(btn.dataset.annotationId || "").trim();
      const ann = (session.slow.annotations || []).find((a) => a.id === annId);
      const payload = annotationsToFlashcardPayload(ann);
      if (!payload) return;

      const sessionId =
        getActiveReviewSessionId() || String(session?._meta?.session_id || "").trim();
      if (!sessionId) {
        showStatus(es ? "Guarda la sesión antes de convertir." : "Save the session before converting.");
        return;
      }

      const { added, total } = addSlowFlashcardFromPayload(sessionId, payload);
      if (added) {
        try {
          const doc = await getActiveSession();
          if (doc?.docId) {
            await registerOrUpdateSmItem(doc.docId, {
              sourceType: "slow_flashcard",
              sourceId: annId,
              title: String(payload.front || "").trim(),
              contentPreview: String(payload.back || "").slice(0, 80),
            });
          }
        } catch (err) {
          console.warn("[sm2-ingest] slow flashcard ingest failed", err);
        }
      }
      if (!added) {
        showStatus(es ? "Esta anotación ya está en cola." : "This annotation is already queued.");
        btn.disabled = true;
        btn.setAttribute("aria-pressed", "true");
        btn.textContent = es ? "✓ En cola" : "✓ Queued";
        btn.closest(".slow-flashcard-item")?.classList.add("is-converted");
        return;
      }

      btn.disabled = true;
      btn.setAttribute("aria-pressed", "true");
      btn.textContent = es ? "✓ En cola" : "✓ Queued";
      btn.closest(".slow-flashcard-item")?.classList.add("is-converted");
      showStatus(
        es
          ? `Añadida a review (${total} tarjeta${total === 1 ? "" : "s"} en cola).`
          : `Added to review queue (${total} card${total === 1 ? "" : "s"} queued).`,
      );
    });
  });
}

export function getPhase3FlashcardQueueCount(sessionId) {
  return loadSlowFlashcards(sessionId).length;
}

function renderGraphUnlockButtonHtml(lang = "English") {
  const es = isSpanishLang(lang);
  const label = es ? "Ver grafo enriquecido" : "View enriched graph";
  return `<button type="button" id="slowPhase3GraphBtn" class="btn-secondary slow-phase3-graph-btn">${escapeHtml(label)}</button>`;
}

export function renderPhase3ModuleC(session, lang = "English") {
  const es = isSpanishLang(lang);
  const anns = session?.slow?.annotations || [];
  const withText = anns.filter((a) => String(a?.userText || "").trim());
  const graphBtnLabel = es ? "Ver grafo interactivo" : "View interactive graph";
  const graphHint = es
    ? "Mapa de tus anotaciones enlazadas a conceptos y al mapa argumental."
    : "Map of your annotations linked to concepts and the argument map.";
  const lines = withText.slice(0, 20).map((a) => `[Pedro:${a.type}] ${a.userText}`);
  const listHtml = lines.length
    ? `<ul class="slow-phase3-graph-list">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
    : `<p class="hint">${escapeHtml(es ? "Aún no hay anotaciones con texto." : "No annotations with text yet.")}</p>`;
  return `
    <p class="hint">${escapeHtml(graphHint)}</p>
    <button type="button" id="slowPhase3ModuleCGraphBtn" class="btn-secondary slow-phase3-module-c-graph-btn">${escapeHtml(graphBtnLabel)}</button>
    ${listHtml}`;
}

export function renderPhase3ModulePicker(session, pickerEl, { onChange } = {}) {
  if (!pickerEl || !session?.slow) return [];
  const eligible = getEligiblePhase3Modules(session);
  if (!Array.isArray(session.slow.phase3Modules)) {
    session.slow.phase3Modules = [...eligible];
  } else {
    session.slow.phase3Modules = normalizePhase3Selection(session, session.slow.phase3Modules);
  }
  const selected = session.slow.phase3Modules;
  const lang = getStudyLanguage() || "English";
  const es = isSpanishLang(lang);
  const hint = es
    ? "Elige módulos y orden (puedes omitir alguno)."
    : "Choose modules and order (you may skip any).";

  pickerEl.innerHTML = `
    <p class="hint slow-phase3-picker-hint">${escapeHtml(hint)}</p>
    <div class="slow-phase3-module-buttons" role="group" aria-label="${escapeHtml(
      es ? "Módulos de consolidación" : "Consolidation modules",
    )}">
      ${PHASE3_MODULE_DEFS.filter((m) => eligible.includes(m.id))
        .map(
          (m) => `<button type="button" class="slow-phase3-module-btn" data-module-id="${m.id}" aria-pressed="${selected.includes(m.id) ? "true" : "false"}">${escapeHtml(m.label)}</button>`,
        )
        .join("")}
    </div>`;

  pickerEl.querySelectorAll(".slow-phase3-module-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-module-id");
      if (!id || !eligible.includes(id)) return;
      const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
      session.slow.phase3Modules = normalizePhase3Selection(session, next);
      renderPhase3ModulePicker(session, pickerEl, { onChange });
      onChange?.(session.slow.phase3Modules);
    });
  });

  return selected;
}

function phase3ModuleSelector(moduleId) {
  return `.slow-phase3-module-${String(moduleId || "").toLowerCase()}`;
}

function appendPhase3SectionHtml(hostEl, html) {
  const wrap = document.createElement("div");
  wrap.innerHTML = String(html || "").trim();
  const node = wrap.firstElementChild;
  if (node) hostEl.appendChild(node);
}

/**
 * Re-render selected Phase 3 modules. Modules already present in the host and
 * still selected are reused in place (no LLM re-call; Module B textareas kept).
 * Only missing selected modules are generated fresh.
 */
export async function renderPhase3Modules(session, hostEl, moduleIds) {
  if (!hostEl || !session?.slow) return;
  const scopeText = getScopeText(session);
  const lang = getStudyLanguage() || "English";
  const es = isSpanishLang(lang);
  const breakpoints = session.slow.breakpoints || [];
  const selected = normalizePhase3Selection(session, moduleIds);

  /** @type {Map<string, Element>} */
  const reused = new Map();
  for (const id of selected) {
    const existing = hostEl.querySelector(phase3ModuleSelector(id));
    if (existing) reused.set(id, existing);
  }
  // Detach keepers before clearing so nodes (and Module B answers) survive.
  for (const node of reused.values()) node.remove();

  hostEl.replaceChildren();

  if (!selected.length) {
    hostEl.innerHTML = `<p class="hint">${escapeHtml(
      es ? "Selecciona al menos un módulo arriba." : "Select at least one module above.",
    )}</p>`;
    return;
  }

  for (const id of selected) {
    if (reused.has(id)) {
      hostEl.appendChild(reused.get(id));
      continue;
    }

    if (id === "A") {
      const moduleA = comparePhase0ToAnnotations(
        session.slow.phase0,
        session.slow.annotations,
        scopeText,
      );
      const def = PHASE3_MODULE_DEFS.find((m) => m.id === "A");
      appendPhase3SectionHtml(
        hostEl,
        `<section class="slow-phase3-module slow-phase3-module-a">
      <h2>${escapeHtml(def?.title || "A")}</h2>
      <p class="hint">${escapeHtml(es ? "Comparación amable — oportunidades de revisión, no calificación." : "Gentle comparison — review opportunities, not grading.")}</p>
      ${renderPhase3ModuleA(moduleA, session, { lang, breakpoints })}
    </section>`,
      );
      continue;
    }

    if (id === "B") {
      const shells = await generateRetrievalByType(session, session.slow.annotations);
      const devilsAdvocate = session.slow.criticalMode
        ? await generateDevilsAdvocateQuestions(session, session.slow.annotations)
        : [];
      const sessionId =
        getActiveReviewSessionId() || String(session?._meta?.session_id || "").trim();
      const flashcardPanel = renderPhase3FlashcardPanel(session, lang, sessionId);
      const def = PHASE3_MODULE_DEFS.find((m) => m.id === "B");
      appendPhase3SectionHtml(
        hostEl,
        `<section class="slow-phase3-module slow-phase3-module-b">
      <h2>${escapeHtml(def?.title || "B")}</h2>
      ${renderPhase3ModuleB(shells, lang, { devilsAdvocate, flashcardPanelHtml: flashcardPanel })}
    </section>`,
      );
      continue;
    }

    if (id === "C") {
      const def = PHASE3_MODULE_DEFS.find((m) => m.id === "C");
      appendPhase3SectionHtml(
        hostEl,
        `<section class="slow-phase3-module slow-phase3-module-c">
      <h2>${escapeHtml(def?.title || "C")}</h2>
      ${renderPhase3ModuleC(session, lang)}
    </section>`,
      );
    }
  }
}

export async function generateRetrievalQuestions(session, annotations) {
  const scope = getScopeText(session);
  const anns = (annotations || []).slice(0, 12);
  const lang = getStudyLanguage() || "English";
  const prompt = `Generate retrieval questions (1 per annotation) as a JSON array {annotationId, question}. Respond entirely in ${lang}. Annotations: ${JSON.stringify(anns.map((a) => ({ id: a.id, type: a.type, text: a.userText })))}`;
  const raw = await llmChatCompletions({
    llmModel: normalizeLlmModel(session.llmModel),
    messages: [
      { role: "system", content: "Return only a JSON array." },
      { role: "user", content: `${prompt}\n\nContext:\n${scope.slice(0, 80000)}` },
    ],
    temperature: 0.1,
  });
  try {
    return JSON.parse(String(raw).replace(/^```json?\s*|\s*```$/gi, ""));
  } catch {
    return [];
  }
}

/** In-flight init — prevents concurrent double LLM on overlapping reveals. */
let phase3InitInFlight = null;

export async function initPhase3Screen(session, hostEl, pickerEl, scoreEl) {
  if (!session?.slow) return;
  if (phase3InitInFlight) return phase3InitInFlight;

  phase3InitInFlight = (async () => {
    const contentEl =
      hostEl ||
      (typeof document !== "undefined" ? document.getElementById("slowPhase3Content") : null);
    const modulesEl =
      pickerEl ||
      (typeof document !== "undefined" ? document.getElementById("slowPhase3Modules") : null);
    const gamificationEl =
      scoreEl ||
      (typeof document !== "undefined" ? document.getElementById("slowPhase3Score") : null);
    const lang = getStudyLanguage() || "English";

    if (gamificationEl) {
      gamificationEl.innerHTML = renderPhase3GamificationPanel(session, lang);
    }

    const selected = renderPhase3ModulePicker(session, modulesEl, {
      onChange: (ids) => {
        void renderPhase3Modules(session, contentEl, ids).then(() => {
          wirePhase3FlashcardConvert(contentEl, session);
        });
      },
    });

    // Re-showing Phase 3 (graph round-trip, resume, aria-hidden flip) must not
    // wipe DOM-only Module B answers or re-call the retrieval LLM.
    const alreadyRendered = Boolean(contentEl?.querySelector(".slow-phase3-module"));
    if (!alreadyRendered) {
      await renderPhase3Modules(session, contentEl, selected);
      wirePhase3FlashcardConvert(contentEl, session);
    }

    const graphActionsEl =
      typeof document !== "undefined" ? document.getElementById("slowPhase3GraphActions") : null;
    if (graphActionsEl) {
      graphActionsEl.hidden = false;
      graphActionsEl.innerHTML = renderGraphUnlockButtonHtml(lang);
    }
  })();

  try {
    await phase3InitInFlight;
  } finally {
    phase3InitInFlight = null;
  }
}

/** Clear Phase 3 module DOM so the next visit regenerates (e.g. after Back). */
export function clearPhase3ScreenContent() {
  if (typeof document === "undefined") return;
  const contentEl = document.getElementById("slowPhase3Content");
  if (contentEl) contentEl.replaceChildren();
}
