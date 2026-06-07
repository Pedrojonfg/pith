import {
  LS_LAST_EXPORT_STATE_KEY,
  LS_SESSION_CONCEPTS_BY_BLOCK_KEY,
  LS_SESSION_CONCEPTS_KEY,
  LS_REVIEW_SESSION_RESULTS_KEY,
} from "./config.js?v=20260525_1";
import {
  buildResumePayload,
  gapLabelsForBlock,
  getBlockResumeStatus,
  getMissedTestQuestions,
  hasGeneratedBlockContent,
  normalizeGapsByBlock,
  parseBlockTitlesFromList,
  state,
  ensureSessionResponseState,
} from "./session.js?v=20260527_1";
import { isOfflineMode } from "./offline.js?v=20260606_1";
import { buildPenaltyFeedback, computeDepthScore } from "./slow/gamification.js?v=20260528_1";
import { buildGraphSubgraphMarkdown } from "./graph/view.js?v=20260607_1";
import { buildSessionGraph } from "./graph/adapters.js?v=20260607_2";

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

/** Summarize confirmed assessment gaps for the Initial Assessment export section. */
export function formatAssessmentGapsExportSection(assessmentMeta, { titleMap = {}, nBlocks = 0 } = {}) {
  if (!assessmentMeta || typeof assessmentMeta !== "object") return [];

  const gapsByBlock = normalizeGapsByBlock(assessmentMeta.gaps_by_block || {});
  const n = Math.max(0, Math.floor(Number(nBlocks) || 0));
  const blockIds = new Set(Object.keys(gapsByBlock));
  for (let bi = 0; bi < n; bi += 1) blockIds.add(String(bi + 1));

  const lines = [];
  const metaParts = [];
  const gapsSource = String(assessmentMeta.gaps_source || "").trim();
  const synthesisStatus = String(assessmentMeta.synthesis_status || "").trim();
  if (gapsSource) metaParts.push(`Gaps source: ${gapsSource}`);
  if (synthesisStatus) metaParts.push(`Gap synthesis: ${synthesisStatus}`);
  if (metaParts.length) lines.push(metaParts.join(" · "));

  lines.push("");
  lines.push("### Knowledge gaps by block");

  let anyGaps = false;
  const sortedIds = [...blockIds].sort((a, b) => Number(a) - Number(b));
  for (const blockId of sortedIds) {
    const entries = Array.isArray(gapsByBlock[blockId]) ? gapsByBlock[blockId] : [];
    const labels = gapLabelsForBlock(gapsByBlock, blockId);
    if (!labels.length) continue;
    anyGaps = true;
    const title =
      titleMap[blockId] != null && String(titleMap[blockId]).trim()
        ? String(titleMap[blockId]).trim()
        : `Block ${blockId}`;
    const parts = entries.map((entry) => {
      const label = String(entry?.label || "").trim();
      if (!label) return "";
      if (entry?.source === "user") return `${label} (edited)`;
      return label;
    }).filter(Boolean);
    lines.push(`- **Block ${blockId} — ${title}**: ${parts.join("; ")}`);
  }

  if (!anyGaps) lines.push("- (none recorded)");
  return lines;
}

function normalizeExportConceptEntry(c) {
  const obj = c && typeof c === "object" ? c : {};
  const term = String(obj.term || "").trim();
  const definition = String(obj.definition || "").trim();
  if (!term) return null;
  return { term, definition };
}

function pickBetterExportConcept(existing, incoming) {
  const aDef = String(existing.definition || "").trim();
  const bDef = String(incoming.definition || "").trim();
  if (!aDef && bDef) return incoming;
  if (aDef && !bDef) return existing;
  if (bDef.length > aDef.length) return incoming;
  return existing;
}

