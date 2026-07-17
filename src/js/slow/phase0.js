import { scopeTextForPhase0IA } from "../input-normalization.js?v=20260625_02";
import {
  flattenHierarchy,
  getChunksFromHierarchy,
} from "../normalization/hierarchy.js?v=20260625_02";
import { parseHeadings, SCOPE_CHAR_WARN } from "./headings.js?v=20260625_02";
import {
  getActiveSessionLlmModel,
  llmChatCompletions,
  normalizeLlmModel,
} from "../llm.js?v=20260625_02";
import { getStudyLanguage } from "../ui.js?v=20260625_02";
import { addConceptsToShared, getActiveSession, saveActiveSession } from "../session-store.js";
import { SLOW_PHASE0_GENERATIVE_RULES } from "../pedagogy/generative-pedagogy.js";
import { looksLikeTruncatedModelJson } from "../api.js?v=20260625_02";

export const PHASE0_MAP_REDUCE_THRESHOLD = SCOPE_CHAR_WARN;
export const PHASE0_MAX_CHUNK_CHARS = 50000;
/** ~8 partialMap nodes + 5 concepts × ~120 tok; headroom for dense Spanish prose */
export const PHASE0_CHUNK_MAX_TOKENS = 3072;

const MIN_CONCEPTS = 3;
const MAX_CONCEPTS = 5;
const PHASE0_CHUNK_BISECT_MAX_DEPTH = 2;

export const NODE_TYPES = new Set(["CONCEPT", "PERSON", "WORK", "MOVEMENT", "EVENT"]);
export const TEXT_GENRES = new Set([
  "LINEAR_ARGUMENT",
  "GENEALOGY",
  "DEBATE",
  "DEFINITION",
  "CASE_ANALYSIS",
]);

const NODE_TYPE_PREFIX_RE = /^\[(CONCEPT|PERSON|WORK|MOVEMENT|EVENT)\]\s*/i;

function normalizeNodeType(raw, term = "") {
  const fromField = normalizeString(raw).toUpperCase();
  if (NODE_TYPES.has(fromField)) return fromField;
  const fromTerm = String(term || "").match(NODE_TYPE_PREFIX_RE);
  if (fromTerm) return fromTerm[1].toUpperCase();
  return "CONCEPT";
}

function stripNodeTypePrefix(term) {
  return normalizeString(term).replace(NODE_TYPE_PREFIX_RE, "");
}

function normalizeTextGenre(raw) {
  const genre = normalizeString(raw).toUpperCase();
  return TEXT_GENRES.has(genre) ? genre : "LINEAR_ARGUMENT";
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
  const period = normalizeString(raw.period || raw.periodo);
  if (period) node.period = period;
  const author = normalizeString(raw.author || raw.autor);
  if (author) node.author = author;
  return node;
}

