import { MAX_N_TEST } from "./config.js?v=20260527_1";
import {
  buildParagraphFormatOpts,
  enforceExplanationParagraphs,
  explanationParagraphHardRule,
  getMinExplanationParagraphs,
  hasValidExplanationParagraphs,
} from "./explanationParagraphs.js?v=20260527_1";
import {
  getActiveSessionLlmModel,
  getApiKeyForLlmModel,
  llmChatCompletions,
  normalizeLlmModel,
} from "./llm.js?v=20260525_1";
import { shuffleInPlace, shuffleTestQuestionsInList } from "./shuffle-options.js";

function resolveLlmModelArg(llmModel) {
  return normalizeLlmModel(llmModel ?? getActiveSessionLlmModel());
}

function stripJsonFence(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function extractBalancedJsonText(text, openChar, closeChar) {
  const raw = String(text || "").trim();
  const start = raw.indexOf(openChar);
  if (start < 0) return raw;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === openChar) {
      depth += 1;
    } else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  return raw.slice(start);
}

function extractJsonObjectText(text) {
  return extractBalancedJsonText(text, "{", "}");
}

function extractJsonArrayText(text) {
  return extractBalancedJsonText(text, "[", "]");
}

function escapeLatexMathBackslashes(text) {
  return String(text || "")
    .replace(/\\\(([\s\S]*?)\\\)/g, (match) => match.replace(/\\/g, "\\\\"))
    .replace(/\\\[([\s\S]*?)\\\]/g, (match) => match.replace(/\\/g, "\\\\"));
}

function escapeInvalidJsonBackslashes(text) {
  return String(text || "").replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}

function repairJsonLight(text) {
  return String(text || "")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([\]}])/g, "$1");
}

function tryParseJsonCandidate(candidate) {
  if (!candidate) return null;
  const attempts = [
    candidate,
    repairJsonLight(candidate),
    escapeLatexMathBackslashes(candidate),
    escapeInvalidJsonBackslashes(candidate),
    escapeInvalidJsonBackslashes(escapeLatexMathBackslashes(candidate)),
    repairJsonLight(escapeInvalidJsonBackslashes(escapeLatexMathBackslashes(candidate))),
  ];
  for (const text of attempts) {
    try {
      return JSON.parse(text);
    } catch {
      // next repair
    }
  }
  return null;
}

function parseModelJsonObject(text) {
  const raw = String(text || "").trim();
  const withoutFence = stripJsonFence(raw);
  const extracted = extractJsonObjectText(withoutFence);
  const candidates = [extracted, withoutFence, raw].filter(Boolean);
  const uniqueCandidates = Array.from(new Set(candidates));

  for (const candidate of uniqueCandidates) {
    const parsed = tryParseJsonCandidate(candidate);
    if (parsed != null) return parsed;
  }

  return null;
}

function parseModelJsonValue(text) {
  const raw = String(text || "").trim();
  const withoutFence = stripJsonFence(raw);
  const extractedArr = extractJsonArrayText(withoutFence);
  const extractedObj = extractJsonObjectText(withoutFence);

  const candidates = [withoutFence, extractedArr, extractedObj, raw].filter(Boolean);
  const uniqueCandidates = Array.from(new Set(candidates));

  for (const candidate of uniqueCandidates) {
    const parsed = tryParseJsonCandidate(candidate);
    if (parsed != null) return parsed;
  }

  return null;
}

function unwrapBlockIndexArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;
  for (const key of ["blocks", "block_index", "blockIndex", "items", "data"]) {
    if (Array.isArray(value[key])) return value[key];
  }
  return null;
}

/** Parse DeepSeek block-split response into a JSON array (or null). */
export function parseBlockIndexFromModelResponse(text) {
  const parsed = parseModelJsonValue(text);
  return unwrapBlockIndexArray(parsed);
}

function normalizePageRange(rawStart, rawEnd, totalPages) {
  const maxPage = Math.max(1, Math.floor(Number(totalPages) || 1));
  let start = Math.floor(Number(rawStart));
  let end = Math.floor(Number(rawEnd));
  if (!Number.isFinite(start) || start < 1) start = 1;
  if (!Number.isFinite(end) || end < start) end = start;
  start = Math.min(start, maxPage);
  end = Math.min(Math.max(end, start), maxPage);
  return { startPage: start, endPage: end };
}

