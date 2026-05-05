import {
  LS_ACTIVE_SESSION_KEY,
  LS_BLOCK_INDEX_KEY,
  LS_KEY,
  LS_SESSION_CONCEPTS_KEY,
} from "./config.js?v=20260503_7";

export const state = {
  sessionMode: "test",
  studyMode: null,
  originalMaterialText: "",
  studyNotes: "",
  lastNBlocks: 0,
  lastUploadedFileNames: [],
  lastCleanedMaterialText: "",
  lastCleanedMaterialWordCount: 0,
  lastBlockIndex: null,
  activeSession: null,
  activeBlockIndex: 0,
  activeQuestionIndex: 0,
};

export function clampInt(n, min, max, fallback) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

export function getStoredKey() {
  const v = localStorage.getItem(LS_KEY);
  if (!v) return null;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : null;
}

export function saveKey(key) {
  localStorage.setItem(LS_KEY, key);
}

export function storeActiveSession(sessionObj, { bumpRev } = {}) {
  if (bumpRev && sessionObj && typeof sessionObj === "object") {
    if (!sessionObj._meta || typeof sessionObj._meta !== "object") {
      sessionObj._meta = {};
    }
    if (!sessionObj._meta.session_id) {
      sessionObj._meta.session_id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
    const prev = Number(sessionObj._meta.rev || 0);
    sessionObj._meta.rev = Number.isFinite(prev) && prev >= 0 ? prev + 1 : 1;
  }
  localStorage.setItem(LS_ACTIVE_SESSION_KEY, JSON.stringify(sessionObj));
}

export function loadActiveSession() {
  const raw = localStorage.getItem(LS_ACTIVE_SESSION_KEY);
  if (raw && raw.trim()) {
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") return obj;
    } catch {
      // ignore
    }
  }
  return null;
}

export function getBlocksSafe() {
  return Array.isArray(state.activeSession?.blocks) ? state.activeSession.blocks : [];
}

export function getTotalBlocksSafe() {
  const blocks = getBlocksSafe();
  const n = Number(state.activeSession?.n_blocks);
  if (Number.isFinite(n) && n > 0) return n;
  return blocks.length;
}

export function ensureSessionResponseState() {
  if (!state.activeSession || typeof state.activeSession !== "object") return;
  if (!state.activeSession._meta || typeof state.activeSession._meta !== "object") {
    state.activeSession._meta = {};
  }
  if (!state.activeSession._meta.session_id) {
    state.activeSession._meta.session_id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
  if (state.activeSession._meta.rev == null) {
    state.activeSession._meta.rev = 0;
  }
  if (!state.activeSession._meta.started_at) {
    state.activeSession._meta.started_at = new Date().toISOString();
  }
  if (!state.activeSession._responses || typeof state.activeSession._responses !== "object") {
    state.activeSession._responses = { blocks: {} };
  }
  if (
    !state.activeSession._responses.blocks ||
    typeof state.activeSession._responses.blocks !== "object"
  ) {
    state.activeSession._responses.blocks = {};
  }
}

export function recordResponse({
  blockIndex,
  questionIndex,
  questionType,
  questionText,
  userAnswer,
  feedback,
  correctAnswer,
}) {
  ensureSessionResponseState();
  const blocks = state.activeSession?._responses?.blocks;
  if (!blocks || typeof blocks !== "object") return;
  const bKey = String(blockIndex);
  const qKey = String(questionIndex);
  if (!blocks[bKey] || typeof blocks[bKey] !== "object") {
    blocks[bKey] = { questions: {} };
  }
  if (!blocks[bKey].questions || typeof blocks[bKey].questions !== "object") {
    blocks[bKey].questions = {};
  }
  blocks[bKey].questions[qKey] = {
    type: questionType,
    question: questionText,
    user_answer: userAnswer,
    feedback: feedback,
    correct_answer: correctAnswer,
    answered_at: new Date().toISOString(),
  };
  storeActiveSession(state.activeSession, { bumpRev: true });
}

export function loadBlockIndex() {
  const raw = localStorage.getItem(LS_BLOCK_INDEX_KEY);
  if (raw && raw.trim()) {
    try {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj)) return obj;
    } catch {
      // ignore
    }
  }
  return null;
}

