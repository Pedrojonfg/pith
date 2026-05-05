import {
  LS_LAST_EXPORT_STATE_KEY,
  LS_SESSION_CONCEPTS_KEY,
} from "./config.js?v=20260503_7";
import {
  buildResumePayload,
  getBlockResumeStatus,
  getMissedTestQuestions,
  parseBlockTitlesFromList,
  state,
  ensureSessionResponseState,
} from "./session.js?v=20260503_7";

function sanitizeFilenameStem(name) {
  const raw = String(name || "").trim();
  if (!raw) return "study-session";
  const lower = raw.toLowerCase();
  const cleaned = lower.replace(/[^a-z0-9_-]+/g, "");
  return cleaned || "study-session";
}

function stripExtension(filename) {
  const raw = String(filename || "").trim();
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return raw;
  return raw.slice(0, dot);
}

function formatExportTimestamp(d) {
  const pad2 = (n) => String(n).padStart(2, "0");
  const day = pad2(d.getDate());
  const month = pad2(d.getMonth() + 1);
  const year = String(d.getFullYear());
  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());
  const seconds = pad2(d.getSeconds());
  return `${day}${month}${year}_${hours}${minutes}${seconds}`;
}

function getExportFilenameStem() {
  const metaFiles = state.activeSession?._meta?.source_files;
  if (Array.isArray(metaFiles) && metaFiles.length) {
    const first = metaFiles[0];
    const name = first && typeof first === "object" ? String(first.name || "") : "";
    return sanitizeFilenameStem(stripExtension(name));
  }
  if (Array.isArray(state.lastUploadedFileNames) && state.lastUploadedFileNames.length) {
    return sanitizeFilenameStem(stripExtension(state.lastUploadedFileNames[0]));
  }
  return "study-session";
}

function getLastExportState() {
  const raw = localStorage.getItem(LS_LAST_EXPORT_STATE_KEY);
  if (!raw || !raw.trim()) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    const sessionId = String(obj.session_id || "").trim();
    const rev = Number(obj.rev);
    if (!sessionId) return null;
    if (!Number.isFinite(rev) || rev < 0) return null;
    return { sessionId, rev };
  } catch {
    return null;
  }
}

function setLastExportState({ sessionId, rev }) {
  try {
    localStorage.setItem(
      LS_LAST_EXPORT_STATE_KEY,
      JSON.stringify({ session_id: sessionId, rev }),
    );
  } catch {
    // ignore
  }
}

function encodeResumeCapsule(payload) {
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `<!-- study-session-resume:v2:${b64} -->`;
}