function normalizeConcept(raw) {
  if (!raw || typeof raw !== "object") return null;
  const rawTerm = normalizeString(raw.term || raw.concept || raw.name);
  const term = stripNodeTypePrefix(rawTerm);
  const authorUsage = normalizeString(
    raw.authorUsage || raw.usage || raw.definition || raw.howUsed || raw.note,
  );
  if (!term || !authorUsage) return null;
  const nodeType = normalizeNodeType(raw.nodeType || raw.node_type || raw.type, rawTerm);
  const out = { term, authorUsage, nodeType };
  const graphTermId = normalizeString(raw.graphTermId || raw.termId);
  if (graphTermId) out.graphTermId = graphTermId;
  const includesRaw = raw.includes || raw.incluye;
  if (Array.isArray(includesRaw)) {
    const includes = includesRaw.map((item) => normalizeString(item)).filter(Boolean);
    if (includes.length) out.includes = includes;
  }
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

  const textGenre = normalizeTextGenre(raw.textGenre || raw.text_genre || raw.genre);
  const out = { thesis, argumentMap, conceptsToFind, guideQuestion, textGenre };

  const preRaw = raw.prequestions || raw.pre_questions || raw.userQuestions;
  if (Array.isArray(preRaw)) {
    const prequestions = preRaw.map(normalizePrequestion).filter(Boolean);
    if (prequestions.length) out.prequestions = prequestions;
  }

  const blanksRaw = raw.fillableBlanks || raw.fillable_blanks;
  if (Array.isArray(blanksRaw)) {
    const fillableBlanks = blanksRaw.map(normalizeFillableBlank).filter(Boolean);
    if (fillableBlanks.length) out.fillableBlanks = fillableBlanks;
  }

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
6. criticalExaminePoints: array of 2-3 strings — structural weak points weak points to examine critically (not verdicts on correctness).`
    : "";
  return `You are a philosophical reading assistant. Analyze the text and produce structured orientation BEFORE the student reads.

Rules:
- Respond entirely in ${lang}.
- Return ONLY valid JSON (no markdown fences).
- Do NOT judge whether the argument is correct or valid.
- Before building the argument map, classify the text into ONE textGenre:
  LINEAR_ARGUMENT (linear thesis + premises), GENEALOGY (historical evolution of a concept),
  DEBATE (contrasting authors on one problem), DEFINITION (what a concept is/is not),
  CASE_ANALYSIS (concrete case with theoretical frame).
- thesis: one sentence — what the author wants the reader to accept wants the reader to accept (conclusion-oriented, not a summary).
- argumentMap shape depends on textGenre:
  LINEAR_ARGUMENT ? P1, P2, …, C with status on premises;
  GENEALOGY ? G1, G2, … chronological with required period per node;
  DEBATE ? D1, D2, … positions with required author per node;
  DEFINITION ? DEF central node + S1, S2 satellites;
  CASE_ANALYSIS ? CASE + M1, M2 theoretical frame nodes.
- conceptsToFind: exactly 3-5 objects { term, authorUsage, nodeType } — technical or redefined concepts or redefined concepts.
  For each node indicate type: [CONCEPT], [PERSON], [WORK], [MOVEMENT], or [EVENT].
  Never create a [PERSON] node for the author of the text you are analyzing.
  If the text contains its own name as a bibliographic reference, ignore it as a node.
  If several concepts share the same structural role, group them in one node with includes: [...].
- guideQuestion: one open question the text answers (broad enough to avoid tunnel vision, specific enough to orient reading).${criticalBlock}
${SLOW_PHASE0_GENERATIVE_RULES}

JSON schema:
{
  "textGenre": "LINEAR_ARGUMENT",
  "thesis": "string",
  "argumentMap": [{ "id": "P1", "text": "...", "status": "..." }],
  "conceptsToFind": [{ "term": "...", "authorUsage": "...", "nodeType": "CONCEPT", "includes": ["..."] }],
  "guideQuestion": "string"${criticalMode ? ',\n  "criticalExaminePoints": ["..."]' : ""}
}`;
}

function buildPhase0UserPrompt(scopeText, treeSummary = "") {
  const treeBlock = treeSummary
    ? `\n\nDocument structure (section tree):\n${treeSummary}\n`
    : "";
  return `Analyze this text and generate Phase 0 orientation JSON.${treeBlock}\n\n${String(scopeText || "").trim()}`;
}

function buildHierarchyTreeSummary(docHierarchy, scopeStart, scopeEnd) {
  if (!docHierarchy?.tree?.length) return "";
  const flat = flattenHierarchy(docHierarchy.tree, 2).filter(
    (n) => n.startOffset >= scopeStart && n.startOffset < scopeEnd,
  );
  if (!flat.length) return "";
  return JSON.stringify(
    flat.map((n) => ({
      title: n.title,
      level: n.level,
      startOffset: n.startOffset - scopeStart,
      endOffset: Math.min(n.endOffset, scopeEnd) - scopeStart,
    })),
    null,
    0,
  );
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
- Emit a single textGenre for the WHOLE text (pick dominant genre if sections disagree).
- Merge partial maps into one coherent argumentMap (dedupe, renumber as needed per genre).
- Pick the best 3-5 conceptsToFind across all sections (with nodeType and includes when grouping).
- thesis and guideQuestion must reflect the WHOLE text.${criticalBlock}

JSON schema:
{
  "textGenre": "LINEAR_ARGUMENT",
  "thesis": "string",
  "argumentMap": [{ "id": "P1", "text": "...", "status": "..." }],
  "conceptsToFind": [{ "term": "...", "authorUsage": "...", "nodeType": "CONCEPT" }],
  "guideQuestion": "string"${criticalMode ? ',\n  "criticalExaminePoints": ["..."]' : ""}
}`;
}

