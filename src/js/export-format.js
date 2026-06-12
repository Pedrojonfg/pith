/** Session export markdown format v3 — shared helpers (render-only layer). */

export const EDGE_TYPE_FAMILIES = {
  requires: "epistemic",
  sequence: "didactic",
  covers: "didactic",
  mentions: "didactic",
  historically_precedes: "didactic",
  relates: "semantic",
  instantiates: "semantic",
  reinterprets: "semantic",
  constitutes: "semantic",
  influences: "semantic",
  supports: "argumentative",
  contradicts: "argumentative",
  refuta: "argumentative",
  cuestiona: "argumentative",
  contrasts_with: "argumentative",
};

const FAMILY_LABELS = {
  en: {
    epistemic: "epistemic",
    didactic: "didactic",
    semantic: "semantic",
    argumentative: "argumentative",
  },
  es: {
    epistemic: "epistemic",
    didactic: "didactic",
    semantic: "semantic",
    argumentative: "argumentative",
  },
};

const VALID_ERROR_TYPES = new Set([
  "formula_recall",
  "conceptual_confusion",
  "calculation_error",
  "attention_slip",
]);

const VALID_REVIEW_PRIORITIES = new Set(["high", "medium", "low"]);

function yamlQuote(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return '""';
  if (/^[a-z0-9_.-]+$/i.test(raw)) return raw;
  return `"${raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function parseAnswerLetter(raw) {
  const t = String(raw || "").trim();
  if (!t) return "";
  const m = t.match(/\b([ABCD])\b/i);
  return m ? String(m[1]).toUpperCase() : "";
}

export function normalizeExportLanguageCode(lang) {
  void lang;
  return "en";
}

export function resolveMaterialPath(session) {
  const metaFiles = session?._meta?.source_files;
  if (Array.isArray(metaFiles) && metaFiles.length) {
    const name = String(metaFiles[0]?.name || "").trim();
    if (name) return name;
  }
  const fromMeta = String(session?.materialMeta?.fileName || "").trim();
  if (fromMeta) return fromMeta;
  return "—";
}

export function resolveMaterialFormat(session) {
  const explicit = String(session?.materialMeta?.format || session?._meta?.material_format || "")
    .trim()
    .toLowerCase();
  if (explicit === "html" || explicit === "md" || explicit === "markdown") {
    return explicit === "html" ? "html" : "md";
  }
  const path = resolveMaterialPath(session).toLowerCase();
  if (path.endsWith(".html") || path.endsWith(".htm")) return "html";
  return "md";
}

export function resolveExportDate(session) {
  const fromMeta = String(session?._meta?.exported_at || session?._meta?.session_date || "").trim();
  if (fromMeta) {
    const d = new Date(fromMeta);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}/.test(fromMeta)) return fromMeta.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

export function resolveDurationMin(session) {
  const direct = Number(session?._meta?.duration_min);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
  const started = Number(session?._meta?.session_started_at);
  const ended = Number(session?._meta?.last_activity_at || session?._meta?.exported_at);
  if (Number.isFinite(started) && Number.isFinite(ended) && ended > started) {
    return Math.max(1, Math.round((ended - started) / 60000));
  }
  return null;
}

export function buildExportFrontmatter(session, { mode } = {}) {
  const safe = session && typeof session === "object" ? session : {};
  const studyMode = String(mode || safe.studyMode || "rsvp").trim().toLowerCase();
  const exportMode =
    studyMode === "slow"
      ? "slow"
      : studyMode === "cloze"
        ? "cloze"
        : studyMode === "questions"
          ? "questions"
          : "fast";
  const lines = ["---"];
  lines.push(`session_id: ${yamlQuote(safe?._meta?.session_id || "unknown")}`);
  lines.push(`mode: ${exportMode}`);
  lines.push(`date: ${resolveExportDate(safe)}`);
  lines.push(`material: ${yamlQuote(resolveMaterialPath(safe))}`);
  lines.push(`material_format: ${resolveMaterialFormat(safe)}`);
  lines.push(`language: ${normalizeExportLanguageCode(safe.language)}`);
  if (exportMode === "cloze") {
    const count = Number(safe?._meta?.item_count);
    if (Number.isFinite(count) && count >= 0) lines.push(`item_count: ${Math.round(count)}`);
  }
  if (exportMode === "slow") {
    const scope = safe.slow?.readingScope || {};
    const label = String(scope.label || "—").trim();
    const start = scope.charStart ?? 0;
    const end = scope.charEnd ?? 0;
    lines.push(`scope: ${yamlQuote(`${label} (${start}–${end})`)}`);
    lines.push(`critical: ${Boolean(safe.slow?.criticalMode)}`);
  }
  const duration = resolveDurationMin(safe);
  if (duration != null) lines.push(`duration_min: ${duration}`);
  lines.push("---");
  return lines.join("\n");
}

export function formatGraphEdgeMarkdown(from, to, type, lang = "English") {
  const edgeType = String(type || "relates").trim() || "relates";
  const familyKey = EDGE_TYPE_FAMILIES[edgeType] || "semantic";
  void lang;
  const labels = FAMILY_LABELS.en;
  const familyLabel = labels[familyKey] || familyKey;
  return `- ${from} → ${to} (${edgeType} · ${familyLabel})`;
}

export function normalizeReviewPriority(raw, fallback = "medium") {
  const v = String(raw || "").trim().toLowerCase();
  if (VALID_REVIEW_PRIORITIES.has(v)) return v;
  return VALID_REVIEW_PRIORITIES.has(fallback) ? fallback : "medium";
}

export function defaultGapReviewPriority(entry, { blockIsWeak = false } = {}) {
  if (entry?.review_priority) return normalizeReviewPriority(entry.review_priority);
  if (entry?.source === "user") return "medium";
  return blockIsWeak ? "high" : "medium";
}

export function defaultFindingReviewPriority(finding) {
  if (finding?.review_priority) return normalizeReviewPriority(finding.review_priority);
  return finding?.revealedInPhase1 ? "low" : "medium";
}

export function isTestResponseIncorrect(response) {
  const r = response && typeof response === "object" ? response : {};
  const correct = String(r.correct_answer || "").trim().toUpperCase();
  const userLetter = parseAnswerLetter(r.user_answer);
  if (!correct || !userLetter) return false;
  return userLetter !== correct;
}

export function inferErrorType(response, questionText = "") {
  const r = response && typeof response === "object" ? response : {};
  const stored = String(r.error_type || "").trim().toLowerCase();
  if (VALID_ERROR_TYPES.has(stored)) return stored;
  const fb = String(r.feedback || "").toLowerCase();
  const q = String(questionText || "").toLowerCase();
  if (/compute|calculation|∇|integral|deriv/.test(fb) || /∇|integral|deriv|φ\(/.test(q)) {
    return "calculation_error";
  }
  if (/theorem|remember|formula|formal/.test(fb)) {
    return "formula_recall";
  }
  if (/review|attention|simple|careless|slip/.test(fb)) {
    return "attention_slip";
  }
  return "conceptual_confusion";
}

export function resolveSocraticMode(response, questionMeta) {
  const fromResp = String(response?.socratic_mode || "").trim().toLowerCase();
  if (fromResp === "free" || fromResp === "guided") return fromResp;
  const fromQ = String(questionMeta?.socratic_mode || questionMeta?.socraticMode || "")
    .trim()
    .toLowerCase();
  if (fromQ === "free" || fromQ === "guided") return fromQ;
  return "free";
}

export function resolveStudentSynthesis(session) {
  const safe = session && typeof session === "object" ? session : {};
  const direct =
    String(safe?._meta?.student_synthesis || safe?.slow?.studentSynthesis || "").trim();
  if (direct) return direct;
  const thesis = String(safe?.slow?.phase0?.thesis || "").trim();
  const notes = String(safe?._meta?.study_notes || "").trim();
  if (thesis && notes) return `${thesis} ${notes}`.trim();
  if (thesis) return thesis;
  if (notes) return notes;
  return "";
}

function annRangeLabel(a) {
  return `[${a?.charStart ?? "?"}–${a?.charEnd ?? "?"}]`;
}

function truncate(text, max = 72) {
  const raw = String(text || "").trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, Math.max(0, max - 1))}…`;
}