export function buildMarkdown(session) {
  const safe = session && typeof session === "object" ? session : {};
  if (session === state.activeSession) {
    ensureSessionResponseState();
  }
  const resumePayload = buildResumePayload(safe, {
    activeBlockIndex: state.activeBlockIndex,
    activeQuestionIndex: state.activeQuestionIndex,
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const studyNotes = String(safe?._meta?.study_notes || "").trim();
  const blocks = Array.isArray(safe.blocks) ? safe.blocks : [];
  const nBlocksExport = Math.max(
    blocks.length,
    Number(safe.n_blocks) || 0,
    Number(resumePayload.n_blocks) || 0,
    1,
  );
  const titleMap = parseBlockTitlesFromList(safe.blocks_list_text);
  const respBlocks =
    safe._responses?.blocks && typeof safe._responses.blocks === "object"
      ? safe._responses.blocks
      : {};

  const lines = [];
  lines.push(`# Study Session — ${dateStr}`);
  lines.push(
    `Questions per block: ${Number(resumePayload.n_test) || 0} test + ${Number(resumePayload.n_socratic) || 0} socratic`,
  );
  if (studyNotes) {
    lines.push("");
    lines.push("## Study focus / comments");
    lines.push(studyNotes);
  }

  const assessmentMeta =
    safe?._meta?.assessment && typeof safe._meta.assessment === "object"
      ? safe._meta.assessment
      : null;
  if (assessmentMeta) {
    const maxQuestions = Math.max(1, Number(assessmentMeta.max_questions) || 1);
    const penalisedTotal = Number(assessmentMeta.penalised_total || 0);
    const pct = Number.isFinite(Number(assessmentMeta.pct))
      ? Number(assessmentMeta.pct)
      : (penalisedTotal / maxQuestions) * 100;
    const strongIds = Array.isArray(assessmentMeta.strong_blocks) ? assessmentMeta.strong_blocks : [];
    const weakIds = Array.isArray(assessmentMeta.weak_blocks) ? assessmentMeta.weak_blocks : [];
    const strongList = strongIds.length ? strongIds.map((x) => `Block ${x}`).join(", ") : "None";
    const weakList = weakIds.length ? weakIds.map((x) => `Block ${x}`).join(", ") : "None";
    const adjusted = assessmentMeta.config_adjustments_applied ? "yes" : "no";

    lines.push("");
    lines.push("## Initial Assessment");
    lines.push(`Score: ${penalisedTotal.toFixed(2)}/${maxQuestions} (${Math.round(pct)}%)`);
    lines.push(`Strong blocks: ${strongList}`);
    lines.push(`Weak blocks: ${weakList}`);
    lines.push(`Config adjustments applied: ${adjusted}`);
  }

  const guideHistory = Array.isArray(window?.guideHistory) ? window.guideHistory : [];
  const sidebarNotes = guideHistory
    .filter((m) => m && typeof m === "object")
    .filter((m) => String(m.role || "").trim().toLowerCase() === "user")
    .map((m) => ({
      content: String(m.content || "").trim(),
      timestamp: m.timestamp,
      meta: m.meta && typeof m.meta === "object" ? m.meta : null,
    }))
    .filter((m) => m.content);
  if (sidebarNotes.length) {
    lines.push("");
    lines.push("## Sidebar notes");
    for (const n of sidebarNotes) {
      const isPending = n.meta?.fromPendingComment === true;
      const label = isPending ? "Pending comment" : "Note";
      lines.push(`- **${label}:** ${n.content}`);
    }
  }

  const missed = getMissedTestQuestions(safe);
  if (missed.length) {
    lines.push("");
    lines.push("## Missed questions (to review)");
    for (const m of missed) {
      const q = m.question ? `Q: ${m.question}` : "Q: (missing)";
      lines.push(`- **Block ${Number(m.blockIndex) + 1}, Q${Number(m.questionIndex) + 1}:** ${q}`);
      lines.push(`  - Your answer: ${m.user_answer || "(blank)"}`);
      lines.push(`  - Correct: ${m.correct_answer || "(unknown)"}`);
      if (m.feedback) lines.push(`  - Feedback: ${m.feedback}`);
    }
  }
  lines.push("");

  lines.push("## Session Plan");
  lines.push("");
  lines.push(
    "To **resume** this session later: use *Resume saved session* with the **original material file** plus this markdown export.",
  );
  lines.push("");
  const plan = Array.isArray(resumePayload.blocks_plan) ? resumePayload.blocks_plan : [];
  const nPlan = Math.max(1, Number(resumePayload.n_blocks) || 1);
  for (let bi = 0; bi < nPlan; bi += 1) {
    const planRow = plan[bi];
    const title = planRow ? String(planRow.title || "").trim() : `Block ${bi + 1}`;
    const summary = planRow ? String(planRow.summary || "").trim() : "";
    const blk = resumePayload.blocks && resumePayload.blocks[bi] ? resumePayload.blocks[bi] : null;
    const st = getBlockResumeStatus({
      block: blk,
      blockIndex: bi,
      mode: "",
      responses: resumePayload._responses,
    });
    const sumShort =
      summary.length > 220 ? `${summary.slice(0, 217).trim()}…` : summary;
    lines.push(
      `- **Block ${bi + 1} — ${title}** · ${st.label}${sumShort ? ` · *${sumShort}*` : ""}`,
    );
  }
  lines.push("");

  for (let bi = 0; bi < nBlocksExport; bi += 1) {
    const b = blocks[bi] && typeof blocks[bi] === "object" ? blocks[bi] : {};
    const fallbackTitle = titleMap[String(bi + 1)]
      ? String(titleMap[String(bi + 1)])
      : `Block ${bi + 1}`;
    const title = String(b.title || fallbackTitle);
    const explanation = String(b.explanation || "").trim();
    lines.push(`## Block ${bi + 1}: ${title}`);
    lines.push(explanation || "");
    lines.push("");
    lines.push("### Questions & Answers");

    const qs = Array.isArray(b.questions) ? b.questions : [];
    const qResp =
      respBlocks[String(bi)]?.questions && typeof respBlocks[String(bi)].questions === "object"
        ? respBlocks[String(bi)].questions
        : {};

    for (let qi = 0; qi < qs.length; qi += 1) {
      const q = qs[qi] && typeof qs[qi] === "object" ? qs[qi] : {};
      const qText = String(q.question || "").trim();
      const r = qResp[String(qi)] || {};
      const userAns = r.user_answer != null ? String(r.user_answer).trim() : "";
      const fb = r.feedback != null ? String(r.feedback).trim() : "";
      const correct = r.correct_answer != null ? String(r.correct_answer).trim() : "";

      lines.push(`**Q:** ${qText}`);
      lines.push(`**A (user):** ${userAns || ""}`);

      const fbLine = fb
        ? correct
          ? `${fb} (Correct: ${correct})`
          : fb
        : correct
          ? correct
          : "";
      lines.push(`**Feedback:** ${fbLine}`);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  try {
    const raw = localStorage.getItem(LS_SESSION_CONCEPTS_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    const concepts = Array.isArray(arr) ? arr : [];
    const cleaned = concepts
      .map((c) => (c && typeof c === "object" ? c : null))
      .filter(Boolean)
      .map((c) => ({
        term: String(c.term || "").trim(),
        definition: String(c.definition || "").trim(),
      }))
      .filter((c) => c.term);

    if (cleaned.length) {
      cleaned.sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" }));
      lines.push("## Concept Dictionary");
      lines.push("| Term | Definition |");
      lines.push("|------|------------|");
      for (const c of cleaned) {
        const t = c.term.replace(/\|/g, "\\|");
        const d = (c.definition || "").replace(/\|/g, "\\|");
        lines.push(`| ${t} | ${d} |`);
      }
      lines.push("");
    }
  } catch {
    // ignore dictionary export errors
  }

  const formatHHMM = (ts) => {
    let d = null;
    if (typeof ts === "number" && Number.isFinite(ts)) d = new Date(ts);
    else {
      const raw = String(ts || "").trim();
      if (!raw) return "";
      const asNum = Number(raw);
      if (Number.isFinite(asNum) && asNum > 0) d = new Date(asNum);
      else {
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) d = parsed;
      }
    }
    if (!d || Number.isNaN(d.getTime())) return "";
    const pad2 = (n) => String(n).padStart(2, "0");
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  lines.push("## Study Guide Chat");
  lines.push("");

  if (!guideHistory.length) {
    lines.push("(No guide interactions recorded.)");
    lines.push("");
  } else {
    for (const m of guideHistory) {
      const msg = m && typeof m === "object" ? m : {};
      const role = String(msg.role || "").trim().toLowerCase();
      const content = String(msg.content || "");
      const hhmm = formatHHMM(msg.timestamp);
      if (role === "user") {
        lines.push(`**User**${hhmm ? ` (${hhmm})` : ""}: ${content}`);
      } else if (role === "assistant") {
        lines.push(`**Assistant**: ${content}`);
      } else {
        lines.push(`**${role || "Message"}**: ${content}`);
      }
      lines.push("");
      lines.push("---");
      lines.push("");
    }

    const startTime = formatHHMM(guideHistory[0]?.timestamp);
    const endTime = formatHHMM(guideHistory[guideHistory.length - 1]?.timestamp);
    lines.push(
      `Total messages: ${guideHistory.length} | Duration: ${startTime || "?"} → ${endTime || "?"}`,
    );
    lines.push("");
  }

  lines.push(encodeResumeCapsule(resumePayload));

  return lines.join("\n").trim() + "\n";
}

export function downloadTextFile({ filename, text }) {
  const blob = new Blob([String(text || "")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportSessionMarkdown() {
  if (!state.activeSession) return;
  ensureSessionResponseState();
  const sessionId = String(state.activeSession?._meta?.session_id || "");
  const rev = Number(state.activeSession?._meta?.rev || 0);
  const last = getLastExportState();
  if (last && last.sessionId === sessionId && last.rev === rev) {
    return;
  }
  const md = buildMarkdown(state.activeSession);
  const ts = formatExportTimestamp(new Date());
  const stem = getExportFilenameStem();
  downloadTextFile({
    filename: `${stem}_${ts}.md`,
    text: md,
  });
  if (sessionId && Number.isFinite(rev)) {
    setLastExportState({ sessionId, rev });
  }
}

