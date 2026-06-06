/** Depth score + findings — Fase 3 only (FR-010, FR-015) */

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

export function computeDepthScore(annotations) {
  const list = Array.isArray(annotations) ? annotations : [];
  const byType = {};
  let total = 0;
  const penalties = [];
  for (const a of list) {
    const pts = TYPE_POINTS[a.type] ?? 1;
    byType[a.type] = (byType[a.type] || 0) + pts;
    total += pts;
    if (!String(a.userText || "").trim() && ["→", "≈", "?"].includes(a.type)) {
      penalties.push({ annotationId: a.id, reason: "Anotación generativa sin texto propio" });
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
    if (term && text.includes(term)) {
      registerFinding(session, c.term, annotation.id, session.slow.fillableMapMode);
    }
  }
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