export function getBlockIndexEntry(blockIndex) {
  const id = Number(blockIndex) + 1;
  const arr = loadBlockIndex();
  if (!Array.isArray(arr)) return null;
  return arr.find((b) => b && typeof b === "object" && Number(b.id) === id) || null;
}

export function getBlockChunkFromIndex(blockIndex) {
  const entry = getBlockIndexEntry(blockIndex);
  const chunk =
    entry && typeof entry === "object" ? String(entry.chunk || "").trim() : "";
  return chunk;
}

export function parseBlockTitlesFromList(text) {
  const raw = String(text || "");
  const lines = raw.split("\n");
  const map = {};
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s*[\.\)\-:]\s*(.+?)\s*$/);
    if (!m) continue;
    const idx = Number(m[1]);
    if (!Number.isFinite(idx) || idx <= 0) continue;
    const rest = String(m[2] || "").trim();
    if (!rest) continue;
    const split = rest.split(/\s+(?:—|–|-)\s+/);
    const title = String(split[0] || rest).trim();
    if (!title) continue;
    map[String(idx)] = title;
  }
  return map;
}

/** Each line: `id. title — summary` (summary optional). */
export function parseBlocksPlanFromList(text) {
  const raw = String(text || "");
  const lines = raw.split("\n");
  const out = [];
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s*[\.\)\-:]\s*(.+?)\s*$/);
    if (!m) continue;
    const id = Number(m[1]);
    const rest = String(m[2] || "").trim();
    if (!Number.isFinite(id) || id <= 0 || !rest) continue;
    const emMatch = rest.match(/^(.*?)\s+(?:—|–|-)\s+(.*)$/);
    const title = String(emMatch ? emMatch[1] : rest).trim();
    const summary = String(emMatch ? emMatch[2] : "").trim();
    if (!title) continue;
    out.push({ id, title, summary });
  }
  out.sort((a, b) => a.id - b.id);
  return out;
}

const RESUME_FORMAT_VERSION = 1;

function deepCloneJson(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return null;
  }
}

function getQuestionsForMode(block, mode) {
  const qs = Array.isArray(block?.questions) ? block.questions : [];
  const m = String(mode || "").trim();
  if (m === "test") return qs.filter((q) => q && typeof q === "object" && q.type === "test");
  if (m === "socratic") {
    return qs.filter((q) => q && typeof q === "object" && q.type === "socratic");
  }
  return qs;
}

function countAnsweredInBlock(blockIndex, questionCount, responses) {
  const b =
    responses?.blocks &&
    typeof responses.blocks === "object" &&
    responses.blocks[String(blockIndex)] &&
    typeof responses.blocks[String(blockIndex)] === "object"
      ? responses.blocks[String(blockIndex)]
      : null;
  const qm = b?.questions && typeof b.questions === "object" ? b.questions : {};
  let n = 0;
  for (let qi = 0; qi < questionCount; qi += 1) {
    const r = qm[String(qi)];
    if (r && typeof r === "object" && r.user_answer != null && String(r.user_answer).trim()) {
      n += 1;
    }
  }
  return n;
}

/** Human-readable status for Session Plan export. */
export function getBlockResumeStatus({ block, blockIndex, mode, responses }) {
  const bi = Number(blockIndex);
  const m = String(mode || "").trim();
  if (!block || typeof block !== "object") {
    return { phase: "pending", answered: 0, total: 0, label: "pending (not generated yet)" };
  }
  const qs = getQuestionsForMode(block, m);
  const total = qs.length;
  const answered =
    total > 0 ? countAnsweredInBlock(bi, total, responses) : 0;
  if (total === 0) {
    return { phase: "generated", answered: 0, total: 0, label: "generated (no questions)" };
  }
  if (answered >= total) {
    return { phase: "complete", answered, total, label: `complete (${answered}/${total} answered)` };
  }
  return {
    phase: "in_progress",
    answered,
    total,
    label: `in progress (${answered}/${total} answered)`,
  };
}