export async function mapBlocksToPages(blockIndex, extractedPages, language, llmModel) {
  const model = resolveLlmModelArg(llmModel);

  const safeBlocks = Array.isArray(blockIndex) ? blockIndex : [];
  const safePages = Array.isArray(extractedPages) ? extractedPages : [];
  if (!safeBlocks.length) return [];

  const totalPages = Math.max(0, Math.floor(Number(safePages.length) || 0));
  const lang = String(language || "English").trim() || "English";
  const groupSize = 20;
  const totalGroups = Math.max(1, Math.ceil(safeBlocks.length / groupSize));
  const samplePages = safePages
    .filter((_, i) => i % 10 === 0)
    .map((p) => `[Page ${Number(p?.pageNum) || 0}]: ${String(p?.text || "").slice(0, 200)}`)
    .join("\n");

  const mappedById = new Map();

  for (let gi = 0; gi < totalGroups; gi += 1) {
    const group = safeBlocks.slice(gi * groupSize, (gi + 1) * groupSize);
    if (!group.length) continue;

    console.log(`Mapping blocks to pages... (group ${gi + 1} of ${totalGroups})`);

    const systemPrompt = `You are mapping study blocks to page ranges in a textbook.
The document has {totalPages} pages total.
The document contains two sources:
  - O&R = Osborne & Rubinstein game theory textbook (pages 1-~500)
  - TNC = The Negotiation Challenge book (pages ~500-{totalPages})
  - SINT = synthesis blocks, no direct source pages

For each block, estimate the page range where its content appears.
For SINT blocks: set startPage and endPage to -1.

Page samples for orientation:
{samplePages}

Return ONLY valid JSON array:
[{id, startPage, endPage}]

Be generous with ranges - it's better to include
extra pages than to miss content.
Respond in {language}.`
      .replaceAll("{totalPages}", String(totalPages))
      .replace("{samplePages}", samplePages || "(no page samples)")
      .replace("{language}", lang);

    const userPrompt = JSON.stringify(
      group.map((b) => ({
        id: b?.id,
        title: b?.title,
        source: b?.source,
        level: b?.level,
      })),
    );

    const content = await llmChatCompletions({
      llmModel: model,
      max_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    });

    const rawMap = parseModelJsonValue(content);
    if (!Array.isArray(rawMap)) {
      throw new Error("Model did not return a valid JSON array for block-page mapping.");
    }

    for (const row of rawMap) {
      const id = Number(row?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const startPage = Number(row?.startPage);
      const endPage = Number(row?.endPage);
      mappedById.set(id, { startPage, endPage });
    }
  }

  const { estimateBlockPageRange } = await import("./session.js?v=20260525_1");
  const estimated = estimateBlockPageRange(safeBlocks, totalPages);
  const estimatedById = new Map(
    estimated
      .map((b) => ({
        id: Number(b?.id),
        startPage: Number(b?.startPage),
        endPage: Number(b?.endPage),
      }))
      .filter((b) => Number.isFinite(b.id) && b.id > 0),
  );

  const mappedWithRanges = safeBlocks.map((block) => {
    const id = Number(block?.id);
    const source = String(block?.source || "").trim().toUpperCase();
    const mapped = mappedById.get(id);
    const isSint = source === "SINT";

    if (!mapped) {
      const fallback = estimatedById.get(id);
      const safe = normalizePageRange(fallback?.startPage, fallback?.endPage, totalPages || 1);
      return { ...block, startPage: safe.startPage, endPage: safe.endPage };
    }

    if (isSint && Number(mapped.startPage) === -1) {
      return { ...block, startPage: -1, endPage: -1 };
    }

    const safe = normalizePageRange(mapped.startPage, mapped.endPage, totalPages || 1);
    return { ...block, startPage: safe.startPage, endPage: safe.endPage };
  });

  const nearestNonSintRange = (targetId) => {
    let best = null;
    for (const block of mappedWithRanges) {
      const id = Number(block?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const source = String(block?.source || "").trim().toUpperCase();
      if (source === "SINT") continue;
      const startPage = Number(block?.startPage);
      const endPage = Number(block?.endPage);
      if (!Number.isFinite(startPage) || !Number.isFinite(endPage) || startPage < 1 || endPage < 1) continue;
      const distance = Math.abs(id - targetId);
      if (!best || distance < best.distance) {
        best = { distance, startPage, endPage };
      }
    }
    return best;
  };

  return mappedWithRanges.map((block) => {
    const source = String(block?.source || "").trim().toUpperCase();
    if (source !== "SINT" || Number(block?.startPage) !== -1) return block;

    const id = Number(block?.id);
    const near = nearestNonSintRange(id);
    if (near) {
      const safe = normalizePageRange(near.startPage, near.endPage, totalPages || 1);
      return { ...block, startPage: safe.startPage, endPage: safe.endPage };
    }

    const fallback = estimatedById.get(id);
    const safe = normalizePageRange(fallback?.startPage, fallback?.endPage, totalPages || 1);
    return { ...block, startPage: safe.startPage, endPage: safe.endPage };
  });
}

export async function generateAssessmentQuestions(blockIndex, maxQuestions, llmModel) {
  const model = resolveLlmModelArg(llmModel);

  const blocks = Array.isArray(blockIndex) ? blockIndex : [];
  const maxQ = Math.max(1, Math.floor(Number(maxQuestions) || 0));
  if (!blocks.length) throw new Error("Missing block index.");

  const minimalIndex = blocks.map((b) => ({
    id: Number(b?.id),
    title: String(b?.title || "").trim(),
    summary: String(b?.summary || "").trim(),
  }));

  // Step 1 — distribute budget
  let selected = minimalIndex;
  if (minimalIndex.length > maxQ) {
    const step = minimalIndex.length / maxQ;
    const picks = [];
    const used = new Set();
    for (let i = 0; i < maxQ; i += 1) {
      const idx = Math.min(minimalIndex.length - 1, Math.floor(i * step));
      if (!used.has(idx)) {
        used.add(idx);
        picks.push(minimalIndex[idx]);
      }
    }
    // If rounding produced fewer than maxQ unique indices, fill by moving forward.
    let cursor = 0;
    while (picks.length < maxQ && cursor < minimalIndex.length) {
      if (!used.has(cursor)) {
        used.add(cursor);
        picks.push(minimalIndex[cursor]);
      }
      cursor += 1;
    }
    selected = picks;
  }

  const questionsPerBlock = Math.max(1, Math.floor(maxQ / selected.length));
  const distribution = {};
  let remaining = maxQ;
  for (let i = 0; i < selected.length; i += 1) {
    const id = Number(selected[i]?.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    const n = Math.min(questionsPerBlock, remaining);
    distribution[String(id)] = n;
    remaining -= n;
  }
  // Distribute leftovers (at most selected.length - 1) across blocks.
  if (remaining > 0) {
    for (let i = 0; i < selected.length && remaining > 0; i += 1) {
      const id = Number(selected[i]?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      distribution[String(id)] = (distribution[String(id)] || 0) + 1;
      remaining -= 1;
    }
  }

  // Step 2 — single DeepSeek call
  const systemPrompt = `Generate exactly {maxQuestions} multiple-choice assessment questions 
from this study index. Rules:
- Conceptual only. No arithmetic. Answerable in under 10 seconds.
- 4 options (A/B/C/D), one correct answer.
- ${MC_OPTION_PARITY_RULES}
- Questions must test recognition and understanding, not computation.
- Cover ALL blocks proportionally. 
  Distribution: {block_id: n_questions, ...}
- Each question tagged with its block_id.
- Bad question: 'Compute the flux of F=(x,y) over the unit circle'
- Good question: 'What does flux measure across a closed curve?'
Return ONLY valid JSON:
[{
  block_id: 1,
  question: '...',
  options: {A:'...', B:'...', C:'...', D:'...'},
  answer: 'B'
}]
Distribution: {distribution}`.replace("{maxQuestions}", String(maxQ)).replace(
    "{distribution}",
    JSON.stringify(distribution),
  );

  const userPrompt = JSON.stringify(
    selected.map((b) => ({ id: b.id, title: b.title, summary: b.summary })),
  );

  const content = await llmChatCompletions({
    llmModel: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
  });

  const arr = parseModelJsonValue(content);
  if (!Array.isArray(arr)) {
    console.warn("Invalid assessment JSON response:", content);
    throw new Error("Model did not return a valid JSON array. Please try again.");
  }

  // Step 3 — shuffle question order, permute options, cap to requested count
  const capped = shuffleInPlace(Array.isArray(arr) ? [...arr] : []).slice(0, maxQ);
  return shuffleTestQuestionsInList(capped);
}

export async function generateAssessmentSynthesis(assessmentResults, blockIndex, language, llmModel) {
  try {
    const model = resolveLlmModelArg(llmModel);
    if (!getApiKeyForLlmModel(model)) return null;

    const safeResults =
      assessmentResults && typeof assessmentResults === "object" ? assessmentResults : {};
    const safeIndex = Array.isArray(blockIndex) ? blockIndex : [];

    const weakBlocks = safeIndex
      .filter((b) => safeResults?.perBlock?.[String(Number(b?.id))]?.classification === "weak")
      .map((b) => String(b?.title || "").trim())
      .filter(Boolean);
    const strongBlocks = safeIndex
      .filter((b) => safeResults?.perBlock?.[String(Number(b?.id))]?.classification === "strong")
      .map((b) => String(b?.title || "").trim())
      .filter(Boolean);

    const maxQuestions = Math.max(1, Math.floor(Number(safeResults?.maxQuestions) || 0));
    const pct = Math.round((Number(safeResults?.rawTotal || 0) / maxQuestions) * 100);

    const systemPrompt = `You are a study coach. Be direct and specific.
Respond in {language}. Max 3 sentences.`.replace("{language}", String(language || "English"));
    const userPrompt = `Assessment results for a study session:
Overall score: ${pct}%
Weak areas (need focus): ${weakBlocks.join(", ") || "none"}
Strong areas (already solid): ${strongBlocks.join(", ") || "none"}
All blocks in order: ${safeIndex.map((b) => String(b?.title || "").trim()).filter(Boolean).join(" → ")}

Give a concrete study recommendation: what to prioritise,
whether to skim or skip strong blocks, and flag any weak blocks
that are prerequisites for later strong ones.`;

    return await llmChatCompletions({
      llmModel: model,
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    });
  } catch {
    return null;
  }
}

export const GAP_SYNTHESIS_TIMEOUT_MS = 30000;

export class GapSynthesisError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GapSynthesisError";
    this.code = code;
  }
}

function buildGapSynthesisUserPayload({ assessmentResults, questions, responses, blockIndex }) {
  const perBlock =
    assessmentResults?.perBlock && typeof assessmentResults.perBlock === "object"
      ? assessmentResults.perBlock
      : {};
  const blocks = [];
  for (const b of Array.isArray(blockIndex) ? blockIndex : []) {
    const id = Number(b?.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    const row = perBlock[String(id)] || {};
    const classification = String(row.classification || "ok").trim() || "ok";
    blocks.push({
      id,
      title: String(b?.title || "").trim(),
      classification,
    });
  }

  const qs = Array.isArray(questions) ? questions : [];
  const resp = Array.isArray(responses) ? responses : [];
  const responseRows = [];
  for (let i = 0; i < qs.length; i += 1) {
    const q = qs[i] || {};
    const r = resp[i] || {};
    const blockId = Number(r.block_id ?? q.block_id);
    if (!Number.isFinite(blockId) || blockId <= 0) continue;
    const skipped = Boolean(r.skipped);
    let chosen = null;
    if (!skipped) {
      if (r.chosen != null && String(r.chosen).trim()) {
        chosen = String(r.chosen).trim().toUpperCase().slice(0, 1);
      } else if (r.correct === true) {
        chosen = String(q.answer || "").trim().toUpperCase().slice(0, 1) || null;
      }
    }
    responseRows.push({
      block_id: blockId,
      question: String(q.question || "").trim(),
      chosen,
      correct: skipped ? null : r.correct === true,
      skipped,
    });
  }

  return { blocks, responses: responseRows };
}

function parseGapSynthesisResponse(text) {
  const parsed = parseModelJsonObject(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const raw = parsed.gaps_by_block ?? parsed.gapsByBlock;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return { gaps_by_block: raw, notes: parsed.notes != null ? String(parsed.notes).trim() : undefined };
}

function createLinkedAbortSignal(externalSignal, timeoutMs = GAP_SYNTHESIS_TIMEOUT_MS) {
  if (externalSignal?.aborted) {
    throw new GapSynthesisError("timeout", "Gap synthesis aborted.");
  }
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (externalSignal) externalSignal.addEventListener("abort", onExternalAbort);
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timerId);
      if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
    },
  };
}

async function callGapSynthesisApi({ llmModel, userPayload, language, signal }) {
  const lang = String(language || "English").trim() || "English";
  const systemPrompt = `You analyse multiple-choice assessment results and infer conceptual knowledge gaps.

Rules:
- Respond in ${lang}.
- Return ONLY a JSON object: {"gaps_by_block":{"<block_id>":[{"label":"...","evidence":"..."}]}}.
- Infer 0–3 gaps per block that has wrong or skipped answers; use 0 gaps for strong blocks unless a clear misconception appears in responses.
- Labels: short student-facing noun phrases (3–80 chars). Do NOT include block numbers in labels.
- evidence: optional one short phrase tying the gap to a missed question (may be empty string).
- Max 8 gaps total across the entire session (drop lowest-priority gaps if needed).
- Conceptual gaps only — no arithmetic drills, no "practice calculating…" style tasks.
- Mark each gap with "source":"synthesis" when you include source (optional).`;

  try {
    return await llmChatCompletions({
      llmModel,
      max_tokens: 1024,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      signal,
    });
  } catch (err) {
    throw new GapSynthesisError("api_error", err?.message || "Gap synthesis request failed.");
  }
}

/**
 * Gap synthesis (step C): structured per-block gaps from assessment responses.
 * @returns {{ gaps_by_block: Record<string, {label:string, evidence?:string, source?:string}[]>, notes?: string }}
 */
export async function synthesizeAssessmentGaps({
  assessmentResults,
  questions,
  responses,
  blockIndex,
  language,
  signal,
} = {}) {
  const model = resolveLlmModelArg();
  if (!getApiKeyForLlmModel(model)) {
    throw new GapSynthesisError(
      "missing_api_key",
      model === "gemini-2.5-flash"
        ? "Missing Gemini API key. Open API setup to add it."
        : "Missing DeepSeek API key. Open API setup to add it.",
    );
  }

  const userPayload = buildGapSynthesisUserPayload({
    assessmentResults,
    questions,
    responses,
    blockIndex,
  });

  const { signal: linkedSignal, cleanup } = createLinkedAbortSignal(signal);
  let lastRaw = "";

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (linkedSignal.aborted) {
        throw new GapSynthesisError("timeout", "Gap synthesis timed out.");
      }
      try {
        lastRaw = await callGapSynthesisApi({
          llmModel: model,
          userPayload,
          language,
          signal: linkedSignal,
        });
      } catch (err) {
        if (err?.name === "AbortError" || linkedSignal.aborted) {
          throw new GapSynthesisError("timeout", "Gap synthesis timed out.");
        }
        if (err instanceof GapSynthesisError) throw err;
        throw new GapSynthesisError("api_error", err?.message || "Gap synthesis request failed.");
      }

      const parsed = parseGapSynthesisResponse(lastRaw);
      if (parsed) {
        const { normalizeGapsByBlock } = await import("./session.js?v=20260525_1");
        const gaps_by_block = normalizeGapsByBlock(parsed.gaps_by_block);
        const out = { gaps_by_block };
        if (parsed.notes) out.notes = parsed.notes;
        return out;
      }
    }

    throw new GapSynthesisError("invalid_json", "Model did not return valid gap synthesis JSON.");
  } finally {
    cleanup();
  }
}

