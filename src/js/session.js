import {
  LS_ACTIVE_SESSION_KEY,
  LS_BLOCK_INDEX_KEY,
  LS_SESSION_DEFAULT_Q_CONFIG_KEY,
  LS_SESSION_CONCEPTS_KEY,
  LS_SESSIONS_BY_MODE_KEY,
  MAX_N_TEST,
} from "./config.js?v=20260625_02";
import {
  getActiveSession as getActiveDocumentSession,
  saveActiveSession as saveDocumentSession,
} from "./session-store.js";
import { writeThroughModeSlice } from "./block-store.js";
import { syncConceptsFromBlock } from "./dictionary.js?v=20260625_02";
import {
  deepSeekGenerateBlockBridge,
  deepSeekGenerateBlockJson,
  deepSeekRegenerateBlockQuestions,
  generateBlockFromChunk,
  mapBlocksToPages,
  warnQuestionsOnlyCountMismatch,
} from "./api.js?v=20260625_02";
import { assignAlignedChunksSequential } from "./chunk-alignment.js";
import { annotateBlocksWithSourceFileIds } from "./source-provenance.js";
import {
  annotateBlockIndexEntry,
  buildQuestionScopeContext,
  computeEstimatedConceptTarget,
  extractClaimsFromQuestions,
  appendCoverageClaims,
  initPipelineLevers,
  isZeroQuestionBlockTitle,
  replaceCoverageForBlock,
  findSemanticDuplicatePairs,
} from "./pipeline-levers.js";
import { extractSneakPeek } from "./sneakPeek.js?v=20260625_02";
import {
  assertLlmKeyPresent,
  getActiveSessionLlmModel,
  getSessionLlmModel,
} from "./llm.js?v=20260625_02";
import { enforceExplanationParagraphs, buildParagraphFormatOpts } from "./explanationParagraphs.js?v=20260625_02";
import { shuffleTestQuestionsInList } from "./shuffle-options.js?v=20260625_02";
import { getStudyLanguage } from "./ui.js?v=20260625_02";
import { isOfflineMode } from "./offline.js?v=20260625_02";
import { migrateLegacyHtmlMinSession } from "./normalization/migrate-html-min.js";
import { applyNoveltyPackingBias } from "./pedagogy/novelty-packing.js";
import {
  blockIsThreshold,
  mergeThresholdBlockConfig,
  sortBlockIndexForThresholds,
} from "./pedagogy/threshold-concepts.js";
import { buildFactualBlockQuestions } from "./pedagogy/factual-block-questions.js";
import {
  isDeterministicFactualQuestionsEnabled,
  isThresholdConceptsEnabled,
  MIN_CONCEPTS_ABSOLUTE,
  MIN_CHARS_PER_CONCEPT,
  minViableConcepts,
  DPP_STALE_TIMEOUT_MS,
  DPP_PENDING_GRACE_MS,
} from "./config/flags.js";
import { normalizePreparationState, setPreparationStatus, isTier1PreparationComplete } from "./session-types.js";
import { isDppRunActiveOnDevice } from "./dpp-persistence.js";

/**
 * Call sites patched for DPP recalculation guard (20260622-fix-dpp-recalculation-guard):
 * - document-preparation.js runPhaseT12
 * - study.js enterModeSelectAfterTier1Gate, startDocumentPreparation
 * - study.js recommendBlockCount, generate-blocks submit
 * - mode-bootstrap.js resolveModeEntryState
 */
export {
  computeInventoryHash,
  createEmptyRecallSlice,
  normalizeRecallSlice,
} from "./recall-slice.js";

export const state = {
  studyMode: null,
  originalMaterialText: "",
  studyNotes: "",
  nTest: 2,
  nSocratic: 1,
  includeConnectionQuestions: true,
  sourceFidelityStrict: false,
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
  blockSplitCache: null,
  materialBootstrapActive: false,
};

export function clampInt(n, min, max, fallback) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

export function loadDefaultQuestionConfig() {
  try {
    const raw = localStorage.getItem(LS_SESSION_DEFAULT_Q_CONFIG_KEY);
    const obj = raw ? JSON.parse(raw) : null;
    const n_test = clampInt(obj?.n_test, 0, MAX_N_TEST, 2);
    const n_socratic = clampInt(obj?.n_socratic, 0, 3, 1);
    return { n_test, n_socratic };
  } catch {
    return { n_test: 2, n_socratic: 1 };
  }
}

export function storeDefaultQuestionConfig({ n_test, n_socratic }) {
  try {
    const safe = {
      n_test: clampInt(n_test, 0, MAX_N_TEST, 2),
      n_socratic: clampInt(n_socratic, 0, 3, 1),
    };
    localStorage.setItem(LS_SESSION_DEFAULT_Q_CONFIG_KEY, JSON.stringify(safe));
  } catch {
    // ignore
  }
}

const EXPLANATION_PROFILES = new Set(["thorough", "brief_deep", "relational_compressed", "threshold_expanded"]);
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
          ? String(item.label || item.concept_id || "").trim()
          : "";
    if (!label) continue;
    if (out.some((entry) => (typeof entry === "string" ? entry : entry?.concept_id || entry?.label) === label)) {
      continue;
    }
    if (item && typeof item === "object" && (item.concept_id || item.reason)) {
      out.push({
        concept_id: String(item.concept_id || label).trim(),
        ...(item.reason ? { reason: String(item.reason).trim() } : {}),
        label,
      });
    } else {
      out.push(label);
    }
    if (out.length >= 8) break;
  }
  return out;
}

export { mapKnowledgeProfileToBlockConfig, applyKnowledgeProfileToBlockIndex } from "./block-profile-config.js";

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
export function adjustQuestionBudgetForGaps(
  n_test,
  n_socratic,
  gapCount,
  reserveConnectionSlot = false,
) {
  const gaps = Math.max(0, Math.floor(Number(gapCount) || 0));
  let nt = clampInt(n_test, 0, MAX_N_TEST, 0);
  let ns = clampInt(n_socratic, 0, 3, 0);
  const reservedConnectionSlot = reserveConnectionSlot ? 1 : 0;
  const availableForGaps = Math.max(0, nt + ns - reservedConnectionSlot);
  if (gaps <= availableForGaps) return { n_test: nt, n_socratic: ns };

  const targetTotal = Math.min(8, gaps + reservedConnectionSlot);

  // Prefer test questions for breadth; socratic is capped at 3 by UI/prompt contract.
  nt = Math.min(MAX_N_TEST, Math.max(nt, Math.ceil(targetTotal * 0.6)));
  ns = targetTotal - nt;
  if (ns > 3) {
    ns = 3;
    nt = targetTotal - ns;
  }
  if (ns < 0) {
    ns = 0;
    nt = targetTotal;
  }

  // Final safety cap.
  while (nt + ns > 8 && ns > 0) ns -= 1;
  while (nt + ns > 8 && nt > 0) nt -= 1;
  return { n_test: nt, n_socratic: ns };
}

function resolveBlockTitleForConfig(blockIndex) {
  const session = state.activeSession && typeof state.activeSession === "object" ? state.activeSession : {};
  const blocks = Array.isArray(session.blocks) ? session.blocks : [];
  const b = blocks[blockIndex];
  const fromBlock = b && typeof b === "object" ? String(b.title || "").trim() : "";
  if (fromBlock) return fromBlock;
  const indexEntry = getBlockIndexEntry(blockIndex);
  return indexEntry ? String(indexEntry.title || "").trim() : getBlockTitleFromList(blockIndex);
}

export function resolveBlockQuestionConfig(blockIndex) {
  const session = state.activeSession && typeof state.activeSession === "object" ? state.activeSession : {};
  const defaults = {
    n_test: clampInt(session.n_test, 0, MAX_N_TEST, clampInt(state.nTest, 0, MAX_N_TEST, 2)),
    n_socratic: clampInt(session.n_socratic, 0, 3, clampInt(state.nSocratic, 0, 3, 1)),
    explanation_profile: "thorough",
    gap_focus: [],
    include_connection_questions: session.include_connection_questions !== false,
  };

  const blockTitle = resolveBlockTitleForConfig(blockIndex);
  if (isZeroQuestionBlockTitle(blockTitle)) {
    return {
      n_test: 0,
      n_socratic: 0,
      explanation_profile: defaults.explanation_profile,
      gap_focus: [],
      include_connection_questions: false,
    };
  }

  const blocks = Array.isArray(session.blocks) ? session.blocks : [];
  const b = blocks[blockIndex];
  const cfg = b && typeof b === "object" && b._config && typeof b._config === "object" ? b._config : null;
  const base = !cfg
    ? defaults
    : {
        n_test: clampInt(cfg.n_test, 0, MAX_N_TEST, defaults.n_test),
        n_socratic: clampInt(cfg.n_socratic, 0, 3, defaults.n_socratic),
        explanation_profile: normalizeExplanationProfile(cfg.explanation_profile, defaults.explanation_profile),
        gap_focus: normalizeGapFocus(cfg.gap_focus),
        include_connection_questions:
          cfg.include_connection_questions != null
            ? Boolean(cfg.include_connection_questions)
            : defaults.include_connection_questions,
        ...(Number.isFinite(Number(cfg.rsvp_wpm_cap)) ? { rsvp_wpm_cap: Number(cfg.rsvp_wpm_cap) } : {}),
      };

  if (isThresholdConceptsEnabled()) {
    const inv = resolveSessionConceptInventory(session);
    const entry = getBlockIndexEntry(blockIndex);
    if (blockIsThreshold(entry, inv)) {
      return mergeThresholdBlockConfig(base, true);
    }
  }
  return base;
}

export { buildQuestionScopeContext };

export function ensureSessionCoverageManifest(session) {
  if (!session || typeof session !== "object") return [];
  if (!session._meta || typeof session._meta !== "object") session._meta = {};
  if (!Array.isArray(session._meta.coverageManifest)) session._meta.coverageManifest = [];
  return session._meta.coverageManifest;
}

export function ensureSessionPipelineLevers(session, strictMode = false) {
  if (!session || typeof session !== "object") return initPipelineLevers(strictMode);
  if (!session._meta || typeof session._meta !== "object") session._meta = {};
  session._meta.pipelineLevers = initPipelineLevers(
    strictMode,
    session._meta.pipelineLevers,
  );
  return session._meta.pipelineLevers;
}

export function updateCoverageManifestAfterBlock(blockIndex, questions) {
  const session = state.activeSession;
  if (!session || typeof session !== "object") return;
  const blockId = blockIndex + 1;
  const claims = extractClaimsFromQuestions(blockId, questions);
  ensureSessionCoverageManifest(session);
  session._meta.coverageManifest = replaceCoverageForBlock(
    session._meta.coverageManifest,
    blockId,
    claims,
  );
}

export { appendCoverageClaims, replaceCoverageForBlock, extractClaimsFromQuestions };