export function buildResumePayload(session, { activeBlockIndex, activeQuestionIndex } = {}) {
  const safe = session && typeof session === "object" ? session : {};
  const n = Math.max(1, Number(safe.n_blocks) || 1);
  const blocks = Array.isArray(safe.blocks) ? safe.blocks : [];
  let blocksPlan = parseBlocksPlanFromList(safe.blocks_list_text || "");
  if (blocksPlan.length < n) {
    const titleMap = parseBlockTitlesFromList(safe.blocks_list_text);
    const byId = new Map(blocksPlan.map((b) => [b.id, b]));
    for (let id = 1; id <= n; id += 1) {
      if (byId.has(id)) continue;
      const bl = blocks[id - 1];
      const fromBlock =
        bl && typeof bl === "object"
          ? { id, title: String(bl.title || "").trim(), summary: "" }
          : {
              id,
              title: titleMap[String(id)] || `Block ${id}`,
              summary: "",
            };
      byId.set(id, {
        id,
        title: fromBlock.title || `Block ${id}`,
        summary: String(fromBlock.summary || "").trim(),
      });
    }
    blocksPlan = Array.from(byId.values()).sort((a, b) => a.id - b.id);
  }
  blocksPlan = blocksPlan.filter((b) => b && Number(b.id) >= 1 && Number(b.id) <= n);
  blocksPlan.sort((a, b) => a.id - b.id);

  const blocksOut = Array.from({ length: n }, (_, i) =>
    blocks[i] && typeof blocks[i] === "object" ? deepCloneJson(blocks[i]) : null,
  );

  const meta =
    safe._meta && typeof safe._meta === "object" ? deepCloneJson(safe._meta) : {};
  const responses =
    safe._responses && typeof safe._responses === "object"
      ? deepCloneJson(safe._responses)
      : { blocks: {} };

  const fromSessionQ =
    safe.active_question_index != null && Number.isFinite(Number(safe.active_question_index))
      ? Math.max(0, Math.floor(Number(safe.active_question_index)))
      : null;
  const abi =
    activeBlockIndex != null && Number.isFinite(Number(activeBlockIndex))
      ? clampInt(activeBlockIndex, 0, n - 1, 0)
      : clampInt(Number(safe.current_block_index) || 0, 0, n - 1, 0);
  const aqi =
    fromSessionQ != null
      ? fromSessionQ
      : activeQuestionIndex != null && Number.isFinite(Number(activeQuestionIndex))
        ? Math.max(0, Math.floor(Number(activeQuestionIndex)))
        : 0;

  let sessionConcepts = [];
  try {
    const raw = localStorage.getItem(LS_SESSION_CONCEPTS_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    sessionConcepts = Array.isArray(arr)
      ? arr
          .map((c) => (c && typeof c === "object" ? c : null))
          .filter(Boolean)
          .map((c) => ({
            term: String(c.term || "").trim(),
            definition: String(c.definition || "").trim(),
          }))
          .filter((c) => c.term)
      : [];
  } catch {
    sessionConcepts = [];
  }

  return {
    format_version: RESUME_FORMAT_VERSION,
    exported_at: new Date().toISOString(),
    session_mode: String(safe.session_mode || ""),
    n_blocks: n,
    current_block_index: clampInt(Number(safe.current_block_index) || 0, 0, n - 1, 0),
    active_block_index: abi,
    active_question_index: aqi,
    blocks_list_text: String(safe.blocks_list_text || ""),
    blocks_plan: blocksPlan,
    blocks: blocksOut,
    _meta: meta || {},
    _responses: responses || { blocks: {} },
    _pending_comment_for_next_block: String(safe._pending_comment_for_next_block || ""),
    session_concepts: sessionConcepts,
  };
}

export function normalizeResumePayload(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Resume payload is missing or invalid.");
  }
  const ver = Number(raw.format_version);
  if (ver !== 1) {
    throw new Error(`Unsupported resume format_version (${raw.format_version}). Expected 1.`);
  }
  const mode = String(raw.session_mode || "").trim();
  if (mode !== "test" && mode !== "socratic") {
    throw new Error('Resume payload has invalid session_mode (need "test" or "socratic").');
  }
  const n = Math.max(1, Math.floor(Number(raw.n_blocks)));
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("Resume payload has invalid n_blocks.");
  }

  let blocksPlan = Array.isArray(raw.blocks_plan) ? raw.blocks_plan : [];
  if (!blocksPlan.length) {
    blocksPlan = parseBlocksPlanFromList(String(raw.blocks_list_text || ""));
  }
  const planById = new Map();
  for (const item of blocksPlan) {
    if (!item || typeof item !== "object") continue;
    const id = Number(item.id);
    const title = String(item.title || "").trim();
    const summary = String(item.summary || "").trim();
    if (!Number.isFinite(id) || id < 1 || id > n || !title) continue;
    planById.set(id, { id, title, summary: summary || "(see material)" });
  }
  for (let id = 1; id <= n; id += 1) {
    if (!planById.has(id)) {
      throw new Error(`Resume payload is missing block plan entry for id ${id}.`);
    }
  }
  blocksPlan = Array.from({ length: n }, (_, i) => planById.get(i + 1));

  let blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  if (blocks.length < n) {
    blocks = [...blocks, ...Array.from({ length: n - blocks.length }, () => null)];
  }
  if (blocks.length > n) blocks = blocks.slice(0, n);

  const responses =
    raw._responses && typeof raw._responses === "object"
      ? deepCloneJson(raw._responses)
      : { blocks: {} };
  if (!responses.blocks || typeof responses.blocks !== "object") responses.blocks = {};

  const meta = raw._meta && typeof raw._meta === "object" ? deepCloneJson(raw._meta) : {};

  const currentBlockIndex = clampInt(
    Number(raw.current_block_index),
    0,
    n - 1,
    0,
  );
  const activeBlockIndex = clampInt(
    Number(raw.active_block_index != null ? raw.active_block_index : currentBlockIndex),
    0,
    n - 1,
    currentBlockIndex,
  );
  const activeQuestionIndex = Math.max(
    0,
    Math.floor(Number(raw.active_question_index) || 0),
  );

  let sessionConcepts = [];
  if (Array.isArray(raw.session_concepts)) {
    sessionConcepts = raw.session_concepts
      .map((c) => (c && typeof c === "object" ? c : null))
      .filter(Boolean)
      .map((c) => ({
        term: String(c.term || "").trim(),
        definition: String(c.definition || "").trim(),
      }))
      .filter((c) => c.term);
  }

  return {
    format_version: 1,
    exported_at: String(raw.exported_at || ""),
    session_mode: mode,
    n_blocks: n,
    current_block_index: currentBlockIndex,
    active_block_index: activeBlockIndex,
    active_question_index: activeQuestionIndex,
    blocks_list_text: String(raw.blocks_list_text || "").trim() || blocksListTextFromBlockIndex(blocksPlan),
    blocks_plan: blocksPlan,
    blocks,
    _meta: meta,
    _responses: responses,
    _pending_comment_for_next_block: String(raw._pending_comment_for_next_block || ""),
    session_concepts: sessionConcepts,
  };
}

