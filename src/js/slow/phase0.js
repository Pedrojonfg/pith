import { parseHeadings, SCOPE_CHAR_WARN } from "./headings.js?v=20260528_1";
import {
  getActiveSessionLlmModel,
  llmChatCompletions,
  normalizeLlmModel,
} from "../llm.js?v=20260525_1";

export const PHASE0_MAP_REDUCE_THRESHOLD = SCOPE_CHAR_WARN;
export const PHASE0_MAX_CHUNK_CHARS = 50000;

const MIN_CONCEPTS = 3;
const MAX_CONCEPTS = 5;

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
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return raw.slice(start);
}

function tryParseJsonCandidate(candidate) {
  if (!candidate) return null;
  const attempts = [
    candidate,
    candidate.replace(/[\u201c\u201d]/g, '"').replace(/,\s*([\]}])/g, "$1"),
  ];
  for (const text of attempts) {
    try {
      return JSON.parse(text);
    } catch {
      // next
    }
  }
  return null;
}

function parseModelJsonObject(text) {
  const raw = String(text || "").trim();
  const withoutFence = stripJsonFence(raw);
  const extracted = extractBalancedJsonText(withoutFence, "{", "}");
  for (const candidate of [extracted, withoutFence, raw].filter(Boolean)) {
    const parsed = tryParseJsonCandidate(candidate);
    if (parsed != null) return parsed;
  }
  return null;
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeArgumentMapNode(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = normalizeString(raw.id || raw.key || raw.role);
  const text = normalizeString(raw.text || raw.label || raw.content || raw.premise);
  if (!id || !text) return null;
  const node = { id, text };
  const status = normalizeString(raw.status || raw.estado || raw.state);
  if (status) node.status = status;
  const linkType = normalizeString(raw.linkType || raw.nexo || raw.nexoType);
  if (linkType) node.linkType = linkType;
  const objections = normalizeString(raw.objections || raw.objeciones);
  if (objections) node.objections = objections;
  return node;
}

function normalizeConcept(raw) {
  if (!raw || typeof raw !== "object") return null;
  const term = normalizeString(raw.term || raw.concept || raw.name);
  const authorUsage = normalizeString(
    raw.authorUsage || raw.usage || raw.definition || raw.howUsed || raw.note,
  );
  if (!term || !authorUsage) return null;
  const out = { term, authorUsage };
  const graphTermId = normalizeString(raw.graphTermId || raw.termId);
  if (graphTermId) out.graphTermId = graphTermId;
  return out;
}

/**
 * Validate and normalize Phase0Orientation JSON.
 * @returns {object | null}
 */
export function validatePhase0Orientation(value, { criticalMode = false } = {}) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : null;
  if (!raw) return null;

  const thesis = normalizeString(raw.thesis || raw.tesis);
  const guideQuestion = normalizeString(raw.guideQuestion || raw.guide_question || raw.preguntaGuia);
  const mapRaw = raw.argumentMap || raw.argument_map || raw.mapa || raw.map;
  const conceptsRaw = raw.conceptsToFind || raw.concepts_to_find || raw.concepts || raw.conceptos;

  if (!thesis || !guideQuestion) return null;
  if (!Array.isArray(mapRaw) || !mapRaw.length) return null;
  if (!Array.isArray(conceptsRaw)) return null;

  const argumentMap = mapRaw.map(normalizeArgumentMapNode).filter(Boolean);
  const conceptsToFind = conceptsRaw.map(normalizeConcept).filter(Boolean);

  if (!argumentMap.length) return null;
  if (conceptsToFind.length < MIN_CONCEPTS || conceptsToFind.length > MAX_CONCEPTS) return null;

  const out = { thesis, argumentMap, conceptsToFind, guideQuestion };

  const criticalRaw = raw.criticalExaminePoints || raw.critical_examine_points || raw.criticalPoints;
  if (criticalMode && Array.isArray(criticalRaw)) {
    const criticalExaminePoints = criticalRaw
      .map((p) => normalizeString(p))
      .filter(Boolean)
      .slice(0, 5);
    if (criticalExaminePoints.length) out.criticalExaminePoints = criticalExaminePoints;
  }

  return out;
}

/** Parse model text into validated Phase0Orientation (or null). */
export function parsePhase0Orientation(text, opts = {}) {
  const parsed = parseModelJsonObject(text);
  return validatePhase0Orientation(parsed, opts);
}

