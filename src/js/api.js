import { DS_CHAT_COMPLETIONS_URL, LS_KEY } from "./config.js?v=20260523_2";

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

function parseModelJsonObject(text) {
  const raw = String(text || "").trim();
  const withoutFence = stripJsonFence(raw);
  const extracted = extractJsonObjectText(withoutFence);
  const candidates = [extracted, withoutFence, raw].filter(Boolean);
  const uniqueCandidates = Array.from(new Set(candidates));

  for (const candidate of uniqueCandidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try repair candidates below
    }
  }

  for (const candidate of uniqueCandidates) {
    const repairedCandidates = [
      escapeLatexMathBackslashes(candidate),
      escapeInvalidJsonBackslashes(candidate),
      escapeInvalidJsonBackslashes(escapeLatexMathBackslashes(candidate)),
    ];

    for (const repaired of repairedCandidates) {
      try {
        return JSON.parse(repaired);
      } catch {
        // try next repair
      }
    }
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
    try {
      return JSON.parse(candidate);
    } catch {
      // try repair candidates below
    }
  }

  for (const candidate of uniqueCandidates) {
    const repairedCandidates = [
      escapeLatexMathBackslashes(candidate),
      escapeInvalidJsonBackslashes(candidate),
      escapeInvalidJsonBackslashes(escapeLatexMathBackslashes(candidate)),
    ];
    for (const repaired of repairedCandidates) {
      try {
        return JSON.parse(repaired);
      } catch {
        // try next repair
      }
    }
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

function shuffleInPlace(arr) {
  const a = Array.isArray(arr) ? arr : [];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
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

export async function mapBlocksToPages(blockIndex, extractedPages, language) {
  const apiKey = String(localStorage.getItem(LS_KEY) || "").trim();
  if (!apiKey) {
    throw new Error("Missing API key. Click “Change API key” to set it.");
  }

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

    const res = await fetch(DS_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 800,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      // ignore JSON parse error; handled below
    }

    if (!res.ok) {
      const apiMsg =
        data?.error?.message || data?.message || `Request failed with status ${res.status}.`;
      throw new Error(apiMsg);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("Unexpected API response (missing message content).");
    }

    const rawMap = parseModelJsonValue(content.trim());
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

  const { estimateBlockPageRange } = await import("./session.js?v=20260523_2");
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

export async function generateAssessmentQuestions(blockIndex, maxQuestions) {
  const apiKey = String(localStorage.getItem(LS_KEY) || "").trim();
  if (!apiKey) {
    throw new Error("Missing API key. Click “Change API key” to set it.");
  }

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

  const res = await fetch(DS_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore JSON parse error; handled below
  }

  if (!res.ok) {
    const apiMsg =
      data?.error?.message || data?.message || `Request failed with status ${res.status}.`;
    throw new Error(apiMsg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Unexpected API response (missing message content).");
  }

  const raw = content.trim();
  const arr = parseModelJsonValue(raw);
  if (!Array.isArray(arr)) {
    console.warn("Invalid assessment JSON response:", raw);
    throw new Error("Model did not return a valid JSON array. Please try again.");
  }

  // Step 3 — shuffle returned array before returning
  return shuffleInPlace(arr);
}

export async function generateAssessmentSynthesis(assessmentResults, blockIndex, language) {
  try {
    const apiKey = String(localStorage.getItem(LS_KEY) || "").trim();
    if (!apiKey) return null;

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

    const res = await fetch(DS_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 300,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      // ignore
    }
    if (!res.ok) return null;

    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return null;
    return content.trim();
  } catch {
    return null;
  }
}

export async function deepSeekSocraticTutor({
  apiKey,
  blockTitle,
  question,
  studentAnswer,
}) {
  const systemPrompt = `You are a Socratic tutor. The student just studied this block: 
{block.title}. Evaluate their answer, point out gaps, push their reasoning further. 
Be concise and sharp, not encouraging.`.replace("{block.title}", blockTitle);

  const userPrompt = `Question: ${question}\nStudent answer: ${studentAnswer}`;

  const res = await fetch(DS_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore JSON parse error; handled below
  }

  if (!res.ok) {
    const apiMsg =
      data?.error?.message || data?.message || `Request failed with status ${res.status}.`;
    throw new Error(apiMsg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Unexpected API response (missing message content).");
  }
  return content.trim();
}

export async function deepSeekSummarySoFar({ apiKey, language, userPrompt }) {
  const systemPrompt = `You are a study assistant. Summarize the key concepts, arguments, 
and facts covered so far in this study session. Structure it as:
- One short paragraph of overall context
- A bullet list of the most important points (max 15 bullets)
- A bullet list of key terms introduced
Be concise. Respond in {language}.`.replace("{language}", language);

  const res = await fetch(DS_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore JSON parse error; handled below
  }

  if (!res.ok) {
    const apiMsg =
      data?.error?.message || data?.message || `Request failed with status ${res.status}.`;
    throw new Error(apiMsg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Unexpected API response (missing message content).");
  }
  return content.trim();
}

export async function deepSeekSplitIntoBlocks({
  apiKey,
  nBlocks,
  materialText,
  studyNotes,
  language,
}) {
  const n = Math.max(1, Math.floor(Number(nBlocks) || 1));
  const lang = String(language || "English").trim() || "English";
  const systemPrompt = `You are splitting a study document into exactly ${n} blocks.

Rules:
- Return EXACTLY ${n} objects with ids 1 through ${n} (no more, no fewer).
- Each block must cover ONE distinct concept. Not one section, one concept.
- If multiple sections discuss the SAME idea, merge them into ONE block titled after the concept.
- Never create a block whose primary concept appears in another block.
- Each block must have a unique "signature": a list of 3-5 key terms that ONLY appear as the main focus of that block, not in others.
- The "chunk" field must include ALL source text relevant to that concept, even if it spans multiple sections.
- Escape backslashes in JSON strings (e.g. LaTeX \\\\frac not \\frac).

Return ONLY a JSON array (no markdown fences, no preamble):
[{
  "id": 1,
  "title": "...",
  "summary": "2-3 sentences",
  "signature": ["term1", "term2", "term3"],
  "chunk": "verbatim text from ALL relevant sections"
}]

You MUST cover the ENTIRE document. The last block must correspond to the last section. Each concept appears in exactly ONE block.

Respond entirely in ${lang}.`;

  const messages = [{ role: "system", content: systemPrompt }];
  const notes = String(studyNotes || "").trim();
  if (notes) {
    messages.push({
      role: "user",
      content: `Student comments / study focus (follow these preferences when splitting):\n${notes}`,
    });
  }
  messages.push({
    role: "user",
    content: `Split the following material into exactly ${n} blocks.\n\n${materialText}`,
  });

  const res = await fetch(DS_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 0.2,
    }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore JSON parse error; handled below
  }

  if (!res.ok) {
    const apiMsg =
      data?.error?.message || data?.message || `Request failed with status ${res.status}.`;
    throw new Error(apiMsg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Unexpected API response (missing message content).");
  }
  return content.trim();
}

export async function deepSeekAuditBlockIndex({ apiKey, blockIndexJson, language }) {
  const systemPrompt = `You are auditing a study session block index for conceptual overlap.

Here is the block index (id, title, summary, signature):
{blockIndexJSON}

Your task:
1. Identify ALL pairs of blocks where the primary concept overlaps.
   Overlap = the same core idea, formula, or theorem is taught in both.
2. For each overlapping pair, recommend: MERGE or KEEP SEPARATE.
   MERGE if: both blocks teach the same concept at the same depth.
   KEEP SEPARATE if: one introduces and the other extends significantly.
3. Output a merge plan:

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

Be aggressive: if in doubt, merge. Redundancy is worse than density.
Respond ONLY with valid JSON.`
    .replace("{blockIndexJSON}", String(blockIndexJson || "[]"))
    .replace("{language}", language);

  const res = await fetch(DS_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore JSON parse error; handled below
  }

  if (!res.ok) {
    const apiMsg =
      data?.error?.message || data?.message || `Request failed with status ${res.status}.`;
    throw new Error(apiMsg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Unexpected API response (missing message content).");
  }
  return content.trim();
}

export async function deepSeekPostMergeChunk({
  apiKey,
  keep_id,
  absorb_ids,
  new_title,
  concatenated_chunks,
}) {
  const systemPrompt = `The following blocks have been merged:
- Original blocks {absorb_ids} are absorbed into block {keep_id}
- New title: {new_title}

Here are the original chunks for all merged blocks:
{concatenated_chunks}

Return a single merged chunk: combine the source texts, remove duplicate explanations, keep all unique examples and formulas.
Preserve verbatim source text where possible. Max 2000 words.`
    .replace("{keep_id}", String(keep_id))
    .replace("{absorb_ids}", Array.isArray(absorb_ids) ? absorb_ids.join(", ") : String(absorb_ids))
    .replace("{new_title}", String(new_title || ""))
    .replace("{concatenated_chunks}", String(concatenated_chunks || ""));

  const res = await fetch(DS_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore JSON parse error; handled below
  }

  if (!res.ok) {
    const apiMsg =
      data?.error?.message || data?.message || `Request failed with status ${res.status}.`;
    throw new Error(apiMsg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Unexpected API response (missing message content).");
  }
  return content.trim();
}

export async function deepSeekGenerateBlockJson({
  apiKey,
  blocksListText,
  materialText,
  blockIndex,
  blockTitle,
  previousComment,
  language,
  n_test,
  n_socratic,
}) {
  const nTest = Math.max(0, Math.min(5, Math.round(Number(n_test))));
  const nSocratic = Math.max(0, Math.min(3, Math.round(Number(n_socratic))));

  const systemPrompt = `You will receive study material and a confirmed list of blocks. Generate JSON for ONLY ONE block.
Return a single JSON object with this schema:
{
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
}
Respond entirely in {language}.
Generate exactly {n_test} test questions (type: "test") and {n_socratic} socratic questions (type: "socratic") in the questions array.
Test questions: 4 options (A/B/C/D), one correct answer, brief feedback.
Socratic questions: open-ended, no options, no correct answer field.
Order: all test questions first, then all socratic questions.
If n_test=0 or n_socratic=0, omit that type entirely.
When the material includes equations or expressions that must be reproduced exactly (LaTeX in the explanation counts), include AT LEAST one question whose primary focus is choosing the CORRECT FORM of the key formula or expression versus plausible incorrect variants (missing factor, wrong exponent/sign, swapped terms, dimensional inconsistency patterns). Prefer inline LaTeX in option text using \\( ... \\) when needed so each option renders clearly. Wrong options must reflect realistic student mistakes—not nonsense; keep options parallel in structure and length where possible.
Write a thorough, detailed explanation of at least 400-600 words. Cover all sub-concepts, include examples, and anticipate common points of confusion. Do not summarize — teach.
Also extract 3-8 key concepts, terms, names, or methods introduced in this block.
For each: the term exactly as used in the material, and a definition of max 15 words.
Only include terms that are non-obvious or domain-specific. No common words.
Every LaTeX backslash MUST be escaped for JSON strings: use "\\\\(", "\\\\)", "\\\\nabla", "\\\\cdot", etc.
Return ONLY valid JSON. No preamble, no backticks, no markdown fences.`
    .replace("{language}", language)
    .replace("{n_test}", String(nTest))
    .replace("{n_socratic}", String(nSocratic));

  const commentLine = previousComment
    ? `\n\nThe student had this comment after the previous block:\n${previousComment}\nTake it into account for the explanation and questions.`
    : "";

  const userContent = `Confirmed blocks list:\n${blocksListText}\n\nTarget block:\n${
    Number(blockIndex) + 1
  }. ${blockTitle}\n\nSource material (verbatim chunk for this block only):\n${materialText}${commentLine}`;

  const res = await fetch(DS_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
    }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore JSON parse error; handled below
  }

  if (!res.ok) {
    const apiMsg =
      data?.error?.message || data?.message || `Request failed with status ${res.status}.`;
    throw new Error(apiMsg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Unexpected API response (missing message content).");
  }

  const raw = content.trim();
  const blockObj = parseModelJsonObject(raw);
  if (!blockObj || typeof blockObj !== "object" || Array.isArray(blockObj)) {
    console.warn("Invalid block JSON response:", raw);
    throw new Error("Model did not return valid JSON for the block. Please try again.");
  }
  return blockObj;
}

export async function generateBlockFromChunk(block, chunk, config = {}, language = "English") {
  const apiKey = String(localStorage.getItem(LS_KEY) || "").trim();
  if (!apiKey) {
    throw new Error("Missing API key. Click “Change API key” to set it.");
  }
  const safeBlock = block && typeof block === "object" ? block : {};
  const id = Math.max(1, Math.floor(Number(safeBlock.id) || 1));
  const title = String(safeBlock.title || `Block ${id}`).trim() || `Block ${id}`;
  const source = String(safeBlock.source || "unknown").trim() || "unknown";
  const nTest = Math.max(0, Math.min(5, Math.round(Number(config.n_test))));
  const lang = String(language || "English").trim() || "English";
  const materialText = String(chunk || "").trim();

  const blocksListText = `${id}. ${title}`;
  const sourceLine = `Source: block ${id} '${title}' from ${source}`;
  const blockObj = await deepSeekGenerateBlockJson({
    apiKey,
    blocksListText,
    materialText: `${sourceLine}\n\n${materialText}`,
    blockIndex: id - 1,
    blockTitle: title,
    previousComment: "",
    language: lang,
    n_test: nTest,
    n_socratic: 0,
  });
  return {
    explanation: String(blockObj?.explanation || ""),
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
  const n_test = Math.max(0, Math.min(5, Math.round(Number(config.n_test))));
  const n_socratic = Math.max(0, Math.min(3, Math.round(Number(config.n_socratic))));
  const getApiKey = config.getApiKey;
  const blocksListText = String(config.blocksListText || "");
  const language = String(config.language || "English");
  const signal = config.signal;
  const onProgress = typeof config.onProgress === "function" ? config.onProgress : null;
  const onWarning = typeof config.onWarning === "function" ? config.onWarning : null;
  let failedCount = 0;

  for (let i = 0; i < total; i += 1) {
    if (signal?.aborted) throw new Error("Generation cancelled.");
    const row = items[i] && typeof items[i] === "object" ? items[i] : {};
    const title = String(row.title || `Block ${i + 1}`);
    const materialText = String(row.chunk || "");
    const apiKey = typeof getApiKey === "function" ? String(getApiKey() || "") : String(config.apiKey || "");
    if (!apiKey) throw new Error("Missing API key.");
    let block = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        block = await deepSeekGenerateBlockJson({
          apiKey,
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
  apiKey,
  sessionContent,
  type,
  batchSize,
}) {
  const typeWord =
    type === "both"
      ? "mixed (test and socratic)"
      : type === "test"
        ? "test"
        : "socratic";

  const systemPrompt = `You are a review examiner. Based on this study session content, generate exactly {batch_size} {type} questions that test retention across the ENTIRE session, not just one block. Prioritize: key terms, dates, names, cause-effect relationships, and concepts that are easy to confuse.
Return ONLY valid JSON array:
[{type, question, options?, answer?, feedback?}]
No preamble, no backticks.`
    .split("{batch_size}")
    .join(String(batchSize))
    .split("{type}")
    .join(String(typeWord));

  const res = await fetch(DS_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: String(sessionContent || "") },
      ],
      temperature: 0.2,
    }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore JSON parse error; handled below
  }

  if (!res.ok) {
    const apiMsg =
      data?.error?.message || data?.message || `Request failed with status ${res.status}.`;
    throw new Error(apiMsg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Unexpected API response (missing message content).");
  }

  return content.trim();
}

export async function deepSeekReviewSocraticTutor({
  apiKey,
  sessionContent,
  question,
  studentAnswer,
}) {
  const systemPrompt = `You are a Socratic tutor. The student is reviewing a study session. Evaluate their answer, point out gaps, and push their reasoning further.
Be concise and sharp, not encouraging.`;
  const userPrompt = `Session context:\n${sessionContent}\n\nQuestion: ${question}\nStudent answer: ${studentAnswer}`;

  const res = await fetch(DS_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore JSON parse error; handled below
  }

  if (!res.ok) {
    const apiMsg =
      data?.error?.message || data?.message || `Request failed with status ${res.status}.`;
    throw new Error(apiMsg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Unexpected API response (missing message content).");
  }
  return content.trim();
}

