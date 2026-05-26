import {
  LS_ACTIVE_SESSION_KEY,
  LS_BLOCK_INDEX_KEY,
  LS_KEY,
  LS_SESSION_DEFAULT_Q_CONFIG_KEY,
  LS_SESSION_CONCEPTS_KEY,
} from "./config.js?v=20260527_1";
import { syncConceptsFromBlock } from "./dictionary.js?v=20260527_1";
import {
  deepSeekGenerateBlockJson,
  deepSeekRegenerateBlockQuestions,
  generateBlockFromChunk,
  mapBlocksToPages,
  warnQuestionsOnlyCountMismatch,
} from "./api.js?v=20260527_1";
import {
  assertLlmKeyPresent,
  getActiveSessionLlmModel,
  getSessionLlmModel,
  getStoredGeminiKey,
  saveGeminiKey,
} from "./llm.js?v=20260525_1";
import { getStudyLanguage } from "./ui.js?v=20260525_1";
import { isOfflineMode } from "./main.js?v=20260525_1";

export { getStoredGeminiKey, saveGeminiKey };

export const state = {
  studyMode: null,
  originalMaterialText: "",
  studyNotes: "",
  nTest: 2,
  nSocratic: 1,
  nextBlockQuestionOverride: null, // { blockIndex, n_test, n_socratic, _touched }
  lastNBlocks: 0,
  lastUploadedFileNames: [],
  lastRawMaterialText: "",
  lastCleanedMaterialText: "",
  lastCleanedMaterialWordCount: 0,
  lastBlockIndex: null,
  activeSession: null,
  activeBlockIndex: 0,
  activeQuestionIndex: 0,
  pendingLlmModel: null,
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

export function loadDefaultQuestionConfig() {
  try {
    const raw = localStorage.getItem(LS_SESSION_DEFAULT_Q_CONFIG_KEY);
    const obj = raw ? JSON.parse(raw) : null;
    const n_test = clampInt(obj?.n_test, 0, 5, 2);
    const n_socratic = clampInt(obj?.n_socratic, 0, 3, 1);
    return { n_test, n_socratic };
  } catch {
    return { n_test: 2, n_socratic: 1 };
  }
}

export function storeDefaultQuestionConfig({ n_test, n_socratic }) {
  try {
    const safe = {
      n_test: clampInt(n_test, 0, 5, 2),
      n_socratic: clampInt(n_socratic, 0, 3, 1),
    };
    localStorage.setItem(LS_SESSION_DEFAULT_Q_CONFIG_KEY, JSON.stringify(safe));
  } catch {
    // ignore
  }
}

const EXPLANATION_PROFILES = new Set(["thorough", "brief_deep"]);
const GAPS_SOURCES = new Set(["synthesis", "user", "merged", "none"]);
const SYNTHESIS_STATUSES = new Set(["ok", "timeout", "error", "skipped"]);

export function normalizeExplanationProfile(value, fallback = "thorough") {
  const v = String(value || "").trim();
  if (EXPLANATION_PROFILES.has(v)) return v;
  return EXPLANATION_PROFILES.has(fallback) ? fallback : "thorough";
}

export function normalizeGapFocus(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    const label =
      typeof item === "string"
        ? item.trim()
        : item && typeof item === "object"
          ? String(item.label || "").trim()
          : "";
    if (!label) continue;
    if (out.includes(label)) continue;
    out.push(label);
    if (out.length >= 8) break;
  }
  return out;
}

export function normalizeGapsByBlock(gapsByBlock) {
  if (!gapsByBlock || typeof gapsByBlock !== "object" || Array.isArray(gapsByBlock)) return {};
  const out = {};
  for (const [blockKey, entries] of Object.entries(gapsByBlock)) {
    const key = String(blockKey).trim();
    if (!key || !Array.isArray(entries)) continue;
    const normalized = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const label = String(entry.label || "").trim();
      if (label.length < 3 || label.length > 80) continue;
      const gap = { label };
      const source = String(entry.source || "").trim();
      if (source === "synthesis" || source === "user") gap.source = source;
      const fromIdx = Number(entry.from_question_index);
      if (Number.isFinite(fromIdx) && fromIdx >= 0) gap.from_question_index = Math.floor(fromIdx);
      normalized.push(gap);
      if (normalized.length >= 8) break;
    }
    if (normalized.length) out[key] = normalized;
  }
  return out;
}

export function normalizeGapsSource(value, fallback = "none") {
  const v = String(value || "").trim();
  if (GAPS_SOURCES.has(v)) return v;
  return GAPS_SOURCES.has(fallback) ? fallback : "none";
}

export function normalizeSynthesisStatus(value, fallback = "ok") {
  const v = String(value || "").trim();
  if (SYNTHESIS_STATUSES.has(v)) return v;
  return SYNTHESIS_STATUSES.has(fallback) ? fallback : "ok";
}

export function gapLabelsForBlock(gapsByBlock, blockId) {
  const key = String(blockId);
  const entries = gapsByBlock && typeof gapsByBlock === "object" ? gapsByBlock[key] : null;
  if (!Array.isArray(entries)) return [];
  return normalizeGapFocus(entries);
}

/**
 * Merge synthesized gaps (C) with optional per-block user edits (D).
 * User-edited blocks replace synthesis for that block; untouched blocks keep synthesis.
 */
export function mergeGapLists(synthesis, userEdits) {
  const synRaw =
    synthesis && typeof synthesis === "object" && !Array.isArray(synthesis)
      ? synthesis.gaps_by_block ?? synthesis.gapsByBlock ?? synthesis
      : {};
  const editRaw =
    userEdits && typeof userEdits === "object" && !Array.isArray(userEdits)
      ? userEdits.gaps_by_block ?? userEdits.gapsByBlock ?? userEdits
      : {};
  const merged = { ...normalizeGapsByBlock(synRaw) };
  if (!editRaw || typeof editRaw !== "object" || Array.isArray(editRaw)) return merged;

  for (const [blockKey, entries] of Object.entries(editRaw)) {
    const key = String(blockKey).trim();
    if (!key) continue;
    const normalized = normalizeGapsByBlock({ [key]: Array.isArray(entries) ? entries : [] });
    if (normalized[key]) merged[key] = normalized[key];
    else delete merged[key];
  }
  return merged;
}

/** R8 — raise n_test/n_socratic when gap count exceeds question budget (max 8 total). */
export function adjustQuestionBudgetForGaps(n_test, n_socratic, gapCount) {
  const gaps = Math.max(0, Math.floor(Number(gapCount) || 0));
  let nt = clampInt(n_test, 0, 5, 0);
  let ns = clampInt(n_socratic, 0, 3, 0);
  if (gaps <= nt + ns) return { n_test: nt, n_socratic: ns };
  nt = Math.min(5, Math.max(nt, Math.ceil(gaps * 0.6)));
  ns = Math.min(3, Math.max(ns, gaps - nt));
  while (nt + ns > 8 && ns > 0) ns -= 1;
  while (nt + ns > 8 && nt > 0) nt -= 1;
  return { n_test: nt, n_socratic: ns };
}

