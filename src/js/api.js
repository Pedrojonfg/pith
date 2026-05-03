import { DS_CHAT_COMPLETIONS_URL } from "./config.js?v=20260503_3";

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
  const systemPrompt = `You will receive study material. Split it into exactly {N} thematic blocks for a university student.
Return ONLY valid JSON: an array of objects with this exact schema:
[
  { "id": 1, "title": "...", "summary": "2-3 sentence description" }
]
Rules:
- The array length MUST equal {N}.
- "id" MUST be 1..{N} in order.
- Do NOT include source excerpts, chunks, quotes, or verbatim material.
- Do not include any extra keys.
- Return ONLY JSON. No preamble, no backticks, no markdown fences.

You MUST cover the ENTIRE document from start to finish. 
Distribute blocks proportionally across all sections. 
The last block must correspond to the last section of the document. 
Do not over-represent early sections at the expense of later ones.
If the student provides study comments/focus, use them to choose titles and allocate MORE detail/blocks to the relevant parts, while still covering the full document.

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

export async function deepSeekGenerateBlockJson({
  apiKey,
  mode,
  blocksListText,
  materialText,
  blockIndex,
  blockTitle,
  previousComment,
  language,
}) {
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
Mode is {mode}. For test: 3-4 questions, 4 options (A/B/C/D), correct answer, brief feedback.
When the material includes equations or expressions that must be reproduced exactly (LaTeX in the explanation counts), include AT LEAST one question whose primary focus is choosing the CORRECT FORM of the key formula or expression versus plausible incorrect variants (missing factor, wrong exponent/sign, swapped terms, dimensional inconsistency patterns). Prefer inline LaTeX in option text using \\( ... \\) when needed so each option renders clearly. Wrong options must reflect realistic student mistakes—not nonsense; keep options parallel in structure and length where possible.
For socratic: 2-3 open questions requiring reasoning or synthesis.
Write a thorough, detailed explanation of at least 400-600 words. Cover all sub-concepts, include examples, and anticipate common points of confusion. Do not summarize — teach.
Also extract 3-8 key concepts, terms, names, or methods introduced in this block.
For each: the term exactly as used in the material, and a definition of max 15 words.
Only include terms that are non-obvious or domain-specific. No common words.
Every LaTeX backslash MUST be escaped for JSON strings: use "\\\\(", "\\\\)", "\\\\nabla", "\\\\cdot", etc.
Return ONLY valid JSON. No preamble, no backticks, no markdown fences.`
    .replace("{mode}", mode)
    .replace("{language}", language);

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

