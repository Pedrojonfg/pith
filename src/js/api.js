import { MAX_N_TEST } from "./config.js?v=20260527_1";
import { ASSESSMENT_FLAGS, isAssessmentQuestionsUiEnabled } from "./config/flags.js";
import { validateBlockFidelity } from "./fidelity-validation.js";
import {
  SOURCE_FIDELITY_RULES,
  buildSourceFirstRsvpStructure,
  mergeFidelityIntoSystemPrompt,
} from "./source-fidelity.js";
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
import {
  normalizeTestQuestion,
  shuffleInPlace,
  shuffleTestQuestionsInList,
} from "./shuffle-options.js";
import { renderCoverageManifestForPrompt } from "./coverage-manifest.js";

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
- Each question must be answerable from that block's summary alone—do not ask about examples or topics the summary does not explain.
- For cause-effect questions, the correct option must include causal links the summary does not already make obvious.
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

export async function deepSeekGenerateBlockBridge({
  llmModel,
  apiKey: _legacyApiKey,
  language,
  finishedBlockTitle,
  finishedBlockSummary,
  finishedBlockRecap,
  nextBlockTitle,
  nextBlockSummary,
  finishedBlockIndex,
  nextBlockIndex,
  totalBlocks,
  blocksOutline,
}) {
  const lang = String(language || "English").trim() || "English";
  const systemPrompt = `You write brief transition previews between study blocks in an RSVP reading app.
The student just finished one block and is about to start the next.

Write exactly 3 or 4 short sentences in plain text (no markdown, no bullets, no headings).
- Briefly acknowledge what was covered in the block they just finished.
- Explain how that connects to or motivates the upcoming block.
- Optionally hint where this fits in the overall session structure.
Be concise, warm, and direct. Do not repeat block titles verbatim unless needed for clarity.
Respond entirely in ${lang}.`;

  const parts = [
    `Session: ${Math.max(1, Number(totalBlocks) || 1)} blocks total.`,
    `Just finished block ${Math.max(1, Math.floor(Number(finishedBlockIndex) || 0) + 1)}: "${String(finishedBlockTitle || "").trim()}"`,
  ];
  const fSummary = String(finishedBlockSummary || "").trim();
  if (fSummary) parts.push(`Finished block plan: ${fSummary}`);
  const recap = String(finishedBlockRecap || "").trim();
  if (recap) parts.push(`What they read: ${recap}`);
  parts.push(
    `Up next — block ${Math.max(1, Math.floor(Number(nextBlockIndex) || 0) + 1)}: "${String(nextBlockTitle || "").trim()}"`,
  );
  const nSummary = String(nextBlockSummary || "").trim();
  if (nSummary) parts.push(`Next block plan: ${nSummary}`);
  const outline = String(blocksOutline || "").trim();
  if (outline) parts.push(`Full outline:\n${outline}`);

  return llmChatCompletions({
    llmModel: resolveLlmModelArg(llmModel),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: parts.join("\n") },
    ],
    temperature: 0.3,
  });
}