/** Union session_concepts + concepts_by_block + blocks[].concepts for export table. */
export function collectExportConcepts(session) {
  const map = new Map();

  const addConcept = (c) => {
    const entry = normalizeExportConceptEntry(c);
    if (!entry) return;
    const key = entry.term.toLowerCase();
    if (!map.has(key)) map.set(key, entry);
    else map.set(key, pickBetterExportConcept(map.get(key), entry));
  };

  try {
    const raw = localStorage.getItem(LS_SESSION_CONCEPTS_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    if (Array.isArray(arr)) for (const c of arr) addConcept(c);
  } catch {
    // ignore
  }

  try {
    const raw = localStorage.getItem(LS_SESSION_CONCEPTS_BY_BLOCK_KEY);
    const obj = raw ? JSON.parse(raw) : null;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      for (const arr of Object.values(obj)) {
        if (Array.isArray(arr)) for (const c of arr) addConcept(c);
      }
    }
  } catch {
    // ignore
  }

  const blocks = Array.isArray(session?.blocks) ? session.blocks : [];
  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    const concepts = Array.isArray(b.concepts) ? b.concepts : [];
    for (const c of concepts) addConcept(c);
  }

  return Array.from(map.values()).sort((a, b) =>
    a.term.localeCompare(b.term, undefined, { sensitivity: "base" }),
  );
}

function appendConceptDictionarySection(lines, session) {
  const exportConcepts = collectExportConcepts(session);
  if (!exportConcepts.length) return;
  lines.push("## Concept Dictionary");
  lines.push("");
  for (const c of exportConcepts) {
    lines.push(`### ${c.term}`);
    lines.push("");
    lines.push(String(c.definition || "").trim() || "(no definition)");
    lines.push("");
  }
}

function formatGraphLinks(links) {
  const arr = Array.isArray(links) ? links : [];
  return arr
    .map((link) => {
      const termId = String(link?.termId || "").trim();
      const relation = String(link?.relation || "").trim();
      if (!termId) return "";
      return relation ? `${termId} (${relation})` : termId;
    })
    .filter(Boolean)
    .join(", ");
}

/** Append Phase 0, enriched, and RSVP material graphs when data exists. */
export function appendGraphSections(lines, session, lang = "English") {
  const graphs = [];

  const blockIndex = session?._meta?.material_graph?.blockIndex;
  if (Array.isArray(blockIndex) && blockIndex.length) {
    const rsvpGraph = buildSessionGraph(session, { mode: "rsvp" });
    if (rsvpGraph.nodes.length) graphs.push(rsvpGraph);
  }

  if (session?.slow?.phase0) {
    const phase0Graph = buildSessionGraph(session, { mode: "slow_phase0" });
    if (phase0Graph.nodes.length) graphs.push(phase0Graph);
  }

  const annotations = Array.isArray(session?.slow?.annotations) ? session.slow.annotations : [];
  const hasUserAnnotations = annotations.some((a) => String(a?.userText || "").trim());
  if (hasUserAnnotations || session?.slow?.graphEnrichedUnlocked) {
    const enrichedGraph = buildSessionGraph(session, { mode: "slow_enriched" });
    if (enrichedGraph.nodes.length) graphs.push(enrichedGraph);
  }

  const seenKinds = new Set();
  for (const graph of graphs) {
    const kind = String(graph?.kind || "graph");
    if (seenKinds.has(kind)) continue;
    seenKinds.add(kind);
    lines.push(buildGraphSubgraphMarkdown(graph, lang));
  }
}