/** First block/question that still needs study (deterministic restore). */
export function computeResumePointer(p) {
  const normalized = normalizeResumePayload(p);
  const mode = normalized.session_mode;
  const n = normalized.n_blocks;
  const blocks = normalized.blocks;
  const responses = normalized._responses;
  for (let bi = 0; bi < n; bi += 1) {
    const block = blocks[bi];
    if (!block || typeof block !== "object") {
      return { current_block_index: bi, active_question_index: 0, session_complete: false };
    }
    const qs = getQuestionsForMode(block, mode);
    if (!qs.length) continue;
    for (let qi = 0; qi < qs.length; qi += 1) {
      const r = responses?.blocks?.[String(bi)]?.questions?.[String(qi)];
      const answered =
        r &&
        typeof r === "object" &&
        r.user_answer != null &&
        String(r.user_answer).trim();
      if (!answered) {
        return { current_block_index: bi, active_question_index: qi, session_complete: false };
      }
    }
  }
  return {
    current_block_index: Math.max(0, n - 1),
    active_question_index: 0,
    session_complete: true,
  };
}

export function buildSessionFromResumePayload(payload) {
  const p = normalizeResumePayload(payload);
  const ptr = computeResumePointer(p);
  const sessionObj = {
    session_mode: p.session_mode,
    n_blocks: p.n_blocks,
    blocks_list_text: p.blocks_list_text,
    current_block_index: ptr.session_complete
      ? Math.max(0, p.n_blocks - 1)
      : ptr.current_block_index,
    active_question_index: ptr.session_complete ? 0 : ptr.active_question_index,
    blocks: p.blocks,
    _pending_comment_for_next_block: p._pending_comment_for_next_block,
    _meta: p._meta,
    _responses: p._responses,
  };
  return {
    sessionObj,
    pointer: ptr,
    session_concepts: p.session_concepts,
  };
}