function buildPhase0SystemPrompt(language, criticalMode) {
  const lang = normalizeString(language) || "English";
  const criticalBlock = criticalMode
    ? `
5. criticalExaminePoints: array of 2-3 strings — structural weak points to examine critically (not verdicts on correctness).`
    : "";
  return `You are a philosophical reading assistant. Analyze the text and produce structured orientation BEFORE the student reads.

Rules:
- Respond entirely in ${lang}.
- Return ONLY valid JSON (no markdown fences).
- Do NOT judge whether the argument is correct or valid.
- thesis: one sentence — what the author wants the reader to accept (conclusion-oriented, not a summary).
- argumentMap: array of nodes with id (P1, P2, I, C, …), text, and status for premises (e.g. argued / taken for granted / intuition).
- conceptsToFind: exactly 3-5 objects { term, authorUsage } — technical or redefined concepts to track actively.
- guideQuestion: one open question the text answers (broad enough to avoid tunnel vision, specific enough to orient reading).${criticalBlock}

JSON schema:
{
  "thesis": "string",
  "argumentMap": [{ "id": "P1", "text": "...", "status": "..." }],
  "conceptsToFind": [{ "term": "...", "authorUsage": "..." }],
  "guideQuestion": "string"${criticalMode ? ',\n  "criticalExaminePoints": ["..."]' : ""}
}`;
}

function buildPhase0UserPrompt(scopeText) {
  return `Analyze this text and generate Phase 0 orientation JSON.\n\n${String(scopeText || "").trim()}`;
}

function buildChunkSystemPrompt(language) {
  const lang = normalizeString(language) || "English";
  return `You are analyzing one section of a longer philosophical text for map-reduce orientation.

Rules:
- Respond entirely in ${lang}.
- Return ONLY valid JSON (no markdown fences).
- partialMap: argument nodes found in THIS section only [{ id, text, status? }].
- concepts: 0-5 technical concepts in this section [{ term, authorUsage }].

JSON schema:
{ "partialMap": [{ "id": "P1", "text": "...", "status": "..." }], "concepts": [{ "term": "...", "authorUsage": "..." }] }`;
}

function buildSynthesisSystemPrompt(language, criticalMode) {
  const lang = normalizeString(language) || "English";
  const criticalBlock = criticalMode
    ? `\n- criticalExaminePoints: 2-3 structural weak points to examine (not verdicts).`
    : "";
  return `You are synthesizing partial analyses of a long text into one Phase 0 orientation.

Rules:
- Respond entirely in ${lang}.
- Return ONLY valid JSON matching the full Phase 0 schema.
- Merge partial maps into one coherent argumentMap (dedupe, renumber P1/P2/I/C as needed).
- Pick the best 3-5 conceptsToFind across all sections.
- thesis and guideQuestion must reflect the WHOLE text.${criticalBlock}

JSON schema:
{
  "thesis": "string",
  "argumentMap": [{ "id": "P1", "text": "...", "status": "..." }],
  "conceptsToFind": [{ "term": "...", "authorUsage": "..." }],
  "guideQuestion": "string"${criticalMode ? ',\n  "criticalExaminePoints": ["..."]' : ""}
}`;
}

async function callPhase0Json({ llmModel, systemPrompt, userPrompt, max_tokens = 4096, signal }) {
  let content;
  try {
    content = await llmChatCompletions({
      llmModel,
      max_tokens,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      signal,
    });
  } catch (err) {
    if (err?.status === 400 || /response_format/i.test(String(err?.message))) {
      content = await llmChatCompletions({
        llmModel,
        max_tokens,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        signal,
      });
    } else {
      throw err;
    }
  }
  return content;
}

function parsePartialChunk(text) {
  const parsed = parseModelJsonObject(text);
  if (!parsed || typeof parsed !== "object") return null;
  const partialMap = Array.isArray(parsed.partialMap)
    ? parsed.partialMap.map(normalizeArgumentMapNode).filter(Boolean)
    : [];
  const conceptsRaw = parsed.concepts || parsed.conceptsToFind || [];
  const concepts = Array.isArray(conceptsRaw)
    ? conceptsRaw.map(normalizeConcept).filter(Boolean)
    : [];
  return { partialMap, concepts };
}

/**
 * Build section boundaries in scope-relative coordinates.
 */
export function buildSectionBoundariesForScope(session) {
  const slow = session?.slow;
  if (!slow?.readingScope) return [];
  const scope = slow.readingScope;
  const scopeStart = Math.max(0, Number(scope.charStart) || 0);
  const scopeEnd = Math.min(
    slow.normalizedTextFull.length,
    Number(scope.charEnd) || slow.normalizedTextFull.length,
  );
  const headings = parseHeadings(slow.normalizedTextFull, slow.normalizedFormat);
  const inScope = headings.filter(
    (h) => h.charStart >= scopeStart && h.charStart < scopeEnd,
  );
  return inScope.map((h, i) => {
    const next = inScope[i + 1];
    const absEnd = next ? next.charStart : scopeEnd;
    return {
      id: `section-${i}`,
      title: h.label,
      charStart: h.charStart - scopeStart,
      charEnd: absEnd - scopeStart,
    };
  });
}

/**
 * Split scope text into map-reduce chunks (≤50k chars).
 */