function appendPhase0Section(lines, phase0) {
  if (!phase0 || typeof phase0 !== "object") return;
  lines.push("## Phase 0 — Orientation");
  lines.push("");
  lines.push(`**Thesis:** ${String(phase0.thesis || "").trim() || "—"}`);
  lines.push(`**Guide question:** ${String(phase0.guideQuestion || "").trim() || "—"}`);
  lines.push("");

  const prequestions = Array.isArray(phase0.prequestions) ? phase0.prequestions : [];
  if (prequestions.length) {
    lines.push("### Pre-questions");
    for (let i = 0; i < prequestions.length; i += 1) {
      const q = String(prequestions[i] || "").trim();
      if (q) lines.push(`${i + 1}. ${q}`);
    }
    lines.push("");
  }

  const map = Array.isArray(phase0.argumentMap) ? phase0.argumentMap : [];
  if (map.length) {
    lines.push("### Argument map");
    for (const node of map) {
      const id = String(node?.id || "").trim();
      const text = String(node?.text || "").trim();
      const status = String(node?.status || "").trim();
      const statusSuffix = status ? ` · *${status}*` : "";
      lines.push(`- **${id || "?"}:** ${text || "—"}${statusSuffix}`);
    }
    lines.push("");
  }

  const fillable = Array.isArray(phase0.fillableBlanks) ? phase0.fillableBlanks : [];
  if (fillable.length) {
    lines.push("### Fillable blanks");
    for (const blank of fillable) {
      const slot = String(blank?.slotId || blank?.id || "").trim();
      const answer = String(blank?.userAnswer || blank?.answer || "").trim();
      lines.push(`- **${slot || "?"}:** ${answer || "(empty)"}`);
    }
    lines.push("");
  }

  const concepts = Array.isArray(phase0.conceptsToFind) ? phase0.conceptsToFind : [];
  if (concepts.length) {
    lines.push("### Concepts to track");
    for (const c of concepts) {
      const term = String(c?.term || "").trim();
      const usage = String(c?.authorUsage || "").trim();
      if (!term) continue;
      lines.push(`- **${term}:** ${usage || "—"}`);
    }
    lines.push("");
  }

  const critical = Array.isArray(phase0.criticalExaminePoints) ? phase0.criticalExaminePoints : [];
  if (critical.length) {
    lines.push("### Critical examine points");
    for (const point of critical) {
      const text = String(point || "").trim();
      if (text) lines.push(`- ${text}`);
    }
    lines.push("");
  }
}

function appendFindingsSection(lines, findings) {
  const arr = Array.isArray(findings) ? findings : [];
  if (!arr.length) return;
  lines.push("## Concept findings");
  lines.push("");
  for (const f of arr) {
    const term = String(f?.conceptTerm || "").trim();
    const text = String(f?.userText || "").trim();
    const revealed = f?.revealedInPhase1 ? " (revealed in Phase 1)" : "";
    lines.push(`- **${term || "concept"}**${revealed}: ${text || "—"}`);
  }
  lines.push("");
}

function appendAnnotationsSection(lines, annotations) {
  const arr = Array.isArray(annotations) ? annotations : [];
  lines.push("## Annotations");
  lines.push("");
  if (!arr.length) {
    lines.push("(No annotations recorded.)");
    lines.push("");
    return;
  }
  for (const a of arr) {
    const type = String(a?.type || "?").trim();
    const range = `[${a?.charStart ?? "?"}–${a?.charEnd ?? "?"}]`;
    const userText = String(a?.userText || "").trim();
    const aiReply = String(a?.aiReply || "").trim();
    const links = formatGraphLinks(a?.graphLinks);
    lines.push(`- **${type}** ${range}${userText ? `: ${userText}` : ""}`);
    if (aiReply) lines.push(`  - IA reply: ${aiReply}`);
    if (links) lines.push(`  - Graph links: ${links}`);
  }
  lines.push("");
}

function appendDepthScoreSection(lines, session, depthScore) {
  const slow = session?.slow || {};
  const lang = String(session?.language || "English").trim() || "English";
  const depth =
    depthScore ||
    computeDepthScore(slow.annotations, { criticalMode: Boolean(slow.criticalMode) });
  lines.push("## Depth score");
  lines.push("");
  lines.push(`**Total:** ${depth.total}`);
  lines.push(`**Generative ratio:** ${(depth.generativeRatio * 100).toFixed(0)}%`);
  const byType = depth.byType && typeof depth.byType === "object" ? depth.byType : {};
  const breakdown = Object.entries(byType).filter(([, pts]) => Number(pts) > 0);
  if (breakdown.length) {
    lines.push("");
    lines.push("### Breakdown by type");
    for (const [type, pts] of breakdown) {
      lines.push(`- ${type}: ${pts}`);
    }
  }
  const penalties = Array.isArray(depth.penalties) ? depth.penalties : [];
  if (penalties.length) {
    lines.push("");
    lines.push("### Improvement opportunities");
    const annById = new Map((slow.annotations || []).map((a) => [a.id, a]));
    for (const p of penalties) {
      const ann = annById.get(p.annotationId) || { type: p.type, id: p.annotationId };
      lines.push(`- ${ann.type || "?"}: ${buildPenaltyFeedback(ann, lang)}`);
    }
  }
  lines.push("");
}