export function buildBlockIndexFromResumePayload(payload, materialText) {
  const p = normalizeResumePayload(payload);
  const chunks = splitMaterialIntoBlockChunks(materialText, p.n_blocks);
  if (chunks.length !== p.n_blocks) {
    throw new Error("Could not split material into the expected number of blocks.");
  }
  return p.blocks_plan.map((row, i) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    chunk: String(chunks[i] || "").trim(),
  }));
}

export function safeParseJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const withoutFence = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const candidates = withoutFence && withoutFence !== raw ? [raw, withoutFence] : [raw];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function normalizeBlockIndexArray(arr, { requireChunk = true } = {}) {
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") return null;
    const id = Number(item.id);
    const title = String(item.title || "").trim();
    const summary = String(item.summary || "").trim();
    const signatureArr = Array.isArray(item.signature) ? item.signature : null;
    const signature = signatureArr
      ? signatureArr.map((t) => String(t || "").trim()).filter(Boolean)
      : String(item.signature || "")
          .split(/[,\n;]/g)
          .map((t) => String(t || "").trim())
          .filter(Boolean);
    const chunk = String(item.chunk || "").trim();
    if (!Number.isFinite(id) || id <= 0) return null;
    if (!title) return null;
    if (!summary) return null;
    if (requireChunk && !chunk) return null;
    out.push({ id, title, summary, signature, chunk });
  }
  out.sort((a, b) => a.id - b.id);
  return out;
}

export function splitMaterialIntoBlockChunks(text, nBlocks) {
  const raw = String(text || "").trim();
  const n = Math.max(0, Math.floor(Number(nBlocks)));
  if (!raw || n <= 0) return [];
  const words = raw.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const chunks = [];
  for (let i = 0; i < n; i += 1) {
    const start = Math.floor((i * words.length) / n);
    const end = Math.floor(((i + 1) * words.length) / n);
    const chunk = words.slice(start, Math.max(end, start + 1)).join(" ").trim();
    chunks.push(chunk || raw);
  }
  return chunks;
}