export function buildMapReduceChunks(scopeText, sectionBoundaries, maxChunk = PHASE0_MAX_CHUNK_CHARS) {
  const text = String(scopeText || "");
  if (!text.length) return [];

  if (!Array.isArray(sectionBoundaries) || !sectionBoundaries.length) {
    const chunks = [];
    for (let i = 0; i < text.length; i += maxChunk) {
      chunks.push({
        title: `Part ${chunks.length + 1}`,
        text: text.slice(i, i + maxChunk),
      });
    }
    return chunks;
  }

  const chunks = [];
  let current = {
    title: sectionBoundaries[0].title,
    start: sectionBoundaries[0].charStart,
    end: sectionBoundaries[0].charEnd,
  };

  for (let i = 1; i < sectionBoundaries.length; i += 1) {
    const b = sectionBoundaries[i];
    const mergedLen = b.charEnd - current.start;
    if (mergedLen > maxChunk) {
      chunks.push({
        title: current.title,
        text: text.slice(current.start, current.end),
      });
      current = { title: b.title, start: b.charStart, end: b.charEnd };
    } else {
      current.end = b.charEnd;
      current.title = `${current.title} · ${b.title}`;
    }
  }
  chunks.push({
    title: current.title,
    text: text.slice(current.start, current.end),
  });
  return chunks;
}

/**
 * Single-call Phase 0 for scope < 60k chars.
 */
export async function generatePhase0Single(scopeText, opts = {}) {
  const {
    criticalMode = false,
    llmModel = getActiveSessionLlmModel(),
    language = "English",
    signal,
  } = opts;
  const model = normalizeLlmModel(llmModel);
  const raw = await callPhase0Json({
    llmModel: model,
    systemPrompt: buildPhase0SystemPrompt(language, criticalMode),
    userPrompt: buildPhase0UserPrompt(scopeText),
    signal,
  });
  const orientation = parsePhase0Orientation(raw, { criticalMode });
  if (!orientation) {
    throw new Error("Model did not return valid Phase 0 orientation JSON.");
  }
  return orientation;
}

/**
 * Map-reduce Phase 0 for scope ≥ 60k chars.
 */
export async function mapReducePhase0(scopeText, sectionBoundaries, opts = {}) {
  const {
    criticalMode = false,
    llmModel = getActiveSessionLlmModel(),
    language = "English",
    onProgress,
    signal,
  } = opts;
  const model = normalizeLlmModel(llmModel);
  const chunks = buildMapReduceChunks(scopeText, sectionBoundaries);
  if (!chunks.length) {
    throw new Error("Scope text is empty — cannot generate Phase 0.");
  }

  const partials = [];
  for (let i = 0; i < chunks.length; i += 1) {
    if (signal?.aborted) throw new Error("Phase 0 generation cancelled.");
    if (onProgress) {
      onProgress({
        phase: "chunk",
        current: i + 1,
        total: chunks.length,
        label: chunks[i].title,
      });
    }
    const raw = await callPhase0Json({
      llmModel: model,
      systemPrompt: buildChunkSystemPrompt(language),
      userPrompt: `Section: ${chunks[i].title}\n\n${chunks[i].text}`,
      max_tokens: 2048,
      signal,
    });
    const partial = parsePartialChunk(raw);
    if (!partial) {
      throw new Error(`Invalid partial Phase 0 JSON for section ${i + 1}.`);
    }
    partials.push({ title: chunks[i].title, ...partial });
  }

  if (onProgress) {
    onProgress({
      phase: "synthesis",
      current: chunks.length,
      total: chunks.length,
      label: "Synthesis",
    });
  }

  const synthesisUser = JSON.stringify({
    sections: partials.map((p) => ({
      title: p.title,
      partialMap: p.partialMap,
      concepts: p.concepts,
    })),
  });

  const rawFinal = await callPhase0Json({
    llmModel: model,
    systemPrompt: buildSynthesisSystemPrompt(language, criticalMode),
    userPrompt: `Synthesize these partial analyses into one Phase 0 orientation:\n${synthesisUser}`,
    max_tokens: 4096,
    signal,
  });

  const orientation = parsePhase0Orientation(rawFinal, { criticalMode });
  if (!orientation) {
    throw new Error("Model did not return valid synthesized Phase 0 JSON.");
  }
  return orientation;
}

/**
 * Pick single vs map-reduce based on scope length.
 */
export async function generatePhase0ForScope(scopeText, session, opts = {}) {
  const text = String(scopeText || "");
  const boundaries = buildSectionBoundariesForScope(session);
  const criticalMode = Boolean(session?.slow?.criticalMode);
  const baseOpts = {
    criticalMode,
    llmModel: session?.llmModel,
    ...opts,
  };

  if (text.length < PHASE0_MAP_REDUCE_THRESHOLD) {
    return generatePhase0Single(text, baseOpts);
  }
  return mapReducePhase0(text, boundaries, baseOpts);
}