export async function deepSeekSocraticTutor({
  llmModel,
  apiKey: _legacyApiKey,
  blockTitle,
  question,
  studentAnswer,
}) {
  const systemPrompt = `You are a Socratic tutor. The student just studied this block: {block.title}.

Structure your reply in two parts (use these exact headings, in the same language as the question):

**Critique**
- Briefly note what is correct in the student's answer.
- Point out gaps, misconceptions, or weak reasoning. Be direct and precise—not only destructive, and not empty praise.

**Suggested answer**
- After the critique, write a complete model answer to the question that incorporates your corrections and missing points.
- It must stand alone as the answer a strong student would give; do not merely repeat the critique.

Be concise overall. Respond in the same language as the question and student answer.`.replace(
    "{block.title}",
    blockTitle,
  );

  const userPrompt = `Question: ${question}\nStudent answer: ${studentAnswer}`;

  return llmChatCompletions({
    llmModel: resolveLlmModelArg(llmModel),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
  });
}

export async function deepSeekSummarySoFar({ llmModel, apiKey: _legacyApiKey, language, userPrompt }) {
  const systemPrompt = `You are a study assistant. Summarize the key concepts, arguments, 
and facts covered so far in this study session. Structure it as:
- One short paragraph of overall context
- A bullet list of the most important points (max 15 bullets)
- A bullet list of key terms introduced
Be concise. Respond in {language}.`.replace("{language}", language);

  return llmChatCompletions({
    llmModel: resolveLlmModelArg(llmModel),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
  });
}

function buildSplitBlocksPrompt(n, lang, { compact = false } = {}) {
  const chunkRule = compact
    ? '- Set "chunk" to "" for every block.'
    : '- Set "chunk" to "" (the app assigns source text locally; do NOT paste document text into chunk).';
  return `You are designing exactly ${n} study blocks for RSVP reading (one word flash at a time; the student cannot re-read).

Design for learning—not for mirroring the document:
- Order blocks by prerequisites (foundations before applications).
- Do NOT copy section titles or source paragraph order when that hurts learning order.
- Each block = ONE teachable concept OR ONE vocabulary set—not one chapter heading.
- If several sections teach the same core idea, merge them into ONE block named after the concept.
- Never duplicate the same primary concept in two blocks.

Module + vocabulary structure:
- Infer natural thematic modules from the material.
- For EACH module, its FIRST block MUST be a vocabulary block:
  - title: "Key terms: [short module name]" (exact prefix "Key terms: ")
  - summary: one sentence stating this block lists 6-10 terms only, no narrative yet.
  - signature: the 6-10 term strings (no other words).
- Later blocks in that module build on those terms; each summary must note they assume the module vocabulary block.
- Vocabulary blocks count toward the total of ${n}.

Other rules:
- Return EXACTLY ${n} objects with ids 1 through ${n}.
- Non-vocabulary blocks: unique "signature" of 3-5 key terms for that block only.
${chunkRule}
- Valid JSON only: double-quoted keys/strings, no trailing commas, no comments.

Return ONLY one JSON object (no markdown, no preamble):
{"blocks":[{"id":1,"title":"Key terms: ...","summary":"...","signature":["term1"],"chunk":""}]}

Cover the full material. Respond entirely in ${lang}.`;
}

async function callLlmSplit({ llmModel, messages, useJsonObjectMode }) {
  return llmChatCompletions({
    llmModel,
    messages,
    temperature: 0.2,
    response_format: useJsonObjectMode ? { type: "json_object" } : undefined,
  });
}

export async function deepSeekSplitIntoBlocks({
  llmModel,
  apiKey: _legacyApiKey,
  nBlocks,
  materialText,
  studyNotes,
  language,
}) {
  const model = resolveLlmModelArg(llmModel);
  const n = Math.max(1, Math.floor(Number(nBlocks) || 1));
  const lang = String(language || "English").trim() || "English";
  const notes = String(studyNotes || "").trim();
  const material = String(materialText || "").trim();

  function buildMessages(compact) {
    const messages = [{ role: "system", content: buildSplitBlocksPrompt(n, lang, { compact }) }];
    if (notes) {
      messages.push({
        role: "user",
        content: `Student comments / study focus (follow these preferences when splitting):\n${notes}`,
      });
    }
    messages.push({
      role: "user",
      content: `Split the following material into exactly ${n} blocks.\n\n${material}`,
    });
    return messages;
  }

  const attempts = [
    { compact: false, useJsonObjectMode: true },
    { compact: true, useJsonObjectMode: true },
    { compact: true, useJsonObjectMode: false },
  ];

  let lastRaw = "";
  for (const attempt of attempts) {
    try {
      lastRaw = await callLlmSplit({
        llmModel: model,
        messages: buildMessages(attempt.compact),
        useJsonObjectMode: attempt.useJsonObjectMode,
      });
    } catch (err) {
      if (attempt.useJsonObjectMode && (err?.status === 400 || /response_format/i.test(String(err?.message)))) {
        lastRaw = await callLlmSplit({
          llmModel: model,
          messages: buildMessages(attempt.compact),
          useJsonObjectMode: false,
        });
      } else {
        throw err;
      }
    }

    const blocks = parseBlockIndexFromModelResponse(lastRaw);
    if (Array.isArray(blocks) && blocks.length) {
      return blocks;
    }
    console.warn("Block split: parse failed, trying next attempt…", lastRaw.slice(0, 400));
  }

  console.warn("Block split: all parse attempts failed:", lastRaw.slice(0, 800));
  throw new Error(
    "Model returned blocks JSON we could not parse. Please try generating blocks again.",
  );
}

