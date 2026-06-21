/**
 * One-line "why am I seeing this?" explanations for review items.
 * @see specs/20260701-pedagogical-principles/spec.md §7
 */

const MS_PER_DAY = 86_400_000;

/**
 * @param {object} params
 * @param {object} params.item — smItem
 * @param {object} [params.beliefState] — shared.knowledgeBeliefState
 * @param {object[]} [params.assessmentSignals]
 * @param {number} [params.now]
 * @returns {string}
 */
export function computeWhyThisExplanation({
  item,
  beliefState = null,
  assessmentSignals = [],
  now = Date.now(),
}) {
  const conceptIds = resolveConceptIdsFromItem(item);
  const signals = Array.isArray(assessmentSignals) ? assessmentSignals : [];

  const miss = findRecentMiss(signals, conceptIds, item, now);
  if (miss) {
    const days = Math.max(1, Math.round((now - miss.at) / MS_PER_DAY));
    return `You missed this ${days} day${days === 1 ? "" : "s"} ago.`;
  }

  const propagated = findPropagatedBelief(beliefState, conceptIds);
  if (propagated) {
    return `Inferred from your answer about ${propagated.relatedLabel}.`;
  }

  const due = Number(item?.scheduledDue);
  if (Number.isFinite(due) && due <= now + MS_PER_DAY) {
    return "Scheduled for review today.";
  }

  return "Part of your regular review.";
}

function resolveConceptIdsFromItem(item) {
  const preview = String(item?.contentPreview || "");
  return preview
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function findRecentMiss(signals, conceptIds, item, now) {
  const windowMs = 30 * MS_PER_DAY;
  const sourceId = String(item?.sourceId || "");
  for (const sig of signals) {
    if (!sig || typeof sig !== "object") continue;
    const at = Number(sig.at || sig.timestamp);
    if (!Number.isFinite(at) || now - at > windowMs) continue;
    const missed = sig.missed === true || sig.correct === false;
    if (!missed) continue;
    const sigConcepts = Array.isArray(sig.conceptIds) ? sig.conceptIds.map(String) : [];
    if (sigConcepts.some((id) => conceptIds.includes(id))) return { at };
    if (sourceId && String(sig.blockId || sig.sourceId || "") === sourceId) return { at };
  }
  if (Number.isFinite(item?.lastMissAt) && now - item.lastMissAt <= windowMs) {
    return { at: item.lastMissAt };
  }
  return null;
}

function findPropagatedBelief(beliefState, conceptIds) {
  const beliefs = beliefState?.beliefs || beliefState?.concepts;
  if (!beliefs || typeof beliefs !== "object") return null;
  for (const id of conceptIds) {
    const entry = beliefs[id];
    if (!entry || typeof entry !== "object") continue;
    if (entry.source === "propagated" || entry.lastUpdateSource === "propagated") {
      const related = String(entry.relatedConceptLabel || entry.relatedConceptId || "a related concept");
      return { relatedLabel: related };
    }
  }
  return null;
}