function buildSlowMarkdown(session) {
  const safe = session && typeof session === "object" ? session : {};
  const slow = safe.slow || {};
  const scope = slow.readingScope || {};
  const lang = String(safe.language || "English").trim() || "English";
  const lines = [];
  lines.push("# Slow Mode Session");
  lines.push(`Material: ${safe.materialMeta?.fileName || "—"}`);
  lines.push(`Language: ${lang}`);
  lines.push(`Scope: ${scope.label || "—"} (${scope.charStart ?? 0}–${scope.charEnd ?? 0})`);
  lines.push(`Phase: ${slow.phase || "—"}`);
  lines.push(`Critical mode: ${slow.criticalMode ? "yes" : "no"}`);
  lines.push(`Fillable map mode: ${slow.fillableMapMode ? "yes" : "no"}`);
  lines.push("");

  appendPhase0Section(lines, slow.phase0);
  appendFindingsSection(lines, slow.findings);
  appendAnnotationsSection(lines, slow.annotations);
  appendDepthScoreSection(lines, safe, slow.depthScore);
  appendConceptDictionarySection(lines, safe);
  appendGraphSections(lines, safe, lang);

  const resumePayload = buildResumePayload(safe, {
    activeBlockIndex: state.activeBlockIndex,
    activeQuestionIndex: state.activeQuestionIndex,
  });
  lines.push(encodeResumeCapsule(resumePayload));

  return `${lines.join("\n").trim()}\n`;
}