const OVERVIEW_TITLE_RE = /^(overview|mapa del curso|course map)/i;

export function buildConceptInventoryPrompt(lang) {
  const language = String(lang || "English").trim() || "English";
  return `You are extracting an ordered inventory of teachable concepts from study material.

Rules:
- One concept = one teachable idea sized for RSVP (single pass, no re-read).
- Order by learning prerequisites (foundations before applications).
- Do NOT paste document text or long quotes in the output.
- Each concept: stable id (c1, c2, …), order (1-based, strictly increasing), title, scope_one_line.
- Optional: module (thematic label), prerequisite_ids (array of other concept ids).
- Return enough concepts to cover the material (typically at least 5 for substantial texts).

Output JSON only (no markdown, no preamble):
{"concepts":[{"id":"c1","order":1,"title":"Short concept name","scope_one_line":"What this concept covers","module":"Optional module","prerequisite_ids":[]}]}

Respond entirely in ${language}.`;
}

/** @returns {import('./session.js').ConceptInventoryItem[] | null} */
export function parseConceptInventoryFromModelResponse(text) {
  const parsed = parseModelJsonValue(text);
  let concepts = null;
  if (Array.isArray(parsed)) concepts = parsed;
  else if (parsed && typeof parsed === "object" && Array.isArray(parsed.concepts)) {
    concepts = parsed.concepts;
  }
  if (!concepts?.length) return null;

  const out = [];
  const seenIds = new Set();
  for (const item of concepts) {
    if (!item || typeof item !== "object") continue;
    const id = String(item.id || "").trim();
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    let order = Number(item.order);
    if (!Number.isFinite(order) || order <= 0) order = out.length + 1;
    const title = String(item.title || "").trim();
    const scope_one_line = String(item.scope_one_line || item.scope || "").trim();
    if (!title || !scope_one_line) continue;
    const row = { id, order, title, scope_one_line };
    const moduleName = String(item.module || "").trim();
    if (moduleName) row.module = moduleName;
    if (Array.isArray(item.prerequisite_ids)) {
      row.prerequisite_ids = item.prerequisite_ids
        .map((x) => String(x || "").trim())
        .filter(Boolean);
    }
    out.push(row);
  }
  if (!out.length) return null;
  out.sort((a, b) => a.order - b.order);
  return out;
}

export async function deepSeekConceptInventory({
  llmModel,
  apiKey: _legacyApiKey,
  materialText,
  studyNotes,
  language,
}) {
  const model = resolveLlmModelArg(llmModel);
  const lang = String(language || "English").trim() || "English";
  const notes = String(studyNotes || "").trim();
  const material = String(materialText || "").trim();

  function buildMessages(compact) {
    const system = buildConceptInventoryPrompt(lang);
    const messages = [{ role: "system", content: compact ? `${system}\n\nBe concise. Valid JSON only.` : system }];
    if (notes) {
      messages.push({
        role: "user",
        content: `Student comments / study focus:\n${notes}`,
      });
    }
    messages.push({
      role: "user",
      content: compact
        ? `Extract concepts from this material:\n\n${material.slice(0, 120000)}`
        : `Extract the ordered concept inventory from this material:\n\n${material}`,
    });
    return messages;
  }

  const attempts = [
    { compact: false, useJsonObjectMode: true },
    { compact: true, useJsonObjectMode: true },
    { compact: true, useJsonObjectMode: false },
  ];

  let lastRaw = "";
  for (const attempt of attempts) {
    try {
      lastRaw = await callLlmSplit({
        llmModel: model,
        messages: buildMessages(attempt.compact),
        useJsonObjectMode: attempt.useJsonObjectMode,
      });
    } catch (err) {
      if (attempt.useJsonObjectMode && (err?.status === 400 || /response_format/i.test(String(err?.message)))) {
        lastRaw = await callLlmSplit({
          llmModel: model,
          messages: buildMessages(attempt.compact),
          useJsonObjectMode: false,
        });
      } else {
        throw err;
      }
    }

    const concepts = parseConceptInventoryFromModelResponse(lastRaw);
    if (Array.isArray(concepts) && concepts.length) {
      return concepts;
    }
    console.warn("Concept inventory: parse failed, trying next attempt…", lastRaw.slice(0, 400));
  }

  console.warn("Concept inventory: all parse attempts failed:", lastRaw.slice(0, 800));
  throw new Error(
    "Model returned concept inventory JSON we could not parse. Please try generating blocks again.",
  );
}

export function buildConceptPackPrompt(n, lang, inventoryJson) {
  const targetN = Math.max(1, Math.floor(Number(n) || 1));
  const language = String(lang || "English").trim() || "English";
  const inventory = String(inventoryJson || "[]");
  return `You are packaging a concept inventory into exactly ${targetN} study blocks for RSVP reading.

Input: concept inventory JSON (ordered teachable concepts).
Target block count N = ${targetN}.

Rules:
1. Block id 1 MUST be a global course overview (title starts with "Overview:", "Mapa del curso:", or "Course map:"). It counts toward N. concept_ids may be [].
2. For EACH module in the inventory: the first block for that module MUST be vocabulary: title "Key terms: [module name]", 6-10 terms in signature, concept_ids for that vocab concept only.
3. Never assign the same concept_id to two blocks.
4. If distinct concepts + overview + vocab blocks exceed N: merge related/adjacent concepts until you have exactly ${targetN} blocks. Record merges in pack_meta.merges.
5. If fewer than N blocks are justified: set pack_meta.final_block_count to the actual count (no padding).
6. Every block: summary, signature (3-10 strings), chunk "" (always empty).

Output JSON only:
{"blocks":[{"id":1,"title":"Overview: ...","summary":"...","signature":["term1"],"concept_ids":[],"chunk":""}],"pack_meta":{"target_n":${targetN},"final_block_count":12,"merges":[{"concept_ids":["c5","c6"],"block_title":"..."}]}}

Concept inventory:
${inventory}

Respond entirely in ${language}.`;
}

function isOverviewBlockTitle(title) {
  return OVERVIEW_TITLE_RE.test(String(title || "").trim());
}

/** @returns {{ blocks: object[], pack_meta: object } | null} */
export function parseConceptPackFromModelResponse(text, { targetN } = {}) {
  const parsed = parseModelJsonValue(text);
  if (!parsed || typeof parsed !== "object") return null;

  const blocksRaw = unwrapBlockIndexArray(parsed);
  if (!Array.isArray(blocksRaw) || !blocksRaw.length) return null;

  const packMetaRaw = parsed.pack_meta && typeof parsed.pack_meta === "object" ? parsed.pack_meta : {};
  const target_n = Math.max(
    1,
    Math.floor(Number(packMetaRaw.target_n ?? targetN) || Number(targetN) || blocksRaw.length),
  );
  let final_block_count = Math.floor(Number(packMetaRaw.final_block_count));
  if (!Number.isFinite(final_block_count) || final_block_count <= 0) {
    final_block_count = blocksRaw.length;
  }

  const blockOne = blocksRaw.find((b) => Number(b?.id) === 1) ?? blocksRaw[0];
  if (!blockOne || !isOverviewBlockTitle(blockOne.title)) return null;

  const seenConceptIds = new Set();
  for (const block of blocksRaw) {
    const ids = Array.isArray(block.concept_ids) ? block.concept_ids : [];
    for (const cid of ids) {
      const s = String(cid || "").trim();
      if (!s) continue;
      if (seenConceptIds.has(s)) return null;
      seenConceptIds.add(s);
    }
  }

  const blocks = blocksRaw.map((b) => {
    const signatureArr = Array.isArray(b.signature) ? b.signature : [];
    const signature = signatureArr.map((t) => String(t || "").trim()).filter(Boolean);
    const concept_ids = Array.isArray(b.concept_ids)
      ? b.concept_ids.map((c) => String(c || "").trim()).filter(Boolean)
      : [];
    return {
      id: Number(b.id),
      title: String(b.title || "").trim(),
      summary: String(b.summary || b.description || b.title || "").trim(),
      signature,
      chunk: "",
      concept_ids,
    };
  });

  const merges = Array.isArray(packMetaRaw.merges)
    ? packMetaRaw.merges
        .filter((m) => m && typeof m === "object")
        .map((m) => ({
          concept_ids: Array.isArray(m.concept_ids)
            ? m.concept_ids.map((c) => String(c || "").trim()).filter(Boolean)
            : [],
          block_title: String(m.block_title || "").trim(),
        }))
        .filter((m) => m.concept_ids.length)
    : [];

  const pack_meta = {
    target_n,
    final_block_count: Math.min(final_block_count, blocks.length),
    merges,
  };

  return { blocks, pack_meta };
}