export function resolveBlockQuestionConfig(blockIndex) {
  const session = state.activeSession && typeof state.activeSession === "object" ? state.activeSession : {};
  const defaults = {
    n_test: clampInt(session.n_test, 0, 5, clampInt(state.nTest, 0, 5, 2)),
    n_socratic: clampInt(session.n_socratic, 0, 3, clampInt(state.nSocratic, 0, 3, 1)),
    explanation_profile: "thorough",
    gap_focus: [],
  };
  const blocks = Array.isArray(session.blocks) ? session.blocks : [];
  const b = blocks[blockIndex];
  const cfg = b && typeof b === "object" && b._config && typeof b._config === "object" ? b._config : null;
  if (!cfg) return defaults;
  return {
    n_test: clampInt(cfg.n_test, 0, 5, defaults.n_test),
    n_socratic: clampInt(cfg.n_socratic, 0, 3, defaults.n_socratic),
    explanation_profile: normalizeExplanationProfile(cfg.explanation_profile, defaults.explanation_profile),
    gap_focus: normalizeGapFocus(cfg.gap_focus),
  };
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

export function getBlock(blockIndex) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  if (isOfflineMode()) {
    const blocks = Array.isArray(window?.offlinePack?.blocks) ? window.offlinePack.blocks : [];
    return blocks[idx] && typeof blocks[idx] === "object" ? blocks[idx] : null;
  }
  const blocks = getBlocksSafe();
  return blocks[idx] && typeof blocks[idx] === "object" ? blocks[idx] : null;
}

export function shouldTriggerCommentReply() {
  return !isOfflineMode();
}

export function areAllSessionBlocksGenerated(sessionObj = state.activeSession) {
  const safe = sessionObj && typeof sessionObj === "object" ? sessionObj : {};
  const blocks = Array.isArray(safe.blocks) ? safe.blocks : [];
  const total = Number(safe.n_blocks);
  const expected = Number.isFinite(total) && total > 0 ? total : blocks.length;
  if (!expected) return false;
  for (let i = 0; i < expected; i += 1) {
    const b = blocks[i];
    const ok =
      b &&
      typeof b === "object" &&
      typeof b.explanation === "string" &&
      Array.isArray(b.questions);
    if (!ok) return false;
  }
  return true;
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

function parseAnswerLetter(raw) {
  const t = String(raw || "").trim();
  if (!t) return "";
  const m = t.match(/\b([ABCD])\b/i);
  return m ? String(m[1]).toUpperCase() : "";
}

export function getMissedTestQuestions(session) {
  const safe = session && typeof session === "object" ? session : {};
  const blocks = Array.isArray(safe.blocks) ? safe.blocks : [];
  const respBlocks =
    safe._responses?.blocks && typeof safe._responses.blocks === "object"
      ? safe._responses.blocks
      : {};

  const missed = [];
  for (let bi = 0; bi < blocks.length; bi += 1) {
    const b = blocks[bi] && typeof blocks[bi] === "object" ? blocks[bi] : null;
    if (!b) continue;
    const qs = Array.isArray(b.questions) ? b.questions : [];
    const qResp =
      respBlocks[String(bi)]?.questions && typeof respBlocks[String(bi)].questions === "object"
        ? respBlocks[String(bi)].questions
        : {};

    for (let qi = 0; qi < qs.length; qi += 1) {
      const q = qs[qi] && typeof qs[qi] === "object" ? qs[qi] : null;
      if (!q || String(q.type || "").trim() !== "test") continue;
      const r = qResp[String(qi)];
      if (!r || typeof r !== "object") continue;

      const correct = String(r.correct_answer || "").trim().toUpperCase();
      const userLetter = parseAnswerLetter(r.user_answer);
      if (!correct || !userLetter) continue;
      if (userLetter === correct) continue;

      missed.push({
        blockIndex: bi,
        questionIndex: qi,
        question: String(q.question || "").trim(),
        user_answer: String(r.user_answer || "").trim(),
        correct_answer: correct,
        feedback: String(r.feedback || "").trim(),
        answered_at: String(r.answered_at || "").trim(),
      });
    }
  }

  return missed;
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

export function countExplanationWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Dev-oriented checks per block-generation-profile contract. */
export function warnBlockGenerationProfileMismatch(blockObj, cfg) {
  if (!blockObj || typeof blockObj !== "object" || !cfg || typeof cfg !== "object") return;
  const profile = String(cfg.explanation_profile || "thorough");
  const gaps = Array.isArray(cfg.gap_focus) ? cfg.gap_focus : [];
  const questions = Array.isArray(blockObj.questions) ? blockObj.questions : [];
  if (profile === "brief_deep") {
    const wc = countExplanationWords(blockObj.explanation);
    if (wc > 0 && (wc < 60 || wc > 140)) {
      console.warn(`Block generation: brief_deep explanation has ${wc} words (expected max 120).`);
    }
  }
  if (gaps.length > 0 && questions.length < gaps.length) {
    console.warn(
      `Block generation: ${gaps.length} gap(s) but only ${questions.length} question(s) (expected ≥${gaps.length}).`,
    );
  }
}

export async function generateBlockForIndex(blockIndex, { n_test, n_socratic, previousComment } = {}) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  if (isOfflineMode()) {
    const block = getBlock(idx);
    if (!block) throw new Error("Missing offline block.");
    return block;
  }
  const llmModel = getSessionLlmModel(state.activeSession);
  assertLlmKeyPresent(llmModel);

  const blocksListText = String(state.activeSession?.blocks_list_text || "").trim();
  if (!blocksListText) throw new Error("Missing confirmed blocks list.");

  const resolved = resolveBlockQuestionConfig(idx);
  const cfg = {
    n_test: clampInt(n_test, 0, 5, resolved.n_test),
    n_socratic: clampInt(n_socratic, 0, 3, resolved.n_socratic),
    explanation_profile: resolved.explanation_profile,
    gap_focus: resolved.gap_focus,
  };

  const materialChunk = getBlockChunkFromIndex(idx);
  if (!materialChunk) {
    throw new Error("Missing block chunk for this session. Please regenerate blocks.");
  }

  const blockTitle = getBlockTitleFromList(idx);
  const blockRequest = {
    llmModel,
    blocksListText,
    materialText: materialChunk,
    blockIndex: idx,
    blockTitle,
    previousComment: String(previousComment || "").trim(),
    language: getStudyLanguage(),
    n_test: cfg.n_test,
    n_socratic: cfg.n_socratic,
    explanation_profile: cfg.explanation_profile,
    gap_focus: cfg.gap_focus,
  };

  let obj = null;
  try {
    obj = await deepSeekGenerateBlockJson(blockRequest);
  } catch (err) {
    const message = err?.message ? String(err.message) : String(err);
    if (!message.includes("valid JSON")) throw err;
    obj = await deepSeekGenerateBlockJson(blockRequest);
  }
  warnBlockGenerationProfileMismatch(obj, cfg);
  return obj;
}

/**
 * Client regen mode for transition overlay (see data-model.md).
 * @returns {"consume_prefetch"|"questions_only"|"full_block"}
 */
export function resolveRegenMode(nextCfg, prefetchedBlock, opts = {}) {
  const cfg = nextCfg && typeof nextCfg === "object" ? nextCfg : {};
  const expectedKey = buildBlockConfigKey(cfg);
  const prefetchReady = Boolean(opts.prefetchReady);
  const prefetchConfigKey = String(opts.prefetchConfigKey || "");

  if (
    prefetchReady &&
    prefetchConfigKey &&
    prefetchConfigKey === expectedKey &&
    prefetchedBlock &&
    typeof prefetchedBlock === "object"
  ) {
    return "consume_prefetch";
  }

  const explanation = String(prefetchedBlock?.explanation || "").trim();
  if (!prefetchedBlock || !explanation) {
    return "full_block";
  }

  const baseCfg =
    prefetchedBlock._config && typeof prefetchedBlock._config === "object"
      ? prefetchedBlock._config
      : opts.baseCfg && typeof opts.baseCfg === "object"
        ? opts.baseCfg
        : null;

  if (!baseCfg) {
    return "full_block";
  }

  const nextProfile = normalizeExplanationProfile(
    cfg.explanation_profile,
    baseCfg.explanation_profile,
  );
  const baseProfile = normalizeExplanationProfile(baseCfg.explanation_profile, "thorough");
  const nextGaps = normalizeGapFocus(cfg.gap_focus).join("\0");
  const baseGaps = normalizeGapFocus(baseCfg.gap_focus).join("\0");

  if (nextProfile !== baseProfile || nextGaps !== baseGaps) {
    return "full_block";
  }

  return "questions_only";
}

export async function generateQuestionsOnlyForIndex(
  blockIndex,
  { n_test, n_socratic, baseBlock } = {},
) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  if (isOfflineMode()) {
    const block = getBlock(idx);
    if (!block) throw new Error("Missing offline block.");
    return block;
  }

  const base = baseBlock && typeof baseBlock === "object" ? baseBlock : {};
  const explanation = String(base.explanation || "").trim();
  if (!explanation) {
    throw new Error("Cannot regenerate questions only without a non-empty explanation.");
  }

  const resolved = resolveBlockQuestionConfig(idx);
  const cfg = {
    n_test: clampInt(n_test, 0, 5, resolved.n_test),
    n_socratic: clampInt(n_socratic, 0, 3, resolved.n_socratic),
    explanation_profile: resolved.explanation_profile,
    gap_focus: resolved.gap_focus,
  };

  const materialChunk = getBlockChunkFromIndex(idx);
  if (!materialChunk) {
    throw new Error("Missing block chunk for this session. Please regenerate blocks.");
  }

  const blockTitle = String(base.title || getBlockTitleFromList(idx)).trim() || getBlockTitleFromList(idx);
  const llmModel = getSessionLlmModel(state.activeSession);
  assertLlmKeyPresent(llmModel);

  const request = {
    llmModel,
    language: getStudyLanguage(),
    n_test: cfg.n_test,
    n_socratic: cfg.n_socratic,
    blockTitle,
    explanation,
    materialText: materialChunk,
    gap_focus: cfg.gap_focus,
  };

  let response = null;
  try {
    response = await deepSeekRegenerateBlockQuestions(request);
  } catch (err) {
    const message = err?.message ? String(err.message) : String(err);
    if (!message.includes("valid JSON")) throw err;
    response = await deepSeekRegenerateBlockQuestions(request);
  }
  warnQuestionsOnlyCountMismatch(response, cfg);

  const merged = {
    ...base,
    id: base.id != null ? base.id : idx + 1,
    title: base.title || blockTitle,
    explanation,
    questions: Array.isArray(response?.questions) ? response.questions : [],
    concepts:
      Array.isArray(response?.concepts) && response.concepts.length
        ? response.concepts
        : Array.isArray(base.concepts)
          ? base.concepts
          : [],
  };
  if (!merged._config || typeof merged._config !== "object") merged._config = {};
  merged._config.n_test = cfg.n_test;
  merged._config.n_socratic = cfg.n_socratic;
  merged._config.explanation_profile = cfg.explanation_profile;
  merged._config.gap_focus = cfg.gap_focus;
  return merged;
}