function newSessionId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** @returns {'rsvp'|'slow'|'cloze'|'questions'|'recall'} */
export function normalizeStudyMode(mode) {
  const m = String(mode || "").trim();
  if (m === "slow") return "slow";
  if (m === "cloze") return "cloze";
  if (m === "questions") return "questions";
  if (m === "recall") return "recall";
  return "rsvp";
}

export function isQuestionsStudyMode(sessionOrMode) {
  const raw =
    typeof sessionOrMode === "string"
      ? sessionOrMode
      : sessionOrMode?.studyMode != null
        ? sessionOrMode.studyMode
        : state.studyMode;
  return normalizeStudyMode(raw) === "questions";
}

export function emptySessionsByMode() {
  return { rsvp: null, slow: null, cloze: null, questions: null, recall: null };
}

export function parseSessionsByModeRaw(raw) {
  if (!raw || !String(raw).trim()) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return {
      rsvp: obj.rsvp && typeof obj.rsvp === "object" ? obj.rsvp : null,
      slow: obj.slow && typeof obj.slow === "object" ? obj.slow : null,
      cloze: obj.cloze && typeof obj.cloze === "object" ? obj.cloze : null,
      questions: obj.questions && typeof obj.questions === "object" ? obj.questions : null,
      recall: obj.recall && typeof obj.recall === "object" ? obj.recall : null,
    };
  } catch {
    return null;
  }
}

/** One-time migration: legacy `active_session` ? `sessions_by_mode.rsvp`. Idempotent. */
export function migrateLegacyActiveSession() {
  const existingRaw = localStorage.getItem(LS_SESSIONS_BY_MODE_KEY);
  if (existingRaw && existingRaw.trim()) return;

  const legacyRaw = localStorage.getItem(LS_ACTIVE_SESSION_KEY);
  if (!legacyRaw || !legacyRaw.trim()) return;

  try {
    const legacy = JSON.parse(legacyRaw);
    if (!legacy || typeof legacy !== "object") return;
    const migrated = { rsvp: legacy, slow: null, cloze: null, questions: null, recall: null };
    // One-time migration write — do not mirror RSVP slices to legacy keys elsewhere RSVP slices to legacy keys elsewhere.
    localStorage.setItem(LS_SESSIONS_BY_MODE_KEY, JSON.stringify(migrated));
  } catch {
    // ignore corrupt legacy
  }
}

function migrateLoadedSession(session) {
  if (!session || typeof session !== "object") return session;
  return migrateLegacyHtmlMinSession(session);
}

export function loadSessionsByMode() {
  migrateLegacyActiveSession();
  const parsed = parseSessionsByModeRaw(localStorage.getItem(LS_SESSIONS_BY_MODE_KEY));
  const base = parsed || emptySessionsByMode();
  return {
    rsvp: base.rsvp,
    slow: base.slow ? migrateLoadedSession(base.slow) : null,
    cloze: base.cloze ? migrateLoadedSession(base.cloze) : null,
    questions: base.questions,
    recall: base.recall,
  };
}

export function storeSessionsByMode(data) {
  const safe = {
    rsvp: data?.rsvp && typeof data.rsvp === "object" ? data.rsvp : null,
    slow: data?.slow && typeof data.slow === "object" ? data.slow : null,
    cloze: data?.cloze && typeof data.cloze === "object" ? data.cloze : null,
    questions: data?.questions && typeof data.questions === "object" ? data.questions : null,
    recall: data?.recall && typeof data.recall === "object" ? data.recall : null,
  };
  // Legacy keys are read-only outside migration — DocumentSession is the write target is the write target.
  return safe;
}

export async function loadSessionForMode(mode) {
  const slot = normalizeStudyMode(mode);
  const doc = await getActiveDocumentSession();
  if (doc?.modes) return doc.modes[slot] || null;
  const all = loadSessionsByMode();
  return all[slot] || null;
}

export async function storeSessionForMode(mode, session) {
  const slot = normalizeStudyMode(mode);
  const doc = await getActiveDocumentSession();
  if (doc?.modes) {
    if (session && typeof session === "object") {
      migrateLegacyHtmlMinSession(session);
      doc.modes[slot] = session;
    } else {
      doc.modes[slot] = null;
    }
    await saveDocumentSession(doc);
    return;
  }
  const all = loadSessionsByMode();
  if (session && typeof session === "object") {
    migrateLegacyHtmlMinSession(session);
    all[slot] = session;
  } else {
    all[slot] = null;
  }
  storeSessionsByMode(all);
}

export async function storeActiveSession(sessionObj, { bumpRev } = {}) {
  if (sessionObj && typeof sessionObj === "object") {
    if (!sessionObj._meta || typeof sessionObj._meta !== "object") {
      sessionObj._meta = {};
    }
    if (!sessionObj._meta.session_id) {
      sessionObj._meta.session_id = newSessionId();
    }
    if (bumpRev) {
      const prev = Number(sessionObj._meta.rev || 0);
      sessionObj._meta.rev = Number.isFinite(prev) && prev >= 0 ? prev + 1 : 1;
    }
    const mode = normalizeStudyMode(sessionObj.studyMode);
    if (!sessionObj.studyMode) sessionObj.studyMode = mode;
  }
  const mode =
    sessionObj && typeof sessionObj === "object"
      ? normalizeStudyMode(sessionObj.studyMode)
      : normalizeStudyMode(state.studyMode);
  await storeSessionForMode(mode, sessionObj);
}

export async function loadActiveSession() {
  migrateLegacyActiveSession();
  const mode = state.studyMode != null ? normalizeStudyMode(state.studyMode) : "rsvp";
  return await loadSessionForMode(mode);
}

export function getBlocksSafe() {
  return Array.isArray(state.activeSession?.blocks) ? state.activeSession.blocks : [];
}

export function getBlock(blockIndex) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  if (isOfflineMode()) {
    const blocks = Array.isArray(window?.offlinePack?.blocks) ? window.offlinePack.blocks : [];
    const block = blocks[idx] && typeof blocks[idx] === "object" ? blocks[idx] : null;
    return applyExplanationParagraphEnforcementToBlock(block, idx);
  }
  const blocks = getBlocksSafe();
  const block = blocks[idx] && typeof blocks[idx] === "object" ? blocks[idx] : null;
  return applyExplanationParagraphEnforcementToBlock(block, idx);
}