export async function deepSeekPackConceptsToBlocks({
  llmModel,
  apiKey: _legacyApiKey,
  inventory,
  nBlocks,
  studyNotes,
  language,
}) {
  const model = resolveLlmModelArg(llmModel);
  const n = Math.max(1, Math.floor(Number(nBlocks) || 1));
  const lang = String(language || "English").trim() || "English";
  const notes = String(studyNotes || "").trim();
  const inventoryJson = JSON.stringify(Array.isArray(inventory) ? inventory : []);

  function buildMessages(compact) {
    const messages = [
      { role: "system", content: buildConceptPackPrompt(n, lang, inventoryJson) },
    ];
    if (notes) {
      messages.push({
        role: "user",
        content: `Student comments / study focus:\n${notes}`,
      });
    }
    if (compact) {
      messages.push({
        role: "user",
        content: `Pack concepts into ${n} blocks. JSON only.`,
      });
    }
    return messages;
  }

  const attempts = [
    { compact: false, useJsonObjectMode: true },
    { compact: true, useJsonObjectMode: true },
    { compact: true, useJsonObjectMode: false },
  ];

  let lastRaw = "";
  for (const attempt of attempts) {
    try {
      lastRaw = await callLlmSplit({
        llmModel: model,
        messages: buildMessages(attempt.compact),
        useJsonObjectMode: attempt.useJsonObjectMode,
      });
    } catch (err) {
      if (attempt.useJsonObjectMode && (err?.status === 400 || /response_format/i.test(String(err?.message)))) {
        lastRaw = await callLlmSplit({
          llmModel: model,
          messages: buildMessages(attempt.compact),
          useJsonObjectMode: false,
        });
      } else {
        throw err;
      }
    }

    const packed = parseConceptPackFromModelResponse(lastRaw, { targetN: n });
    if (packed?.blocks?.length) {
      return packed;
    }
    console.warn("Concept pack: parse failed, trying next attempt…", lastRaw.slice(0, 400));
  }

  console.warn("Concept pack: all parse attempts failed:", lastRaw.slice(0, 800));
  throw new Error(
    "Model returned concept pack JSON we could not parse. Please try generating blocks again.",
  );
}

export async function deepSeekAuditBlockIndex({ llmModel, apiKey: _legacyApiKey, blockIndexJson, language }) {
  const model = resolveLlmModelArg(llmModel);
  const systemPrompt = `You are auditing a study session block index for conceptual overlap.

Here is the block index (id, title, summary, signature):
{blockIndexJSON}

Your task:
1. Identify ALL pairs of blocks where the primary concept overlaps.
   Overlap = the same core idea, formula, or theorem is taught in both.
2. For each overlapping pair, recommend: MERGE or KEEP SEPARATE.
   MERGE only if: both blocks teach the same concept at the same depth with substantial redundant text (same examples, same formulas repeated).
   KEEP SEPARATE if: one introduces and the other extends, deepens, or applies; blocks are sequential chapters of one theme; or overlap is thematic adjacency only.
3. Output a merge plan (use an empty "merges" array if nothing qualifies):

{
  "merges": [
    {
      "keep_id": 3,
      "absorb_ids": [4, 5],
      "new_title": "Line Integrals: Concept, Calculation and Circulation",
      "reason": "Blocks 3, 4, 5 all teach the formula ∫F·c'dt with the same example"
    }
  ],
  "no_change": [1, 2, 6, 7],
  "summary": "X blocks → Y blocks after merging"
}

Be conservative: if in doubt, KEEP SEPARATE. Losing study depth is worse than a few overlapping blocks.
Respond ONLY with valid JSON.`
    .replace("{blockIndexJSON}", String(blockIndexJson || "[]"))
    .replace("{language}", language);

  return llmChatCompletions({
    llmModel: model,
    messages: [{ role: "system", content: systemPrompt }],
    temperature: 0.2,
    max_tokens: 2000,
  });
}

const MERGE_WORDS_PER_BLOCK = 2000;

export async function deepSeekPostMergeChunk({
  llmModel,
  apiKey: _legacyApiKey,
  keep_id,
  absorb_ids,
  new_title,
  concatenated_chunks,
  block_count,
}) {
  const absorbList = Array.isArray(absorb_ids) ? absorb_ids : [];
  const nBlocks = Math.max(
    1,
    Math.floor(Number(block_count)) || 1 + absorbList.length,
  );
  const maxWords = MERGE_WORDS_PER_BLOCK * nBlocks;
  const maxTokens = Math.min(8000, Math.max(2000, maxWords * 2));

  const systemPrompt = `The following blocks have been merged:
- Original blocks {absorb_ids} are absorbed into block {keep_id}
- New title: {new_title}
- Blocks merged: {block_count} (keep + absorbed)

Here are the original chunks for all merged blocks:
{concatenated_chunks}

Return a single merged chunk: combine the source texts, remove duplicate explanations only, keep all unique examples and formulas.
Preserve verbatim source text where possible. Do not summarize away unique material. Max {max_words} words.`
    .replace("{keep_id}", String(keep_id))
    .replace("{absorb_ids}", absorbList.join(", "))
    .replace("{new_title}", String(new_title || ""))
    .replace("{block_count}", String(nBlocks))
    .replace("{concatenated_chunks}", String(concatenated_chunks || ""))
    .replace("{max_words}", String(maxWords));

  return llmChatCompletions({
    llmModel: resolveLlmModelArg(llmModel),
    messages: [{ role: "system", content: systemPrompt }],
    temperature: 0.2,
    max_tokens: maxTokens,
  });
}

const BLOCK_JSON_SCHEMA = `{
  id: number,
  title: string,
  explanation: string (markdown),
  questions: [{
    type: "test" | "socratic",
    question: string,
    options?: { A, B, C, D },
    answer?: string,
    feedback?: string
  }],
  concepts: [
    { term: string, definition: string }
  ]
}`;

const EXPLANATION_RSVP_THOROUGH = `You are writing study material optimized for RSVP reading (rapid serial visual presentation). The student reads word by word at high speed and CANNOT re-read. This imposes strict rules:

CONTENT STRUCTURE (mandatory drafting order—never expose these step names in the explanation text):
1. Hook — 1 sentence: why this concept exists; what problem it solves.
2. Core definition — 1-3 sentences: plain language; no Latin yet; no jargon; explain to a smart 16-year-old.
3. Technical layer — 2-4 sentences: formal/Latin terms; each term in its own sentence (e.g. "The Romans called this X, meaning Y.").
4. Concrete example — 2-4 sentences: one specific vivid real-world case; not "imagine..."; a real instance.
5. Contrast — 1-3 sentences: what this is NOT; common confusions.
6. Connection — 1-2 sentences: link to the next concept or the course arc.

When this block is not first, add a bridge from the previous block (the previous block title or its key concept).
That bridge goes in the very first Hook sentence (first sentence of the first paragraph) and uses the provided previous title.
This keeps the connection visible even when only four sentences are previewed (the sneak preview never reaches the final Connection paragraph).

OUTPUT FORMAT (explanation field):
- Continuous prose only. Never print section names or headings (no HOOK, CORE, EXAMPLE, CONTRAST, ALL-CAPS labels, or markdown **bold** section titles).
- One paragraph per structure step above, in order. Put exactly one blank line between paragraphs so the RSVP reader inserts a short pause—this marks subsections; visible labels distract at speed.
- Each paragraph uses short flowing sentences; a step may use 2-3 sentences but stays one paragraph.

WRITING RULES (non-negotiable):
- Short sentences: subject-verb-object. Maximum 15 words per sentence. Break any longer sentence in two. RSVP destroys long sentences with subordinate clauses.
- One idea per sentence. Never connect two concepts with "and" or "but" in the same sentence.
- No parentheses. No semicolons. No em-dashes.
- Define every technical term the first time it appears. Never use a term before defining it.
- If a concept requires knowing another concept first, teach that first (in an earlier block—not here).
- Strict pedagogical order: definition → concrete example → implication. Never reverse (no example before definition; no implication before the example that supports it).
- Prefer active voice. Prefer concrete nouns over abstract ones.
- Do NOT copy source prose: no 80-word sentences, no five concepts per paragraph, no undefined vocabulary.
- Total length: 200-300 words maximum. Dense but scannable at speed.`;

const EXPLANATION_VOCABULARY_BLOCK = `This block is a VOCABULARY block (title starts with "Key terms:"). The student reads via RSVP and CANNOT re-read.

Write ONLY definitions—no narrative, no relationships between terms yet.

Format the explanation as one paragraph per term (6-10 terms):
**TERM** — Plain-language definition. Why the term exists. One-sentence real example.

WRITING RULES: subject-verb-object; max 15 words per sentence; one idea per sentence; no parentheses, semicolons, or em-dashes; define before use.
Do not use section labels or headings. Later blocks reference these terms as known.`;