async function callPhase0Json({ llmModel, systemPrompt, userPrompt, max_tokens = 4096, signal }) {
  let content;
  try {
    content = await llmChatCompletions({
      llmModel,
      max_tokens,
      temperature: 0.1,
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
        temperature: 0.1,
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

export function parsePartialChunk(text) {
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

function splitPhase0ChunkForBisect(chunk) {
  const text = String(chunk?.text || "");
  if (text.length < 800) return null;
  const mid = Math.floor(text.length / 2);
  let splitAt = text.lastIndexOf("\n\n", mid);
  if (splitAt < text.length * 0.25) splitAt = text.lastIndexOf("\n", mid);
  if (splitAt < text.length * 0.25) splitAt = mid;
  const a = text.slice(0, splitAt).trim();
  const b = text.slice(splitAt).trim();
  if (!a.length || !b.length) return null;
  return [
    { title: `${chunk.title} (a)`, text: a },
    { title: `${chunk.title} (b)`, text: b },
  ];
}

async function fetchPartialChunkLlm(chunk, ctx) {
  const { model, language, normalizedFormat, treeSummary, signal, max_tokens, terse } = ctx;
  const systemPrompt = terse
    ? `${buildChunkSystemPrompt(language)}\nRespond with MINIMAL JSON — at most 3 partialMap nodes and 2 concepts.`
    : buildChunkSystemPrompt(language);
  const userPrompt = buildPhase0UserPrompt(
    scopeTextForPhase0IA(chunk.text, normalizedFormat),
    treeSummary,
  ).replace("Analyze this text", `Analyze this section (${chunk.title})`);
  return callPhase0Json({
    llmModel: model,
    systemPrompt,
    userPrompt,
    max_tokens,
    signal,
  });
}

/**
 * @param {{ title: string, text: string }} chunk
 * @param {object} ctx
 * @param {number} [depth]
 */
export async function extractPartialChunkWithRetry(chunk, ctx, depth = 0) {
  const attempts = [
    { max_tokens: PHASE0_CHUNK_MAX_TOKENS, terse: false },
    { max_tokens: PHASE0_CHUNK_MAX_TOKENS, terse: true },
  ];
  let lastRaw = "";
  for (const attempt of attempts) {
    lastRaw = await fetchPartialChunkLlm(chunk, { ...ctx, ...attempt });
    const partial = parsePartialChunk(lastRaw);
    if (partial) return partial;
    const truncated = looksLikeTruncatedModelJson(lastRaw);
    console.warn("[phase0.mapReducePhase0] Parse failed, next attempt:", {
      title: chunk.title,
      depth,
      truncated,
      responseChars: String(lastRaw || "").length,
    });
    if (!truncated && attempt.terse) break;
  }
  if (depth >= PHASE0_CHUNK_BISECT_MAX_DEPTH) {
    throw new Error(`Invalid partial Phase 0 JSON for section: ${chunk.title}.`);
  }
  const halves = splitPhase0ChunkForBisect(chunk);
  if (!halves) {
    throw new Error(`Invalid partial Phase 0 JSON for section: ${chunk.title}.`);
  }
  console.warn("[phase0.mapReducePhase0] Bisecting chunk after parse failure:", {
    title: chunk.title,
    depth,
  });
  const results = await Promise.all(
    halves.map((half) => extractPartialChunkWithRetry(half, ctx, depth + 1)),
  );
  const partialMap = results.flatMap((r) => r.partialMap || []);
  /** @type {Map<string, object>} */
  const conceptByTerm = new Map();
  for (const r of results) {
    for (const c of r.concepts || []) {
      if (c?.term) conceptByTerm.set(c.term, c);
    }
  }
  return { partialMap, concepts: [...conceptByTerm.values()] };
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

  if (session?.docHierarchy?.tree?.length) {
    return flattenHierarchy(session.docHierarchy.tree, 2)
      .filter((n) => n.startOffset >= scopeStart && n.startOffset < scopeEnd)
      .map((n, i) => ({
        id: `section-${i}`,
        title: n.title,
        charStart: n.startOffset - scopeStart,
        charEnd: Math.min(n.endOffset, scopeEnd) - scopeStart,
      }));
  }

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
 * Split scope text into map-reduce chunks (=50k chars).
 */
export function buildMapReduceChunks(
  scopeText,
  sectionBoundaries,
  maxChunk = PHASE0_MAX_CHUNK_CHARS,
  docHierarchy = null,
) {
  const text = String(scopeText || "");
  if (!text.length) return [];

  if (docHierarchy?.tree?.length) {
    const scopeStart = 0;
    const scopedTree = shiftHierarchyTree(docHierarchy.tree, scopeStart, text.length);
    const hierarchyChunks = getChunksFromHierarchy(scopedTree, text, maxChunk);
    return hierarchyChunks.map((ch) => ({
      title: ch.title,
      text: ch.text,
    }));
  }

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
      current.title = `${current.title} — ${b.title}`;
    }
  }
  chunks.push({
    title: current.title,
    text: text.slice(current.start, current.end),
  });
  return chunks;
}

function shiftHierarchyTree(tree, offset, scopeLen) {
  function shiftNode(node) {
    const start = Math.max(0, node.startOffset - offset);
    const end = Math.min(scopeLen, node.endOffset - offset);
    const children = Array.isArray(node.children)
      ? node.children.map(shiftNode).filter((c) => c.endOffset > c.startOffset)
      : [];
    return {
      ...node,
      startOffset: start,
      endOffset: end,
      children,
    };
  }
  return (Array.isArray(tree) ? tree : [])
    .map(shiftNode)
    .filter((n) => n.endOffset > n.startOffset);
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
    treeSummary = "",
  } = opts;
  const model = normalizeLlmModel(llmModel);
  const raw = await callPhase0Json({
    llmModel: model,
    systemPrompt: buildPhase0SystemPrompt(language, criticalMode),
    userPrompt: buildPhase0UserPrompt(scopeText, treeSummary),
    signal,
  });
  const orientation = parsePhase0Orientation(raw, { criticalMode });
  if (!orientation) {
    throw new Error("Model did not return valid Phase 0 orientation JSON.");
  }
  return orientation;
}

/**
 * Map-reduce Phase 0 for scope = 60k chars.
 */
export async function mapReducePhase0(scopeText, sectionBoundaries, opts = {}) {
  const {
    criticalMode = false,
    llmModel = getActiveSessionLlmModel(),
    language = "English",
    normalizedFormat,
    onProgress,
    signal,
    session = null,
    treeSummary = "",
  } = opts;
  const model = normalizeLlmModel(llmModel);
  const text = String(scopeText || "");
  // [debug-enrich]
  console.info("[slow.phase0.mapReducePhase0] Start:", {
    textLen: text.length,
    criticalMode,
    llmModel: model,
    language,
    hasSession: Boolean(session),
  });
  const scope = session?.slow?.readingScope;
  const scopeStart = Math.max(0, Number(scope?.charStart) || 0);
  const scopeEnd = scopeStart + text.length;
  const resolvedTreeSummary =
    treeSummary || buildHierarchyTreeSummary(session?.docHierarchy, scopeStart, scopeEnd);
  const scopedHierarchy =
    session?.docHierarchy?.tree?.length && scope
      ? {
          ...session.docHierarchy,
          tree: shiftHierarchyTree(
            session.docHierarchy.tree,
            scopeStart,
            text.length,
          ),
        }
      : null;

  const chunks = buildMapReduceChunks(
    scopeText,
    sectionBoundaries,
    PHASE0_MAX_CHUNK_CHARS,
    scopedHierarchy,
  );
  if (!chunks.length) {
    throw new Error("Scope text is empty — cannot generate Phase 0. generate Phase 0.");
  }

  const partials = [];
  const chunkCtx = {
    model,
    language,
    normalizedFormat,
    treeSummary: resolvedTreeSummary,
    signal,
  };
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
    try {
      const partial = await extractPartialChunkWithRetry(chunks[i], chunkCtx);
      partials.push({ title: chunks[i].title, ...partial });
    } catch (err) {
      const prepHint = err?.message || String(err);
      console.error("[phase0.mapReducePhase0] Chunk failed:", {
        section: i + 1,
        title: chunks[i].title,
        message: prepHint,
      });
      throw new Error(`Invalid partial Phase 0 JSON for section ${i + 1}.`);
    }
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
    // [debug-enrich]
    console.error("[slow.phase0.mapReducePhase0] Invalid synthesized Phase 0 JSON");
    throw new Error("Model did not return valid synthesized Phase 0 JSON.");
  }
  // [debug-enrich]
  console.info("[slow.phase0.mapReducePhase0] Done:", {
    chunkCount: chunks.length,
    conceptCount: Array.isArray(orientation?.conceptsToFind) ? orientation.conceptsToFind.length : 0,
    criticalMode,
  });
  return orientation;
}

/**
 * Dual-write Phase 0 concepts to DocumentSession.shared.conceptInventory.
 * @param {{ conceptsToFind?: { term?: string, authorUsage?: string }[] } | null} phase0
 */
export async function syncPhase0ConceptsToShared(phase0) {
  const doc = await getActiveSession();
  if (!doc?.docId || !phase0) return;
  const concepts = (phase0.conceptsToFind || [])
    .map((c) => ({
      label: String(c?.term || "").trim(),
      definition: String(c?.authorUsage || "").trim(),
      detectedBy: "slow",
    }))
    .filter((c) => c.label);
  if (!concepts.length) return;
  try {
    addConceptsToShared(doc, concepts);
    await saveActiveSession(doc);
  } catch (err) {
    console.warn("[phase0] shared concepts dual-write failed", err);
  }
}

/**
 * Pick single vs map-reduce based on scope length.
 */
export async function generatePhase0ForScope(scopeText, session, opts = {}) {
  const text = String(scopeText || "");
  const normalizedFormat = session?.slow?.normalizedFormat;
  const iaText = scopeTextForPhase0IA(text, normalizedFormat);
  const boundaries = buildSectionBoundariesForScope(session);
  const criticalMode = Boolean(session?.slow?.criticalMode);
  const scope = session?.slow?.readingScope;
  const scopeStart = Math.max(0, Number(scope?.charStart) || 0);
  const scopeEnd = scopeStart + text.length;
  const treeSummary = buildHierarchyTreeSummary(session?.docHierarchy, scopeStart, scopeEnd);
  const baseOpts = {
    criticalMode,
    llmModel: session?.llmModel,
    normalizedFormat,
    treeSummary,
    ...opts,
  };

  const orientation =
    iaText.length < PHASE0_MAP_REDUCE_THRESHOLD
      ? await generatePhase0Single(iaText, { ...baseOpts, treeSummary })
      : await mapReducePhase0(text, boundaries, { ...baseOpts, session });
  syncPhase0ConceptsToShared(orientation);
  return orientation;
}

// --- T04: editable Phase 0, fillable map, re-read ---

export const LS_PHASE0_SEEN_KEYS = "slow_phase0_seen_keys";
export const LS_PHASE0_ORIENTATION_CACHE = "slow_phase0_orientation_cache";

export function slugGraphTermId(term) {
  return String(term || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/gi, "");
}

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || !raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/** Stable key for (fileName + scope range) re-read detection. */
export function computePhase0SeenKey(fileName, scope) {
  const fn = String(fileName || "").trim();
  const start = Math.max(0, Number(scope?.charStart) || 0);
  const end = Math.max(start, Number(scope?.charEnd) || 0);
  const raw = `${fn}\0${start}:${end}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) {
    h = (h << 5) - h + raw.charCodeAt(i);
    h |= 0;
  }
  return `p0_${Math.abs(h)}_${start}_${end}`;
}

export function loadPhase0SeenKeys() {
  const arr = readJsonStorage(LS_PHASE0_SEEN_KEYS, []);
  return Array.isArray(arr) ? arr.map(String) : [];
}

export function isPhase0Reread(seenKey) {
  const key = String(seenKey || "").trim();
  if (!key) return false;
  return loadPhase0SeenKeys().includes(key);
}

export function markPhase0Seen(seenKey) {
  const key = String(seenKey || "").trim();
  if (!key) return;
  const keys = loadPhase0SeenKeys();
  if (!keys.includes(key)) {
    keys.push(key);
    writeJsonStorage(LS_PHASE0_SEEN_KEYS, keys);
  }
}

export function loadPhase0Cache(seenKey, { criticalMode = false } = {}) {
  const key = String(seenKey || "").trim();
  if (!key) return null;
  const cache = readJsonStorage(LS_PHASE0_ORIENTATION_CACHE, {});
  const entry = cache && typeof cache === "object" ? cache[key] : null;
  if (!entry || typeof entry !== "object") return null;
  return validatePhase0Orientation(entry, { criticalMode });
}

export function savePhase0Cache(seenKey, phase0) {
  const key = String(seenKey || "").trim();
  if (!key || !phase0) return;
  const cache = readJsonStorage(LS_PHASE0_ORIENTATION_CACHE, {});
  const next = cache && typeof cache === "object" && !Array.isArray(cache) ? { ...cache } : {};
  next[key] = phase0;
  writeJsonStorage(LS_PHASE0_ORIENTATION_CACHE, next);
}

export function normalizePrequestion(raw) {
  const text = normalizeString(typeof raw === "string" ? raw : raw?.text || raw?.question);
  return text || null;
}

export function normalizeFillableBlank(raw) {
  if (!raw || typeof raw !== "object") return null;
  const nodeId = normalizeString(raw.nodeId || raw.id);
  if (!nodeId) return null;
  const out = {
    nodeId,
    userText: normalizeString(raw.userText || raw.text),
    pageIndex: raw.pageIndex == null ? null : Math.max(0, Math.floor(Number(raw.pageIndex) || 0)),
  };
  const annotationId = normalizeString(raw.annotationId);
  if (annotationId) out.annotationId = annotationId;
  return out;
}

export function buildFillableBlanksFromMap(argumentMap) {
  return (Array.isArray(argumentMap) ? argumentMap : [])
    .map((n) => normalizeArgumentMapNode(n))
    .filter(Boolean)
    .map((n) => ({ nodeId: n.id, userText: "", pageIndex: null }));
}

export function applyFillableMapMode(orientation, fillableMapMode) {
  if (!orientation || !fillableMapMode) return orientation;
  const existing = Array.isArray(orientation.fillableBlanks)
    ? orientation.fillableBlanks.map(normalizeFillableBlank).filter(Boolean)
    : [];
  const blanks =
    existing.length > 0 ? existing : buildFillableBlanksFromMap(orientation.argumentMap);
  return { ...orientation, fillableBlanks: blanks };
}

export function ensurePhase0UserFields(phase0) {
  if (!phase0 || typeof phase0 !== "object") return phase0;
  if (!Array.isArray(phase0.prequestions)) phase0.prequestions = [];
  return phase0;
}

/**
 * Fill the next matching blank during Phase 1 (fillable map mode).
 * @returns {object | null} filled blank entry
 */
export function fillBlankFromAnnotation(session, annotation, pageIndex) {
  const slow = session?.slow;
  if (!slow?.fillableMapMode || !slow.phase0?.fillableBlanks) return null;
  const userText = normalizeString(annotation?.userText);
  if (!userText) return null;

  const blanks = slow.phase0.fillableBlanks;
  const upper = userText.toUpperCase();
  let target =
    blanks.find((b) => !b.userText && upper.includes(String(b.nodeId || "").toUpperCase())) ||
    null;

  if (!target) {
    for (const c of slow.phase0.conceptsToFind || []) {
      const term = String(c.term || "").toLowerCase();
      if (term && userText.toLowerCase().includes(term)) {
        const node = (slow.phase0.argumentMap || []).find(
          (n) => String(n.text || "").toLowerCase().includes(term),
        );
        if (node) {
          target = blanks.find((b) => b.nodeId === node.id && !b.userText);
          if (target) break;
        }
      }
    }
  }

  if (!target) {
    target = blanks.find((b) => !b.userText) || null;
  }
  if (!target) return null;

  target.userText = userText;
  target.pageIndex = Math.max(0, Math.floor(Number(pageIndex) || 0));
  if (annotation?.id) target.annotationId = annotation.id;
  return target;
}

export function getPhase0SeenKeyForSession(session) {
  return computePhase0SeenKey(session?.materialMeta?.fileName, session?.slow?.readingScope);
}

const GENERIC_SUMMARIZE_RE = /summarize (?:this section )?in one sentence/i;

/**
 * Local integration question when phase0 was skipped or IA is unavailable.
 */
export function buildCheckpointQuestionTemplate(section, argumentMap, lang = "English") {
  const title = String(section?.title || "this section").trim() || "this section";
  const map = Array.isArray(argumentMap) ? argumentMap.filter(Boolean) : [];
  if (map.length) {
    const nodes = map
      .slice(0, 3)
      .map((n) => `${n.id}: ${n.text}`)
      .join("; ");
    return `How does what you read in «${title}» connect to the argument map (${nodes})?`;
  }

  return `How would you integrate what you read under «${title}» with the author's line of argument?`;
}

function normalizeCheckpointQuestion(text) {
  return String(text || "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();
}

function isWeakCheckpointQuestion(text) {
  const q = normalizeCheckpointQuestion(text);
  if (!q) return true;
  if (GENERIC_SUMMARIZE_RE.test(q)) return true;
  if (/^who\s+(is|was)\s+(the\s+)?author/i.test(q)) return true;
  return false;
}

/**
 * One integration checkpoint question from argument map + section text (FR-007 / R19).
 */
export async function generateCheckpointQuestion({
  section,
  argumentMap,
  sectionText,
  llmModel,
  phase0Skipped = false,
  lang,
  llmCall = llmChatCompletions,
} = {}) {
  const studyLang = lang || getStudyLanguage() || "English";

  if (phase0Skipped || !Array.isArray(argumentMap) || !argumentMap.length) {
    return buildCheckpointQuestionTemplate(section, phase0Skipped ? null : argumentMap, studyLang);
  }

  const mapSummary = argumentMap
    .map((n) => `${n.id}${n.status ? ` (${n.status})` : ""}: ${n.text}`)
    .join("\n");

  try {
    const question = await llmCall({
      llmModel: normalizeLlmModel(llmModel),
      messages: [
        {
          role: "system",
          content:
            `Generate exactly ONE integration checkpoint question for a slow reading session. ` +
            `The question must require synthesizing the section text with the Phase 0 argument map — ` +
            `NOT factual trivia, NOT "who is the author", NOT "summarize in one sentence". ` +
            `Respond with ONLY the question, no quotes, no numbering. Language: ${studyLang}.`,
        },
        {
          role: "user",
          content:
            `Section heading: ${section?.title || "Section"}\n\n` +
            `Argument map:\n${mapSummary}\n\n` +
            `Section text read:\n${String(sectionText || "").slice(0, 80000)}`,
        },
      ],
      temperature: 0.6,
      max_tokens: 120,
    });

    const cleaned = normalizeCheckpointQuestion(question);
    if (isWeakCheckpointQuestion(cleaned)) {
      return buildCheckpointQuestionTemplate(section, argumentMap, studyLang);
    }
    return cleaned;
  } catch {
    return buildCheckpointQuestionTemplate(section, argumentMap, studyLang);
  }
}