function applyExplanationParagraphEnforcementToBlock(block, blockIndex) {
  if (!block || typeof block !== "object") return null;
  const raw = String(block.explanation || "").trim();
  if (!raw || raw.startsWith("[Generation failed")) return block;
  const cfg = block._config && typeof block._config === "object" ? block._config : {};
  const paragraphOpts = buildParagraphFormatOpts(
    block.title || getBlockTitleFromList(blockIndex),
    cfg.explanation_profile,
  );
  const fixed = enforceExplanationParagraphs(raw, paragraphOpts);
  if (fixed === raw) return block;
  return { ...block, explanation: fixed };
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
    state.activeSession._meta.session_id = newSessionId();
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
  persistActiveRsvpSlice(state.activeSession, { bumpRev: true });
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

function resolveSessionConceptInventory(session) {
  return (
    session?.shared?.conceptInventory ||
    session?._meta?.material_graph?.conceptInventory ||
    []
  );
}

function resolveBlockConcepts(blockIndex, inventory) {
  const entry = getBlockIndexEntry(blockIndex);
  const ids = new Set(
    (Array.isArray(entry?.concept_ids) ? entry.concept_ids : [])
      .map((c) => String(c || "").trim())
      .filter(Boolean),
  );
  const inv = Array.isArray(inventory) ? inventory : [];
  if (!ids.size) return inv.filter((c) => c?.questionClass === "factual");
  return inv.filter((c) => {
    const id = String(c?.id || c?.canonicalId || "").trim();
    return ids.has(id);
  });
}

async function buildFactualQuestionsForBlock(blockIndex, cfg) {
  const session = state.activeSession;
  if (!session || !isDeterministicFactualQuestionsEnabled()) {
    return { questions: [], llmFallbackConceptIds: [], validationCallCount: 0, remainingNTest: cfg.n_test };
  }
  const inventory = resolveSessionConceptInventory(session);
  const concepts = resolveBlockConcepts(blockIndex, inventory);
  const sourceText =
    getBlockChunkFromIndex(blockIndex) ||
    String(session.shared?.rawMarkdown || state.originalMaterialText || "");
  const result = await buildFactualBlockQuestions(
    concepts,
    inventory,
    sourceText,
    getStudyLanguage(),
    session,
    { maxQuestions: cfg.n_test, llmModel: getSessionLlmModel(session) },
  );
  return {
    ...result,
    remainingNTest: Math.max(0, cfg.n_test - result.questions.length),
  };
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
  if (profile === "threshold_expanded") {
    const wc = countExplanationWords(blockObj.explanation);
    if (wc > 0 && (wc < 280 || wc > 480)) {
      console.warn(`Block generation: threshold_expanded explanation has ${wc} words (expected 320-450).`);
    }
  }
  if (profile === "brief_deep") {
    const wc = countExplanationWords(blockObj.explanation);
    if (wc > 0 && (wc < 60 || wc > 140)) {
      console.warn(`Block generation: brief_deep explanation has ${wc} words (expected max 120).`);
    }
  }
  if (profile === "relational_compressed") {
    const wc = countExplanationWords(blockObj.explanation);
    if (wc > 0 && wc > 140) {
      console.warn(`Block generation: relational_compressed explanation has ${wc} words (expected ~40% of standard).`);
    }
  }
  if (gaps.length > 0 && questions.length < gaps.length) {
    console.warn(
      `Block generation: ${gaps.length} gap(s) but only ${questions.length} question(s) (expected =${gaps.length}).`,
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
  if (isQuestionsStudyMode(state.activeSession)) {
    return generateQuestionsBlockForIndex(blockIndex, { n_test, n_socratic });
  }
  const llmModel = getSessionLlmModel(state.activeSession);
  assertLlmKeyPresent(llmModel);

  const blocksListText = String(state.activeSession?.blocks_list_text || "").trim();
  if (!blocksListText) throw new Error("Missing confirmed blocks list.");

  const resolved = resolveBlockQuestionConfig(idx);
  const cfg = {
    n_test: clampInt(n_test, 0, MAX_N_TEST, resolved.n_test),
    n_socratic: clampInt(n_socratic, 0, 3, resolved.n_socratic),
    explanation_profile: resolved.explanation_profile,
    gap_focus: resolved.gap_focus,
    include_connection_questions: resolved.include_connection_questions,
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
    include_connection_questions: cfg.include_connection_questions,
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
  return normalizeBlockJson(obj, cfg, idx);
}

export function getBlockSummaryFromList(blockIndex) {
  const plan = parseBlocksPlanFromList(state.activeSession?.blocks_list_text);
  const id = Math.max(1, Math.floor(Number(blockIndex) || 0) + 1);
  const row = plan.find((p) => Number(p.id) === id);
  return row ? String(row.summary || "").trim() : "";
}

/** Questions mode: generate test/socratic items from block summary + source chunk (no RSVP explanation). */
export async function generateQuestionsBlockForIndex(blockIndex, { n_test, n_socratic } = {}) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  if (isOfflineMode()) {
    const block = getBlock(idx);
    if (!block) throw new Error("Missing offline block.");
    return block;
  }

  const resolved = resolveBlockQuestionConfig(idx);
  const cfg = {
    n_test: clampInt(n_test, 0, MAX_N_TEST, resolved.n_test),
    n_socratic: clampInt(n_socratic, 0, 3, resolved.n_socratic),
    explanation_profile: resolved.explanation_profile,
    gap_focus: resolved.gap_focus,
    include_connection_questions: resolved.include_connection_questions,
  };

  const materialChunk = getBlockChunkFromIndex(idx);
  if (!materialChunk) {
    throw new Error("Missing block chunk for this session. Please regenerate blocks.");
  }

  const blockTitle = String(getBlockTitleFromList(idx)).trim() || getBlockTitleFromList(idx);
  const summary = getBlockSummaryFromList(idx);
  const grounding = summary || blockTitle;

  const llmModel = getSessionLlmModel(state.activeSession);
  assertLlmKeyPresent(llmModel);

  const titlesById = parseBlockTitlesFromList(String(state.activeSession?.blocks_list_text || ""));
  const previousBlocksTitles = [];
  for (let id = 1; id <= idx; id += 1) {
    const t = titlesById[String(id)];
    if (t) previousBlocksTitles.push(t);
  }

  const blockIndexArr = loadBlockIndex() || [];
  const inventory =
    state.activeSession?.shared?.conceptInventory ||
    state.activeSession?._meta?.material_graph?.conceptInventory ||
    [];
  const coverageManifest = ensureSessionCoverageManifest(state.activeSession);
  const questionScope = buildQuestionScopeContext(idx, blockIndexArr, inventory, coverageManifest);

  const factualBundle = await buildFactualQuestionsForBlock(idx, cfg);

  const request = {
    llmModel,
    language: getStudyLanguage(),
    n_test: factualBundle.remainingNTest,
    n_socratic: cfg.n_socratic,
    blockTitle,
    blockIndex: idx,
    include_connection_questions: cfg.include_connection_questions,
    explanation: grounding,
    materialText: materialChunk,
    gap_focus: cfg.gap_focus,
    previousBlocksTitles,
    coverageManifest: coverageManifest.slice(-20),
    questionScope,
  };

  let response = null;
  if (factualBundle.remainingNTest > 0 || cfg.n_socratic > 0) {
    try {
      response = await deepSeekRegenerateBlockQuestions(request);
    } catch (err) {
      const message = err?.message ? String(err.message) : String(err);
      if (!message.includes("valid JSON")) throw err;
      response = await deepSeekRegenerateBlockQuestions(request);
    }
    warnQuestionsOnlyCountMismatch(response, { ...cfg, n_test: factualBundle.remainingNTest });
  }

  const llmQuestions = Array.isArray(response?.questions) ? response.questions : [];
  const merged = normalizeBlockJson(
    {
      id: idx + 1,
      title: blockTitle,
      explanation: "",
      questions: [...factualBundle.questions, ...llmQuestions],
      concepts: Array.isArray(response?.concepts) ? response.concepts : [],
    },
    cfg,
    idx,
  );
  merged.explanation = "";
  if (Array.isArray(merged.questions)) {
    merged.questions = shuffleTestQuestionsInList(merged.questions);
  }
  return merged;
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

  if (isQuestionsStudyMode(state.activeSession)) {
    const questions = Array.isArray(prefetchedBlock?.questions) ? prefetchedBlock.questions : [];
    if (prefetchedBlock && questions.length) {
      return "questions_only";
    }
    return "full_block";
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
    n_test: clampInt(n_test, 0, MAX_N_TEST, resolved.n_test),
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

  const titlesById = parseBlockTitlesFromList(String(state.activeSession?.blocks_list_text || ""));
  const previousBlocksTitles = [];
  for (let id = 1; id <= idx; id += 1) {
    const t = titlesById[String(id)];
    if (t) previousBlocksTitles.push(t);
  }

  const blockIndexArr = loadBlockIndex() || [];
  const inventory =
    state.activeSession?.shared?.conceptInventory ||
    state.activeSession?._meta?.material_graph?.conceptInventory ||
    [];
  const coverageManifest = ensureSessionCoverageManifest(state.activeSession);
  const questionScope = buildQuestionScopeContext(idx, blockIndexArr, inventory, coverageManifest);

  const factualBundle = await buildFactualQuestionsForBlock(idx, cfg);

  const request = {
    llmModel,
    language: getStudyLanguage(),
    n_test: factualBundle.remainingNTest,
    n_socratic: cfg.n_socratic,
    blockTitle,
    blockIndex: idx,
    include_connection_questions: cfg.include_connection_questions,
    explanation,
    materialText: materialChunk,
    gap_focus: cfg.gap_focus,
    previousBlocksTitles,
    coverageManifest: coverageManifest.slice(-20),
    questionScope,
  };

  let response = null;
  if (factualBundle.remainingNTest > 0 || cfg.n_socratic > 0) {
    try {
      response = await deepSeekRegenerateBlockQuestions(request);
    } catch (err) {
      const message = err?.message ? String(err.message) : String(err);
      if (!message.includes("valid JSON")) throw err;
      response = await deepSeekRegenerateBlockQuestions(request);
    }
    warnQuestionsOnlyCountMismatch(response, { ...cfg, n_test: factualBundle.remainingNTest });
  }
  updateCoverageManifestAfterBlock(idx, [
    ...factualBundle.questions,
    ...(Array.isArray(response?.questions) ? response.questions : []),
  ]);

  const llmQuestions = Array.isArray(response?.questions) ? response.questions : [];
  const merged = {
    ...base,
    id: base.id != null ? base.id : idx + 1,
    title: base.title || blockTitle,
    explanation,
    questions: [...factualBundle.questions, ...llmQuestions],
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
      n_test: clampInt(config.n_test, 0, MAX_N_TEST, 2),
      n_socratic: 0,
      llmModel: config.llmModel ?? getSessionLlmModel(state.activeSession),
      include_connection_questions:
        config.include_connection_questions !== false && config.include_connection_questions != null
          ? Boolean(config.include_connection_questions)
          : true,
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
    n_test: clampInt(safe.n_test, 0, MAX_N_TEST, 2),
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
  const n_test = clampInt(raw.n_test, 0, MAX_N_TEST, defaultsFromV1.n_test);
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
  return t === "basic" || t === "intermediate" || t === "advanced";
}

function stripLeadingListMarkers(line) {
  return String(line || "").replace(/^[\d.\-*\s]+/, "").trim();
}

function stripTrailingMetadata(line) {
  const raw = String(line || "");
  const splitMeta = raw.split(/\s+—\s+/);
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
    const concept_ids = Array.isArray(item.concept_ids)
      ? item.concept_ids.map((c) => String(c || "").trim()).filter(Boolean)
      : [];
    const row = { id, title, summary, signature, chunk };
    if (concept_ids.length) row.concept_ids = concept_ids;
    out.push(row);
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
  return id === 1 || /^(overview|course map)/i.test(title);
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

function resolveDedupSignatureThreshold() {
  const session = state.activeSession && typeof state.activeSession === "object" ? state.activeSession : {};
  const levers = session._meta?.pipelineLevers;
  const fromLevers = Number(levers?.dedupSignatureOverlapThreshold);
  if (Number.isFinite(fromLevers) && fromLevers >= 1) return Math.floor(fromLevers);
  const strict =
    String(session._meta?.source_fidelity_mode || "").trim().toLowerCase() === "strict";
  return strict ? 2 : 3;
}

function sharedConceptIds(blockA, blockB) {
  const idsA = new Set(
    (Array.isArray(blockA?.concept_ids) ? blockA.concept_ids : [])
      .map((c) => String(c || "").trim())
      .filter(Boolean),
  );
  const idsB = Array.isArray(blockB?.concept_ids) ? blockB.concept_ids : [];
  let shared = 0;
  for (const c of idsB) {
    const id = String(c || "").trim();
    if (id && idsA.has(id)) shared += 1;
  }
  return shared;
}

/** Max block-count change allowed in one deterministic dedup pass (±10%, rounded up). */
export const DEDUP_BLOCK_COUNT_TOLERANCE = 0.1;

/**
 * Budget for how many blocks dedup may absorb relative to the pre-dedup index length.
 * @param {number} baselineBlockCount
 * @returns {{ baseline: number, minFinalCount: number, maxMerges: number }}
 */
export function computeDedupMergeBudget(baselineBlockCount) {
  const baseline = Math.max(1, Math.floor(Number(baselineBlockCount) || 1));
  const minFinalCount = Math.ceil(baseline * (1 - DEDUP_BLOCK_COUNT_TOLERANCE));
  const maxMerges = Math.max(0, baseline - minFinalCount);
  return { baseline, minFinalCount, maxMerges };
}

/**
 * Keep only the first merge plans that fit within maxMerges absorbed blocks.
 * @param {import('./session.js').DedupMergeRecord[]} plans
 * @param {number} maxMerges
 */
export function capDedupMergePlans(plans, maxMerges) {
  const cap = Math.max(0, Math.floor(Number(maxMerges) || 0));
  if (!cap || !Array.isArray(plans) || !plans.length) return [];
  const capped = [];
  let absorbed = 0;
  for (const plan of plans) {
    const absorbIds = Array.isArray(plan?.absorb_ids) ? plan.absorb_ids : [];
    if (!absorbIds.length) continue;
    if (absorbed + absorbIds.length > cap) break;
    capped.push(plan);
    absorbed += absorbIds.length;
  }
  return capped;
}

/** @returns {import('./session.js').DedupMergeRecord[]} */
export function findDeterministicDuplicateMerges(blockIndex) {
  const safe = Array.isArray(blockIndex) ? blockIndex.slice() : [];
  safe.sort((a, b) => Number(a.id) - Number(b.id));
  const threshold = resolveDedupSignatureThreshold();
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
        const conceptShared = sharedConceptIds(blockI, blockJ);
        if (overlap_terms.length >= threshold) {
          reason = "signature_overlap";
        } else if (conceptShared >= 1 && overlap_terms.length >= 2) {
          reason = "concept_signature_overlap";
        }
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
  const mergeBudget = computeDedupMergeBudget(original.length);
  const allPlans = findDeterministicDuplicateMerges(original);
  const plans = capDedupMergePlans(allPlans, mergeBudget.maxMerges);
  const skipped_merge_count = Math.max(
    0,
    allPlans.reduce((acc, p) => acc + (Array.isArray(p.absorb_ids) ? p.absorb_ids.length : 0), 0) -
      plans.reduce((acc, p) => acc + (Array.isArray(p.absorb_ids) ? p.absorb_ids.length : 0), 0),
  );
  if (!plans.length) {
    return {
      blockIndex: renumberBlockIndexSequential(original),
      dedup_merges: [],
      merged_count: 0,
      dedup_merge_budget: mergeBudget,
      dedup_merges_skipped: skipped_merge_count,
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

    const mergedConceptIds = [
      ...new Set([
        ...(Array.isArray(keep.concept_ids) ? keep.concept_ids : []),
        ...absorbs.flatMap((b) => (Array.isArray(b.concept_ids) ? b.concept_ids : [])),
      ]),
    ];
    const mergedSignature = [
      ...new Set([
        ...(Array.isArray(keep.signature) ? keep.signature : []),
        ...absorbs.flatMap((b) => (Array.isArray(b.signature) ? b.signature : [])),
      ]),
    ];
    byId.set(keepId, {
      ...keep,
      chunk: mergedChunk,
      signature: mergedSignature,
      ...(mergedConceptIds.length ? { concept_ids: mergedConceptIds } : {}),
    });
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
    dedup_merge_budget: mergeBudget,
    dedup_merges_skipped: skipped_merge_count,
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
    headlineParts.push(`You requested ${requested_n}; the material supported ${final_n} blocks.`);
  } else {
    headlineParts.push(`Split complete: ${final_n} blocks.`);
  }
  if (pipeline === "fallback_mono") {
    headlineParts.push("Using classic split (fallback).");
  }

  const dedupLine =
    Number.isFinite(dedup_merged_count) && dedup_merged_count > 0
      ? `Dedup: ${dedup_merged_count} blocks merged due to duplicate signatures`
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

/** @param {object} sessionObj */
function ensureSessionMetaObject(sessionObj) {
  if (!sessionObj || typeof sessionObj !== "object") return null;
  if (!sessionObj._meta || typeof sessionObj._meta !== "object") {
    sessionObj._meta = {};
  }
  return sessionObj._meta;
}

/** @returns {object | null} */
export function getKnowledgeProfile(sessionObj) {
  const profile = sessionObj?._meta?.knowledge_profile;
  return profile && typeof profile === "object" ? profile : null;
}

export function setKnowledgeProfile(sessionObj, profile) {
  const meta = ensureSessionMetaObject(sessionObj);
  if (!meta) return sessionObj;
  if (profile == null) {
    delete meta.knowledge_profile;
    return sessionObj;
  }
  if (typeof profile !== "object") return sessionObj;
  meta.knowledge_profile = profile;
  if (meta.assessment_skipped == null) meta.assessment_skipped = false;
  if (meta.packing_ignored_profile == null) meta.packing_ignored_profile = false;
  return sessionObj;
}

export function setAssessmentSkipped(sessionObj, skipped = true) {
  const meta = ensureSessionMetaObject(sessionObj);
  if (!meta) return sessionObj;
  meta.assessment_skipped = Boolean(skipped);
  if (skipped) {
    delete meta.knowledge_profile;
    meta.packing_ignored_profile = false;
  }
  return sessionObj;
}

export function setPackingIgnoredProfile(sessionObj, ignored = true) {
  const meta = ensureSessionMetaObject(sessionObj);
  if (!meta) return sessionObj;
  meta.packing_ignored_profile = Boolean(ignored);
  if (ignored) meta.assessment_skipped = false;
  return sessionObj;
}

/** Mastery weight for packing: known → deprioritize, unknown → prioritize, unassessed → neutral. */
export function getMasteryWeight(concept, knowledgeProfile) {
  if (!knowledgeProfile?.byConceptId) return 0.5;
  const conceptId = String(concept?.id || concept?.concept_id || "").trim();
  if (!conceptId) return 0.5;
  const entry = knowledgeProfile.byConceptId[conceptId];
  if (!entry || !entry.assessed) return 0.5;
  return entry.correct ? 0.2 : 0.9;
}

/** Bridge concept-coverage profile to LLM pack prompt shape. */
export function knowledgeProfileForPack(knowledgeProfile) {
  if (!knowledgeProfile || typeof knowledgeProfile !== "object") return null;
  if (knowledgeProfile.byConceptId && Array.isArray(knowledgeProfile.items)) {
    return knowledgeProfile;
  }
  if (!knowledgeProfile.byConceptId) return knowledgeProfile;
  const items = [];
  for (const [concept_id, entry] of Object.entries(knowledgeProfile.byConceptId)) {
    if (!entry?.assessed) continue;
    items.push({
      concept_id,
      mastery: entry.correct ? "full" : "none",
      confidence: entry.correct ? 0.85 : 0.2,
    });
  }
  return { ...knowledgeProfile, items };
}

/** Pack layer invariants for tests and runtime checks. */
export function validatePackInvariants({
  conceptInventory,
  blockIndex,
  requested_n,
  knowledgeProfile = null,
  splitRunMeta = null,
}) {
  const inv = Array.isArray(conceptInventory) ? conceptInventory : [];
  const idx = Array.isArray(blockIndex) ? blockIndex : [];
  const errors = [];
  const storedInv = splitRunMeta?.concept_inventory;
  if (Array.isArray(storedInv) && storedInv.length !== inv.length) {
    errors.push("concept_inventory length changed in splitRunMeta");
  }
  if (idx.length > requested_n) {
    errors.push(`blockIndex.length (${idx.length}) > requested_n (${requested_n})`);
  }
  const expectedApplied = Boolean(knowledgeProfile);
  if (splitRunMeta && splitRunMeta.profile_applied !== expectedApplied) {
    errors.push(`profile_applied expected ${expectedApplied}`);
  }
  return { ok: errors.length === 0, errors };
}

export async function runConceptInventoryMapReduce(
  materialText,
  docHierarchy,
  splitOpts = {},
) {
  const {
    buildInventoryChunks,
    buildCharFallbackInventoryChunks,
    deepSeekConceptInventoryChunk,
    deepSeekMergeConceptInventories,
    INVENTORY_MAP_REDUCE_WORD_THRESHOLD,
    INVENTORY_MAX_PARALLEL_CALLS,
  } = await import("./api.js?v=20260625_02");

  const wordCount =
    Number(splitOpts.wordCount) ||
    materialText.split(/\s+/).filter(Boolean).length;
  if (wordCount <= INVENTORY_MAP_REDUCE_WORD_THRESHOLD || !docHierarchy?.tree?.length) {
    console.debug("[session.runConceptInventoryMapReduce] Skipped — below threshold or no hierarchy:", {
      wordCount,
      threshold: INVENTORY_MAP_REDUCE_WORD_THRESHOLD,
      hasHierarchy: Boolean(docHierarchy?.tree?.length),
    }); // [debug-enrich]
    return null;
  }

  const chunks =
    buildInventoryChunks(docHierarchy, materialText) ||
    buildCharFallbackInventoryChunks(materialText, splitOpts.charCount);
  if (!chunks || chunks.length < 2) {
    console.debug("[session.runConceptInventoryMapReduce] Skipped — insufficient chunks:", {
      chunkCount: chunks?.length || 0,
      charFallback: !docHierarchy?.tree?.length,
    }); // [debug-enrich]
    return null;
  }

  console.info("[session.runConceptInventoryMapReduce] Start:", {
    wordCount,
    chunkCount: chunks.length,
    parallelCap: INVENTORY_MAX_PARALLEL_CALLS,
  }); // [debug-enrich]

  const progress = (msg) => {
    if (typeof splitOpts.onProgress === "function" && msg) splitOpts.onProgress(String(msg));
  };
  progress(`Indexing concepts (${chunks.length} sections)…`);

  if (chunks.length > INVENTORY_MAX_PARALLEL_CALLS) {
    console.warn(
      `Map-reduce inventory: ${chunks.length} chunks exceed parallel cap ${INVENTORY_MAX_PARALLEL_CALLS}; processing in batches.`,
    );
  }

  const batchSize = INVENTORY_MAX_PARALLEL_CALLS;
  /** @type {{ label: string, concepts: object[] }[]} */
  const partials = [];
  /** @type {string[]} */
  const failedChunks = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map((chunk) =>
        deepSeekConceptInventoryChunk(chunk, {
          ...splitOpts,
          totalWordCount: wordCount,
        }),
      ),
    );
    settled.forEach((result, idx) => {
      const chunk = batch[idx];
      if (result.status === "fulfilled" && result.value?.concepts?.length) {
        partials.push({
          label: chunk.label,
          concepts: result.value.concepts,
        });
      } else {
        failedChunks.push(chunk.label);
        const reason =
          result.status === "rejected"
            ? result.reason?.message || result.reason
            : "empty inventory";
        console.warn(`Map-reduce chunk failed (${chunk.label}):`, reason);
      }
    });
  }

  if (!partials.length) {
    console.error("[session.runConceptInventoryMapReduce] All chunks failed:", {
      chunkCount: chunks.length,
      failedChunks,
    }); // [debug-enrich]
    throw new Error("All inventory chunks failed.");
  }

  progress("Merging concept inventories…");
  const merged = await deepSeekMergeConceptInventories(partials, splitOpts);
  if (merged.failReason || !Array.isArray(merged.concepts) || !merged.concepts.length) {
    console.error("[session.runConceptInventoryMapReduce] Merge failed:", {
      failReason: merged.failReason,
      partialCount: partials.length,
      mergedConceptCount: merged.concepts?.length || 0,
    }); // [debug-enrich]
    const err = new Error(merged.failReason || "MERGE_TRUNCATED");
    err.code = "CONCEPT_INVENTORY_TRUNCATED";
    throw err;
  }
  return {
    inventory: merged.concepts,
    inventoryMode: merged.inventoryMode || "map_reduce",
    chunkCount: chunks.length,
    failedChunks,
  };
}

export async function runConceptInventory(
  material,
  { llmModel, studyNotes, language, onProgress, docHierarchy, wordCount: wordCountIn, charCount: charCountIn } = {},
) {
  const lang = String(language || getStudyLanguage?.() || "English").trim() || "English";
  const materialText = String(material || "").trim();
  const model = llmModel ?? state.pendingLlmModel ?? getActiveSessionLlmModel();
  const notes = String(studyNotes ?? state.studyNotes ?? "").trim();
  console.debug("[session.runConceptInventory] Start:", {
    charCount: materialText.length,
    wordCountIn,
    hasDocHierarchy: Boolean(docHierarchy?.tree?.length),
    llmModel: model,
  }); // [debug-enrich]
  const session = state.activeSession && typeof state.activeSession === "object" ? state.activeSession : {};
  const strict =
    String(session._meta?.source_fidelity_mode || "").trim().toLowerCase() === "strict";
  const pipelineLevers = ensureSessionPipelineLevers(session, strict);
  const wordCount =
    Number(wordCountIn) || materialText.split(/\s+/).filter(Boolean).length;
  const charCount = Number(charCountIn) || materialText.length;
  const estimatedConceptTarget = computeEstimatedConceptTarget(wordCount, pipelineLevers);
  const progress = (msg) => {
    if (typeof onProgress === "function" && msg) onProgress(String(msg));
  };

  const splitOpts = {
    llmModel: model,
    studyNotes: notes,
    language: lang,
    onProgress,
    estimatedConceptTarget,
    wordCount,
    charCount,
  };

  let hierarchy = docHierarchy;
  if (!hierarchy?.tree?.length && wordCount > 8000) {
    try {
      const { buildDocumentHierarchy } = await import("./normalization/hierarchy.js");
      progress("Building document structure…");
      hierarchy = await buildDocumentHierarchy(materialText, null, { useCache: true });
    } catch (err) {
      console.warn("runConceptInventory: hierarchy build failed, single-pass", err?.message || err);
      hierarchy = null;
    }
  }

  const mapResult = await runConceptInventoryMapReduce(materialText, hierarchy, splitOpts);
  if (mapResult) {
    console.info("[session.runConceptInventory] Map-reduce complete:", {
      conceptCount: mapResult.inventory.length,
      inventoryMode: mapResult.inventoryMode,
      chunkCount: mapResult.chunkCount,
      failedChunks: mapResult.failedChunks,
    }); // [debug-enrich]
    return {
      inventory: mapResult.inventory,
      inventoryMode: mapResult.inventoryMode,
      chunkCount: mapResult.chunkCount,
      failedChunks: mapResult.failedChunks,
      concept_count: mapResult.inventory.length,
      estimatedConceptTarget,
      wordCount,
    };
  }

  const { deepSeekConceptInventory } = await import("./api.js?v=20260625_02");
  progress("Indexing concepts…");
  const result = await deepSeekConceptInventory({
    llmModel: model,
    materialText,
    studyNotes: notes,
    language: lang,
    estimatedConceptTarget,
    wordCount,
  });

  console.info("[session.runConceptInventory] Single-pass complete:", {
    conceptCount: result.concepts.length,
    inventoryMode: result.inventoryMode || "full",
    estimatedConceptTarget,
  }); // [debug-enrich]

  return {
    inventory: result.concepts,
    inventoryMode: result.inventoryMode || "full",
    concept_count: result.concepts.length,
    estimatedConceptTarget,
    wordCount,
  };
}

/**
 * Returns true when shared concept inventory meets DPP viability thresholds (ignores status).
 * @param {object} session
 * @returns {boolean}
 */
export function meetsConceptInventoryThreshold(session) {
  const shared = session?.shared;
  if (!shared) return false;

  const inventory = shared.conceptInventory;
  if (!Array.isArray(inventory) || inventory.length === 0) return false;

  const charCount = shared.docMeta?.charCount ?? 0;
  return inventory.length >= minViableConcepts(charCount);
}

/**
 * True when preparation has been running longer than the stale timeout.
 * @param {object} prep
 * @param {object} session
 * @returns {boolean}
 */
export function isStuckPreparationRun(prep, session) {
  const normalized = normalizePreparationState(prep);
  if (normalized.status !== "running" && normalized.status !== "pending") return false;
  const startedAt = Number(normalized.startedAt);
  if (Number.isFinite(startedAt) && startedAt > 0) {
    return Date.now() - startedAt > DPP_STALE_TIMEOUT_MS;
  }
  return isPreparationStale(normalized, session);
}

/**
 * Mark a single session failed when a prior DPP run is stuck on this device.
 * @param {object} session
 * @param {{ persist?: boolean }} [options]
 * @returns {Promise<{ changed: boolean, session: object }>}
 */
export async function markStalePreparationSession(session, options = {}) {
  if (!session?.shared) return { changed: false, session };
  const prep = normalizePreparationState(session.shared.preparation);
  session.shared.preparation = prep;
  if (!isStuckPreparationRun(prep, session)) {
    return { changed: false, session };
  }
  const docId = String(session.docId || "").trim();
  if (isDppRunActiveOnDevice(docId, prep.runId)) {
    return { changed: false, session };
  }
  prep.status = "failed";
  prep.failReason = "STALE_RUN";
  prep.updatedAt = Date.now();
  prep.completedAt = prep.completedAt || Date.now();
  console.log("[DPP-GUARD] Marked stale preparation failed (STALE_RUN).", { docId });
  if (options.persist !== false) {
    await saveDocumentSession(session);
  }
  return { changed: true, session };
}

/**
 * Scan sessions for stuck preparation runs (library / mode-select entry).
 * @param {object[]} sessions
 * @returns {Promise<object[]>}
 */
export async function scanStalePreparationSessions(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const out = [];
  for (const session of list) {
    const result = await markStalePreparationSession(session);
    out.push(result.session);
  }
  return out;
}

/**
 * @deprecated Use markStalePreparationSession — no longer promotes running→ready.
 * @param {object} session
 * @returns {Promise<object>}
 */
export async function repairStuckRunningPreparationIfNeeded(session) {
  const result = await markStalePreparationSession(session);
  return result.session;
}

/**
 * Returns true when shared concept inventory meets DPP viability thresholds.
 * @param {object} session
 * @returns {boolean}
 */
export function isConceptInventoryValid(session) {
  if (!meetsConceptInventoryThreshold(session)) return false;

  const status = session?.shared?.preparation?.status;
  if (status === "ready" || status === "partial") return true;
  if (status === "legacy") return true;
  return false;
}

/**
 * User-facing create-session status from preparation state.
 * @param {object | null | undefined} doc
 * @returns {string}
 */
export function resolveCreateSessionPrepStatus(doc) {
  const prep = normalizePreparationState(doc?.shared?.preparation);
  const inv = doc?.shared?.conceptInventory;
  const hasInv = Array.isArray(inv) && inv.length > 0;
  if (prep.status === "failed") {
    if (prep.failReason === "INVENTORY_TOO_SPARSE" && hasInv) {
      return "Document ready with reduced concept coverage. You can continue.";
    }
    const errMsg = prep.errors?.[prep.errors.length - 1]?.message;
    return errMsg
      ? String(errMsg)
      : "Document preparation failed. Try again or tap Continue.";
  }
  if (prep.status === "ready" || prep.status === "partial") {
    if (isTier1PreparationComplete(doc)) {
      return prep.failReason === "INVENTORY_TOO_SPARSE"
        ? "Document ready with reduced concept coverage. You can continue."
        : "Document ready. You can continue.";
    }
  }
  if (isTier1PreparationComplete(doc)) return "Document ready. You can continue.";
  if (prep.status === "running" || prep.status === "pending") {
    return "Preparing document…";
  }
  return "Preparing document…";
}

/** @type {Map<string, Promise<unknown>>} */
const dppFlights = new Map();

/**
 * Dedupe concurrent DPP runs per docId (used by document-preparation.js).
 * @param {string} docId
 * @param {() => Promise<unknown>} factory
 * @param {{ force?: boolean }} [options]
 */
export function runDedupedDppFlight(docId, factory, options = {}) {
  const id = String(docId || "").trim();
  if (!id) return Promise.resolve(factory());
  if (!options.force && dppFlights.has(id)) return dppFlights.get(id);
  const flight = Promise.resolve()
    .then(factory)
    .finally(() => {
      if (dppFlights.get(id) === flight) dppFlights.delete(id);
    });
  dppFlights.set(id, flight);
  return flight;
}

export function isDppInFlight(docId) {
  return dppFlights.has(String(docId || "").trim());
}

function getPreparationActivityTs(prep) {
  const updatedAt = Number(prep?.updatedAt);
  if (Number.isFinite(updatedAt) && updatedAt > 0) return updatedAt;
  const startedAt = Number(prep?.startedAt);
  if (Number.isFinite(startedAt) && startedAt > 0) return startedAt;
  return null;
}

function isPreparationStale(prep, session) {
  const activityTs = getPreparationActivityTs(prep);
  if (activityTs != null) {
    return Date.now() - activityTs > DPP_STALE_TIMEOUT_MS;
  }
  const docTs = Number(session?.updatedAt) || Number(session?.createdAt) || 0;
  return docTs > 0 && Date.now() - docTs > DPP_PENDING_GRACE_MS;
}

async function handlePreparationStaleRun(session) {
  if (!session.shared) session.shared = {};
  const prep = normalizePreparationState(session.shared.preparation);
  session.shared.preparation = prep;
  const docId = String(session?.docId || "").trim();
  if (isDppRunActiveOnDevice(docId, prep.runId)) {
    return { retried: false, session };
  }
  prep.status = "failed";
  prep.failReason = "STALE_RUN";
  prep.updatedAt = Date.now();
  prep.completedAt = prep.completedAt || Date.now();
  console.log("[DPP-GUARD] Stale preparation — marking failed (STALE_RUN).");
  await saveDocumentSession(session);
  return { retried: false, session };
}

/**
 * @param {object} session
 * @param {{ forceRerun?: boolean }} [options]
 * @returns {{ decision: 'skip'|'run'|'failed'|'waiting'|'degraded' }}
 */
export function evaluateConceptInventoryGuard(session, options = {}) {
  if (options.forceRerun) {
    console.log("[DPP-GUARD] [DPP-GUARD] Force rerun requested — bypassing guard.");
    return { decision: "run" };
  }

  if (isConceptInventoryValid(session)) {
    const inv = session.shared.conceptInventory;
    const charCount = session.shared.docMeta?.charCount ?? 0;
    console.log(
      `[DPP-GUARD] isConceptInventoryValid ? TRUE (${inv.length} concepts, charCount ${charCount}). Skipping recalculation.`,
    );
    return { decision: "skip" };
  }

  const status = session?.shared?.preparation?.status ?? "undefined";
  const length = Array.isArray(session?.shared?.conceptInventory)
    ? session.shared.conceptInventory.length
    : 0;
  console.log(
    `[DPP-GUARD] isConceptInventoryValid ? FALSE. Status: ${status}, inventory: ${length} concepts.`,
  );

  if (status === "failed") {
    const prep = normalizePreparationState(session?.shared?.preparation);
    if (prep.failReason === "STALE_RUN") {
      console.log("[DPP-GUARD] Failed STALE_RUN — user may retry preparation.");
      return { decision: "failed" };
    }
    console.log("[DPP-GUARD] Status 'failed' — surfacing error state. Not auto-retrying.");
    return { decision: "failed" };
  }

  if (status === "running" || status === "pending") {
    const prep = normalizePreparationState(session?.shared?.preparation);
    const docId = String(session?.docId || "").trim();
    if (isDppInFlight(docId)) {
      console.log("[DPP-GUARD] Skipping DPP re-trigger: pipeline in flight.");
      return { decision: "waiting" };
    }
    if (isPreparationStale(prep, session)) {
      console.log("[DPP-GUARD] Preparation stale with no in-flight pipeline — allowing re-run.");
      return { decision: "run" };
    }
    console.log("[DPP-GUARD] Skipping DPP re-trigger: already running.");
    return { decision: "waiting" };
  }

  if (status === "ready" || status === "partial") {
    const charCount = session?.shared?.docMeta?.charCount ?? 0;
    const minRequired = minViableConcepts(charCount);
    console.log(
      `[DPP-GUARD] Inventory below minimum threshold (${length} < ${minRequired}). Treating as degraded.`,
    );
    return { decision: "degraded" };
  }

  return { decision: "run" };
}

/**
 * Poll until inventory guard returns skip or degraded, or failed/run timeout.
 * @param {() => Promise<object|null>} reloadSession
 * @param {{ pollMs?: number, maxWaitMs?: number }} [options]
 * @returns {Promise<{ decision: string, session: object|null }>}
 */
export async function pollUntilConceptInventoryReady(reloadSession, options = {}) {
  const pollMs = options.pollMs ?? 2000;
  const maxWaitMs = options.maxWaitMs ?? DPP_STALE_TIMEOUT_MS + 60_000;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    let session = await reloadSession();
    if (!session) return { decision: "failed", session: null };

    session = await repairStuckRunningPreparationIfNeeded(session);

    const prep = normalizePreparationState(session.shared?.preparation);
    if (
      (prep.status === "running" || prep.status === "pending") &&
      !meetsConceptInventoryThreshold(session) &&
      !isDppInFlight(session.docId)
    ) {
      if (isPreparationStale(prep, session)) {
        const stale = await handlePreparationStaleRun(session);
        return { decision: "failed", session: stale.session };
      }
    }

    const guard = evaluateConceptInventoryGuard(session);
    if (guard.decision === "skip" || guard.decision === "degraded") {
      return { decision: guard.decision, session };
    }
    if (guard.decision === "failed") {
      return { decision: "failed", session };
    }
    if (guard.decision === "run") {
      return { decision: "run", session };
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return { decision: "waiting", session: await reloadSession() };
}

/**
 * Inventory with mono-phase fallback — all entry points should use this should use this.
 * @returns {Promise<{ kind: 'inventory', inventory: object[], inventoryMode?: string, chunkCount?: number, failedChunks?: string[], concept_count: number, estimatedConceptTarget: number, wordCount: number } | { kind: 'fallback_mono', blockIndex: object[], splitRunMeta: object, inventoryMode: 'fallback_mono' }>}
 */
export async function runConceptInventoryWithFallback(
  material,
  { llmModel, studyNotes, language, onProgress, docHierarchy, nBlocks, wordCount, charCount } = {},
) {
  const materialText = String(material || "").trim();
  const model = llmModel ?? state.pendingLlmModel ?? getActiveSessionLlmModel();
  const lang = String(language || getStudyLanguage?.() || "English").trim() || "English";
  const notes = String(studyNotes ?? state.studyNotes ?? "").trim();
  const requested_n = Math.max(1, Math.floor(Number(nBlocks) || 12));
  const progress = (msg) => {
    if (typeof onProgress === "function" && msg) onProgress(String(msg));
  };

  const runFallback = async (reason) => {
    console.warn("[session.runConceptInventoryWithFallback] Falling back to mono split:", {
      reason,
      requested_n,
      charCount: materialText.length,
    }); // [debug-enrich]
    progress("Using classic split (fallback)…");
    const { deepSeekSplitIntoBlocks } = await import("./api.js?v=20260625_02");
    const parsed = await deepSeekSplitIntoBlocks({
      llmModel: model,
      nBlocks: requested_n,
      materialText,
      studyNotes: notes,
      language: lang,
    });
    let normalized = normalizeBlockIndexArray(parsed, { requireChunk: false, lenient: true });
    if (!normalized?.length) throw new Error("Fallback block split returned no blocks.");
    let { blocks: blockIndex } = assignAlignedChunksSequential(materialText, normalized, [], {
      docHierarchy: docHierarchy || resolveDocHierarchyForAlignment(),
    });
    blockIndex = annotateBlocksWithSourceFileIds(blockIndex, materialText);
    return {
      kind: "fallback_mono",
      blockIndex,
      splitRunMeta: {
        requested_n,
        final_n: blockIndex.length,
        pipeline: "fallback_mono",
        inventory_fallback_reason: reason || "inventory_failed",
      },
      inventoryMode: "fallback_mono",
    };
  };

  try {
    console.debug("[session.runConceptInventoryWithFallback] Start:", {
      charCount: materialText.length,
      requested_n,
      hasDocHierarchy: Boolean(docHierarchy?.tree?.length),
    }); // [debug-enrich]
    const result = await runConceptInventory(materialText, {
      llmModel: model,
      studyNotes: notes,
      language: lang,
      onProgress,
      docHierarchy,
      wordCount,
      charCount,
    });
    return { kind: "inventory", ...result };
  } catch (err) {
    const truncated = err?.code === "CONCEPT_INVENTORY_TRUNCATED";
    console.warn("[session.runConceptInventoryWithFallback] Inventory failed:", {
      truncated,
      code: err?.code,
      message: err?.message || String(err),
    }); // [debug-enrich]
    return runFallback(truncated ? "truncated" : "parse_error");
  }
}

/** Local pack when LLM output truncates — no network, assigns every concept once, assigns every concept once. */
export function packInventoryDeterministic(inventory, nBlocks, lang = "English", options = {}) {
  const targetN = Math.max(1, Math.floor(Number(nBlocks) || 1));
  let inv = (Array.isArray(inventory) ? inventory : [])
    .filter((c) => c && String(c.id || "").trim());

  inv = applyNoveltyPackingBias(inv, { beliefState: options.beliefState || null });
  inv = inv.slice().sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  if (!inv.length) {
    return { blocks: [], pack_meta: { target_n: targetN, final_block_count: 0, merges: [] } };
  }

  const overviewPrefix = "Overview:";
  const courseLabel = String(inv[0]?.module || inv[0]?.title || "Course").trim();

  /** @type {object[]} */
  const blocks = [
    {
      id: 1,
      title: `${overviewPrefix} ${courseLabel}`,
      summary: inv
        .slice(0, 5)
        .map((c) => String(c.title || "").trim())
        .filter(Boolean)
        .join("; "),
      signature: inv
        .slice(0, 6)
        .map((c) => String(c.title || "").trim())
        .filter(Boolean),
      concept_ids: [],
      chunk: "",
    },
  ];

  const assigned = new Set();
  const byModule = new Map();
  for (const c of inv) {
    const mod = String(c.module || "General").trim() || "General";
    if (!byModule.has(mod)) byModule.set(mod, []);
    byModule.get(mod).push(c);
  }

  const moduleEntries = [...byModule.entries()];
  const slotsAfterOverview = targetN - 1;
  const canVocab =
    targetN >= 3 && moduleEntries.length > 0 && moduleEntries.length <= slotsAfterOverview - 1;

  if (canVocab) {
    for (const [modName, concepts] of moduleEntries) {
      if (blocks.length >= targetN) break;
      if (concepts.length < 4) continue;
      const vocab = concepts[0];
      if (!vocab?.id || assigned.has(vocab.id)) continue;
      assigned.add(vocab.id);
      blocks.push(
        annotateBlockIndexEntry({
          id: blocks.length + 1,
          title: `Key terms: ${modName}`,
          summary: `Key terms for ${modName}.`,
          signature: concepts
            .slice(0, 8)
            .map((c) => String(c.title || "").trim())
            .filter(Boolean),
          concept_ids: [String(vocab.id)],
          chunk: "",
          module: modName,
        }),
      );
    }
  }

  const remaining = inv.filter((c) => !assigned.has(String(c.id)));
  const slotsLeft = Math.max(0, targetN - blocks.length);
  if (slotsLeft > 0 && remaining.length > 0) {
    const per = Math.ceil(remaining.length / slotsLeft);
    let idx = 0;
    for (let s = 0; s < slotsLeft && idx < remaining.length; s++) {
      const group = remaining.slice(idx, idx + per);
      idx += per;
      if (!group.length) continue;
      for (const c of group) assigned.add(String(c.id));
      blocks.push({
        id: blocks.length + 1,
        title:
          group.length === 1
            ? String(group[0].title || "").trim()
            : `${String(group[0].title || "").trim()} (+${group.length - 1})`,
        summary: group
          .map((c) => String(c.scope_one_line || c.title || "").trim())
          .filter(Boolean)
          .join(" ")
          .slice(0, 280),
        signature: group
          .map((c) => String(c.title || "").trim())
          .filter(Boolean)
          .slice(0, 6),
        concept_ids: group.map((c) => String(c.id)),
        chunk: "",
      });
    }
  }

  const normalized = blocks.slice(0, targetN).map((b, i) => ({ ...b, id: i + 1, chunk: "" }));
  return {
    blocks: normalized,
    pack_meta: {
      target_n: targetN,
      final_block_count: normalized.length,
      merges: [],
      deterministic: true,
    },
  };
}

function resolveDocHierarchyForAlignment() {
  try {
    const doc = getActiveDocumentSession?.();
    const h = doc?.shared?.docHierarchy;
    if (h && typeof h === "object" && Array.isArray(h.tree) && h.tree.length) return h;
  } catch {
    // ignore
  }
  return null;
}

export async function packInventoryToBlocks(
  inventory,
  nBlocks,
  material,
  { llmModel, studyNotes, language, onProgress, knowledgeProfile = null, docHierarchy = null, docTopics = null } = {},
) {
  const requested_n = Math.max(1, Math.floor(Number(nBlocks) || 1));
  const lang = String(language || getStudyLanguage?.() || "English").trim() || "English";
  const materialText = String(material || "").trim();
  const model = llmModel ?? state.pendingLlmModel ?? getActiveSessionLlmModel();
  const notes = String(studyNotes ?? state.studyNotes ?? "").trim();
  const profile =
    knowledgeProfile && typeof knowledgeProfile === "object"
      ? knowledgeProfileForPack(knowledgeProfile)
      : null;
  let resolvedDocTopics = docTopics;
  let vaultSession = null;
  if (!Array.isArray(resolvedDocTopics)) {
    try {
      const activeDoc = getActiveDocumentSession?.();
      resolvedDocTopics = activeDoc?.shared?.docTopics;
      vaultSession = activeDoc || null;
    } catch {
      resolvedDocTopics = [];
    }
  } else {
    try {
      vaultSession = getActiveDocumentSession?.() || null;
    } catch {
      vaultSession = null;
    }
  }
  const progress = (msg) => {
    if (typeof onProgress === "function" && msg) onProgress(String(msg));
  };

  console.info("[session.packInventoryToBlocks] Start:", {
    requested_n,
    inventorySize: Array.isArray(inventory) ? inventory.length : 0,
    materialChars: materialText.length,
    hasKnowledgeProfile: Boolean(profile),
    hasDocHierarchy: Boolean(docHierarchy || resolveDocHierarchyForAlignment()),
  }); // [debug-enrich]

  const { deepSeekPackConceptsToBlocks, deepSeekSplitIntoBlocks } = await import(
    "./api.js?v=20260625_02",
  );

  progress(`Packing ${requested_n} blocks…`);
  let blocks;
  let pack_meta;
  let packPipeline = "two_phase";
  try {
    ({ blocks, pack_meta } = await deepSeekPackConceptsToBlocks({
      llmModel: model,
      inventory,
      nBlocks: requested_n,
      maxBlocks: requested_n,
      studyNotes: notes,
      language: lang,
      knowledgeProfile: profile,
      docTopics: Array.isArray(resolvedDocTopics) ? resolvedDocTopics : [],
      vaultSession,
    }));
  } catch (packErr) {
    const packReason = String(packErr?.message || packErr);
    console.warn("[session.packInventoryToBlocks] LLM pack failed:", {
      reason: packReason,
      requested_n,
      inventorySize: inventory?.length || 0,
    }); // [debug-enrich]
    progress("Packing blocks locally…");
    const det = packInventoryDeterministic(inventory, requested_n, lang);
    if (det?.blocks?.length) {
      blocks = det.blocks;
      pack_meta = {
        ...det.pack_meta,
        pack_fallback_reason: packReason,
      };
      packPipeline = "deterministic_fallback";
      console.info("[session.packInventoryToBlocks] Using deterministic fallback:", {
        blockCount: blocks?.length || 0,
      }); // [debug-enrich]
    } else {
      console.warn("[session.packInventoryToBlocks] Deterministic fallback empty — mono split"); // [debug-enrich]
      progress("Using classic split (fallback)…");
      const parsed = await deepSeekSplitIntoBlocks({
        llmModel: model,
        nBlocks: requested_n,
        materialText,
        studyNotes: notes,
        language: lang,
      });
      let fallbackBlocks = normalizeBlockIndexArray(parsed, { requireChunk: false, lenient: true });
      if (!fallbackBlocks?.length) throw packErr;
      let { blocks: blockIndex } = assignAlignedChunksSequential(materialText, fallbackBlocks, inventory, {
        docHierarchy: docHierarchy || resolveDocHierarchyForAlignment(),
      });
      blockIndex = annotateBlocksWithSourceFileIds(blockIndex, materialText);
      return {
        blockIndex,
        conceptInventory: inventory,
        splitRunMeta: {
          requested_n,
          final_n: blockIndex.length,
          baseline_n: requested_n,
          profile_applied: Boolean(profile),
          pipeline: "fallback_mono",
          concept_count: inventory.length,
          concept_inventory: inventory,
          pack_fallback_reason: packReason,
        },
      };
    }
  }

  let normalized = normalizeBlockIndexArray(blocks, { requireChunk: false, lenient: true });
  if (!normalized?.length) throw new Error("Pack returned no normalizable blocks.");

  normalized = applyPackMetaCount(normalized, pack_meta);
  const enriched = normalized.map((b, i) => {
    const src = blocks[i] && typeof blocks[i] === "object" ? blocks[i] : {};
    const concept_ids = Array.isArray(src.concept_ids)
      ? src.concept_ids.map((c) => String(c || "").trim()).filter(Boolean)
      : Array.isArray(b.concept_ids)
        ? b.concept_ids
        : [];
    const learning_goal = String(src.learning_goal || b.learning_goal || "").trim();
    const mastery_adjusted = src.mastery_adjusted === true || b.mastery_adjusted === true;
    return {
      ...b,
      ...(concept_ids.length ? { concept_ids } : {}),
      ...(learning_goal ? { learning_goal } : {}),
      ...(mastery_adjusted ? { mastery_adjusted: true } : {}),
    };
  });
  let { blocks: blockIndex } = assignAlignedChunksSequential(materialText, enriched, inventory, {
    docHierarchy: docHierarchy || resolveDocHierarchyForAlignment(),
  });

  blockIndex = annotateBlocksWithSourceFileIds(blockIndex, materialText);

  blockIndex = blockIndex.map((b) => annotateBlockIndexEntry(b));

  progress("Checking for duplicates…");
  let dedupResult = await applyDeterministicDedup(blockIndex, { llmModel: model });
  const sessionForLevers =
    state.activeSession && typeof state.activeSession === "object" ? state.activeSession : {};
  const levers = ensureSessionPipelineLevers(
    sessionForLevers,
    String(sessionForLevers._meta?.source_fidelity_mode || "").toLowerCase() === "strict",
  );
  if (levers.semanticDedupEnabled) {
    const expectedBlocks = Math.max(1, requested_n);
    if (dedupResult.blockIndex.length > expectedBlocks * 1.2) {
      const pairs = findSemanticDuplicatePairs(dedupResult.blockIndex, 0.85);
      if (pairs.length) {
        console.warn("pipeline-levers: semantic dedup flagged pairs", pairs.length);
      }
    }
  }
  const concept_count = inventory.length;

  const splitRunMeta = {
    requested_n,
    final_n: dedupResult.blockIndex.length,
    baseline_n: requested_n,
    profile_applied: Boolean(profile),
    pipeline: packPipeline,
    concept_count,
    concept_inventory: inventory,
    pack_meta,
    dedup_merges: dedupResult.dedup_merges,
    dedup_merged_count: dedupResult.merged_count,
    dedup_merge_budget: dedupResult.dedup_merge_budget,
    dedup_merges_skipped: dedupResult.dedup_merges_skipped,
  };

  const invariant = validatePackInvariants({
    conceptInventory: inventory,
    blockIndex: dedupResult.blockIndex,
    requested_n,
    knowledgeProfile: profile,
    splitRunMeta,
  });
  if (!invariant.ok) {
    console.warn("[session.packInventoryToBlocks] Invariant violations:", {
      errors: invariant.errors,
      requested_n,
      final_n: dedupResult.blockIndex.length,
      concept_count,
      pipeline: packPipeline,
    }); // [debug-enrich]
  }

  console.info("[session.packInventoryToBlocks] Done:", {
    pipeline: packPipeline,
    requested_n,
    final_n: dedupResult.blockIndex.length,
    concept_count,
    dedup_merged_count: dedupResult.merged_count,
  }); // [debug-enrich]

  const sortedBlockIndex = isThresholdConceptsEnabled()
    ? sortBlockIndexForThresholds(dedupResult.blockIndex, inventory)
    : dedupResult.blockIndex;

  return {
    blockIndex: sortedBlockIndex,
    conceptInventory: inventory,
    splitRunMeta,
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

  console.debug("[session.twoPhaseConceptSplit] Start:", {
    requested_n,
    materialChars: materialText.length,
  }); // [debug-enrich]

  const runFallback = async () => {
    progress("Using classic split (fallback)…");
    const { deepSeekSplitIntoBlocks } = await import("./api.js?v=20260625_02");
    const parsed = await deepSeekSplitIntoBlocks({
      llmModel: model,
      nBlocks: requested_n,
      materialText,
      studyNotes: notes,
      language: lang,
    });
    let normalized = normalizeBlockIndexArray(parsed, { requireChunk: false, lenient: true });
    if (!normalized?.length) throw new Error("Fallback block split returned no blocks.");
    let { blocks: blockIndex } = assignAlignedChunksSequential(materialText, normalized, [], {
      docHierarchy: resolveDocHierarchyForAlignment(),
    });
    blockIndex = annotateBlocksWithSourceFileIds(blockIndex, materialText);
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
    const invResult = await runConceptInventoryWithFallback(material, {
      llmModel,
      studyNotes,
      language,
      onProgress,
      nBlocks: requested_n,
    });
    if (invResult.kind === "fallback_mono") {
      console.info("[session.twoPhaseConceptSplit] Inventory fallback_mono:", {
        blockCount: invResult.blockIndex?.length || 0,
      }); // [debug-enrich]
      return {
        blockIndex: invResult.blockIndex,
        splitRunMeta: invResult.splitRunMeta,
      };
    }
    return await packInventoryToBlocks(invResult.inventory, nBlocks, material, {
      llmModel,
      studyNotes,
      language,
      onProgress,
    });
  } catch (err) {
    console.error("[session.twoPhaseConceptSplit] Failed — mono split fallback:", {
      message: err?.message || String(err),
      stack: err?.stack,
    }); // [debug-enrich]
    return runFallback();
  }
}

export async function auditBlockIndex(blockIndex, { llmModel, apiKey: _legacyApiKey, language } = {}) {
  const model = llmModel ?? state.pendingLlmModel ?? getActiveSessionLlmModel();
  assertLlmKeyPresent(model);
  const lang = String(language || "English").trim() || "English";

  const payload = buildAuditPayload(blockIndex);
  const { deepSeekAuditBlockIndex } = await import("./api.js?v=20260625_02");
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
  const { deepSeekPostMergeChunk } = await import("./api.js?v=20260625_02");
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

export function initActiveSessionFromBlocksList({
  mode,
  nBlocks,
  blocksListText,
  includeConnectionQuestions = true,
}) {
  const n = Math.max(1, Number(nBlocks) || 1);
  const defaults = loadDefaultQuestionConfig();
  const studyMode = normalizeStudyMode(mode);
  return {
    studyMode,
    n_blocks: n,
    n_test: defaults.n_test,
    n_socratic: defaults.n_socratic,
    include_connection_questions: Boolean(includeConnectionQuestions),
    blocks_list_text: String(blocksListText || ""),
    current_block_index: 0,
    active_question_index: 0,
    blocks: Array.from({ length: n }, () => ({
      _config: {
        n_test: defaults.n_test,
        n_socratic: defaults.n_socratic,
        explanation_profile: "thorough",
        gap_focus: [],
        include_connection_questions: Boolean(includeConnectionQuestions),
      },
    })),
  };
}

export async function applyAssessmentResults(assessmentResults) {
  const skipped = Boolean(
    assessmentResults?.skipped === true || (window?.assessmentConfig && window.assessmentConfig.skipped),
  );
  if (skipped) {
    return { skipped: true, adjusted: false, strongBlocks: [], weakBlocks: [] };
  }

  const sessionObj = await loadActiveSession();
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
    n_test: clampInt(sessionObj.n_test, 0, MAX_N_TEST, 2),
    n_socratic: clampInt(sessionObj.n_socratic, 0, 3, 1),
    explanation_profile: "thorough",
    gap_focus: [],
  };
  const includeConnection = sessionObj.include_connection_questions !== false;

  const strongBlocks = [];
  const weakBlocks = [];
  let adjusted = false;

  for (let i = 0; i < blocks.length; i += 1) {
    const blk = blocks[i] && typeof blocks[i] === "object" ? blocks[i] : {};
    const blockId = Number(blockIndex[i]?.id || i + 1);
    const classification = String(perBlock[String(blockId)]?.classification || "").trim();
    const gap_focus = gapLabelsForBlock(gapsByBlock, blockId);
    const inv = resolveSessionConceptInventory(sessionObj);
    const indexEntry = blockIndex[i];
    const isThBlock = isThresholdConceptsEnabled() && blockIsThreshold(indexEntry, inv);

    if (classification === "strong") {
      blk._config = isThBlock
        ? mergeThresholdBlockConfig(
            {
              n_test: 1,
              n_socratic: Math.min(3, sessionDefaults.n_socratic + 1),
              gap_focus: [],
              include_connection_questions: includeConnection,
            },
            true,
          )
        : {
            n_test: 1,
            n_socratic: 0,
            explanation_profile: "brief_deep",
            gap_focus: [],
            include_connection_questions: includeConnection,
          };
      strongBlocks.push(blockId);
      adjusted = true;
    } else if (classification === "weak") {
      const bumped = {
        n_test: sessionDefaults.n_test,
        n_socratic: Math.min(3, sessionDefaults.n_socratic + 1),
      };
      const reserveConnectionSlot =
        includeConnection && blockId > 1 && bumped.n_test + bumped.n_socratic > 0;
      const budget = adjustQuestionBudgetForGaps(
        bumped.n_test,
        bumped.n_socratic,
        gap_focus.length,
        reserveConnectionSlot,
      );
      blk._config = isThBlock
        ? mergeThresholdBlockConfig(
            {
              n_test: budget.n_test,
              n_socratic: budget.n_socratic,
              gap_focus,
              include_connection_questions: includeConnection,
            },
            true,
          )
        : {
            n_test: budget.n_test,
            n_socratic: budget.n_socratic,
            explanation_profile: "thorough",
            gap_focus,
            include_connection_questions: includeConnection,
          };
      weakBlocks.push(blockId);
      adjusted = true;
    } else {
      blk._config = isThBlock
        ? mergeThresholdBlockConfig(
            {
              n_test: sessionDefaults.n_test,
              n_socratic: sessionDefaults.n_socratic,
              gap_focus,
              include_connection_questions: includeConnection,
            },
            true,
          )
        : {
            n_test: sessionDefaults.n_test,
            n_socratic: sessionDefaults.n_socratic,
            explanation_profile: "thorough",
            gap_focus,
            include_connection_questions: includeConnection,
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
  await storeActiveSession(sessionObj, { bumpRev: true });
  state.activeSession = sessionObj;
  invalidatePrefetch();

  return { skipped: false, adjusted, strongBlocks, weakBlocks, session: sessionObj };
}

/** Stable key for prefetch cache — includes pedagogical profile (research R3) profile (research R3). */
export function buildBlockConfigKey(cfg) {
  const c = cfg && typeof cfg === "object" ? cfg : {};
  const nTest = clampInt(c.n_test, 0, MAX_N_TEST, 2);
  const nSoc = clampInt(c.n_socratic, 0, 3, 1);
  const profile = normalizeExplanationProfile(c.explanation_profile, "thorough");
  const gaps = normalizeGapFocus(c.gap_focus);
  const includeConn = c.include_connection_questions !== false;
  return `${includeConn ? "1" : "0"}|${nTest}|${nSoc}|${profile}|${gaps.join(",")}`;
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
  const paragraphOpts = buildParagraphFormatOpts(
    cleaned.title || blockTitle,
    normalizeExplanationProfile(c.explanation_profile, "thorough"),
  );
  cleaned.explanation = enforceExplanationParagraphs(cleaned.explanation, paragraphOpts);
  if (!Array.isArray(cleaned.questions)) cleaned.questions = [];
  if (!Array.isArray(cleaned.concepts)) cleaned.concepts = [];
  if (!cleaned._config || typeof cleaned._config !== "object") cleaned._config = {};
  cleaned._config.n_test = clampInt(c.n_test, 0, MAX_N_TEST, 2);
  cleaned._config.n_socratic = clampInt(c.n_socratic, 0, 3, 1);
  cleaned._config.explanation_profile = normalizeExplanationProfile(
    c.explanation_profile,
    "thorough",
  );
  cleaned._config.gap_focus = normalizeGapFocus(c.gap_focus);
  cleaned._config.include_connection_questions = c.include_connection_questions !== false;
  return cleaned;
}

let onPrefetchReady = null;
let onBridgeReady = null;
let onPersistFailure = null;

export function setOnPersistFailure(fn) {
  onPersistFailure = typeof fn === "function" ? fn : null;
}

export function notifyPersistFailure(error) {
  if (typeof onPersistFailure !== "function") return;
  try {
    onPersistFailure(error);
  } catch (err) {
    console.warn("notifyPersistFailure: callback failed", err);
  }
}

async function persistActiveRsvpSlice(slice, { bumpRev } = {}) {
  if (!slice || typeof slice !== "object") return { ok: false, error: "invalid" };
  if (!slice._meta || typeof slice._meta !== "object") slice._meta = {};
  if (!slice._meta.session_id) slice._meta.session_id = newSessionId();
  if (bumpRev) {
    const prev = Number(slice._meta.rev || 0);
    slice._meta.rev = Number.isFinite(prev) && prev >= 0 ? prev + 1 : 1;
  }
  const mode = normalizeStudyMode(slice.studyMode || state.studyMode);
  if (!slice.studyMode) slice.studyMode = mode;

  const doc = await getActiveDocumentSession();
  if (doc?.docId && (mode === "rsvp" || mode === "questions")) {
    const result = await writeThroughModeSlice(doc, mode, slice);
    if (!result.ok) notifyPersistFailure(result.error);
    return result;
  }

  await storeSessionForMode(mode, slice);
  return { ok: true };
}

export function setOnPrefetchReady(fn) {
  onPrefetchReady = typeof fn === "function" ? fn : null;
}

export function setOnBridgeReady(fn) {
  onBridgeReady = typeof fn === "function" ? fn : null;
}

export let bridgePrefetchState = {
  finishedBlockIndex: null,
  nextBlockIndex: null,
  configKey: "",
  status: "idle", // idle | generating | ready | failed
  text: "",
  error: null,
};

function notifyBridgeReady() {
  if (typeof onBridgeReady === "function") {
    try {
      onBridgeReady();
    } catch (err) {
      console.warn("notifyBridgeReady: onBridgeReady failed", err);
    }
  }
}

function invalidateBridgePrefetch() {
  bridgePrefetchState = {
    finishedBlockIndex: null,
    nextBlockIndex: null,
    configKey: "",
    status: "idle",
    text: "",
    error: null,
  };
}

function normalizeBridgeText(raw) {
  const text = String(raw || "")
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  return extractSneakPeek(text, 4);
}

export function triggerBridgePrefetch(finishedBlockIndex, nextBlockIndex, nextBlockData, configKey) {
  if (isOfflineMode()) return;
  if (isQuestionsStudyMode(state.activeSession)) return;

  const finishedIdx = Math.max(0, Math.floor(Number(finishedBlockIndex) || 0));
  const nextIdx = Math.max(0, Math.floor(Number(nextBlockIndex) || 0));
  const key = String(configKey || "");

  const alreadyGeneratingSame =
    bridgePrefetchState.status === "generating" &&
    bridgePrefetchState.finishedBlockIndex === finishedIdx &&
    bridgePrefetchState.nextBlockIndex === nextIdx &&
    bridgePrefetchState.configKey === key;
  if (alreadyGeneratingSame) return;

  bridgePrefetchState = {
    finishedBlockIndex: finishedIdx,
    nextBlockIndex: nextIdx,
    configKey: key,
    status: "generating",
    text: "",
    error: null,
  };

  const llmModel = getSessionLlmModel(state.activeSession);
  try {
    assertLlmKeyPresent(llmModel);
  } catch (err) {
    bridgePrefetchState.status = "failed";
    bridgePrefetchState.error = err;
    notifyBridgeReady();
    return;
  }

  const finishedBlock = getBlock(finishedIdx);
  const finishedTitle = getBlockTitleSafe(finishedIdx);
  const finishedSummary = getBlockSummaryFromList(finishedIdx);
  const finishedRecap = extractSneakPeek(String(finishedBlock?.explanation || ""), 2);
  const nextTitle =
    String(nextBlockData?.title || "").trim() || getBlockTitleSafe(nextIdx);
  const nextSummary = getBlockSummaryFromList(nextIdx);
  const blocksOutline = String(state.activeSession?.blocks_list_text || "").trim();

  void deepSeekGenerateBlockBridge({
    llmModel,
    language: getStudyLanguage(),
    finishedBlockTitle: finishedTitle,
    finishedBlockSummary: finishedSummary,
    finishedBlockRecap: finishedRecap,
    nextBlockTitle: nextTitle,
    nextBlockSummary: nextSummary,
    finishedBlockIndex: finishedIdx,
    nextBlockIndex: nextIdx,
    totalBlocks: getTotalBlocksSafe(),
    blocksOutline,
  })
    .then((raw) => {
      if (bridgePrefetchState.finishedBlockIndex !== finishedIdx) return;
      if (bridgePrefetchState.nextBlockIndex !== nextIdx) return;
      if (bridgePrefetchState.configKey !== key) return;
      const text = normalizeBridgeText(raw);
      bridgePrefetchState.status = text ? "ready" : "failed";
      bridgePrefetchState.text = text;
      bridgePrefetchState.error = text ? null : new Error("Empty bridge preview");
      notifyBridgeReady();
    })
    .catch((err) => {
      if (bridgePrefetchState.finishedBlockIndex !== finishedIdx) return;
      if (bridgePrefetchState.nextBlockIndex !== nextIdx) return;
      if (bridgePrefetchState.configKey !== key) return;
      bridgePrefetchState.status = "failed";
      bridgePrefetchState.error = err;
      notifyBridgeReady();
    });
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
    const result = persistActiveRsvpSlice(state.activeSession, { bumpRev: true });
    if (!result.ok) {
      console.warn("applyPrefetchReadySideEffects: session write-through failed", result.error);
    }
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
  invalidateBridgePrefetch();
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
    n_test: clampInt(opts.n_test, 0, MAX_N_TEST, resolved.n_test),
    n_socratic: clampInt(opts.n_socratic, 0, 3, resolved.n_socratic),
    include_connection_questions: resolved.include_connection_questions,
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
      if (idx >= 1) {
        triggerBridgePrefetch(idx - 1, idx, result, configKey);
      }
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