const EXPLANATION_BRIEF_DEEP = `Brief RSVP recap for a student who already studied this material. CANNOT re-read. Max 120 words.

Cover only: hook (1 sentence), core definition (1-2 sentences), technical layer (1-2 sentences), contrast (1 pitfall sentence). Omit concrete example and connection unless a listed learning gap requires them.
When this block is not first, the first Hook sentence (first sentence of the first paragraph) must explicitly state how it builds on the previous block title or key concept.
That bridge sentence must come first so a four-sentence preview still shows the connection before the later Connection paragraph.
Same output rules as thorough: flowing prose, no section labels or headings, one blank line between paragraphs for subsection pauses.
Same writing rules: subject-verb-object; max 15 words per sentence; one idea per sentence; definition before example; no source regurgitation.`;

function getPreviousBlockTitleFromList(blocksListText, blockNumber) {
  const targetNo = Math.floor(Number(blockNumber));
  if (!Number.isFinite(targetNo) || targetNo <= 0) return "";
  const lines = String(blocksListText || "").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\.\s*(.+)\s*$/);
    if (!match) continue;
    const n = Number(match[1]);
    if (!Number.isFinite(n) || n !== targetNo) continue;
    return match[2].trim();
  }
  return "";
}

/** Shared MC distractor rules — reduces "correct answer stands out" cues. */
export const MC_OPTION_PARITY_RULES = `Option parity (required for every test question): All four options A–D must look like siblings—same language/register, notation, grammar pattern, and similar length (each within ~30% of the median word count; never one 15-word option and three 2-word stubs). If one uses Latin (or a foreign term), all four do—or all give the same style of translation/gloss, or none do. If one has a parenthetical, all do or none do. If the correct answer is a full clause/sentence, every distractor is too. Wrong options stay plausible; do not make the correct one identifiable by formatting, length, or polish alone.`;

const QUESTION_PEDAGOGY_RULES = `Questions must test understanding (apply, discriminate, predict)—not verbatim recall of source phrasing.
For vocabulary blocks: test term-to-meaning or meaning-to-term only; no multi-step application yet.`;

const TEST_FEEDBACK_RULES = `Test feedback quality rules (required for every test question, even before any student answer exists):
- Feedback must read as a short conceptual explanation, not as a label for the right option.
- Start by restating the underlying idea or rule in your own words (without copying any option).
- Then explain why that idea makes the correct option work, using principle-level reasoning.
- Briefly contrast with at least one plausible distractor: name the confusion and why it fails.
- Do NOT copy or closely paraphrase the text of the correct option in the feedback.
- Avoid giveaway lead-ins such as "The correct answer is..." or direct letter references (A/B/C/D).
- Keep it concise (3-5 short sentences), specific, and still useful after the student already knows if they were right or wrong.`;

export function buildBlockGenerationSystemPrompt({
  language,
  n_test,
  n_socratic,
  explanation_profile = "thorough",
  gap_focus = [],
  blockTitle = "",
  blockIndex = 0,
  include_connection_questions = true,
}) {
  const nTest = Math.max(0, Math.min(MAX_N_TEST, Math.round(Number(n_test))));
  const nSocratic = Math.max(0, Math.min(3, Math.round(Number(n_socratic))));
  const totalQuestions = nTest + nSocratic;
  const profile = String(explanation_profile || "").trim() === "brief_deep" ? "brief_deep" : "thorough";
  const isVocabularyBlock = /^Key terms:/i.test(String(blockTitle || "").trim());
  const gaps = Array.isArray(gap_focus)
    ? gap_focus.map((g) => String(g || "").trim()).filter(Boolean)
    : [];
  const paragraphOpts = buildParagraphFormatOpts(blockTitle, profile);
  const paragraphRule = explanationParagraphHardRule(paragraphOpts);
  const explanationSection = isVocabularyBlock
    ? `${EXPLANATION_VOCABULARY_BLOCK}\n${paragraphRule}`
    : profile === "brief_deep"
      ? `${EXPLANATION_BRIEF_DEEP}\n${paragraphRule}`
      : `${EXPLANATION_RSVP_THOROUGH}\n${paragraphRule}`;
  const blockNo = Number(blockIndex) + 1;
  const blockNoSafe = Number.isFinite(blockNo) && blockNo > 0 ? blockNo : 1;
  const connectionEnabled = include_connection_questions !== false;
  const requireConnection = connectionEnabled && blockNoSafe > 1;
  const connectionSlotReserved = requireConnection && totalQuestions > 0 ? 1 : 0;
  const gapSlots = Math.max(0, totalQuestions - connectionSlotReserved);

  const gapSection =
    gaps.length > 0
      ? `
Gap-focused questions (${gaps.length} learning gap(s) listed in the user message):
- Generate at least one question per gap (test or socratic) — ${gaps.length} gap(s) require at least ${gaps.length} gap-targeted question(s) in total.
- Each gap-targeted question must focus on that gap: application, discrimination, or common errors — not generic recall.
${requireConnection ? `- Since exactly ONE connection question is required, you only have up to ${gapSlots} question slot(s) for gap-focused questions.` : `- Connection questions are NOT required for this block.`}
${requireConnection ? `- If ${gapSlots} is less than the gap count, prioritize gaps in the numbered order given (assessment misses first).` : ``}`
      : "";

  const connectionSection = requireConnection
    ? `Connection question (required):
- If ${totalQuestions} == 0, generate no questions at all.
- Otherwise generate exactly ONE connection question.
- Connection question must ask the student to relate THIS block's concept to earlier blocks in the confirmed list.
Placement rule:
- If n_socratic > 0, make the connection question the FIRST socratic question.
- Else if n_test > 0, make the connection question the FIRST test question.`
    : `Connection question:
- Not required for this block (block 1 only, or when the option is disabled).
- Do NOT generate any connection question.`;

  return `You will receive study material and a confirmed list of blocks. Generate JSON for ONLY ONE block.
Return a single JSON object with this schema:
${BLOCK_JSON_SCHEMA}
Respond entirely in ${String(language || "English").trim() || "English"}.
Generate exactly ${nTest} test questions (type: "test") and ${nSocratic} socratic questions (type: "socratic") in the questions array.
Test questions: 4 options (A/B/C/D), one correct answer, and high-value feedback.
${MC_OPTION_PARITY_RULES}
${TEST_FEEDBACK_RULES}
Socratic questions: open-ended, no options, no correct answer field.
Order: all test questions first, then all socratic questions.
If n_test=0 or n_socratic=0, omit that type entirely.
${connectionSection}
${QUESTION_PEDAGOGY_RULES}
When the material includes equations or expressions that must be reproduced exactly (LaTeX in the explanation counts), include AT LEAST one question whose primary focus is choosing the CORRECT FORM of the key formula or expression versus plausible incorrect variants (missing factor, wrong exponent/sign, swapped terms, dimensional inconsistency patterns). Prefer inline LaTeX in option text using \\( ... \\) when needed so each option renders clearly; all four options must use the same LaTeX style and comparable complexity.
${explanationSection}
${gapSection}
Also extract key concepts for the dictionary: ${isVocabularyBlock ? "every term in this vocabulary block (6-10)." : "3-8 non-obvious domain terms introduced in the Technical layer."}
For each: the term exactly as used, and a definition of max 15 words.
Only include terms that are non-obvious or domain-specific. No common words.
Every LaTeX backslash MUST be escaped for JSON strings: use "\\\\(", "\\\\)", "\\\\nabla", "\\\\cdot", etc.
Return ONLY valid JSON. No preamble, no backticks, no markdown fences.`;
}

export function buildBlockGenerationUserContent({
  blocksListText,
  materialText,
  blockIndex,
  blockTitle,
  previousComment,
  gap_focus = [],
}) {
  const gaps = Array.isArray(gap_focus)
    ? gap_focus.map((g) => String(g || "").trim()).filter(Boolean)
    : [];
  const gapBlock =
    gaps.length > 0
      ? `\n\nLearning gaps to target (generate ≥1 question per gap):\n${gaps.map((g, i) => `${i + 1}. ${g}`).join("\n")}`
      : "";
  const commentLine = previousComment
    ? `\n\nThe student had this comment after the previous block:\n${previousComment}\nTake it into account for the explanation and questions.`
    : "";

  const blockNoRaw = Number(blockIndex) + 1;
  const blockNo = Number.isFinite(blockNoRaw) && blockNoRaw > 0 ? blockNoRaw : 1;
  const previousTitle =
    blockNo > 1 ? getPreviousBlockTitleFromList(blocksListText, blockNo - 1) : "";
  const previousBlockLine = previousTitle
    ? `\nPrevious block title: ${previousTitle}\nUse this title to write the bridge in the very first Hook sentence (first sentence of the first paragraph) so it appears in the sneak preview (first <=4 sentences).`
    : "";

  return `Confirmed blocks list:\n${blocksListText}\n\nTarget block:\n${blockNo}. ${blockTitle}${previousBlockLine}\n\nSource material (verbatim chunk for this block only):\n${materialText}${gapBlock}${commentLine}`;
}