export function buildSplitBlocksPrompt(n, lang, { compact = false } = {}) {
  const chunkRule = compact
    ? '- Set "chunk" to "" for every block.'
    : '- Set "chunk" to "" (the app assigns source text locally; do NOT paste document text into chunk).';
  return `You are designing exactly ${n} study blocks for RSVP reading (one word flash at a time; the student cannot re-read).

${SOURCE_FIDELITY_RULES}

Design for learning while respecting source definitions:
- Order blocks by prerequisites (foundations before applications).
- Prefer pedagogical order, but block titles and signatures must reflect terms as the source uses them.
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

/** DeepSeek/Gemini output ceiling for block-pack JSON (large inventories need headroom). */
export const CONCEPT_PACK_MAX_TOKENS = 8192;

export function slimInventoryForPack(inventory) {
  return (Array.isArray(inventory) ? inventory : []).map((c) => {
    if (!c || typeof c !== "object") return c;
    const row = {
      id: c.id,
      order: c.order,
      title: c.title,
      scope_one_line: String(c.scope_one_line || c.scope || "").slice(0, 100),
    };
    const moduleName = String(c.module || "").trim();
    if (moduleName) row.module = moduleName;
    if (Array.isArray(c.prerequisite_ids) && c.prerequisite_ids.length) {
      row.prerequisite_ids = c.prerequisite_ids;
    }
    return row;
  });
}

export function looksLikeTruncatedModelJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const withoutFence = stripJsonFence(raw);
  if (!withoutFence.startsWith("{") && !withoutFence.startsWith("[")) return false;
  try {
    JSON.parse(withoutFence);
    return false;
  } catch {
    return withoutFence.length > 200;
  }
}

async function callLlmSplit({ llmModel, messages, useJsonObjectMode, max_tokens }) {
  return llmChatCompletions({
    llmModel,
    messages,
    temperature: 0.2,
    max_tokens,
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

const OVERVIEW_TITLE_RE = /^(overview|course map)/i;

export function buildConceptInventoryPrompt(lang) {
  const language = String(lang || "English").trim() || "English";
  return `You are extracting an ordered inventory of teachable concepts from study material.

${SOURCE_FIDELITY_RULES}

Rules:
- One concept = one teachable idea sized for RSVP (single pass, no re-read).
- Order by learning prerequisites (foundations before applications).
- Each concept: stable id (c1, c2, …), order (1-based, strictly increasing), title, scope_one_line.
- REQUIRED when the term appears in the material: source_phrase — a short anchor quote (≤25 words) copied or nearly copied from the document.
- If no localizable quote exists but the concept is essential: anchor_type "inferred" (omit source_phrase).
- Optional: module (thematic label), prerequisite_ids (array of other concept ids).
- Return enough concepts to cover the material (typically at least 5 for substantial texts).

Output JSON only (no markdown, no preamble):
{"concepts":[{"id":"c1","order":1,"title":"Short concept name","scope_one_line":"What this concept covers","source_phrase":"Short quote from document","anchor_type":"cited","module":"Optional module","prerequisite_ids":[]}]}

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
    const source_phrase = String(item.source_phrase || "").trim();
    if (source_phrase) row.source_phrase = source_phrase.slice(0, 200);
    const anchor_type = String(item.anchor_type || "").trim().toLowerCase();
    if (anchor_type === "inferred" || anchor_type === "cited") {
      row.anchor_type = anchor_type;
    } else if (source_phrase) {
      row.anchor_type = "cited";
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

export function buildConceptPackPrompt(n, lang, inventoryJson, { knowledgeProfile = null } = {}) {
  const targetN = Math.max(1, Math.floor(Number(n) || 1));
  const language = String(lang || "English").trim() || "English";
  const inventory = String(inventoryJson || "[]");
  const threshold = ASSESSMENT_FLAGS.ASSESSMENT_MASTERY_THRESHOLD;
  const profileBlock = knowledgeProfile
    ? `

Knowledge profile present — input inventory is COMPLETE; output only affects active study blocks.
Maximum blocks (ceiling) = ${targetN}. You MAY return fewer than ${targetN} blocks.
Omit dedicated blocks for concepts with mastery === 'full' AND confidence > ${threshold}.
If a dominated concept is prerequisite for a non-dominated concept, include it in the dependent block with learning_goal: 'prerequisite_review'.
For relational-only gaps use learning_goal: 'relational' and compress content (~40% of normal).
Add learning_goal (string) and mastery_adjusted (boolean) on each block when profile-informed.
Do NOT filter concepts out of the inventory JSON — only omit dominated dedicated blocks.

Knowledge profile:
${JSON.stringify(knowledgeProfile)}`
    : "";

  return `You are packaging a concept inventory into study blocks for RSVP reading.

Input: concept inventory JSON (ordered teachable concepts).
${knowledgeProfile ? `Maximum block count (ceiling) = ${targetN}. Return up to ${targetN} blocks; fewer is allowed when profile omits mastered concepts.` : `Target block count N = ${targetN}.`}

Rules:
1. Block id 1 MUST be a global course overview (title starts with "Overview:" or "Course map:"). It counts toward N. concept_ids may be [].
2. For EACH module in the inventory: the first block for that module MUST be vocabulary: title "Key terms: [module name]", 6-10 terms in signature, concept_ids for that vocab concept only.
3. Never assign the same concept_id to two blocks.
4. If distinct concepts + overview + vocab blocks exceed N: merge related/adjacent concepts until you have at most ${targetN} blocks. Record merges in pack_meta.merges.
5. If fewer than N blocks are justified: set pack_meta.final_block_count to the actual count (no padding).
6. Every block: summary (max 1 short sentence), signature (3-6 short terms), chunk "" (always empty). Keep total JSON compact.${profileBlock}

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
  maxBlocks,
  studyNotes,
  language,
  knowledgeProfile = null,
}) {
  const model = resolveLlmModelArg(llmModel);
  const n = Math.max(1, Math.floor(Number(maxBlocks ?? nBlocks) || 1));
  const lang = String(language || "English").trim() || "English";
  const notes = String(studyNotes || "").trim();
  const inventoryJson = JSON.stringify(slimInventoryForPack(inventory));
  const profile =
    knowledgeProfile && typeof knowledgeProfile === "object" ? knowledgeProfile : null;

  function buildMessages(compact, terse = false) {
    const messages = [
      {
        role: "system",
        content: buildConceptPackPrompt(n, lang, inventoryJson, { knowledgeProfile: profile }),
      },
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
        content: terse
          ? `Pack into ${n} blocks. JSON only. Summaries: max 1 sentence each. Signatures: max 5 short terms. No prose outside JSON.`
          : `Pack concepts into ${n} blocks. JSON only. Keep summaries brief (1-2 sentences).`,
      });
    }
    return messages;
  }

  const attempts = [
    { compact: false, terse: false, useJsonObjectMode: true },
    { compact: true, terse: false, useJsonObjectMode: true },
    { compact: true, terse: true, useJsonObjectMode: true },
    { compact: true, terse: true, useJsonObjectMode: false },
  ];

  let lastRaw = "";
  let lastTruncated = false;
  for (const attempt of attempts) {
    const splitOpts = {
      llmModel: model,
      messages: buildMessages(attempt.compact, attempt.terse),
      useJsonObjectMode: attempt.useJsonObjectMode,
      max_tokens: CONCEPT_PACK_MAX_TOKENS,
    };
    try {
      lastRaw = await callLlmSplit(splitOpts);
    } catch (err) {
      if (attempt.useJsonObjectMode && (err?.status === 400 || /response_format/i.test(String(err?.message)))) {
        lastRaw = await callLlmSplit({ ...splitOpts, useJsonObjectMode: false });
      } else {
        throw err;
      }
    }

    lastTruncated = looksLikeTruncatedModelJson(lastRaw);
    const packed = parseConceptPackFromModelResponse(lastRaw, { targetN: n });
    if (packed?.blocks?.length) {
      return packed;
    }
    console.warn("Concept pack: parse failed, trying next attempt…", lastRaw.slice(0, 400));
  }

  console.warn("Concept pack: all parse attempts failed:", lastRaw.slice(0, 800));
  if (lastTruncated) {
    throw new Error(
      "Model response was cut off before finishing the block pack. Try again, or lower the block count slightly.",
    );
  }
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

const OVERLAP_AUDIT_MAX_PRIOR_BLOCKS = 2;
const OVERLAP_AUDIT_EXCERPT_MAX_WORDS = 150;

function truncateToWordLimit(text, maxWords) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}...`;
}

/**
 * @param {{ title?: string, explanation_excerpt?: string, signature?: string | string[] }} block
 */
function normalizePriorBlockForAudit(block) {
  const title = String(block?.title || "").trim() || "Untitled";
  const explanation_excerpt = truncateToWordLimit(
    block?.explanation_excerpt || "",
    OVERLAP_AUDIT_EXCERPT_MAX_WORDS,
  );
  const row = { title, explanation_excerpt };
  if (Array.isArray(block?.signature) && block.signature.length) {
    row.signature = block.signature.map((t) => String(t || "").trim()).filter(Boolean);
  } else {
    const sig = String(block?.signature || "").trim();
    if (sig) row.signature = [sig];
  }
  return row;
}

/**
 * @param {{ blockTitle?: string, candidateExplanation?: string, priorBlocks?: { title?: string, explanation_excerpt?: string, signature?: string | string[] }[], language?: string }} params
 */
export function buildOverlapAuditPrompt({
  blockTitle,
  candidateExplanation,
  priorBlocks,
  language,
}) {
  const lang = String(language || "English").trim() || "English";
  const title = String(blockTitle || "").trim() || "Untitled";
  const candidate = String(candidateExplanation || "").trim();
  const priors = (Array.isArray(priorBlocks) ? priorBlocks : [])
    .slice(0, OVERLAP_AUDIT_MAX_PRIOR_BLOCKS)
    .map(normalizePriorBlockForAudit);

  const priorSection = priors.length
    ? priors
        .map((p, i) => {
          const sig = p.signature?.length ? `\nKey terms: ${p.signature.join(", ")}` : "";
          return `Prior block ${i + 1} — "${p.title}":\n${p.explanation_excerpt || "(no excerpt)"}${sig}`;
        })
        .join("\n\n")
    : "(none)";

  return `You are auditing a study-session block explanation for redundant overlap with prior blocks.

Compare the CANDIDATE explanation against the PRIOR block excerpt(s) below.

Flag redundant DEFINITIONS, EXAMPLES, or FORMULAS that repeat what was already taught.
Do NOT flag intentional bridge sentences that connect topics without re-teaching content.

CANDIDATE block title: ${title}

CANDIDATE explanation:
${candidate || "(empty)"}

PRIOR blocks (max ${OVERLAP_AUDIT_MAX_PRIOR_BLOCKS}):
${priorSection}

Respond ONLY with valid JSON (no markdown, no preamble):
{
  "overlap_severity": "none|low|high",
  "redundant_claims": ["short description of each redundant claim"],
  "action": "pass|trim|regen",
  "regen_hint": "guidance when action is trim or regen; empty string when pass"
}

action rules:
- pass: no meaningful redundancy (including acceptable bridge sentences)
- trim: minor redundancy removable without full rewrite
- regen: substantial repetition of definitions, examples, or formulas

Respond entirely in ${lang}.`;
}

/**
 * @typedef {{ overlap_severity: "none" | "low" | "high", redundant_claims: string[], action: "pass" | "trim" | "regen", regen_hint: string }} OverlapAuditResult
 */

/** @returns {OverlapAuditResult | null} */
export function parseOverlapAuditFromModelResponse(text) {
  const parsed = parseModelJsonObject(text);
  if (!parsed || typeof parsed !== "object") return null;

  const severityRaw = String(parsed.overlap_severity || "").trim().toLowerCase();
  if (!["none", "low", "high"].includes(severityRaw)) return null;

  const actionRaw = String(parsed.action || "").trim().toLowerCase();
  if (!["pass", "trim", "regen"].includes(actionRaw)) return null;

  const redundant_claims = Array.isArray(parsed.redundant_claims)
    ? parsed.redundant_claims.map((c) => String(c || "").trim()).filter(Boolean)
    : [];

  return {
    overlap_severity: severityRaw,
    redundant_claims,
    action: actionRaw,
    regen_hint: String(parsed.regen_hint || "").trim(),
  };
}

export async function deepSeekAuditBlockOverlap({
  llmModel,
  blockTitle,
  candidateExplanation,
  priorBlocks,
  language,
}) {
  const model = resolveLlmModelArg(llmModel);
  const systemPrompt = buildOverlapAuditPrompt({
    blockTitle,
    candidateExplanation,
    priorBlocks,
    language,
  });

  const request = (useJsonObjectMode) =>
    llmChatCompletions({
      llmModel: model,
      messages: [{ role: "system", content: systemPrompt }],
      temperature: 0.2,
      max_tokens: 800,
      ...(useJsonObjectMode ? { response_format: { type: "json_object" } } : {}),
    });

  let raw = "";
  try {
    raw = await request(true);
  } catch (err) {
    if (err?.status === 400 || /response_format/i.test(String(err?.message))) {
      raw = await request(false);
    } else {
      throw err;
    }
  }

  const result = parseOverlapAuditFromModelResponse(raw);
  if (!result) {
    console.warn(
      "Overlap audit: could not parse model response, treating as pass",
      String(raw || "").slice(0, 400),
    );
  }
  return result;
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
1. Hook — 1 sentence: why this concept matters per the source (not invented stakes).
2. Core definition — 1-3 sentences: preserve the author's technical sense in plain RSVP prose.
3. Technical layer — 2-4 sentences: formal terms as the source presents them.
4. Example — ONLY if the source chunk contains an example; otherwise omit entirely.
5. Contrast — ONLY if the source mentions confusion, opposition, or contrast; otherwise omit.
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
- Do NOT contradict or replace source definitions; paraphrase short sentences. No 80-word sentences, no undefined vocabulary.
- Total length: 200-300 words maximum. Dense but scannable at speed.`;

const EXPLANATION_VOCABULARY_BLOCK = `This block is a VOCABULARY block (title starts with "Key terms:"). The student reads via RSVP and CANNOT re-read.

Write ONLY definitions—no narrative, no relationships between terms yet.

Format the explanation as one paragraph per term (6-10 terms):
**TERM** — Definition tracking the source chunk wording and technical sense for that term.

WRITING RULES: subject-verb-object; max 15 words per sentence; one idea per sentence; no parentheses, semicolons, or em-dashes; define before use.
Include a one-sentence example only if the chunk provides one for that term. Do not use section labels or headings.`;

const EXPLANATION_BRIEF_DEEP = `Brief RSVP recap for a student who already studied this material. CANNOT re-read. Max 120 words.

Cover only: hook (1 sentence), core definition (1-2 sentences), technical layer (1-2 sentences). Include contrast only if the source mentions it. Omit example unless a listed learning gap requires it.
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
export const MC_OPTION_PARITY_RULES = `Option parity (required for every test question): All four options A–D must look like siblings—same language/register, notation, grammar pattern, and similar length (each within ~30% of the median word count; never one 15-word option and three 2-word stubs). If one uses Latin (or a foreign term), all four do—or all give the same style of translation/gloss, or none do. If one has a parenthetical, all do or none do. If the correct answer is a full clause/sentence, every distractor is too. Wrong options stay plausible; do not make the correct one identifiable by formatting, length, or polish alone. Exception: when causal completeness requires a longer correct option, distractors stay plausible full clauses but need not pad to match that length.`;

const QUESTION_SCOPE_RULES = `Scope (answerability): The student has ONLY seen this block's explanation and source chunk (plus earlier blocks for connection questions—not later blocks). Every question MUST be solvable from that material alone. Do NOT ask about topics reserved for future blocks, examples only named in the source but not explained in this block's explanation, or cultural/historical references the text does not unpack. Going beyond literal wording is fine ONLY if the reasoning chain is already available in the provided material.`;

const QUESTION_CAUSAL_RULES = `Causal completeness: For "why", "because", "what explains", or cause-effect questions, the correct option must make the reasoning chain answerable without guesswork. If the block explanation already walks through the full chain (premise → intermediate step → conclusion), the correct option may state the conclusion or a key step the explanation makes obvious. If the explanation does NOT spell out intermediate steps, the correct option MUST include the missing causal links (e.g. not just "responsibility" but "because the intellectual's symbolic power creates unavoidable responsibility, which requires political commitment"). Distractors may stay shorter; the correct option should never be a bare label that only makes sense after unstated inference.`;

const QUESTION_PEDAGOGY_RULES = `Questions must test understanding (apply, discriminate, predict)—not verbatim recall of source phrasing.
For vocabulary blocks: test term-to-meaning or meaning-to-term only; no multi-step application yet.
${QUESTION_SCOPE_RULES}
${QUESTION_CAUSAL_RULES}`;

const TEST_FEEDBACK_RULES = `Test feedback quality rules (required for every test question, even before any student answer exists):
- Feedback must read as a short conceptual explanation, not as a label for the right option.
- Start by restating the underlying idea or rule in your own words (without copying any option).
- Then explain why that idea makes the correct option work, using principle-level reasoning.
- For cause-effect questions, trace the full reasoning chain in feedback when the correct option is abbreviated—supply any intermediate steps the block did not already make explicit.
- Briefly contrast with at least one plausible distractor: refer to distractors by option letter (A/B/C/D) matching your JSON options object, e.g. "Option B fails because…" / "Option C confuses…".
- Do NOT copy or closely paraphrase the text of the correct option in the feedback.
- Avoid giveaway lead-ins such as "The correct answer is…" or naming the correct letter outright.
- Keep it concise (3-5 short sentences), specific, and still useful after the student already knows if they were right or wrong.`;

/** Dictionary entries are NOT shown in RSVP — they may be substantive. */
export const CONCEPT_DICTIONARY_EXTRACTION_RULES = (isVocabularyBlock) =>
  `Also list key concepts for the session dictionary in concepts[]: ${
    isVocabularyBlock
      ? "every term in this vocabulary block (6-10)."
      : "3-8 non-obvious domain-specific terms introduced in this block."
  }
For each: the term exactly as used in the source chunk. Definition MUST paraphrase how the chunk defines or uses the term — not a generic textbook gloss.
Keep these extraction definitions brief; fuller entries are generated in a separate pass.
Only include terms grounded in the chunk. No common words.`;

export const CONCEPT_DICTIONARY_ENRICHMENT_RULES = `You are writing session dictionary entries. The student reads these in a sidebar and in the exported session markdown — NOT via RSVP. Entries may be substantive.

Rules (non-negotiable):
- Ground EVERY claim in the provided study material and block explanation. Do NOT invent external history, authors, dates, or formulas unless explicitly named in the text.
- For each term: 2-5 sentences (40-150 words). Markdown allowed for emphasis and inline LaTeX \\( ... \\).
- When the text supports it, cover in order:
  1. How the material defines or uses the term (paraphrase closely; quote key phrases if short).
  2. Formal statement, equation, criterion, or procedure if present in the text.
  3. Who formulated or named it ONLY if the text names them — otherwise omit.
  4. One concrete example taken FROM the material (not invented).
  5. Contrast or common confusion if the text mentions it.
- If the text is silent on origin or formulation, say how the text uses the term — do not guess.
- If a term has multiple senses, give the sense used in THIS block.
- Keep the exact term spelling from the input list.

Output JSON only:
{"concepts":[{"term":"...","definition":"..."}]}`;

export function buildConceptEnrichmentSystemPrompt(language) {
  const lang = String(language || "English").trim() || "English";
  return `${CONCEPT_DICTIONARY_ENRICHMENT_RULES}
Respond entirely in ${lang}.
Every LaTeX backslash MUST be escaped for JSON strings: use "\\\\(", "\\\\)", "\\\\nabla", "\\\\cdot", etc.
Return ONLY valid JSON. No preamble, no backticks, no markdown fences.`;
}

export function buildConceptEnrichmentUserContent({
  blockTitle,
  materialText,
  explanation,
  concepts,
}) {
  const terms = (Array.isArray(concepts) ? concepts : [])
    .map((c) => String(c?.term || "").trim())
    .filter(Boolean);
  const termList = terms.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const expl = String(explanation || "").trim();
  const material = String(materialText || "").trim();
  return `Block: ${String(blockTitle || "").trim() || "(untitled)"}

Terms to define (use exact spelling):
${termList || "(none)"}

Block explanation (study layer — use as secondary source, prefer raw material):
${expl || "(none)"}

Study material (primary source — do not go beyond this):
${material || "(none)"}`;
}

function parseConceptEnrichmentResponse(text, expectedTerms) {
  const parsed = parseModelJsonObject(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const raw = Array.isArray(parsed.concepts) ? parsed.concepts : [];
  const byTerm = new Map();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const term = String(item.term || "").trim();
    const definition = String(item.definition || "").trim();
    if (!term || !definition) continue;
    byTerm.set(term.toLowerCase(), { term, definition });
  }
  const expected = Array.isArray(expectedTerms) ? expectedTerms : [];
  const out = [];
  for (const c of expected) {
    const term = String(c?.term || "").trim();
    if (!term) continue;
    const enriched = byTerm.get(term.toLowerCase());
    if (enriched) out.push(enriched);
    else {
      const fallbackDef = String(c?.definition || "").trim();
      if (fallbackDef) out.push({ term, definition: fallbackDef });
    }
  }
  return out.length ? out : null;
}

export async function enrichBlockConceptDefinitions({
  llmModel,
  language,
  blockTitle,
  materialText,
  explanation,
  concepts,
}) {
  const incoming = Array.isArray(concepts) ? concepts : [];
  const terms = incoming
    .map((c) => (c && typeof c === "object" ? String(c.term || "").trim() : ""))
    .filter(Boolean);
  if (!terms.length) return incoming;

  const systemPrompt = buildConceptEnrichmentSystemPrompt(language);
  const userContent = buildConceptEnrichmentUserContent({
    blockTitle,
    materialText,
    explanation,
    concepts: incoming,
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

  const enriched = parseConceptEnrichmentResponse(raw, incoming);
  return enriched || incoming;
}

export function buildBlockGenerationSystemPrompt({
  language,
  n_test,
  n_socratic,
  explanation_profile = "thorough",
  gap_focus = [],
  blockTitle = "",
  blockIndex = 0,
  include_connection_questions = true,
  strictMode = false,
  extractedClaims = null,
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
  const blockNo = Number(blockIndex) + 1;
  const blockNoSafe = Number.isFinite(blockNo) && blockNo > 0 ? blockNo : 1;
  const connectionEnabled = include_connection_questions !== false;
  const requireConnection = connectionEnabled && blockNoSafe > 1;
  const sourceStructure = buildSourceFirstRsvpStructure({
    isVocabularyBlock,
    requireConnection,
    strictMode,
    extractedClaims,
  });
  const explanationSection = isVocabularyBlock
    ? `${EXPLANATION_VOCABULARY_BLOCK}\n${sourceStructure}\n${paragraphRule}`
    : profile === "brief_deep"
      ? `${EXPLANATION_BRIEF_DEEP}\n${sourceStructure}\n${paragraphRule}`
      : `${EXPLANATION_RSVP_THOROUGH}\n${sourceStructure}\n${paragraphRule}`;
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

  const basePrompt = `You will receive study material and a confirmed list of blocks. Generate JSON for ONLY ONE block.
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
${CONCEPT_DICTIONARY_EXTRACTION_RULES(isVocabularyBlock)}
Every LaTeX backslash MUST be escaped for JSON strings: use "\\\\(", "\\\\)", "\\\\nabla", "\\\\cdot", etc.
Return ONLY valid JSON. No preamble, no backticks, no markdown fences.${
    blockNoSafe > 1
      ? `
If a term appears in ALREADY TAUGHT, advance the argument without repeating its definition or example.`
      : ""
  }`;
  return mergeFidelityIntoSystemPrompt(basePrompt, { strictMode, extractedClaims });
}

export function buildBlockGenerationUserContent({
  blocksListText,
  materialText,
  blockIndex,
  blockTitle,
  previousComment,
  gap_focus = [],
  coverageManifest = null,
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

  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  const coverageBlock =
    idx >= 1 && coverageManifest
      ? `\n\n${renderCoverageManifestForPrompt(coverageManifest)}`
      : "";

  return `Confirmed blocks list:\n${blocksListText}\n\nTarget block:\n${blockNo}. ${blockTitle}${previousBlockLine}\n\nSource material (verbatim chunk for this block only):\n${materialText}${gapBlock}${commentLine}\n\nQuestion scope: questions must be answerable from the explanation you write for this block and the source chunk above—not from future blocks or unexplained asides in the source.${coverageBlock}`;
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

  const basePrompt = `You will receive a FIXED block explanation and source material. Generate ONLY new questions — do NOT modify, rewrite, or return the explanation or title.
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
Optionally list new dictionary terms (3-8) in concepts[] if new domain terms appear; omit concepts if none. Use exact term spelling grounded in the source chunk.
Every LaTeX backslash MUST be escaped for JSON strings: use "\\\\(", "\\\\)", "\\\\nabla", "\\\\cdot", etc.
MUST NOT include "explanation", "title", or "id" fields in the response.
Return ONLY valid JSON. No preamble, no backticks, no markdown fences.`;
  return mergeFidelityIntoSystemPrompt(basePrompt, {});
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
${String(materialText || "").trim()}${gapBlock}${prevBlockSection}

Question scope: assume the student knows only the FIXED EXPLANATION and source chunk above (plus earlier blocks for connection questions)—not later blocks or unexplained source asides.`;
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

export async function deepSeekExtractSourceClaims({
  llmModel,
  materialText,
  blockTitle,
  language,
}) {
  const lang = String(language || "English").trim() || "English";
  const chunk = String(materialText || "").trim();
  const title = String(blockTitle || "").trim();
  const systemPrompt = `Extract structured claims from the source chunk only. Return JSON:
{"claims":[{"type":"definition|classification|example|contrast|thesis","text":"...","terms":["..."]}]}
Rules: every claim MUST be traceable to the user chunk; no external facts; empty claims array is valid.
${SOURCE_FIDELITY_RULES}
Respond entirely in ${lang}. Return ONLY valid JSON.`;
  const userContent = `Block title: ${title || "Untitled"}\n\nSource chunk:\n${chunk}`;
  const raw = await llmChatCompletions({
    llmModel: resolveLlmModelArg(llmModel),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.1,
  });
  const parsed = parseModelJsonObject(raw);
  const claims = Array.isArray(parsed?.claims) ? parsed.claims : [];
  return claims.filter((c) => c && typeof c === "object" && String(c.text || "").trim());
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
  strictMode = false,
  extractedClaims = null,
  anchor_quality = "strong",
  signature = [],
  coverageManifest = null,
}) {
  let claims = extractedClaims;
  if (strictMode && !Array.isArray(claims)) {
    claims = await deepSeekExtractSourceClaims({
      llmModel,
      materialText,
      blockTitle,
      language,
    });
  }

  const systemPrompt = buildBlockGenerationSystemPrompt({
    language,
    n_test,
    n_socratic,
    explanation_profile,
    gap_focus,
    blockTitle,
    blockIndex,
    include_connection_questions,
    strictMode,
    extractedClaims: claims,
  });

  const userContent = buildBlockGenerationUserContent({
    blocksListText,
    materialText,
    blockIndex,
    blockTitle,
    previousComment,
    gap_focus,
    coverageManifest,
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

  const callBlockLlm = async (userExtra = "") => {
    const raw = await llmChatCompletions({
      llmModel: resolveLlmModelArg(llmModel),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent + userExtra },
      ],
      temperature: 0.2,
    });
    return parseAndEnforceBlock(raw);
  };

  let blockObj = await callBlockLlm();
  if (!hasValidExplanationParagraphs(blockObj.explanation, paragraphOpts)) {
    const min = getMinExplanationParagraphs(paragraphOpts);
    const retryHint =
      `\n\nRETRY REQUIRED: The explanation field MUST contain at least ${min} distinct paragraphs ` +
      `separated by one blank line each (double newline). A single paragraph is invalid.`;
    blockObj = await callBlockLlm(retryHint);
    if (!hasValidExplanationParagraphs(blockObj.explanation, paragraphOpts)) {
      console.warn("Block explanation still lacks required paragraph breaks after retry.");
    }
  }

  const fidelityMeta = {
    blockTitle,
    signature,
    chunk: materialText,
    explanation: blockObj.explanation,
    concepts: blockObj.concepts,
    anchor_quality,
  };
  let validation = validateBlockFidelity(fidelityMeta);
  if (!validation.ok && validation.action === "retry") {
    const fidelityHint =
      `\n\nFIDELITY RETRY: These terms lack support in the source chunk: ${validation.unsupported_terms.join(", ")}. ` +
      "Do NOT define them from general knowledge. Only use the chunk.";
    blockObj = await callBlockLlm(fidelityHint);
    validation = validateBlockFidelity({ ...fidelityMeta, explanation: blockObj.explanation, isRetry: true });
  }
  if (!validation.ok) {
    blockObj.fidelity_status = "warn";
    blockObj.fidelity_issues = validation.unsupported_terms;
  }
  if (strictMode && Array.isArray(claims) && claims.length) {
    blockObj.extracted_claims = claims;
  }

  const conceptList = Array.isArray(blockObj.concepts) ? blockObj.concepts : [];
  if (conceptList.length > 0) {
    try {
      blockObj.concepts = await enrichBlockConceptDefinitions({
        llmModel,
        language,
        blockTitle,
        materialText,
        explanation: blockObj.explanation,
        concepts: conceptList,
      });
    } catch (err) {
      console.warn("Concept dictionary enrichment failed; keeping extraction pass definitions:", err);
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
${testParity}${QUESTION_CAUSAL_RULES}
Return ONLY valid JSON array:
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

export const PREPACKING_DONT_KNOW_ANSWER = "I don't know";

const PREPACKING_DONT_KNOW_ALIASES = new Set([
  PREPACKING_DONT_KNOW_ANSWER,
  "I don't know",
  "I do not know",
  "",
]);

const MASTERY_LEVELS = new Set(["none", "partial", "full"]);
const MASTERY_PRIORITY = { none: 0, partial: 1, full: 2 };

const PREPACKING_ASSESSMENT_JSON_SCHEMA = `{
  questions: [{
    type: "test" | "socratic",
    question: string,
    concept_id: string,
    item_id?: string,
    options?: { A, B, C, D },
    answer?: string,
    feedback?: string
  }]
}`;

function truncateMaterialExcerpt(text, maxChars = 12000) {
  const s = String(text || "").trim();
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}\n…[truncated]`;
}

function inventoryIdSet(inventory) {
  return new Set(
    (Array.isArray(inventory) ? inventory : [])
      .map((c) => String(c?.id || c?.concept_id || "").trim())
      .filter(Boolean),
  );
}

/** @param {{ language, n_test, n_socratic, conceptInventory, edges, materialExcerpt }} opts */
export function buildPrePackingAssessmentSystemPrompt({
  language,
  n_test,
  n_socratic,
  conceptInventory,
  edges,
  materialExcerpt,
}) {
  const nTest = Math.max(0, Math.min(MAX_N_TEST, Math.round(Number(n_test))));
  const nSocratic = Math.max(0, Math.min(3, Math.round(Number(n_socratic))));
  const lang = String(language || "English").trim() || "English";
  const inv = Array.isArray(conceptInventory) ? conceptInventory : [];
  const edgeList = Array.isArray(edges) ? edges : [];
  const excerpt = truncateMaterialExcerpt(materialExcerpt);

  const basePrompt = `You will receive a concept inventory and source material excerpt. Generate a document-wide knowledge check before block packing.
Return a single JSON object with this schema:
${PREPACKING_ASSESSMENT_JSON_SCHEMA}
Respond entirely in ${lang}.
Generate exactly ${nTest} test questions (type: "test") and ${nSocratic} socratic questions (type: "socratic") in the questions array.
Test questions: 4 options (A/B/C/D), one correct answer letter, and high-value feedback.
${MC_OPTION_PARITY_RULES}
${TEST_FEEDBACK_RULES}
Socratic questions: open-ended, no options, no answer field.
Order: all test questions first, then all socratic questions.
If n_test=0 or n_socratic=0, omit that type entirely.
Each question MUST include concept_id from the inventory (required).
Prioritize THESIS and ARGUMENT concepts for coverage; include prerequisite edges when useful.
${QUESTION_PEDAGOGY_RULES}
Questions must be answerable from the provided material excerpt and concept labels alone.
Every LaTeX backslash MUST be escaped for JSON strings: use "\\\\(", "\\\\)", "\\\\nabla", "\\\\cdot", etc.
Return ONLY valid JSON. No preamble, no backticks, no markdown fences.

Concept inventory (${inv.length} concepts):
${JSON.stringify(
    inv.map((c) => ({
      id: String(c?.id || c?.concept_id || "").trim(),
      label: String(c?.label || c?.title || "").trim(),
      type: String(c?.type || "CONCEPT").trim(),
    })).filter((c) => c.id),
  )}

Edges (${edgeList.length}):
${JSON.stringify(edgeList)}

Material excerpt:
${excerpt || "(none)"}`;
  return mergeFidelityIntoSystemPrompt(basePrompt, {});
}

function unwrapPrePackingQuestions(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return null;
  for (const key of ["questions", "items", "assessment_items", "data"]) {
    if (Array.isArray(raw[key])) return raw[key];
  }
  return null;
}

/**
 * Normalize LLM output to Questions-mode assessment items.
 * @returns {object[]}
 */
export function normalizePrePackingAssessmentQuestions(raw, { n_test, n_socratic, inventory } = {}) {
  const nTest = Math.max(0, Math.min(MAX_N_TEST, Math.round(Number(n_test))));
  const nSocratic = Math.max(0, Math.min(3, Math.round(Number(n_socratic))));
  const arr = unwrapPrePackingQuestions(raw);
  if (!Array.isArray(arr) || !arr.length) {
    throw new Error("Assessment questions array is empty.");
  }

  const invIds = inventoryIdSet(inventory);
  const out = [];

  for (let idx = 0; idx < arr.length; idx += 1) {
    const item = arr[idx];
    if (!item || typeof item !== "object") {
      throw new Error(`Assessment question ${idx} is not an object.`);
    }
    const type = String(item.type || "").trim().toLowerCase();
    if (type !== "test" && type !== "socratic") {
      throw new Error(`Assessment question ${idx} must be type test or socratic.`);
    }
    const concept_id = String(item.concept_id || "").trim();
    if (!concept_id) {
      throw new Error(`Assessment question ${idx} missing concept_id.`);
    }
    if (invIds.size && !invIds.has(concept_id)) {
      throw new Error(`Assessment question ${idx} concept_id not in inventory.`);
    }
    const question = String(item.question || "").trim();
    if (!question) {
      throw new Error(`Assessment question ${idx} missing question text.`);
    }
    const item_id = String(item.item_id || item.id || `aq_${idx + 1}`).trim();
    const edge =
      item.edge && typeof item.edge === "object"
        ? {
            from: String(item.edge.from || "").trim(),
            to: String(item.edge.to || "").trim(),
          }
        : undefined;

    if (type === "test") {
      const normalized = normalizeTestQuestion({
        ...item,
        type: "test",
        question,
        concept_id,
        item_id,
      });
      const feedback = String(normalized.feedback || "").trim();
      if (!feedback) {
        throw new Error(`Assessment test question ${idx} missing feedback.`);
      }
      const options = normalized.options;
      if (!options || !["A", "B", "C", "D"].every((l) => String(options[l] || "").trim())) {
        throw new Error(`Assessment test question ${idx} needs options A–D.`);
      }
      const answer = String(normalized.answer || "").trim().toUpperCase();
      if (!["A", "B", "C", "D"].includes(answer)) {
        throw new Error(`Assessment test question ${idx} needs valid answer letter.`);
      }
      out.push({
        type: "test",
        question,
        concept_id,
        item_id,
        options,
        answer,
        feedback,
        ...(edge?.from && edge?.to ? { edge } : {}),
      });
    } else {
      out.push({
        type: "socratic",
        question,
        concept_id,
        item_id,
        ...(edge?.from && edge?.to ? { edge } : {}),
      });
    }
  }

  const testCount = out.filter((q) => q.type === "test").length;
  const socCount = out.filter((q) => q.type === "socratic").length;
  if (testCount !== nTest || socCount !== nSocratic) {
    throw new Error(
      `Assessment question count mismatch: expected ${nTest} test + ${nSocratic} socratic, got ${testCount} test + ${socCount} socratic.`,
    );
  }

  return out;
}

function extractTestAnswerLetter(userAnswer) {
  const s = String(userAnswer || "").trim();
  if (!s) return "";
  const letterMatch = s.match(/^([A-D])(?:\b|[.\s])/i);
  if (letterMatch) return letterMatch[1].toUpperCase();
  if (/^[A-D]$/i.test(s)) return s.toUpperCase();
  return s.toUpperCase();
}

function mergeProfileRows(rows) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const concept_id = String(row?.concept_id || "").trim();
    if (!concept_id) continue;
    let mastery = String(row.mastery || "none").trim().toLowerCase();
    if (!MASTERY_LEVELS.has(mastery)) mastery = "none";
    let confidence = Number(row.confidence);
    if (!Number.isFinite(confidence)) confidence = mastery === "full" ? 0.9 : mastery === "partial" ? 0.5 : 0.1;
    confidence = Math.min(1, Math.max(0, confidence));
    const next = { concept_id, mastery, confidence };
    const existing = map.get(concept_id);
    if (!existing) {
      map.set(concept_id, next);
      continue;
    }
    const pNew = MASTERY_PRIORITY[mastery] ?? 0;
    const pOld = MASTERY_PRIORITY[existing.mastery] ?? 0;
    if (pNew > pOld) {
      map.set(concept_id, next);
    } else if (pNew === pOld) {
      existing.confidence = Math.max(existing.confidence, confidence);
    }
  }
  return Array.from(map.values());
}

/** @returns {Array<{ concept_id, mastery, confidence }>} */
export function scorePrePackingTestResponses(items, responses) {
  const qs = Array.isArray(items) ? items : [];
  const resp = Array.isArray(responses) ? responses : [];
  const testItems = qs.filter((q) => q && String(q.type || "").toLowerCase() === "test");
  const itemById = new Map();
  for (const it of testItems) {
    const id = String(it?.item_id || "").trim();
    if (id) itemById.set(id, it);
  }

  const rows = [];
  for (const r of resp) {
    const qType = String(r?.questionType || r?.type || "test").trim().toLowerCase();
    if (qType !== "test" && qType !== "mcq") continue;
    const item_id = String(r?.item_id || "").trim();
    const item = itemById.get(item_id);
    if (!item) continue;
    const concept_id = String(item.concept_id || "").trim();
    if (!concept_id) continue;

    const userAnswer = String(r.userAnswer ?? r.answer ?? "").trim();
    if (isDontKnowAnswer(userAnswer)) {
      rows.push({ concept_id, mastery: "none", confidence: 0.1 });
      continue;
    }

    const chosen = extractTestAnswerLetter(userAnswer);
    const correct = String(item.answer || "").trim().toUpperCase();
    if (chosen && correct && chosen === correct) {
      rows.push({ concept_id, mastery: "partial", confidence: 0.65 });
    } else {
      rows.push({ concept_id, mastery: "none", confidence: 0.2 });
    }
  }

  return mergeProfileRows(rows);
}

function isLegacyMcqAssessmentItem(item) {
  return item && String(item.type || "").trim().toLowerCase() === "mcq";
}

function normalizeAssessmentResponseRows(responses) {
  return (Array.isArray(responses) ? responses : []).map((r) => {
    if (!r || typeof r !== "object") return r;
    if (r.questionType || r.userAnswer != null) return r;
    return {
      item_id: r.item_id,
      userAnswer: r.answer,
      questionType: "mcq",
    };
  });
}

async function evaluateSocraticAssessmentResponses({
  items,
  responses,
  conceptInventory,
  llmModel,
  language,
}) {
  const socItems = (Array.isArray(items) ? items : []).filter(
    (q) => q && String(q.type || "").toLowerCase() === "socratic",
  );
  if (!socItems.length) return [];

  const resp = normalizeAssessmentResponseRows(responses);
  const byItem = new Map();
  for (const r of resp) {
    const id = String(r?.item_id || "").trim();
    if (id) byItem.set(id, r);
  }

  const inventory = Array.isArray(conceptInventory) ? conceptInventory : [];
  const labelById = new Map(
    inventory.map((c) => [
      String(c?.id || c?.concept_id || "").trim(),
      String(c?.label || c?.title || "").trim(),
    ]),
  );

  const lang = String(language || "English").trim() || "English";
  const payload = socItems
    .map((q) => {
      const id = String(q.item_id || "").trim();
      const row = byItem.get(id);
      if (!row) return null;
      const answer = String(row.userAnswer ?? row.answer ?? "").trim();
      if (!answer) return null;
      return {
        item_id: id,
        concept_id: String(q.concept_id || "").trim(),
        concept_label: labelById.get(String(q.concept_id || "").trim()) || "",
        question: String(q.question || ""),
        student_answer: answer,
      };
    })
    .filter(Boolean);

  if (!payload.length) return [];

  const systemPrompt = `Evaluate socratic pre-packing assessment answers into mastery rows.
Rules:
- Conservative mastery: "full" only with demonstrated precision; "partial" requires real understanding.
- Unknown / empty answers → mastery "none", low confidence.
- Output JSON: {"items":[{"concept_id":"...","mastery":"none|partial|full","confidence":0.0-1.0}]}
Respond in ${lang}.`;

  const content = await llmChatCompletions({
    llmModel: resolveLlmModelArg(llmModel),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify({ items: payload }) },
    ],
    temperature: 0.1,
  });

  const parsed = parseModelJsonValue(content);
  const itemsRaw =
    parsed && typeof parsed === "object" && Array.isArray(parsed.items) ? parsed.items : [];
  return itemsRaw
    .map((row, idx) => {
      try {
        return normalizeProfileItem(row, idx);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function unwrapAssessmentItemsArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;
  for (const key of ["items", "questions", "assessment_items", "data"]) {
    if (Array.isArray(value[key])) return value[key];
  }
  return null;
}

/** @returns {object[]} */
export function normalizeAssessmentItems(raw) {
  const arr = unwrapAssessmentItemsArray(raw);
  if (!Array.isArray(arr) || !arr.length) {
    throw new Error("Assessment items array is empty.");
  }
  return arr.map((item, idx) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Assessment item ${idx} is not an object.`);
    }
    const item_id = String(item.item_id || item.id || `item_${idx + 1}`).trim();
    const question = String(item.question || "").trim();
    const type = String(item.type || "mcq").trim().toLowerCase();
    if (!item_id || !question) {
      throw new Error(`Assessment item ${idx} missing item_id or question.`);
    }
    if (type !== "mcq") {
      throw new Error(`Assessment item ${idx} must be type mcq.`);
    }
    const options = Array.isArray(item.options)
      ? item.options.map((o) => String(o || "").trim()).filter(Boolean)
      : [];
    if (options.length < 2) {
      throw new Error(`Assessment item ${idx} needs at least 2 options.`);
    }
    const concept_id =
      item.concept_id != null && String(item.concept_id).trim()
        ? String(item.concept_id).trim()
        : null;
    const edge =
      item.edge && typeof item.edge === "object"
        ? {
            from: String(item.edge.from || "").trim(),
            to: String(item.edge.to || "").trim(),
          }
        : undefined;
    if (edge && (!edge.from || !edge.to)) {
      throw new Error(`Assessment item ${idx} edge requires from and to.`);
    }
    return {
      item_id,
      concept_id,
      ...(edge?.from && edge?.to ? { edge } : {}),
      question,
      type: "mcq",
      options,
      correct: String(item.correct || item.answer || "").trim(),
    };
  });
}

function normalizeProfileItem(raw, idx) {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Profile item ${idx} invalid.`);
  }
  const concept_id = String(raw.concept_id || "").trim();
  if (!concept_id) throw new Error(`Profile item ${idx} missing concept_id.`);
  let mastery = String(raw.mastery || "none").trim().toLowerCase();
  if (!MASTERY_LEVELS.has(mastery)) mastery = "none";
  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = mastery === "full" ? 0.9 : mastery === "partial" ? 0.5 : 0.1;
  confidence = Math.min(1, Math.max(0, confidence));
  const edge_mastery = Array.isArray(raw.edge_mastery)
    ? raw.edge_mastery
        .filter((e) => e && typeof e === "object")
        .map((e) => ({
          from: String(e.from || "").trim(),
          to: String(e.to || "").trim(),
          mastered: Boolean(e.mastered),
        }))
        .filter((e) => e.from && e.to)
    : undefined;
  return {
    concept_id,
    mastery,
    confidence,
    ...(edge_mastery?.length ? { edge_mastery } : {}),
  };
}

function computeAssessmentCoverage(inventory, items) {
  const inv = Array.isArray(inventory) ? inventory : [];
  const invIds = new Set(
    inv.map((c) => String(c?.id || c?.concept_id || "").trim()).filter(Boolean),
  );
  const assessed = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const cid = String(item?.concept_id || "").trim();
    if (cid) assessed.add(cid);
  }
  if (!invIds.size) return 0;
  return Math.min(100, Math.max(0, Math.round((assessed.size / invIds.size) * 100)));
}

function isDontKnowAnswer(answer) {
  const a = String(answer || "").trim();
  return PREPACKING_DONT_KNOW_ALIASES.has(a);
}

/** @returns {object | null} */
export function normalizeKnowledgeProfile(raw, { inventory = [], items = [], responses = [] } = {}) {
  if (!raw || typeof raw !== "object") return null;
  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
  if (!itemsRaw.length) return null;

  const responseByItem = new Map();
  for (const r of Array.isArray(responses) ? responses : []) {
    if (!r || typeof r !== "object") continue;
    const id = String(r.item_id || "").trim();
    if (id) responseByItem.set(id, String(r.answer || "").trim());
  }

  const normalizedItems = itemsRaw.map((row, idx) => normalizeProfileItem(row, idx));

  const quizByItemId = new Map();
  for (const it of Array.isArray(items) ? items : []) {
    const id = String(it?.item_id || "").trim();
    if (id) quizByItemId.set(id, it);
  }
  for (const [itemId, answer] of responseByItem) {
    if (!isDontKnowAnswer(answer)) continue;
    const quizItem = quizByItemId.get(itemId);
    const conceptId = String(quizItem?.concept_id || "").trim();
    if (!conceptId) continue;
    const profileItem = normalizedItems.find((p) => p.concept_id === conceptId);
    if (profileItem) {
      profileItem.mastery = "none";
      profileItem.confidence = Math.min(profileItem.confidence, 0.2);
    }
  }

  return {
    assessed_at: new Date().toISOString(),
    coverage: computeAssessmentCoverage(inventory, items),
    items: normalizedItems,
  };
}

export async function generatePrePackingAssessmentItems({
  conceptInventory,
  edges,
  materialText,
  n_test,
  n_socratic,
  maxItems,
  llmModel,
  language,
  legacyMcq,
}) {
  const model = resolveLlmModelArg(llmModel);
  const inventory = Array.isArray(conceptInventory) ? conceptInventory : [];
  if (!inventory.length) throw new Error("Missing concept inventory.");
  const lang = String(language || "English").trim() || "English";
  const edgeList = Array.isArray(edges) ? edges : [];
  const useLegacy =
    legacyMcq === true || (!isAssessmentQuestionsUiEnabled() && legacyMcq !== false);

  if (useLegacy) {
    const cap = Math.max(
      1,
      Math.floor(Number(maxItems) || ASSESSMENT_FLAGS.ASSESSMENT_ITEMS_MAX || 7),
    );
    const minimal = inventory.map((c) => ({
      id: String(c?.id || c?.concept_id || "").trim(),
      label: String(c?.label || c?.title || "").trim(),
      type: String(c?.type || "CONCEPT").trim(),
    }));

    const systemPrompt = `Generate up to ${cap} multiple-choice assessment items from this concept inventory.
Rules:
- Cover highest-value concept_ids and important prerequisite edges.
- Prioritize THESIS and ARGUMENT over TERM.
- Each item references exactly one concept_id OR one edge {from,to}.
- MCQ with 3-4 options; one correct answer.
- type must be "mcq".
Return ONLY a JSON array:
[{"item_id":"a1","concept_id":"c1","question":"...","type":"mcq","options":["..."],"correct":"..."}]
Respond in ${lang}.`;

    const userPayload = { concepts: minimal.filter((c) => c.id), edges: edgeList };
    const content = await llmChatCompletions({
      llmModel: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      temperature: 0.2,
    });

    const parsed = parseModelJsonValue(content);
    const normalized = normalizeAssessmentItems(parsed);
    return normalized.slice(0, cap);
  }

  const nTest = Math.max(0, Math.min(MAX_N_TEST, Math.round(Number(n_test))));
  const nSocratic = Math.max(0, Math.min(3, Math.round(Number(n_socratic))));
  const cap = Math.max(1, Math.floor(Number(ASSESSMENT_FLAGS.ASSESSMENT_ITEMS_MAX) || 7));
  if (nTest + nSocratic <= 0) {
    throw new Error("Assessment needs at least one question (n_test + n_socratic).");
  }
  if (nTest + nSocratic > cap) {
    throw new Error(`Assessment question count ${nTest + nSocratic} exceeds safety cap ${cap}.`);
  }

  const systemPrompt = buildPrePackingAssessmentSystemPrompt({
    language: lang,
    n_test: nTest,
    n_socratic: nSocratic,
    conceptInventory: inventory,
    edges: edgeList,
    materialExcerpt: materialText,
  });

  const content = await llmChatCompletions({
    llmModel: model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify({
          task: "Generate the knowledge check questions JSON object.",
        }),
      },
    ],
    temperature: 0.2,
  });

  const parsed = parseModelJsonValue(content);
  const normalized = normalizePrePackingAssessmentQuestions(parsed, {
    n_test: nTest,
    n_socratic: nSocratic,
    inventory,
  });
  return shuffleTestQuestionsInList(normalized);
}

export async function evaluatePrePackingAssessmentResponses({
  items,
  responses,
  conceptInventory,
  llmModel,
  language,
}) {
  const qs = Array.isArray(items) ? items : [];
  const resp = normalizeAssessmentResponseRows(responses);
  const inventory = Array.isArray(conceptInventory) ? conceptInventory : [];
  if (!qs.length) return null;

  const legacy = qs.some(isLegacyMcqAssessmentItem);
  if (legacy) {
    try {
      const model = resolveLlmModelArg(llmModel);
      const lang = String(language || "English").trim() || "English";
      const systemPrompt = `Evaluate quiz responses into a knowledge_profile.
Rules:
- Conservative mastery: "full" only with demonstrated precision; "partial" requires real understanding.
- Unknown / "I don't know" answers → mastery "none", low confidence.
- Output JSON: {"items":[{"concept_id":"...","mastery":"none|partial|full","confidence":0.0-1.0}]}
Respond in ${lang}.`;

      const payload = {
        items: qs.map((q) => ({
          item_id: q.item_id,
          concept_id: q.concept_id,
          edge: q.edge,
          question: q.question,
          correct: q.correct,
        })),
        responses: resp,
        inventory_ids: inventory
          .map((c) => String(c?.id || c?.concept_id || "").trim())
          .filter(Boolean),
      };

      const content = await llmChatCompletions({
        llmModel: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(payload) },
        ],
        temperature: 0.1,
      });

      const parsed = parseModelJsonValue(content);
      return normalizeKnowledgeProfile(parsed, { inventory, items: qs, responses: resp });
    } catch (err) {
      console.warn("evaluatePrePackingAssessmentResponses failed:", err?.message || err);
      return null;
    }
  }

  try {
    const testRows = scorePrePackingTestResponses(qs, resp);
    let socraticRows = [];
    try {
      socraticRows = await evaluateSocraticAssessmentResponses({
        items: qs,
        responses: resp,
        conceptInventory: inventory,
        llmModel,
        language,
      });
    } catch (err) {
      console.warn("Socratic assessment evaluation failed:", err?.message || err);
    }

    const merged = mergeProfileRows([...testRows, ...socraticRows]);
    if (!merged.length) return null;

    return normalizeKnowledgeProfile(
      { items: merged },
      { inventory, items: qs, responses: resp },
    );
  } catch (err) {
    console.warn("evaluatePrePackingAssessmentResponses failed:", err?.message || err);
    return null;
  }
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