export function buildMarkdown(session) {
  const safe = session && typeof session === "object" ? session : {};
  if (safe.studyMode === "slow" && safe.slow) {
    return buildSlowMarkdown(safe);
  }
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
    lines.push(...formatAssessmentGapsExportSection(assessmentMeta, {
      titleMap,
      nBlocks: nBlocksExport,
    }));
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

  // If the user ran a review, include the latest results for THIS active session.
  // Review runs store their summary in localStorage, since they live outside the normal session object.
  const sessionId = String(safe?._meta?.session_id || "");
  const sessionRev = Number(safe?._meta?.rev || 0);
  const reviewResults = (() => {
    try {
      const raw = localStorage.getItem(LS_REVIEW_SESSION_RESULTS_KEY);
      if (!raw || !raw.trim()) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return null;
      const rid = String(obj.session_id || "");
      const rrev = Number(obj.rev || 0);
      if (!rid || !sessionId) return null;
      if (rid !== sessionId) return null;
      if (!Number.isFinite(sessionRev) || !Number.isFinite(rrev)) return null;
      if (rrev !== sessionRev) return null;
      return obj;
    } catch {
      return null;
    }
  })();

  if (reviewResults && typeof reviewResults === "object") {
    const formatTs = (ts) => {
      const n = Number(ts);
      if (!Number.isFinite(n) || n <= 0) return "";
      const d = new Date(n);
      if (Number.isNaN(d.getTime())) return "";
      return d.toISOString().replace("T", " ").slice(0, 19);
    };

    const reviewedAt = formatTs(reviewResults.reviewed_at);
    const rt = String(reviewResults.reviewType || "").trim();
    const testQuestions = Number(reviewResults.testQuestions || 0);
    const correct = Number(reviewResults.correct || 0);
    const pct = Number(reviewResults.pct || 0);
    const socraticQuestions = Number(reviewResults.socraticQuestions || 0);
    const wrong = Array.isArray(reviewResults.wrong) ? reviewResults.wrong : [];

    lines.push("");
    lines.push("## Review results");
    if (reviewedAt || rt) {
      lines.push(`Last review: ${reviewedAt || "(unknown)"}${rt ? ` • Type: ${rt}` : ""}`);
    } else {
      lines.push("Last review: (unknown)");
    }

    if (testQuestions > 0) {
      lines.push(`Score: ${correct} / ${testQuestions} correct (${pct}%)`);
    } else {
      lines.push("Score: (no test questions in this review run)");
    }

    lines.push(`Socratic questions completed: ${socraticQuestions}`);

    if (wrong.length) {
      lines.push("");
      lines.push("Wrong answers (test):");
      const cap = Math.min(40, wrong.length);
      for (let i = 0; i < cap; i += 1) {
        const w = wrong[i] && typeof wrong[i] === "object" ? wrong[i] : {};
        const q = String(w.question || "").trim() || `Q${i + 1}`;
        const userAns = String(w.user || "").trim() || "(blank)";
        const correctAns = String(w.correct || "").trim() || "(unknown)";
        lines.push(`- ${q}`);
        lines.push(`  - Your answer: ${userAns}`);
        lines.push(`  - Correct: ${correctAns}`);
      }
    }
    lines.push("");
  } else {
    lines.push("");
  }

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
    if (!hasGeneratedBlockContent(b)) continue;
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

  appendConceptDictionarySection(lines, safe);

  const exportLang = String(safe.language || "English").trim() || "English";
  appendGraphSections(lines, safe, exportLang);

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

export function buildOfflinePack(activeSession, blockIndex) {
  const safe = activeSession && typeof activeSession === "object" ? activeSession : {};
  const sourceFiles = Array.isArray(safe?._meta?.source_files) ? safe._meta.source_files : [];
  const sourceFilename = sourceFiles.length
    ? String(sourceFiles[0]?.name || "").trim() || "unknown-source"
    : "unknown-source";
  const blocks = Array.isArray(safe.blocks) ? safe.blocks : [];
  const totalBlocks = Number(safe.n_blocks);
  const blockCount = Number.isFinite(totalBlocks) && totalBlocks > 0 ? totalBlocks : blocks.length;
  const language = String(safe.language || "English").trim() || "English";
  void blockIndex;

  const indexLines = blocks
    .map((b, idx) => {
      const title = String(b?.title || "").trim() || `Block ${idx + 1}`;
      return `${idx + 1}. ${title}`;
    })
    .join("\n");

  const results = blocks.map((b, idx) => {
    const questions = Array.isArray(b?.questions)
      ? b.questions.filter((q) => q && typeof q === "object" && q.type === "test")
      : [];
    return {
      id: b?.id != null ? b.id : idx + 1,
      title: b?.title,
      explanation: b?.explanation,
      questions,
      concepts: b?.concepts,
      socractic_model_answers: [],
      _offline: true,
      _failed: Boolean(b?._failed),
      _source: {
        startPage: Number(b?.startPage) || -1,
        endPage: Number(b?.endPage) || -1,
      },
    };
  });
  const failedBlocks = results.filter((b) => b._failed).length;
  const generatedAt = new Date().toISOString();
  const payload = {
    version: 1,
    meta: {
      ...(safe?._meta && typeof safe._meta === "object" ? safe._meta : {}),
      generated_at: generatedAt,
      total_blocks: results.length,
      failed_blocks: failedBlocks,
      offline_pack: true,
    },
    config: {
      n_test: safe.n_test,
      language: safe.language,
      include_connection_questions: safe.include_connection_questions,
    },
    blocks: results,
  };

  const lines = [];
  lines.push(`# Offline Study Pack — ${sourceFilename}`);
  lines.push(`Generated: ${generatedAt}`);
  lines.push(
    `Blocks: ${blockCount} | Language: ${language} | Mode: test only | Failed: ${failedBlocks}`,
  );
  lines.push("");
  lines.push("## Index");
  lines.push(indexLines || "1. Block 1");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("<!-- OFFLINE_PACK_V1");
  lines.push(JSON.stringify(payload, null, 2));
  lines.push("-->");
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

export function exportOfflinePack() {
  if (isOfflineMode()) return;
  if (!state.activeSession) return;
  const md = buildOfflinePack(state.activeSession, state.activeBlockIndex);
  const ts = formatExportTimestamp(new Date());
  const stem = getExportFilenameStem();
  downloadTextFile({
    filename: `${stem}_offline_${ts}.md`,
    text: md,
  });
}