const QUESTIONS_ONLY_JSON_SCHEMA = `{
  questions: [{
    type: "test" | "socratic",
    question: string,
    options?: { A, B, C, D },
    answer?: string,
    feedback?: string
  }],
  concepts?: [
    { term: string, definition: string }
  ]
}`;

export function buildQuestionsOnlySystemPrompt({
  language,
  n_test,
  n_socratic,
  gap_focus = [],
  blockTitle = "",
  blockIndex = 0,
  include_connection_questions = true,
}) {
  const nTest = Math.max(0, Math.min(MAX_N_TEST, Math.round(Number(n_test))));
  const nSocratic = Math.max(0, Math.min(3, Math.round(Number(n_socratic))));
  const totalQuestions = nTest + nSocratic;
  const gaps = Array.isArray(gap_focus)
    ? gap_focus.map((g) => String(g || "").trim()).filter(Boolean)
    : [];
  const blockNo = Number(blockIndex) + 1;
  const blockNoSafe = Number.isFinite(blockNo) && blockNo > 0 ? blockNo : 1;
  const connectionEnabled = include_connection_questions !== false;
  const requireConnection = connectionEnabled && blockNoSafe > 1;
  const connectionSlotReserved = requireConnection && totalQuestions > 0 ? 1 : 0;
  const gapSlots = Math.max(0, totalQuestions - connectionSlotReserved);

  const gapSection =
    gaps.length > 0
      ? `
Gap-focused questions (${gaps.length} learning gap(s) listed in the user message):
- Generate at least one question per gap (test or socratic) — ${gaps.length} gap(s) require at least ${gaps.length} gap-targeted question(s) in total.
- Each gap-targeted question must focus on that gap: application, discrimination, or common errors — not generic recall.
${requireConnection ? `- Since exactly ONE connection question is required, you only have up to ${gapSlots} question slot(s) for gap-focused questions.` : `- Connection questions are NOT required for this block.`}
${requireConnection ? `- If ${gapSlots} is less than the gap count, prioritize gaps in the numbered order given (assessment misses first).` : ``}`
      : "";

  const connectionSection = requireConnection
    ? `Connection question (required):
- If ${totalQuestions} == 0, generate no questions at all.
- Otherwise generate exactly ONE connection question.
- Connection question must ask the student to relate THIS block's concept to earlier blocks in the confirmed list.
Placement rule:
- If n_socratic > 0, make the connection question the FIRST socratic question.
- Else if n_test > 0, make the connection question the FIRST test question.`
    : `Connection question:
- Not required for this block (block 1 only, or when the option is disabled).
- Do NOT generate any connection question.`;

  return `You will receive a FIXED block explanation and source material. Generate ONLY new questions — do NOT modify, rewrite, or return the explanation or title.
Return a single JSON object with this schema:
${QUESTIONS_ONLY_JSON_SCHEMA}
Respond entirely in ${String(language || "English").trim() || "English"}.
Generate exactly ${nTest} test questions (type: "test") and ${nSocratic} socratic questions (type: "socratic") in the questions array.
Test questions: 4 options (A/B/C/D), one correct answer, and high-value feedback.
${MC_OPTION_PARITY_RULES}
${TEST_FEEDBACK_RULES}
Socratic questions: open-ended, no options, no correct answer field.
Order: all test questions first, then all socratic questions.
If n_test=0 or n_socratic=0, omit that type entirely.
${connectionSection}
${QUESTION_PEDAGOGY_RULES}
Questions MUST test understanding of the PROVIDED explanation text and the source material — not verbatim recall of unrelated source phrasing.
When the material includes equations or expressions that must be reproduced exactly, include AT LEAST one question whose primary focus is choosing the CORRECT FORM of the key formula or expression versus plausible incorrect variants.
${gapSection}
Optionally extract key concepts for the dictionary (3-8 terms) in concepts[] if new terms appear in your questions; omit concepts if none.
Every LaTeX backslash MUST be escaped for JSON strings: use "\\\\(", "\\\\)", "\\\\nabla", "\\\\cdot", etc.
MUST NOT include "explanation", "title", or "id" fields in the response.
Return ONLY valid JSON. No preamble, no backticks, no markdown fences.`;
}

export function buildQuestionsOnlyUserContent({
  blockTitle,
  explanation,
  materialText,
  gap_focus = [],
  previousBlocksTitles = [],
}) {
  const gaps = Array.isArray(gap_focus)
    ? gap_focus.map((g) => String(g || "").trim()).filter(Boolean)
    : [];
  const prevTitles = Array.isArray(previousBlocksTitles) ? previousBlocksTitles : [];
  const prevBlockSection =
    prevTitles.length > 0
      ? `\n\nPrevious blocks (titles, in order):\n${prevTitles.map((t, i) => `${i + 1}. ${t}`).join(
          "\n",
        )}`
      : `\n\nPrevious blocks: none (this is block 1).`;
  const gapBlock =
    gaps.length > 0
      ? `\n\nLearning gaps to target (generate ≥1 question per gap):\n${gaps.map((g, i) => `${i + 1}. ${g}`).join("\n")}`
      : "";
  const fixedExplanation = String(explanation || "").trim();
  return `Block title: ${String(blockTitle || "").trim() || "Untitled"}

FIXED EXPLANATION (do not rewrite this explanation; generate questions that test understanding of it):
${fixedExplanation}

Source material (verbatim chunk for grounding):
${String(materialText || "").trim()}${gapBlock}${prevBlockSection}`;
}

export function warnQuestionsOnlyCountMismatch(responseObj, cfg) {
  if (!responseObj || typeof responseObj !== "object" || !cfg || typeof cfg !== "object") return;
  const questions = Array.isArray(responseObj.questions) ? responseObj.questions : [];
  const nTest = Math.max(0, Math.min(MAX_N_TEST, Math.round(Number(cfg.n_test))));
  const nSoc = Math.max(0, Math.min(3, Math.round(Number(cfg.n_socratic))));
  const expected = nTest + nSoc;
  if (expected > 0 && questions.length !== expected) {
    console.warn(
      `Questions-only regen: expected ${expected} question(s) (${nTest} test, ${nSoc} socratic), got ${questions.length}.`,
    );
  }
  const gaps = Array.isArray(cfg.gap_focus) ? cfg.gap_focus : [];
  if (gaps.length > 0 && questions.length < gaps.length) {
    console.warn(
      `Questions-only regen: ${gaps.length} gap(s) but only ${questions.length} question(s) (expected ≥${gaps.length}).`,
    );
  }
}

export async function deepSeekRegenerateBlockQuestions({
  llmModel,
  apiKey: _legacyApiKey,
  language,
  n_test,
  n_socratic,
  blockTitle,
  blockIndex = 0,
  include_connection_questions = true,
  explanation,
  materialText,
  gap_focus = [],
  previousBlocksTitles = [],
}) {
  const systemPrompt = buildQuestionsOnlySystemPrompt({
    language,
    n_test,
    n_socratic,
    gap_focus,
    blockTitle,
    blockIndex,
    include_connection_questions,
  });
  const userContent = buildQuestionsOnlyUserContent({
    blockTitle,
    explanation,
    materialText,
    gap_focus,
    previousBlocksTitles,
  });

  const raw = await llmChatCompletions({
    llmModel: resolveLlmModelArg(llmModel),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
  });

  const obj = parseModelJsonObject(raw);
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    console.warn("Invalid questions-only JSON response:", raw);
    throw new Error("Model did not return valid JSON for questions. Please try again.");
  }
  if (Object.prototype.hasOwnProperty.call(obj, "explanation")) {
    console.warn("Questions-only regen returned forbidden explanation field — ignoring it.");
    delete obj.explanation;
  }
  if (Object.prototype.hasOwnProperty.call(obj, "title")) {
    delete obj.title;
  }
  return obj;
}