export async function generateOfflinePack(blockIndex, htmlText, config = {}) {
  const safeBlocks = Array.isArray(blockIndex) ? blockIndex : [];
  const updateProgress =
    typeof config.updateProgress === "function" ? config.updateProgress : () => undefined;
  const updateETA = typeof config.updateETA === "function" ? config.updateETA : () => undefined;
  const language = String(config.language || getStudyLanguage()).trim() || "English";
  const delayMs = Math.max(0, Math.floor(Number(config.delayMs) || 200));
  window.offlinePackCancelled = false;

  if (!safeBlocks.length) {
    return { results: [], mappedBlocks: [], cancelled: false, total: 0, completed: 0 };
  }

  updateProgress(2, "Phase 1 of 3: Parsing document", "Reading pages...");
  let pages = extractPagesFromHTML(htmlText);
  if (!Array.isArray(pages) || !pages.length) {
    const fallbackText = String(htmlText || "").replace(/\s+/g, " ").trim();
    pages = fallbackText ? [{ pageNum: 1, text: fallbackText }] : [];
    window.extractedPages = pages;
    window.totalPages = pages.length;
  }
  updateProgress(5, "Phase 1 of 3: Parsing document", `Reading ${pages.length} pages...`);

  updateProgress(6, "Phase 2 of 3: Mapping blocks", "Mapping block 1 of 1...");
  const mappedBlocks = await mapBlocksToPages(
    safeBlocks,
    pages,
    language,
    config.llmModel ?? getSessionLlmModel(state.activeSession),
  );
  updateProgress(
    20,
    "Phase 2 of 3: Mapping blocks",
    `Mapped ${Array.isArray(mappedBlocks) ? mappedBlocks.length : 0} blocks`,
  );

  const results = [];
  const safeMapped = Array.isArray(mappedBlocks) && mappedBlocks.length ? mappedBlocks : safeBlocks;
  const startTime = Date.now();

  for (let i = 0; i < safeMapped.length; i += 1) {
    if (window.offlinePackCancelled) {
      return {
        results,
        mappedBlocks: safeMapped,
        cancelled: true,
        total: safeMapped.length,
        completed: i,
      };
    }

    const block = safeMapped[i] && typeof safeMapped[i] === "object" ? safeMapped[i] : {};
    const pct = 20 + Math.round((i / safeMapped.length) * 80);
    const title = String(block.title || `Block ${i + 1}`).trim();
    updateProgress(pct, "Phase 3 of 3: Generating content", `Block ${i + 1}/${safeMapped.length} — ${title}`);

    let chunk = "";
    if (Number(block.startPage) === -1) {
      const prev = safeMapped[i - 1];
      const next = safeMapped[i + 1];
      const start = Math.max(1, Number(prev?.startPage) || 1);
      const end = Math.max(start, Number(next?.endPage) || pages.length || start);
      chunk = getChunkForPageRange(pages, start, end).slice(0, 3000);
    } else {
      const start = Math.max(1, Number(block.startPage) || 1);
      const end = Math.max(start, Number(block.endPage) || start);
      chunk = getChunkForPageRange(pages, start, end);
    }
    if (chunk.length > 12000) chunk = chunk.slice(0, 12000);
    if (!chunk.trim()) chunk = String(block.chunk || "").trim().slice(0, 12000);

    const blockConfig = {
      n_test: clampInt(config.n_test, 0, 5, 2),
      n_socratic: 0,
      llmModel: config.llmModel ?? getSessionLlmModel(state.activeSession),
    };

    try {
      const generated = await generateBlockFromChunk(block, chunk, blockConfig, language);
      results.push({ ...block, ...generated, _offline: true });
    } catch (err) {
      console.warn(`Block ${Number(block.id) || i + 1} failed:`, err);
      results.push({
        ...block,
        explanation: `[Generation failed for: ${title}]`,
        questions: [],
        concepts: [],
        _failed: true,
        _offline: true,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const elapsed = (Date.now() - startTime) / 1000;
    const avgPerBlock = elapsed / (i + 1);
    const remaining = Math.round(avgPerBlock * (safeMapped.length - i - 1));
    updateETA(remaining);
  }

  return {
    results,
    mappedBlocks: safeMapped,
    cancelled: false,
    total: safeMapped.length,
    completed: safeMapped.length,
  };
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

const RESUME_FORMAT_VERSION = 2;

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
  const testQs = qs.filter((q) => q && typeof q === "object" && q.type === "test");
  const socQs = qs.filter((q) => q && typeof q === "object" && q.type === "socratic");
  return [...testQs, ...socQs];
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
    n_blocks: n,
    n_test: clampInt(safe.n_test, 0, 5, 2),
    n_socratic: clampInt(safe.n_socratic, 0, 3, 1),
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
  if (ver !== 1 && ver !== 2) {
    throw new Error(`Unsupported resume format_version (${raw.format_version}). Expected 1 or 2.`);
  }
  const mode = ver === 1 ? String(raw.session_mode || "").trim() : "";
  if (ver === 1 && mode !== "test" && mode !== "socratic") {
    throw new Error('Resume payload has invalid session_mode (need "test" or "socratic").');
  }
  const n = Math.max(1, Math.floor(Number(raw.n_blocks)));
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("Resume payload has invalid n_blocks.");
  }

  const defaultsFromV1 =
    ver === 1
      ? mode === "test"
        ? { n_test: 2, n_socratic: 0 }
        : { n_test: 0, n_socratic: 1 }
      : { n_test: 2, n_socratic: 1 };
  const n_test = clampInt(raw.n_test, 0, 5, defaultsFromV1.n_test);
  const n_socratic = clampInt(raw.n_socratic, 0, 3, defaultsFromV1.n_socratic);

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
    format_version: 2,
    exported_at: String(raw.exported_at || ""),
    n_blocks: n,
    n_test,
    n_socratic,
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
  const n = normalized.n_blocks;
  const blocks = normalized.blocks;
  const responses = normalized._responses;
  for (let bi = 0; bi < n; bi += 1) {
    const block = blocks[bi];
    if (!block || typeof block !== "object") {
      return { current_block_index: bi, active_question_index: 0, session_complete: false };
    }
    const qs = getQuestionsForMode(block, "");
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
    n_blocks: p.n_blocks,
    n_test: p.n_test,
    n_socratic: p.n_socratic,
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

function isPedroSourceLine(line) {
  const t = String(line || "").trim().toUpperCase();
  return t === "O&R" || t === "TNC" || t === "SINT";
}

function isPedroLevelLine(line) {
  const t = String(line || "").trim().toLowerCase();
  return t === "basico" || t === "básico" || t === "intermedio" || t === "avanzado";
}

function stripLeadingListMarkers(line) {
  return String(line || "").replace(/^[\d.\-*\s]+/, "").trim();
}

function stripTrailingMetadata(line) {
  const raw = String(line || "");
  const splitMeta = raw.split(/\s+·\s+/);
  const noMeta = String(splitMeta[0] || raw);
  const splitTab = noMeta.split("\t");
  return String(splitTab[0] || noMeta).trim();
}

export function parseImportedIndexText(rawText) {
  const raw = String(rawText || "");
  const parsed = safeParseJson(raw);

  // Strategy 1: JSON array with at least title.
  if (Array.isArray(parsed)) {
    const hasTitles = parsed.every(
      (item) => item && typeof item === "object" && String(item.title || "").trim(),
    );
    if (hasTitles) {
      const parsedIndex = parsed.map((item, i) => ({
        id: Number.isFinite(Number(item.id)) ? Number(item.id) : i + 1,
        title: String(item.title || "").trim(),
        summary: String(item.summary || item.title || "").trim(),
        source: String(item.source || "").trim(),
        level: String(item.level || "").trim(),
        chunk: String(item.chunk || "").trim(),
      }));
      if (parsedIndex.length) return parsedIndex;
    }
  }

  // Strategy 2: Plain text / markdown list.
  const lines = raw
    .split(/\r?\n/g)
    .map((l) => String(l || "").trim())
    .filter(Boolean);
  if (!lines.length) return [];

  // Pedro pattern: groups of 3 lines -> "N. Title", "source", "level".
  const nGroups = Math.floor(lines.length / 3);
  let matched = 0;
  for (let i = 0; i < nGroups; i += 1) {
    const titleLine = lines[i * 3];
    const sourceLine = lines[i * 3 + 1];
    const levelLine = lines[i * 3 + 2];
    const titleOk = /^\d+\.\s*\S+/.test(titleLine);
    if (titleOk && isPedroSourceLine(sourceLine) && isPedroLevelLine(levelLine)) {
      matched += 1;
    }
  }
  if (nGroups > 0 && matched / nGroups >= 0.5) {
    const parsedIndex = [];
    for (let i = 0; i < nGroups; i += 1) {
      const titleLine = lines[i * 3];
      const source = lines[i * 3 + 1];
      const level = lines[i * 3 + 2];
      const title = String(titleLine || "").replace(/^\d+\.\s*/, "").trim();
      if (!title) continue;
      parsedIndex.push({
        id: i + 1,
        title,
        summary: title,
        source: String(source || "").trim(),
        level: String(level || "").trim(),
        chunk: "",
      });
    }
    if (parsedIndex.length) return parsedIndex;
  }

  const titles = [];
  for (const line of lines) {
    const cleaned = stripTrailingMetadata(stripLeadingListMarkers(line));
    if (cleaned) titles.push(cleaned);
  }
  if (!titles.length) return [];

  return titles.map((title, i) => ({
    id: i + 1,
    title,
    summary: title,
    source: "",
    level: "",
    chunk: "",
  }));
}

export function parseOfflinePackMarkdown(text) {
  const raw = String(text || "");
  const match = raw.match(/<!--\s*OFFLINE_PACK_V1\s*([\s\S]*?)-->/);
  if (!match) {
    return { ok: false, reason: "not_offline_pack" };
  }
  const jsonText = String(match[1] || "").trim();
  if (!jsonText) {
    return { ok: false, reason: "invalid" };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const hasVersion = Object.prototype.hasOwnProperty.call(parsed || {}, "version");
  const hasMeta = parsed && typeof parsed === "object" && parsed.meta && typeof parsed.meta === "object";
  const hasBlocks = Array.isArray(parsed?.blocks);
  if (!hasVersion || !hasMeta || !hasBlocks) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, value: parsed };
}

export function normalizeBlockIndexArray(arr, { requireChunk = true, lenient = false } = {}) {
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (let i = 0; i < arr.length; i += 1) {
    const item = arr[i];
    if (!item || typeof item !== "object") {
      if (lenient) continue;
      return null;
    }
    let id = Number(item.id ?? item.block_id);
    if (!Number.isFinite(id) || id <= 0) {
      if (lenient) id = out.length + 1;
      else return null;
    }
    const title = String(item.title || item.name || "").trim();
    const summary = String(item.summary || item.description || item.title || item.name || "").trim();
    const signatureArr = Array.isArray(item.signature) ? item.signature : null;
    const signature = signatureArr
      ? signatureArr.map((t) => String(t || "").trim()).filter(Boolean)
      : String(item.signature || "")
          .split(/[,\n;]/g)
          .map((t) => String(t || "").trim())
          .filter(Boolean);
    const chunk = String(item.chunk || item.text || "").trim();
    if (!title) {
      if (lenient) continue;
      return null;
    }
    if (!summary) {
      if (lenient) continue;
      return null;
    }
    if (requireChunk && !chunk) {
      if (lenient) continue;
      return null;
    }
    out.push({ id, title, summary, signature, chunk });
  }
  if (!out.length) return null;
  out.sort((a, b) => a.id - b.id);
  return out;
}

/** Trim/pad block index to exactly targetCount; renumber ids 1..N. Returns null if too few blocks. */
export function coerceBlockIndexToTargetCount(index, targetCount) {
  const n = Math.max(1, Math.floor(Number(targetCount) || 1));
  if (!Array.isArray(index) || !index.length) return null;
  let rows = index.slice().sort((a, b) => a.id - b.id);
  if (rows.length > n) rows = rows.slice(0, n);
  if (rows.length < n) return null;
  return rows.map((b, i) => ({ ...b, id: i + 1 }));
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

export function extractPagesFromHTML(htmlText) {
  const raw = String(htmlText || "");
  if (typeof DOMParser === "undefined") {
    if (typeof window !== "undefined") {
      window.extractedPages = [];
      window.totalPages = 0;
    }
    return [];
  }
  const doc = new DOMParser().parseFromString(raw, "text/html");
  const pageDivs = doc.querySelectorAll("div.pf");
  const pages = Array.from(pageDivs).map((pageDiv, i) => {
    const text = String(pageDiv.innerText || pageDiv.textContent || "");
    const cleanText = text
      .replace(/\[IMAGEN ELIMINADA\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { pageNum: i + 1, text: cleanText };
  });
  if (typeof window !== "undefined") {
    window.extractedPages = pages;
    window.totalPages = pages.length;
  }
  return pages;
}

export function getChunkForPageRange(pages, startPage, endPage) {
  const safePages = Array.isArray(pages) ? pages : [];
  const start = Math.max(1, Math.floor(Number(startPage) || 1));
  const end = Math.max(start, Math.floor(Number(endPage) || start));
  return safePages
    .filter((p) => {
      const pageNum = Number(p?.pageNum);
      return Number.isFinite(pageNum) && pageNum >= start && pageNum <= end;
    })
    .map((p) => String(p?.text || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

export function estimateBlockPageRange(blockIndex, totalPages) {
  const safeBlocks = Array.isArray(blockIndex) ? blockIndex : [];
  const pages = Math.max(0, Math.floor(Number(totalPages) || 0));
  if (!safeBlocks.length || !pages) return safeBlocks.map((block) => ({ ...block }));
  const pagesPerBlock = pages / safeBlocks.length;
  return safeBlocks.map((block, i) => ({
    ...block,
    startPage: Math.floor(i * pagesPerBlock) + 1,
    endPage: Math.floor((i + 1) * pagesPerBlock),
  }));
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

/** Trim block index to pack_meta.final_block_count; renumber 1..M. No padding if fewer blocks. */
export function applyPackMetaCount(index, packMeta) {
  if (!Array.isArray(index) || !index.length) return index;
  const finalCount = Math.floor(Number(packMeta?.final_block_count));
  if (!Number.isFinite(finalCount) || finalCount <= 0) return index;
  const sorted = index.slice().sort((a, b) => Number(a.id) - Number(b.id));
  if (sorted.length <= finalCount) return sorted;
  return sorted.slice(0, finalCount).map((b, i) => ({ ...b, id: i + 1 }));
}

export function normalizeSignatureTerms(signature) {
  const raw = Array.isArray(signature)
    ? signature
    : String(signature || "")
        .split(/[,\n;]/g)
        .map((t) => String(t || "").trim())
        .filter(Boolean);
  const out = new Set();
  for (const term of raw) {
    const n = String(term || "").trim().toLowerCase();
    if (n) out.add(n);
  }
  return out;
}

export function signatureOverlapCount(sigA, sigB) {
  const a = normalizeSignatureTerms(sigA);
  const b = normalizeSignatureTerms(sigB);
  let count = 0;
  for (const t of a) {
    if (b.has(t)) count += 1;
  }
  return count;
}

export function normalizeBlockTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/^key terms:\s*/i, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isOverviewBlockEntry(block) {
  const id = Number(block?.id);
  const title = String(block?.title || "").trim();
  return id === 1 || /^(overview|mapa del curso|course map)/i.test(title);
}

function isKeyTermsBlockEntry(block) {
  return /^key terms:/i.test(String(block?.title || "").trim());
}

function shouldSkipDedupPair(blockA, blockB) {
  const aOverview = isOverviewBlockEntry(blockA);
  const bOverview = isOverviewBlockEntry(blockB);
  const aKey = isKeyTermsBlockEntry(blockA);
  const bKey = isKeyTermsBlockEntry(blockB);
  if ((aOverview && bKey) || (bOverview && aKey)) {
    return normalizeBlockTitle(blockA.title) !== normalizeBlockTitle(blockB.title);
  }
  return false;
}

/** @returns {import('./session.js').DedupMergeRecord[]} */
export function findDeterministicDuplicateMerges(blockIndex) {
  const safe = Array.isArray(blockIndex) ? blockIndex.slice() : [];
  safe.sort((a, b) => Number(a.id) - Number(b.id));
  const plans = [];
  const scheduledAbsorb = new Set();
  const keepAbsorbing = new Set();

  for (let i = 0; i < safe.length; i += 1) {
    const blockI = safe[i];
    const idI = Number(blockI.id);
    if (scheduledAbsorb.has(idI)) continue;

    for (let j = i + 1; j < safe.length; j += 1) {
      const blockJ = safe[j];
      const idJ = Number(blockJ.id);
      if (scheduledAbsorb.has(idJ)) continue;
      if (shouldSkipDedupPair(blockI, blockJ)) continue;

      const titleI = normalizeBlockTitle(blockI.title);
      const titleJ = normalizeBlockTitle(blockJ.title);
      let reason = null;
      let overlap_terms = [];

      if (titleI && titleI === titleJ) {
        reason = "title_duplicate";
      } else {
        const sigI = normalizeSignatureTerms(blockI.signature);
        const sigJ = normalizeSignatureTerms(blockJ.signature);
        overlap_terms = [...sigI].filter((t) => sigJ.has(t));
        if (overlap_terms.length >= 3) reason = "signature_overlap";
      }

      if (!reason) continue;
      if (keepAbsorbing.has(idI)) continue;

      plans.push({
        keep_id: idI,
        absorb_ids: [idJ],
        reason,
        overlap_terms,
      });
      scheduledAbsorb.add(idJ);
      keepAbsorbing.add(idI);
      break;
    }
  }

  return plans;
}

export async function applyDeterministicDedup(blockIndex, { llmModel, apiKey: _legacyApiKey } = {}) {
  const original = Array.isArray(blockIndex) ? blockIndex.slice() : [];
  const plans = findDeterministicDuplicateMerges(original);
  if (!plans.length) {
    return {
      blockIndex: renumberBlockIndexSequential(original),
      dedup_merges: [],
      merged_count: 0,
    };
  }

  const byId = new Map(original.map((b) => [Number(b.id), b]));
  const removed = new Set();
  const dedup_merges = [];

  for (const plan of plans) {
    const keepId = Number(plan.keep_id);
    if (removed.has(keepId)) continue;
    const keep = byId.get(keepId);
    if (!keep) continue;

    const absorbIds = Array.isArray(plan.absorb_ids) ? plan.absorb_ids : [];
    const absorbs = [];
    for (const aid of absorbIds) {
      const id = Number(aid);
      if (!Number.isFinite(id) || id <= 0 || id === keepId) continue;
      if (removed.has(id)) continue;
      const b = byId.get(id);
      if (b) absorbs.push(b);
    }
    if (!absorbs.length) continue;

    const mergedChunk = await mergeChunks(
      {
        keepBlock: keep,
        absorbBlocks: absorbs,
        keep_id: keepId,
        absorb_ids: absorbs.map((b) => Number(b.id)),
        new_title: String(keep.title || "").trim(),
      },
      { llmModel },
    );

    byId.set(keepId, { ...keep, chunk: mergedChunk });
    for (const b of absorbs) removed.add(Number(b.id));
    dedup_merges.push({
      keep_id: keepId,
      absorb_ids: absorbs.map((b) => Number(b.id)),
      reason: plan.reason,
      overlap_terms: plan.overlap_terms || [],
    });
  }

  const remaining = Array.from(byId.values()).filter((b) => !removed.has(Number(b.id)));
  const merged_count = dedup_merges.reduce((acc, m) => acc + (m.absorb_ids?.length || 0), 0);
  return {
    blockIndex: renumberBlockIndexSequential(remaining),
    dedup_merges,
    merged_count,
  };
}

/** UI copy for split summary (study.js + cursor-tests). */
export function describeSplitRunMetaForUi(splitRunMeta) {
  const meta = splitRunMeta && typeof splitRunMeta === "object" ? splitRunMeta : null;
  const requested_n = Number(meta?.requested_n ?? meta?.original_n);
  const final_n = Number(meta?.final_n);
  const dedup_merged_count = Number(meta?.dedup_merged_count ?? meta?.merged_count ?? 0);
  const pipeline = String(meta?.pipeline || "").trim();

  if (!Number.isFinite(final_n) || final_n <= 0) {
    return { hidden: true, headline: "", dedupLine: "", detailRows: [] };
  }

  const headlineParts = [];
  if (Number.isFinite(requested_n) && final_n < requested_n) {
    headlineParts.push(`Pediste ${requested_n}; el material sustentó ${final_n} bloques.`);
  } else {
    headlineParts.push(`Split complete: ${final_n} blocks.`);
  }
  if (pipeline === "fallback_mono") {
    headlineParts.push("Usando split clásico (fallback).");
  }

  const dedupLine =
    Number.isFinite(dedup_merged_count) && dedup_merged_count > 0
      ? `Dedup: ${dedup_merged_count} bloques fusionados por firmas duplicadas`
      : "";

  const dedupMerges = Array.isArray(meta?.dedup_merges) ? meta.dedup_merges : [];
  const legacyMerges = Array.isArray(meta?.merges) ? meta.merges : [];
  const detailRows = dedupMerges.length
    ? dedupMerges.map((row) => ({
        keep_id: Number(row?.keep_id),
        absorb_ids: Array.isArray(row?.absorb_ids) ? row.absorb_ids : [],
        reason: String(row?.reason || "").trim(),
        overlap_terms: Array.isArray(row?.overlap_terms) ? row.overlap_terms : [],
        legacy: false,
      }))
    : legacyMerges.map((row) => ({
        keep_id: Number(row?.keep_id),
        absorb_ids: Array.isArray(row?.absorb_ids) ? row.absorb_ids : [],
        reason: String(row?.reason || "").trim(),
        keep_title_before: String(row?.keep_title_before || "").trim(),
        keep_title_after: String(row?.keep_title_after || "").trim(),
        absorb_titles: Array.isArray(row?.absorb_titles) ? row.absorb_titles : [],
        legacy: true,
      }));

  return {
    hidden: false,
    headline: headlineParts.join(" "),
    dedupLine,
    detailRows,
  };
}

export async function twoPhaseConceptSplit(
  material,
  nBlocks,
  { llmModel, studyNotes, language, onProgress } = {},
) {
  const requested_n = Math.max(1, Math.floor(Number(nBlocks) || 1));
  const lang = String(language || getStudyLanguage?.() || "English").trim() || "English";
  const materialText = String(material || "").trim();
  const model = llmModel ?? state.pendingLlmModel ?? getActiveSessionLlmModel();
  const notes = String(studyNotes ?? state.studyNotes ?? "").trim();
  const progress = (msg) => {
    if (typeof onProgress === "function" && msg) onProgress(String(msg));
  };

  const runFallback = async () => {
    progress("Usando split clásico (fallback)…");
    const { deepSeekSplitIntoBlocks } = await import("./api.js?v=20260525_1");
    const parsed = await deepSeekSplitIntoBlocks({
      llmModel: model,
      nBlocks: requested_n,
      materialText,
      studyNotes: notes,
      language: lang,
    });
    let normalized = normalizeBlockIndexArray(parsed, { requireChunk: false, lenient: true });
    if (!normalized?.length) throw new Error("Fallback block split returned no blocks.");
    const chunks = splitMaterialIntoBlockChunks(materialText, normalized.length);
    const blockIndex = normalized.map((b, i) => ({
      ...b,
      chunk: chunks[i] || "",
    }));
    return {
      blockIndex,
      splitRunMeta: {
        requested_n,
        final_n: blockIndex.length,
        pipeline: "fallback_mono",
      },
    };
  };

  try {
    const {
      deepSeekConceptInventory,
      deepSeekPackConceptsToBlocks,
    } = await import("./api.js?v=20260525_1");

    progress("Inventariando conceptos…");
    const inventory = await deepSeekConceptInventory({
      llmModel: model,
      materialText,
      studyNotes: notes,
      language: lang,
    });
    const concept_count = inventory.length;

    progress(`Empaquetando ${requested_n} bloques…`);
    const { blocks, pack_meta } = await deepSeekPackConceptsToBlocks({
      llmModel: model,
      inventory,
      nBlocks: requested_n,
      studyNotes: notes,
      language: lang,
    });

    let normalized = normalizeBlockIndexArray(blocks, { requireChunk: false, lenient: true });
    if (!normalized?.length) throw new Error("Pack returned no normalizable blocks.");

    normalized = applyPackMetaCount(normalized, pack_meta);
    const finalCount = normalized.length;
    const chunks = splitMaterialIntoBlockChunks(materialText, finalCount);
    let blockIndex = normalized.map((b, i) => ({
      ...b,
      chunk: chunks[i] || "",
    }));

    progress("Comprobando duplicados…");
    const dedupResult = await applyDeterministicDedup(blockIndex, { llmModel: model });

    return {
      blockIndex: dedupResult.blockIndex,
      splitRunMeta: {
        requested_n,
        final_n: dedupResult.blockIndex.length,
        pipeline: "two_phase",
        concept_count,
        pack_meta,
        dedup_merges: dedupResult.dedup_merges,
        dedup_merged_count: dedupResult.merged_count,
      },
    };
  } catch (err) {
    console.warn("twoPhaseConceptSplit: falling back to mono split", err?.message || err);
    return runFallback();
  }
}

export async function auditBlockIndex(blockIndex, { llmModel, apiKey: _legacyApiKey, language } = {}) {
  const model = llmModel ?? state.pendingLlmModel ?? getActiveSessionLlmModel();
  assertLlmKeyPresent(model);
  const lang = String(language || "English").trim() || "English";

  const payload = buildAuditPayload(blockIndex);
  const { deepSeekAuditBlockIndex } = await import("./api.js?v=20260525_1");
  const text = await deepSeekAuditBlockIndex({
    llmModel: model,
    blockIndexJson: payload,
    language: lang,
  });

  const parsed = safeParseJson(text);
  return normalizeAuditResult(parsed);
}

export async function mergeChunks(
  { keepBlock, absorbBlocks, keep_id, absorb_ids, new_title },
  { llmModel, apiKey: _legacyApiKey } = {},
) {
  const model = llmModel ?? state.pendingLlmModel ?? getActiveSessionLlmModel();
  assertLlmKeyPresent(model);
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

  const blockCount = 1 + absorbs.length;
  const { deepSeekPostMergeChunk } = await import("./api.js?v=20260525_1");
  const mergedChunk = await deepSeekPostMergeChunk({
    llmModel: model,
    keep_id,
    absorb_ids,
    new_title,
    concatenated_chunks,
    block_count: blockCount,
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

export async function twoPhaseSplitMerge(blockIndex, { llmModel, apiKey: _legacyApiKey, language } = {}) {
  const original = Array.isArray(blockIndex) ? blockIndex.slice() : [];
  const originalN = original.length;
  if (!originalN) {
    return {
      blockIndex: [],
      auditResult: { merges: [], no_change: [] },
      mergeInfo: { original_n: 0, final_n: 0, merged_count: 0, merges: [] },
    };
  }

  const auditResult = await auditBlockIndex(original, { llmModel, language });
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
      { llmModel },
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
  const defaults = loadDefaultQuestionConfig();
  return {
    n_blocks: n,
    n_test: defaults.n_test,
    n_socratic: defaults.n_socratic,
    blocks_list_text: String(blocksListText || ""),
    current_block_index: 0,
    active_question_index: 0,
    blocks: Array.from({ length: n }, () => ({
      _config: {
        n_test: defaults.n_test,
        n_socratic: defaults.n_socratic,
        explanation_profile: "thorough",
        gap_focus: [],
      },
    })),
  };
}

export function applyAssessmentResults(assessmentResults) {
  const skipped = Boolean(
    assessmentResults?.skipped === true || (window?.assessmentConfig && window.assessmentConfig.skipped),
  );
  if (skipped) {
    return { skipped: true, adjusted: false, strongBlocks: [], weakBlocks: [] };
  }

  const sessionObj = loadActiveSession();
  if (!sessionObj || typeof sessionObj !== "object") throw new Error("No active session found.");

  const blocks = Array.isArray(sessionObj.blocks) ? sessionObj.blocks : [];
  const blockIndex = loadBlockIndex() || [];
  const perBlock =
    assessmentResults?.perBlock && typeof assessmentResults.perBlock === "object"
      ? assessmentResults.perBlock
      : {};
  const gapsByBlock = normalizeGapsByBlock(
    assessmentResults?.gapsByBlock ?? assessmentResults?.gaps_by_block ?? {},
  );
  const gapsSource = normalizeGapsSource(
    assessmentResults?.gapsSource ?? assessmentResults?.gaps_source,
    Object.keys(gapsByBlock).length ? "synthesis" : "none",
  );
  const synthesisStatus = normalizeSynthesisStatus(
    assessmentResults?.synthesisStatus ?? assessmentResults?.synthesis_status,
    "ok",
  );
  const sessionDefaults = {
    n_test: clampInt(sessionObj.n_test, 0, 5, 2),
    n_socratic: clampInt(sessionObj.n_socratic, 0, 3, 1),
    explanation_profile: "thorough",
    gap_focus: [],
  };

  const strongBlocks = [];
  const weakBlocks = [];
  let adjusted = false;

  for (let i = 0; i < blocks.length; i += 1) {
    const blk = blocks[i] && typeof blocks[i] === "object" ? blocks[i] : {};
    const blockId = Number(blockIndex[i]?.id || i + 1);
    const classification = String(perBlock[String(blockId)]?.classification || "").trim();
    const gap_focus = gapLabelsForBlock(gapsByBlock, blockId);

    if (classification === "strong") {
      blk._config = {
        n_test: 1,
        n_socratic: 0,
        explanation_profile: "brief_deep",
        gap_focus: [],
      };
      strongBlocks.push(blockId);
      adjusted = true;
    } else if (classification === "weak") {
      const bumped = {
        n_test: sessionDefaults.n_test,
        n_socratic: Math.min(3, sessionDefaults.n_socratic + 1),
      };
      const budget = adjustQuestionBudgetForGaps(bumped.n_test, bumped.n_socratic, gap_focus.length);
      blk._config = {
        n_test: budget.n_test,
        n_socratic: budget.n_socratic,
        explanation_profile: "thorough",
        gap_focus,
      };
      weakBlocks.push(blockId);
      adjusted = true;
    } else {
      blk._config = {
        n_test: sessionDefaults.n_test,
        n_socratic: sessionDefaults.n_socratic,
        explanation_profile: "thorough",
        gap_focus,
      };
    }
    blocks[i] = blk;
  }

  if (!sessionObj._meta || typeof sessionObj._meta !== "object") sessionObj._meta = {};
  const maxQuestions = Math.max(1, Math.floor(Number(assessmentResults?.maxQuestions) || 0));
  const penalisedTotal = Number(assessmentResults?.penalisedTotal || 0);
  const rawTotal = Number(assessmentResults?.rawTotal || 0);
  const pct = maxQuestions > 0 ? (penalisedTotal / maxQuestions) * 100 : 0;
  sessionObj._meta.assessment = {
    penalised_total: penalisedTotal,
    raw_total: rawTotal,
    max_questions: maxQuestions,
    pct,
    strong_blocks: strongBlocks,
    weak_blocks: weakBlocks,
    config_adjustments_applied: adjusted,
    gaps_by_block: gapsByBlock,
    gaps_source: gapsSource,
    synthesis_status: synthesisStatus,
  };

  sessionObj.blocks = blocks;
  storeActiveSession(sessionObj, { bumpRev: true });
  state.activeSession = sessionObj;
  invalidatePrefetch();

  return { skipped: false, adjusted, strongBlocks, weakBlocks, session: sessionObj };
}

/** Stable key for prefetch cache — includes pedagogical profile (research R3). */
export function buildBlockConfigKey(cfg) {
  const c = cfg && typeof cfg === "object" ? cfg : {};
  const nTest = clampInt(c.n_test, 0, 5, 2);
  const nSoc = clampInt(c.n_socratic, 0, 3, 1);
  const profile = normalizeExplanationProfile(c.explanation_profile, "thorough");
  const gaps = normalizeGapFocus(c.gap_focus);
  return `${nTest}|${nSoc}|${profile}|${gaps.join(",")}`;
}

export function hasGeneratedBlockContent(block) {
  if (!block || typeof block !== "object") return false;
  if (String(block.explanation || "").trim()) return true;
  const questions = Array.isArray(block.questions) ? block.questions : [];
  return questions.length > 0;
}

export function normalizeBlockJson(data, cfg, blockIndex) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  const c = cfg && typeof cfg === "object" ? cfg : {};
  const blockTitle = getBlockTitleFromList(idx);
  const cleaned =
    data && typeof data === "object"
      ? { ...data }
      : { id: idx + 1, title: blockTitle, explanation: "", questions: [] };
  if (cleaned.id == null) cleaned.id = idx + 1;
  if (!cleaned.title) cleaned.title = blockTitle;
  if (!cleaned.explanation) cleaned.explanation = "";
  if (!Array.isArray(cleaned.questions)) cleaned.questions = [];
  if (!Array.isArray(cleaned.concepts)) cleaned.concepts = [];
  if (!cleaned._config || typeof cleaned._config !== "object") cleaned._config = {};
  cleaned._config.n_test = clampInt(c.n_test, 0, 5, 2);
  cleaned._config.n_socratic = clampInt(c.n_socratic, 0, 3, 1);
  cleaned._config.explanation_profile = normalizeExplanationProfile(
    c.explanation_profile,
    "thorough",
  );
  cleaned._config.gap_focus = normalizeGapFocus(c.gap_focus);
  return cleaned;
}

let onPrefetchReady = null;

export function setOnPrefetchReady(fn) {
  onPrefetchReady = typeof fn === "function" ? fn : null;
}

export function applyPrefetchReadySideEffects(blockIndex, data, cfg) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  if (!state.activeSession || typeof state.activeSession !== "object") return;

  const normalized = normalizeBlockJson(data, cfg, idx);

  try {
    if (!Array.isArray(state.activeSession.blocks)) {
      state.activeSession.blocks = [];
    }
    while (state.activeSession.blocks.length <= idx) {
      state.activeSession.blocks.push({});
    }
    state.activeSession.blocks[idx] = normalized;
    storeActiveSession(state.activeSession, { bumpRev: true });
  } catch (err) {
    console.warn("applyPrefetchReadySideEffects: session write-through failed", err);
  }

  try {
    syncConceptsFromBlock(idx, normalized.concepts);
  } catch (err) {
    console.warn("applyPrefetchReadySideEffects: concepts_by_block update failed", err);
  }

  if (typeof onPrefetchReady === "function") {
    try {
      onPrefetchReady({ blockIndex: idx });
    } catch (err) {
      console.warn("applyPrefetchReadySideEffects: onPrefetchReady failed", err);
    }
  }
}

export function invalidatePrefetch() {
  prefetchState = {
    blockIndex: null,
    status: "idle",
    data: null,
    error: null,
    configKey: "",
  };
}

export let prefetchState = {
  blockIndex: null,
  status: "idle", // idle | generating | ready | failed
  data: null, // generated block JSON when ready
  error: null,
  configKey: "",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function triggerPrefetch(blockIndex, opts = {}) {
  if (isOfflineMode()) return;
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  const resolved = resolveBlockQuestionConfig(idx);
  const cfg = {
    n_test: clampInt(opts.n_test, 0, 5, resolved.n_test),
    n_socratic: clampInt(opts.n_socratic, 0, 3, resolved.n_socratic),
    explanation_profile:
      opts.explanation_profile != null
        ? normalizeExplanationProfile(opts.explanation_profile, resolved.explanation_profile)
        : resolved.explanation_profile,
    gap_focus: opts.gap_focus != null ? normalizeGapFocus(opts.gap_focus) : resolved.gap_focus,
  };
  const configKey = buildBlockConfigKey(cfg);
  const force = Boolean(opts.force);

  const alreadyGeneratingSame =
    prefetchState.status === "generating" &&
    prefetchState.blockIndex === idx &&
    prefetchState.configKey === configKey;
  if (alreadyGeneratingSame && !force) return;

  const alreadyReadySame =
    prefetchState.status === "ready" &&
    prefetchState.blockIndex === idx &&
    prefetchState.configKey === configKey;
  if (alreadyReadySame && !force) return;

  prefetchState = {
    blockIndex: idx,
    status: "generating",
    data: null,
    error: null,
    configKey,
  };

  void generateBlockForIndex(idx, cfg)
    .then((result) => {
      if (prefetchState.blockIndex !== idx) return;
      if (prefetchState.configKey !== configKey) return;
      applyPrefetchReadySideEffects(idx, result, cfg);
      prefetchState.status = "ready";
      prefetchState.data = result;
    })
    .catch((err) => {
      if (prefetchState.blockIndex !== idx) return;
      if (prefetchState.configKey !== configKey) return;
      prefetchState.status = "failed";
      prefetchState.error = err;
    });
}

export async function getPrefetchedBlock(blockIndex, { configKey } = {}) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  if (isOfflineMode()) {
    const block = getBlock(idx);
    if (!block) throw new Error("Missing offline block.");
    return block;
  }
  const wantKey = configKey != null ? String(configKey) : null;

  if (
    prefetchState.blockIndex === idx &&
    prefetchState.status === "ready" &&
    (wantKey == null || prefetchState.configKey === wantKey)
  ) {
    const data = prefetchState.data;
    prefetchState = { blockIndex: null, status: "idle", data: null, error: null, configKey: "" };
    return data;
  }

  const delays = [250, 500, 1000, 2000, 4000];
  const startedAt = Date.now();
  let delayIndex = 0;

  while (Date.now() - startedAt < 30_000) {
    if (prefetchState.blockIndex === idx && (wantKey == null || prefetchState.configKey === wantKey)) {
      if (prefetchState.status === "ready") {
        const data = prefetchState.data;
        prefetchState = { blockIndex: null, status: "idle", data: null, error: null, configKey: "" };
        return data;
      }
      if (prefetchState.status === "failed") {
        const err = prefetchState.error;
        prefetchState = { blockIndex: null, status: "idle", data: null, error: null, configKey: "" };
        throw err instanceof Error ? err : new Error(String(err));
      }
    }

    const d = delays[Math.min(delayIndex, delays.length - 1)];
    delayIndex += 1;
    await sleep(d);
  }

  throw new Error("Block generation timed out");
}