/** Top 2–3 tensions from ⊘/↯/⚠/⇑ annotations for long slow sessions. */
export function extractTopTensions(annotations, { max = 3, lang = "English" } = {}) {
  const list = Array.isArray(annotations) ? annotations : [];
  void lang;
  const scored = list
    .filter((a) => a && ["⊘", "↯", "⚠", "⇑", "★"].includes(String(a.type)))
    .map((a) => {
      const weight = { "⊘": 5, "↯": 4, "⚠": 3, "⇑": 3, "★": 2 }[a.type] || 1;
      const textLen = String(a.userText || "").trim().length;
      return { ann: a, score: weight + (textLen > 20 ? 1 : 0) };
    })
    .sort((a, b) => b.score - a.score);

  const lines = [];
  const used = new Set();

  for (const { ann } of scored) {
    if (lines.length >= max) break;
    const id = ann.id || `${ann.type}-${ann.charStart}`;
    if (used.has(id)) continue;
    used.add(id);

    if (ann.type === "⊘") {
      const steel = list.find(
        (c) =>
          c?.type === "⇑" &&
          !used.has(c.id) &&
          Math.abs(Number(c.charStart) - Number(ann.charStart)) < 600,
      );
      if (steel) {
        used.add(steel.id);
        lines.push(
          `- ${truncate(ann.userText, 56)} (${ann.type} ${annRangeLabel(ann)} ↔ ${steel.type} ${annRangeLabel(steel)})`,
        );
        continue;
      }
    }

    lines.push(`- ${truncate(ann.userText, 80)} (${ann.type} ${annRangeLabel(ann)})`);
  }

  if (!lines.length && list.some((a) => a?.type === "↯")) {
    const t = list.find((a) => a?.type === "↯");
    lines.push(`- ${truncate(t.userText, 80)} (↯ ${annRangeLabel(t)})`);
  }

  return lines;
}

export function appendSourceOfTruthAndResumeCapsule(lines, resumeCapsuleHtml) {
  lines.push("<!-- source-of-truth: resume-blob + material file | this markdown is render-only -->");
  lines.push(resumeCapsuleHtml);
}