function normalizeAuditResult(raw) {
  const obj = raw && typeof raw === "object" ? raw : null;
  const mergesRaw = Array.isArray(obj?.merges) ? obj.merges : [];
  const noChangeRaw = Array.isArray(obj?.no_change) ? obj.no_change : [];

  const merges = [];
  const used = new Set();

  for (const m of mergesRaw) {
    if (!m || typeof m !== "object") continue;
    const keep = Number(m.keep_id ?? m.keep ?? m.keepBlock ?? m.keep_block);
    const absorb = Array.isArray(m.absorb_ids ?? m.absorb ?? m.absorbBlocks ?? m.absorb_blocks)
      ? (m.absorb_ids ?? m.absorb ?? m.absorbBlocks ?? m.absorb_blocks)
      : [];
    const absorbIds = absorb.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
    if (!Number.isFinite(keep) || keep <= 0) continue;
    if (!absorbIds.length) continue;

    // Enforce uniqueness across all merges.
    if (used.has(keep)) continue;
    let ok = true;
    for (const a of absorbIds) {
      if (a === keep || used.has(a)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    used.add(keep);
    for (const a of absorbIds) used.add(a);

    merges.push({
      keep_id: keep,
      absorb_ids: Array.from(new Set(absorbIds)).sort((a, b) => a - b),
      new_title: String(m.new_title || "").trim(),
      reason: String(m.reason || "").trim(),
    });
  }

  const no_change = noChangeRaw
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0 && !used.has(x))
    .sort((a, b) => a - b);

  merges.sort((a, b) => a.keep_id - b.keep_id);
  return {
    merges,
    no_change,
    summary: String(obj?.summary || "").trim(),
  };
}

function buildAuditPayload(blockIndex) {
  const safe = Array.isArray(blockIndex) ? blockIndex : [];
  const view = safe
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((b) => ({
      id: Number(b.id),
      title: String(b.title || "").trim(),
      summary: String(b.summary || "").trim(),
      signature: Array.isArray(b.signature)
        ? b.signature.map((t) => String(t || "").trim()).filter(Boolean)
        : String(b.signature || "")
            .split(/[,\n;]/g)
            .map((t) => String(t || "").trim())
            .filter(Boolean),
    }));
  return JSON.stringify(view, null, 2);
}

export async function auditBlockIndex(blockIndex, { apiKey, language }) {
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("Missing API key.");
  const lang = String(language || "English").trim() || "English";

  const payload = buildAuditPayload(blockIndex);
  const { deepSeekAuditBlockIndex } = await import("./api.js?v=20260503_7");
  const text = await deepSeekAuditBlockIndex({
    apiKey: key,
    blockIndexJson: payload,
    language: lang,
  });

  const parsed = safeParseJson(text);
  return normalizeAuditResult(parsed);
}

export async function mergeChunks({ keepBlock, absorbBlocks, keep_id, absorb_ids, new_title }, { apiKey } = {}) {
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("Missing API key.");
  const keep = keepBlock && typeof keepBlock === "object" ? keepBlock : null;
  const absorbs = Array.isArray(absorbBlocks) ? absorbBlocks : [];
  if (!keep) throw new Error("Missing keepBlock for merge.");
  if (!absorbs.length) throw new Error("Missing absorbBlocks for merge.");

  const concatenated_chunks = [
    String(keep.chunk || "").trim(),
    ...absorbs.map((b) => String(b?.chunk || "").trim()),
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const { deepSeekPostMergeChunk } = await import("./api.js?v=20260503_7");
  const mergedChunk = await deepSeekPostMergeChunk({
    apiKey: key,
    keep_id,
    absorb_ids,
    new_title,
    concatenated_chunks,
  });

  return String(mergedChunk || "").trim();
}

function renumberBlockIndexSequential(blocks) {
  const safe = Array.isArray(blocks) ? blocks.slice() : [];
  safe.sort((a, b) => Number(a.id) - Number(b.id));
  return safe.map((b, i) => ({
    ...b,
    id: i + 1,
  }));
}

export async function twoPhaseSplitMerge(blockIndex, { apiKey, language } = {}) {
  const original = Array.isArray(blockIndex) ? blockIndex.slice() : [];
  const originalN = original.length;
  if (!originalN) {
    return {
      blockIndex: [],
      auditResult: { merges: [], no_change: [] },
      mergeInfo: { original_n: 0, final_n: 0, merged_count: 0, merges: [] },
    };
  }

  const auditResult = await auditBlockIndex(original, { apiKey, language });
  const merges = Array.isArray(auditResult?.merges) ? auditResult.merges : [];
  if (!merges.length) {
    return {
      blockIndex: renumberBlockIndexSequential(original),
      auditResult,
      mergeInfo: {
        original_n: originalN,
        final_n: originalN,
        merged_count: 0,
        merges: [],
      },
    };
  }

  const byId = new Map(original.map((b) => [Number(b.id), b]));
  const removed = new Set();
  const mergeInfoRows = [];

  for (const m of merges) {
    const keepId = Number(m.keep_id);
    if (removed.has(keepId)) continue;
    const keep = byId.get(keepId);
    if (!keep) continue;

    const absorbIds = Array.isArray(m.absorb_ids) ? m.absorb_ids : [];
    const absorbs = [];
    for (const aid of absorbIds) {
      const id = Number(aid);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (id === keepId) continue;
      if (removed.has(id)) continue;
      const b = byId.get(id);
      if (!b) continue;
      absorbs.push(b);
    }
    if (!absorbs.length) continue;

    const beforeKeepTitle = String(keep.title || "").trim();
    const beforeAbsorbTitles = absorbs.map((b) => String(b.title || "").trim());

    const desiredTitle = String(m.new_title || "").trim();
    const mergedChunk = await mergeChunks(
      {
        keepBlock: keep,
        absorbBlocks: absorbs,
        keep_id: keepId,
        absorb_ids: absorbs.map((b) => Number(b.id)),
        new_title: desiredTitle || beforeKeepTitle,
      },
      { apiKey },
    );

    byId.set(keepId, {
      ...keep,
      title: desiredTitle || beforeKeepTitle,
      chunk: mergedChunk,
    });
    for (const b of absorbs) removed.add(Number(b.id));

    mergeInfoRows.push({
      keep_id: keepId,
      keep_title_before: beforeKeepTitle,
      keep_title_after: desiredTitle || beforeKeepTitle,
      absorb_ids: absorbs.map((b) => Number(b.id)),
      absorb_titles: beforeAbsorbTitles,
      reason: String(m.reason || "").trim(),
    });
  }

  const remaining = Array.from(byId.values()).filter((b) => !removed.has(Number(b.id)));
  const renumbered = renumberBlockIndexSequential(remaining);
  const absorbedCount = mergeInfoRows.reduce((acc, r) => acc + (r.absorb_ids?.length || 0), 0);

  return {
    blockIndex: renumbered,
    auditResult,
    mergeInfo: {
      original_n: originalN,
      final_n: renumbered.length,
      merged_count: absorbedCount,
      merges: mergeInfoRows,
    },
  };
}

export function formatBlockIndexForConfirmation(arr) {
  const safe = Array.isArray(arr) ? arr : [];
  const view = safe
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((b) => ({
      id: Number(b.id),
      title: String(b.title || ""),
      summary: String(b.summary || ""),
    }));
  return JSON.stringify(view, null, 2);
}

export function blocksListTextFromBlockIndex(arr) {
  const safe = Array.isArray(arr) ? arr : [];
  const lines = safe
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((b) => {
      const id = Number(b.id);
      const title = String(b.title || "").trim();
      const summary = String(b.summary || "").trim();
      return `${id}. ${title}${summary ? ` — ${summary}` : ""}`;
    });
  return lines.join("\n").trim();
}

export function getBlockTitleFromList(blockIndex) {
  const titles = parseBlockTitlesFromList(state.activeSession?.blocks_list_text);
  const key = String(blockIndex + 1);
  const t = titles[key];
  return t ? String(t) : `Block ${blockIndex + 1}`;
}

export function getBlockTitleSafe(blockIndex) {
  const blocks = getBlocksSafe();
  const b = blocks[blockIndex];
  const t = b && typeof b === "object" ? String(b.title || "").trim() : "";
  return t || getBlockTitleFromList(blockIndex);
}

export function initActiveSessionFromBlocksList({ mode, nBlocks, blocksListText }) {
  const n = Math.max(1, Number(nBlocks) || 1);
  return {
    session_mode: mode,
    n_blocks: n,
    blocks_list_text: String(blocksListText || ""),
    current_block_index: 0,
    active_question_index: 0,
    blocks: Array.from({ length: n }, () => null),
  };
}

export let prefetchState = {
  blockIndex: null,
  status: "idle", // idle | generating | ready | failed
  data: null, // generated block JSON when ready
  error: null,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function triggerPrefetch(blockIndex) {
  if (prefetchState.status === "generating") return;
  if (prefetchState.blockIndex === blockIndex && prefetchState.status === "ready") return;

  prefetchState = { blockIndex, status: "generating", data: null, error: null };

  void import("./api.js?v=20260503_7")
    .then((m) => m.generateBlock(blockIndex))
    .then((result) => {
      if (prefetchState.blockIndex !== blockIndex) return;
      prefetchState.status = "ready";
      prefetchState.data = result;
    })
    .catch((err) => {
      if (prefetchState.blockIndex !== blockIndex) return;
      prefetchState.status = "failed";
      prefetchState.error = err;
    });
}

export async function getPrefetchedBlock(blockIndex) {
  if (prefetchState.blockIndex === blockIndex && prefetchState.status === "ready") {
    const data = prefetchState.data;
    prefetchState = { blockIndex: null, status: "idle", data: null, error: null };
    return data;
  }

  const delays = [250, 500, 1000, 2000, 4000];
  const startedAt = Date.now();
  let delayIndex = 0;

  while (Date.now() - startedAt < 30_000) {
    if (prefetchState.blockIndex === blockIndex) {
      if (prefetchState.status === "ready") {
        const data = prefetchState.data;
        prefetchState = { blockIndex: null, status: "idle", data: null, error: null };
        return data;
      }
      if (prefetchState.status === "failed") {
        const err = prefetchState.error;
        prefetchState = { blockIndex: null, status: "idle", data: null, error: null };
        throw err instanceof Error ? err : new Error(String(err));
      }
    }

    const d = delays[Math.min(delayIndex, delays.length - 1)];
    delayIndex += 1;
    await sleep(d);
  }

  throw new Error("Block generation timed out");
}

