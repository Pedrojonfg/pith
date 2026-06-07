/** Depth score + findings — Fase 3 only (FR-010, FR-015) */

function isSpanishLang(lang) {
  const v = String(lang || "").trim().toLowerCase();
  return v.startsWith("es") || v.includes("spanish") || v.includes("español");
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Actionable quality feedback per annotation type (Fase 3 only). */
export const PENALTY_FEEDBACK_TEMPLATES = {
  "→": {
    es: "Esta → podría desarrollar tu explicación en tus propias palabras.",
    en: "This → could develop your explanation in your own words.",
  },
  "≈": {
    es: "Esta ≈ podría parafrasear la idea sin copiar el texto.",
    en: "This ≈ could paraphrase the idea without copying the text.",
  },
  "?": {
    es: "Esta ? podría formular la pregunta concreta que te planteaste.",
    en: "This ? could state the specific question you raised.",
  },
  "⊘": {
    es: "Esta ⊘ podría especificar qué justificación faltaría o qué objeción concreta planteas.",
    en: "This ⊘ could specify what justification is missing or what concrete objection you raise.",
  },
  "↯": {
    es: "Esta ↯ podría describir la tensión que detectaste y por qué importa.",
    en: "This ↯ could describe the tension you spotted and why it matters.",
  },
  "⚠": {
    es: "Esta ⚠ podría indicar qué evidencia faltaría para fortalecer el punto.",
    en: "This ⚠ could note what evidence would be missing to strengthen the point.",
  },
  "★": {
    es: "Esta ★ podría explicar por qué consideras fuerte este argumento.",
    en: "This ★ could explain why you consider this argument strong.",
  },
  "⇑": {
    es: "Esta ⇑ podría resumir el steel man que formulaste.",
    en: "This ⇑ could summarize the steel man you formulated.",
  },
  "⟷": {
    es: "Esta ⟷ podría resumir la conexión que identificaste entre ideas.",
    en: "This ⟷ could summarize the connection you identified between ideas.",
  },
};

const TYPE_POINTS = {
  "→": 3,
  "≈": 2,
  "?": 2,
  "⟷": 2,
  "⚑": 1,
  "⊘": 4,
  "↯": 4,
  "⚠": 3,
  "★": 3,
  "⇑": 4,
  "📌": 1,
  "⚡": 2,
  "↩": 1,
  "🔗": 2,
};

/** Types that earn ×1.25 depth multiplier when criticalMode is on (T07). */
const CRITICAL_DEPTH_TYPES = new Set(["⊘", "↯", "⚠", "★", "⇑"]);

const CRITICAL_DEPTH_MULTIPLIER = 1.25;

export function computeDepthScore(annotations, { criticalMode = false } = {}) {
  const list = Array.isArray(annotations) ? annotations : [];
  const byType = {};
  let total = 0;
  const penalties = [];
  for (const a of list) {
    let pts = TYPE_POINTS[a.type] ?? 1;
    if (criticalMode && CRITICAL_DEPTH_TYPES.has(a.type)) {
      pts *= CRITICAL_DEPTH_MULTIPLIER;
    }
    byType[a.type] = (byType[a.type] || 0) + pts;
    total += pts;
    if (!String(a.userText || "").trim() && ["→", "≈", "?"].includes(a.type)) {
      penalties.push({
        annotationId: a.id,
        type: a.type,
        reason: "Generative annotation without your own text",
      });
      total -= 1;
    }
  }
  const generative = list.filter((a) => String(a.userText || "").trim()).length;
  return {
    total: Math.max(0, total),
    byType,
    penalties,
    generativeRatio: list.length ? generative / list.length : 0,
  };
}

export function registerFinding(session, conceptTerm, annotationId, revealedInPhase1 = false) {
  if (!session?.slow) return;
  if (!Array.isArray(session.slow.findings)) session.slow.findings = [];
  session.slow.findings.push({
    conceptTerm: String(conceptTerm || "").trim(),
    annotationId,
    revealedInPhase1: Boolean(revealedInPhase1),
  });
}

export function matchConceptFindings(session, annotation) {
  const concepts = session?.slow?.phase0?.conceptsToFind || [];
  const text = String(annotation?.userText || "").toLowerCase();
  for (const c of concepts) {
    const term = String(c.term || "").toLowerCase();
    if (!term || !text.includes(term)) continue;
    const already = (session?.slow?.findings || []).some(
      (f) => String(f.conceptTerm || "").toLowerCase() === term,
    );
    if (already) continue;
    const revealedInPhase1 = Boolean(session.slow.fillableMapMode);
    registerFinding(session, c.term, annotation.id, revealedInPhase1);
    return { conceptTerm: c.term, annotationId: annotation.id, revealedInPhase1 };
  }
  return null;
}

export function annotationsToFlashcardPayload(annotation) {
  if (!annotation) return null;
  return {
    front: `${annotation.type} ${String(annotation.userText || "").slice(0, 120)}`,
    back: "Retrieval from Slow Mode annotation",
    source: "slow_mode",
    annotationId: annotation.id,
  };
}

export function convertAnnotationsToFlashcards(session, filterTypes = ["→", "≈", "⊘", "↯"]) {
  const set = new Set(filterTypes);
  return (session?.slow?.annotations || [])
    .filter((a) => set.has(a.type))
    .map(annotationsToFlashcardPayload)
    .filter(Boolean);
}

export function buildPenaltyFeedback(annotation, lang) {
  const es = isSpanishLang(lang);
  const bucket = PENALTY_FEEDBACK_TEMPLATES[annotation?.type];
  if (bucket) return es ? bucket.es : bucket.en;
  return es
    ? "Añade tu propio texto para reforzar esta marca."
    : "Add your own text to strengthen this mark.";
}

export function ensureDepthScore(session) {
  if (!session?.slow) return null;
  const score = computeDepthScore(session.slow.annotations, {
    criticalMode: Boolean(session.slow.criticalMode),
  });
  session.slow.depthScore = score;
  return score;
}

function formatGenerativeRatio(ratio) {
  return `${Math.round(Math.max(0, Math.min(1, Number(ratio) || 0)) * 100)}%`;
}

export function renderDepthScorePanel(session, lang) {
  const slow = session?.slow;
  if (!slow) return "";
  const score = ensureDepthScore(session);
  const es = isSpanishLang(lang);
  const annotations = Array.isArray(slow.annotations) ? slow.annotations : [];
  const annById = new Map(annotations.map((a) => [a.id, a]));

  const breakdown = Object.entries(score.byType || {})
    .sort((a, b) => b[1] - a[1])
    .map(
      ([type, pts]) =>
        `<li class="slow-depth-breakdown-row"><span class="slow-depth-type" aria-label="tipo">${escapeHtml(type)}</span><span class="slow-depth-pts">${escapeHtml(String(pts))}</span></li>`,
    )
    .join("");

  const penalties = (score.penalties || [])
    .map((p) => {
      const ann = annById.get(p.annotationId) || { id: p.annotationId, type: p.type };
      const feedback = buildPenaltyFeedback(ann, lang);
      return `<li class="slow-depth-penalty"><span class="slow-depth-penalty-type" aria-hidden="true">${escapeHtml(ann.type || p.type || "?")}</span><span>${escapeHtml(feedback)}</span></li>`;
    })
    .join("");

  const title = es ? "Profundidad de lectura" : "Reading depth";
  const totalLabel = es ? "Puntuación total" : "Total score";
  const breakdownLabel = es ? "Desglose por tipo" : "Breakdown by type";
  const ratioLabel = es ? "Ratio generativo" : "Generative ratio";
  const ratioHint = es
    ? "marcas con tu propio texto"
    : "marks with your own text";
  const penaltiesLabel = es ? "Oportunidades de mejora" : "Improvement opportunities";
  const privateNote = es
    ? "Solo para ti — sin rankings ni rachas."
    : "Private to you — no rankings or streaks.";

  return `<section class="slow-depth-panel" aria-label="${escapeHtml(title)}">
    <h2 class="slow-depth-title">${escapeHtml(title)}</h2>
    <p class="slow-depth-private hint">${escapeHtml(privateNote)}</p>
    <div class="slow-depth-total">
      <span class="slow-depth-total-label">${escapeHtml(totalLabel)}</span>
      <span class="slow-depth-total-value">${escapeHtml(String(score.total))}</span>
    </div>
    <div class="slow-depth-ratio">
      <span class="slow-depth-ratio-label">${escapeHtml(ratioLabel)}</span>
      <span class="slow-depth-ratio-value">${escapeHtml(formatGenerativeRatio(score.generativeRatio))}</span>
      <span class="slow-depth-ratio-hint">${escapeHtml(ratioHint)}</span>
    </div>
    <div class="slow-depth-breakdown">
      <h3>${escapeHtml(breakdownLabel)}</h3>
      <ul class="slow-depth-breakdown-list">${breakdown || `<li class="hint">${escapeHtml(es ? "Sin marcas aún." : "No marks yet.")}</li>`}</ul>
    </div>
    ${penalties ? `<div class="slow-depth-penalties"><h3>${escapeHtml(penaltiesLabel)}</h3><ul class="slow-depth-penalty-list">${penalties}</ul></div>` : ""}
  </section>`;
}

export function renderFindingsPanel(session, lang) {
  const slow = session?.slow;
  if (!slow) return "";
  const findings = Array.isArray(slow.findings) ? slow.findings : [];
  const annotations = Array.isArray(slow.annotations) ? slow.annotations : [];
  const annById = new Map(annotations.map((a) => [a.id, a]));
  const es = isSpanishLang(lang);

  const title = es ? "Hallazgos" : "Findings";
  const silentHint = es
    ? "Conceptos que encontraste en la lectura (revelados aquí)."
    : "Concepts you found while reading (revealed here).";
  const earlyHint = es
    ? "Ya vistos durante la lectura (mapa rellenable)."
    : "Already seen during reading (fillable map).";

  if (!findings.length) {
    return `<section class="slow-findings-panel" aria-label="${escapeHtml(title)}">
      <h2 class="slow-findings-title">${escapeHtml(title)}</h2>
      <p class="hint">${escapeHtml(es ? "Ningún concepto de Fase 0 enlazado aún." : "No Phase 0 concepts linked yet.")}</p>
    </section>`;
  }

  const silent = findings.filter((f) => !f.revealedInPhase1);
  const early = findings.filter((f) => f.revealedInPhase1);

  const renderRow = (f) => {
    const ann = annById.get(f.annotationId);
    const snippet = String(ann?.userText || "").trim().slice(0, 80);
    const snippetHtml = snippet
      ? `<span class="slow-finding-snippet">«${escapeHtml(snippet)}${snippet.length >= 80 ? "…" : ""}»</span>`
      : "";
    return `<li class="slow-finding-row">
      <span class="slow-finding-term">${escapeHtml(f.conceptTerm)}</span>
      ${snippetHtml}
    </li>`;
  };

  const silentBlock = silent.length
    ? `<div class="slow-findings-group"><p class="hint">${escapeHtml(silentHint)}</p><ul class="slow-findings-list">${silent.map(renderRow).join("")}</ul></div>`
    : "";
  const earlyBlock = early.length
    ? `<div class="slow-findings-group slow-findings-group--early"><p class="hint">${escapeHtml(earlyHint)}</p><ul class="slow-findings-list">${early.map(renderRow).join("")}</ul></div>`
    : "";

  return `<section class="slow-findings-panel" aria-label="${escapeHtml(title)}">
    <h2 class="slow-findings-title">${escapeHtml(title)}</h2>
    ${silentBlock}${earlyBlock}
  </section>`;
}

export function renderPhase3GamificationPanel(session, lang) {
  return `${renderDepthScorePanel(session, lang)}${renderFindingsPanel(session, lang)}`;
}
