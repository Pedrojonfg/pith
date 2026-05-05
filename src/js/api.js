import { DS_CHAT_COMPLETIONS_URL } from "./config.js?v=20260503_7";

function stripJsonFence(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function extractJsonObjectText(text) {
  const raw = String(text || "").trim();
  const start = raw.indexOf("{");
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
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  return raw.slice(start);
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
  const systemPrompt = `You are splitting a study document into blocks.

Rules:
- Each block must cover ONE distinct concept. Not one section, one concept.
- If multiple sections of the document discuss the SAME idea (e.g. "introduction to X", "how to compute X", "examples of X"), merge them into ONE block titled after the concept.
- Never create a block whose primary concept appears in another block.
- Each block must have a unique "signature": a list of 3-5 key terms that ONLY appear as the main focus of that block, not in others.
- The "chunk" field must include ALL source text relevant to that concept, even if it spans multiple sections.

Return ONLY valid JSON:
[{
  "id": 1,
  "title": "...",
  "summary": "2-3 sentences",
  "signature": ["term1", "term2", "term3"],
  "chunk": "verbatim text from ALL relevant sections"
}]

You MUST cover the ENTIRE document. The last block must correspond to the last section. Each concept appears in exactly ONE block.

Respond entirely in {language}.`
    .split("{N}")
    .join(String(nBlocks))
    .replace("{language}", language);

  const messages = [{ role: "system", content: systemPrompt }];
  const notes = String(studyNotes || "").trim();
  if (notes) {
    messages.push({
      role: "user",
      content: `Student comments / study focus (follow these preferences when splitting):\n${notes}`,
    });
  }
  messages.push({ role: "user", content: materialText });

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