export async function deepSeekGenerateBlockJson({
  llmModel,
  apiKey: _legacyApiKey,
  blocksListText,
  materialText,
  blockIndex,
  blockTitle,
  previousComment,
  language,
  n_test,
  n_socratic,
  explanation_profile = "thorough",
  gap_focus = [],
  include_connection_questions = true,
}) {
  const systemPrompt = buildBlockGenerationSystemPrompt({
    language,
    n_test,
    n_socratic,
    explanation_profile,
    gap_focus,
    blockTitle,
    blockIndex,
    include_connection_questions,
  });

  const userContent = buildBlockGenerationUserContent({
    blocksListText,
    materialText,
    blockIndex,
    blockTitle,
    previousComment,
    gap_focus,
  });

  const raw = await llmChatCompletions({
    llmModel: resolveLlmModelArg(llmModel),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
  });

  const paragraphOpts = buildParagraphFormatOpts(blockTitle, explanation_profile);

  const parseAndEnforceBlock = (responseText) => {
    const obj = parseModelJsonObject(responseText);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      console.warn("Invalid block JSON response:", responseText);
      throw new Error("Model did not return valid JSON for the block. Please try again.");
    }
    if (typeof obj.explanation === "string") {
      obj.explanation = enforceExplanationParagraphs(obj.explanation, paragraphOpts);
    }
    return obj;
  };

  let blockObj = parseAndEnforceBlock(raw);
  if (!hasValidExplanationParagraphs(blockObj.explanation, paragraphOpts)) {
    const min = getMinExplanationParagraphs(paragraphOpts);
    const retryHint =
      `\n\nRETRY REQUIRED: The explanation field MUST contain at least ${min} distinct paragraphs ` +
      `separated by one blank line each (double newline). A single paragraph is invalid.`;
    const rawRetry = await llmChatCompletions({
      llmModel: resolveLlmModelArg(llmModel),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent + retryHint },
      ],
      temperature: 0.2,
    });
    blockObj = parseAndEnforceBlock(rawRetry);
    if (!hasValidExplanationParagraphs(blockObj.explanation, paragraphOpts)) {
      console.warn("Block explanation still lacks required paragraph breaks after retry.");
    }
  }
  return blockObj;
}

export async function generateBlockFromChunk(block, chunk, config = {}, language = "English") {
  const safeBlock = block && typeof block === "object" ? block : {};
  const id = Math.max(1, Math.floor(Number(safeBlock.id) || 1));
  const title = String(safeBlock.title || `Block ${id}`).trim() || `Block ${id}`;
  const source = String(safeBlock.source || "unknown").trim() || "unknown";
  const nTest = Math.max(0, Math.min(MAX_N_TEST, Math.round(Number(config.n_test))));
  const lang = String(language || "English").trim() || "English";
  const materialText = String(chunk || "").trim();
  const include_connection_questions =
    config.include_connection_questions !== false && config.include_connection_questions != null
      ? Boolean(config.include_connection_questions)
      : true;

  const blocksListText = `${id}. ${title}`;
  const sourceLine = `Source: block ${id} '${title}' from ${source}`;
  const blockObj = await deepSeekGenerateBlockJson({
    llmModel: config.llmModel,
    blocksListText,
    materialText: `${sourceLine}\n\n${materialText}`,
    blockIndex: id - 1,
    blockTitle: title,
    previousComment: "",
    language: lang,
    n_test: nTest,
    n_socratic: 0,
    include_connection_questions,
  });
  const paragraphOpts = buildParagraphFormatOpts(title, "thorough");
  return {
    explanation: enforceExplanationParagraphs(
      String(blockObj?.explanation || ""),
      paragraphOpts,
    ),
    questions: Array.isArray(blockObj?.questions) ? blockObj.questions : [],
    concepts: Array.isArray(blockObj?.concepts) ? blockObj.concepts : [],
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateAllBlocks(blockIndex, config = {}) {
  const items = Array.isArray(blockIndex) ? blockIndex : [];
  const total = items.length;
  const results = Array.from({ length: total }, () => null);
  const n_test = Math.max(0, Math.min(MAX_N_TEST, Math.round(Number(config.n_test))));
  const n_socratic = Math.max(0, Math.min(3, Math.round(Number(config.n_socratic))));
  const blocksListText = String(config.blocksListText || "");
  const language = String(config.language || "English");
  const llmModel = resolveLlmModelArg(config.llmModel);
  const signal = config.signal;
  const onProgress = typeof config.onProgress === "function" ? config.onProgress : null;
  const onWarning = typeof config.onWarning === "function" ? config.onWarning : null;
  let failedCount = 0;

  for (let i = 0; i < total; i += 1) {
    if (signal?.aborted) throw new Error("Generation cancelled.");
    const row = items[i] && typeof items[i] === "object" ? items[i] : {};
    const title = String(row.title || `Block ${i + 1}`);
    const materialText = String(row.chunk || "");
    let block = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        block = await deepSeekGenerateBlockJson({
          llmModel,
          blocksListText,
          materialText,
          blockIndex: i,
          blockTitle: title,
          previousComment: "",
          language,
          n_test,
          n_socratic,
        });
        break;
      } catch (err) {
        if (attempt === 0) {
          if (onWarning) onWarning(`Block ${i + 1} failed — retrying...`);
          continue;
        }
        failedCount += 1;
        block = { id: i + 1, title, failed: true, questions: [], explanation: "" };
        if (onWarning) onWarning(`Block ${i + 1} failed and was skipped.`);
      }
    }

    results[i] = block;
    if (onProgress) {
      onProgress({ completed: i + 1, total, title, remaining: Math.max(0, total - (i + 1)), block });
    }
    await sleep(300);
  }

  return { blocks: results, failedCount };
}

export async function deepSeekGenerateReviewBatch({
  llmModel,
  apiKey: _legacyApiKey,
  sessionContent,
  reviewInstructions,
  type,
  batchSize,
}) {
  const typeWord =
    type === "both"
      ? "mixed (test and socratic)"
      : type === "test"
        ? "test"
        : "socratic";

  const testParity =
    type === "test" || type === "both"
      ? `\nFor each test question: 4 options (A/B/C/D), one correct answer, and high-value feedback.\n${MC_OPTION_PARITY_RULES}\n${TEST_FEEDBACK_RULES}\n`
      : "";

  const systemPrompt = `You are a review examiner. Based on this study session content, generate exactly {batch_size} {type} questions that test retention across the ENTIRE session, not just one block.

Rules:
- Questions MUST be new: do NOT copy, paraphrase, or trivially tweak any existing questions from the session, missed-question summaries, or chat history.
- Prefer questions that connect MULTIPLE blocks: comparisons, pre/post relationships, big-picture cause-effect, and how ideas build on each other.
- Only a minority of questions should stay strictly within a single block; most should require recalling how concepts relate across the course arc.
- Re-use concepts and facts, but change the angle, scenario, or granularity so that the student cannot answer by remembering a past question template.
- Avoid asking for mechanical recall of wording; focus on understanding, discrimination between close concepts, and transfer to new situations.

Now generate the review:
Prioritize: key terms, dates, names, cause-effect relationships, and concepts that are easy to confuse.
${testParity}Return ONLY valid JSON array:
[{type, question, options?, answer?, feedback?}]
No preamble, no backticks.`
    .split("{batch_size}")
    .join(String(batchSize))
    .split("{type}")
    .join(String(typeWord));

  const instructions = String(reviewInstructions || "").trim();
  const userParts = [];
  if (instructions) {
    userParts.push(
      `Student review focus (follow these preferences when generating questions):\n${instructions}`,
    );
  }
  userParts.push(String(sessionContent || ""));

  return llmChatCompletions({
    llmModel: resolveLlmModelArg(llmModel),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userParts.filter(Boolean).join("\n\n") },
    ],
    temperature: 0.2,
  });
}

export async function deepSeekReviewSocraticTutor({
  llmModel,
  apiKey: _legacyApiKey,
  sessionContent,
  question,
  studentAnswer,
}) {
  const systemPrompt = `You are a Socratic tutor. The student is reviewing a study session.

Structure your reply in two parts (use these exact headings, in the same language as the question):

**Critique**
- Briefly note what is correct in the student's answer.
- Point out gaps, misconceptions, or weak reasoning. Be direct and precise—not only destructive, and not empty praise.

**Suggested answer**
- After the critique, write a complete model answer to the question that incorporates your corrections and missing points.
- It must stand alone as the answer a strong student would give; do not merely repeat the critique.

Be concise overall. Respond in the same language as the question and student answer.`;
  const userPrompt = `Session context:\n${sessionContent}\n\nQuestion: ${question}\nStudent answer: ${studentAnswer}`;

  return llmChatCompletions({
    llmModel: resolveLlmModelArg(llmModel),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
  });
}

