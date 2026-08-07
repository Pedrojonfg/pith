/**
 * Document hierarchy pre-index: deterministic tree, validation, flatten, chunks.
 */

import { analyzeText } from "../recommendation/analyzer.js";
import {
  getCachedHierarchy,
  hashText,
  setCachedHierarchy,
} from "./hierarchy-cache.js";
import { snapToSentenceBoundary } from "../text-boundaries.js";

const HEADING_RE = /^(#{1,6})\s+(.+)$/gm;
const DELIMITER_L1_RE = /^❖\s*(.+)$/gm;
const DELIMITER_L2_RE = /^[➔➢]\s*(.+)$/gm;
const MIN_LLM_CHARS = 3000;
const SUMMARY_MIN_CHARS = 8000;

/**
 * @param {string} markdownText
 * @param {((args: { systemPrompt: string, userPrompt: string, temperature: number, maxTokens: number, signal?: AbortSignal }) => Promise<string>) | null} llmFn
 * @param {{ useCache?: boolean, textHash?: string, minLlmChars?: number, includeSummary?: boolean, signal?: AbortSignal }} [options]
 * @returns {Promise<{ method: 'llm'|'deterministic'|'trivial', tree: import("./types.js").HierarchyNode[], pedagogicalMeta: import("../session-types.js").PedagogicalMeta | null, topics: string[], textHash: string, generatedAt: number, fromCache?: boolean } | null>}
 */
export async function buildDocumentHierarchy(markdownText, llmFn, options = {}) {
  const text = String(markdownText ?? "");
  const textHash = options.textHash ?? hashText(text);
  const minLlmChars = Number(options.minLlmChars) || MIN_LLM_CHARS;
  const useCache = options.useCache !== false;
  const includeSummary = options.includeSummary ?? text.length >= SUMMARY_MIN_CHARS;
  const generatedAt = Date.now();
  // R6: HeadingCandidate provenance from normalizeDocumentStructure → HierarchyNode.source
  const structureHeadings = Array.isArray(options.headings) ? options.headings : [];

  /**
   * Metadata-only: does not change offsets, titles, or children.
   * @param {object | null} result
   */
  const withSources = (result) => {
    if (!result?.tree?.length || !structureHeadings.length) return result;
    applyHierarchySourcesFromHeadings(result.tree, structureHeadings);
    return result;
  };

  if (hasMarkdownHeadings(text)) {
    const bag = globalThis.__dppNormalizationDebug;
    if (bag) bag.hierarchyMethod = "deterministic";
    console.info("[hierarchy.buildDocumentHierarchy] Deterministic from markdown headings:", {
      charCount: text.length,
      method: "deterministic",
      pathReason: "has_markdown_headings",
      llmAttempted: false,
    }); // [debug-enrich]
    return withSources({
      method: "deterministic",
      tree: buildDeterministicHierarchy(text),
      pedagogicalMeta: buildDeterministicPedagogicalMeta(analyzeText(text)),
      topics: [],
      textHash,
      generatedAt,
    });
  }

  if (hasDelimiterHeadings(text)) {
    const bag = globalThis.__dppNormalizationDebug;
    if (bag) bag.hierarchyMethod = "deterministic-delimiter";
    console.info("[hierarchy.buildDocumentHierarchy] Deterministic from delimiters:", {
      charCount: text.length,
      method: "deterministic",
      pathReason: "has_delimiter_headings",
      llmAttempted: false,
    }); // [debug-enrich]
    return withSources({
      method: "deterministic",
      tree: buildDelimiterHierarchy(text),
      pedagogicalMeta: buildDeterministicPedagogicalMeta(analyzeText(text)),
      topics: [],
      textHash,
      generatedAt,
    });
  }

  if (text.length < minLlmChars) {
    console.warn("[hierarchy.buildDocumentHierarchy] Trivial flat hierarchy (text below LLM threshold):", {
      charCount: text.length,
      minLlmChars,
      method: "trivial",
      pathReason: "text_below_llm_threshold",
      llmAttempted: false,
    }); // [debug-enrich]
    const bag = globalThis.__dppNormalizationDebug;
    if (bag) bag.hierarchyMethod = "trivial";
    return withSources({
      method: "trivial",
      tree: buildTrivialHierarchy(text),
      pedagogicalMeta: buildDeterministicPedagogicalMeta(analyzeText(text)),
      topics: [],
      textHash,
      generatedAt,
    });
  }

  if (typeof llmFn !== "function") {
    console.warn("[hierarchy.buildDocumentHierarchy] No LLM fn — returning null:", {
      charCount: text.length,
      pathReason: "llm_fn_unavailable",
      llmAttempted: false,
      hasMarkdownHeadings: hasMarkdownHeadings(text),
      hasDelimiterHeadings: hasDelimiterHeadings(text),
    }); // [debug-enrich]
    return null;
  }

  console.info("[hierarchy.buildDocumentHierarchy] Attempting LLM hierarchy:", {
    charCount: text.length,
    minLlmChars,
    hasMarkdownHeadings: hasMarkdownHeadings(text),
    hasDelimiterHeadings: hasDelimiterHeadings(text),
    includeSummary,
    useCache,
  }); // [debug-enrich]

  if (useCache) {
    const cached = getCachedHierarchy(textHash);
    if (cached) {
      const bag = globalThis.__dppNormalizationDebug;
      if (bag) bag.hierarchyMethod = cached.method || "llm";
      console.debug("[hierarchy.buildDocumentHierarchy] Cache hit:", {
        method: cached.method || "llm",
        rootCount: cached.tree?.length ?? 0,
      }); // [debug-enrich]
      return withSources({
        method: /** @type {'llm'} */ (cached.method || "llm"),
        tree: /** @type {import("./types.js").HierarchyNode[]} */ (cached.tree),
        pedagogicalMeta:
          cached.pedagogicalMeta ??
          buildDeterministicPedagogicalMeta(analyzeText(text)),
        topics: Array.isArray(cached.topics) ? cached.topics : [],
        textHash,
        generatedAt,
        fromCache: true,
      });
    }
  }

  const userPrompt = buildHierarchyUserPrompt(text, { includeSummary });
  let raw = "";
  try {
    raw = await llmFn({
      systemPrompt: HIERARCHY_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.1,
      maxTokens: 2000,
      signal: options.signal,
    });
  } catch (err) {
    return withSources(
      deterministicFallback(text, textHash, generatedAt, {
        fallbackTrigger: "llm_call_failed",
        errorType: err?.name || "Error",
        errorMessage: String(err?.message || err).slice(0, 200),
        responseLength: 0,
      }),
    );
  }

  const tree = parseLlmHierarchyTree(raw);
  if (!tree) {
    return withSources(
      deterministicFallback(text, textHash, generatedAt, {
        fallbackTrigger: "parse_failed",
        responseLength: raw.length,
        responsePreview: String(raw).trim().slice(0, 120),
        parseResult: "null_tree",
      }),
    );
  }

  const validation = validateHierarchy(tree, text.length);
  if (!validation.valid) {
    return withSources(
      deterministicFallback(text, textHash, generatedAt, {
        fallbackTrigger: "validation_failed",
        responseLength: raw.length,
        validationErrors: validation.errors.slice(0, 8),
        rootCount: tree.length,
      }),
    );
  }

  const pedagogicalMeta =
    parsePedagogicalMetaFromLlm(raw) ?? buildDeterministicPedagogicalMeta(analyzeText(text));
  const topics = parseTopicsFromLlm(raw);

  if (useCache) {
    setCachedHierarchy(textHash, { tree, method: "llm", pedagogicalMeta, topics });
  }

  const bag = globalThis.__dppNormalizationDebug;
  if (bag) bag.hierarchyMethod = "llm";
  console.info("[hierarchy.buildDocumentHierarchy] LLM hierarchy built:", {
    method: "llm",
    rootCount: tree.length,
    topicCount: topics.length,
  }); // [debug-enrich]

  return withSources({ method: "llm", tree, pedagogicalMeta, topics, textHash, generatedAt });
}

/**
 * @param {string} text
 * @param {string} textHash
 * @param {number} generatedAt
 * @param {object} [meta]
 */
function deterministicFallback(text, textHash, generatedAt, meta = {}) {
  console.warn("[hierarchy.buildDocumentHierarchy] LLM fallback to deterministic hierarchy:", {
    charCount: text.length,
    hasMarkdownHeadings: hasMarkdownHeadings(text),
    hasDelimiterHeadings: hasDelimiterHeadings(text),
    fallbackTrigger: meta.fallbackTrigger || "unknown",
    errorType: meta.errorType || null,
    errorMessage: meta.errorMessage || null,
    responseLength: meta.responseLength ?? null,
    responsePreview: meta.responsePreview || null,
    parseResult: meta.parseResult || null,
    validationErrors: meta.validationErrors || null,
    rootCount: meta.rootCount ?? null,
  }); // [debug-enrich]
  const bag = globalThis.__dppNormalizationDebug;
  if (bag) bag.hierarchyMethod = "deterministic-fallback";
  return {
    method: "deterministic",
    tree: buildDeterministicHierarchy(text),
    pedagogicalMeta: buildDeterministicPedagogicalMeta(analyzeText(text)),
    topics: [],
    textHash,
    generatedAt,
  };
}

const HIERARCHY_SYSTEM_PROMPT =
  "Eres un analizador estructural de textos académicos. Responde solo con JSON válido.";

/**
 * @param {string} text
 * @param {{ includeSummary?: boolean }} opts
 */
export function buildHierarchyUserPrompt(text, opts = {}) {
  const includeSummary = opts.includeSummary !== false && text.length >= SUMMARY_MIN_CHARS;
  const summaryRule = includeSummary
    ? "- summary: 1 frase, máx 15 palabras, en el idioma del texto."
    : "- No incluyas el campo summary.";

  return `Dado el siguiente texto en markdown, genera un árbol jerárquico de sus secciones.

REGLAS ESTRICTAS:
- Responde SOLO con JSON válido, sin markdown, sin explicaciones.
- startOffset y endOffset son posiciones en caracteres del texto original.
  startOffset del primer nodo raíz = 0.
  endOffset del último nodo raíz = longitud total del texto.
- Los rangos de nodos hermanos no se solapan y son contiguos.
- level 1 = top-level section; deeper levels reflect actual nesting with no artificial ceiling (CommonMark headings are 1–6).
- Si el texto no tiene estructura clara, devuelve un solo nodo raíz con el título inferido del contenido.
${summaryRule}
- Además del árbol, devuelve "pedagogical_meta" al mismo nivel que el array raíz del árbol:
  - genre: philosophical | scientific_theoretical | scientific_empirical | essay | lecture_notes | textbook_chapter | unknown
  - argumentative_density: 1-5
  - conceptual_load: 1-5
  - primary_learning_goal: understand_argument | memorize_facts | learn_procedure | survey_field
  - reasoning: string, máx 20 palabras
- Devuelve "topics": array de 2 a 5 etiquetas temáticas cortas (idioma del documento OK) para filtrar conocimiento cruzado.

Formato respuesta JSON: { "tree": [...], "pedagogical_meta": { ... }, "topics": ["tag1", "tag2"] }

TEXTO (longitud: ${text.length} chars):
${text}

RESPUESTA (solo JSON):`;
}

const PEDAGOGICAL_GENRES = new Set([
  "philosophical",
  "scientific_theoretical",
  "scientific_empirical",
  "essay",
  "lecture_notes",
  "textbook_chapter",
  "unknown",
]);

const PRIMARY_LEARNING_GOALS = new Set([
  "understand_argument",
  "memorize_facts",
  "learn_procedure",
  "survey_field",
]);

/**
 * @param {string} raw
 * @returns {import("../session-types.js").PedagogicalMeta | null}
 */
/**
 * @param {string} raw
 * @returns {string[]}
 */
export function parseTopicsFromLlm(raw) {
  const parsed = parseLlmJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const topicsRaw = /** @type {Record<string, unknown>} */ (parsed).topics;
  if (!Array.isArray(topicsRaw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of topicsRaw) {
    const tag = String(item || "").trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= 5) break;
  }
  return out.length >= 2 ? out : out;
}

export function parsePedagogicalMetaFromLlm(raw) {
  const parsed = parseLlmJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const meta =
    /** @type {Record<string, unknown>} */ (parsed).pedagogical_meta ??
    /** @type {Record<string, unknown>} */ (parsed).pedagogicalMeta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;

  const m = /** @type {Record<string, unknown>} */ (meta);
  const genreRaw = String(m.genre || "").trim();
  const genre = PEDAGOGICAL_GENRES.has(genreRaw) ? genreRaw : "unknown";

  const goalRaw = String(m.primary_learning_goal ?? m.primaryLearningGoal ?? "").trim();
  const primaryLearningGoal = PRIMARY_LEARNING_GOALS.has(goalRaw)
    ? goalRaw
    : "survey_field";

  const reasoning = String(m.reasoning ?? m.genreReasoning ?? "").trim();
  const genreReasoning = truncateWords(reasoning || "LLM pedagogical classification", 20);

  return {
    genre: /** @type {import("../session-types.js").PedagogicalGenre} */ (genre),
    argumentativeDensity: clampDensity(m.argumentative_density ?? m.argumentativeDensity),
    conceptualLoad: clampDensity(m.conceptual_load ?? m.conceptualLoad),
    primaryLearningGoal: /** @type {import("../session-types.js").PrimaryLearningGoal} */ (
      primaryLearningGoal
    ),
    genreReasoning,
  };
}

/**
 * @param {import("../session-types.js").TextMetrics} textMetrics
 * @returns {import("../session-types.js").PedagogicalMeta}
 */
export function buildDeterministicPedagogicalMeta(textMetrics) {
  const content = textMetrics?.contentSignals ?? {};
  const structure = textMetrics?.structureSignals ?? {};
  const firstPersonRatio = Number(content.firstPersonRatio) || 0;
  const academicVocabDensity = Number(content.academicVocabDensity) || 0;
  const longParagraphRatio = Number(structure.longParagraphRatio) || 0;

  /** @type {import("../session-types.js").PedagogicalGenre} */
  let genre = "unknown";
  let genreReasoning = "Insufficient signals to classify genre";

  if (firstPersonRatio > 0.03) {
    genre = "lecture_notes";
    genreReasoning = "High first-person ratio, typical of lecture notes";
  } else if (content.hasBibliography && content.hasMathNotation) {
    genre = "scientific_empirical";
    genreReasoning = "Bibliographic citations and math notation";
  } else if (academicVocabDensity > 0.05 && longParagraphRatio > 0.25) {
    genre = "philosophical";
    genreReasoning = "Dense academic vocabulary and long argumentative paragraphs";
  } else if (content.hasBibliography) {
    genre = "scientific_theoretical";
    genreReasoning = "Bibliographic references without strong empirical signals";
  } else if (structure.hasExplicitHeadings && content.hasDefinitionPatterns) {
    genre = "textbook_chapter";
    genreReasoning = "Headings structure with definition patterns";
  } else if (firstPersonRatio > 0.01) {
    genre = "essay";
    genreReasoning = "Essay tone with moderate personal voice";
  }

  const argumentativeDensity = clampDensity(
    genre === "philosophical"
      ? 4 + (academicVocabDensity > 0.08 ? 1 : 0)
      : genre === "lecture_notes"
        ? 2
        : genre === "scientific_empirical"
          ? 2
          : genre === "essay"
            ? 3
            : 3,
  );

  const conceptualLoad = clampDensity(
    1 + academicVocabDensity * 40 + (content.hasMathNotation ? 1 : 0),
  );

  /** @type {import("../session-types.js").PrimaryLearningGoal} */
  const primaryLearningGoal =
    genre === "philosophical" || genre === "essay"
      ? "understand_argument"
      : genre === "lecture_notes" || genre === "textbook_chapter"
        ? "memorize_facts"
        : genre === "scientific_empirical"
          ? "survey_field"
          : "survey_field";

  return {
    genre,
    argumentativeDensity,
    conceptualLoad,
    primaryLearningGoal,
    genreReasoning,
  };
}

/**
 * @param {string} raw
 * @returns {import("./types.js").HierarchyNode[] | null}
 */
export function parseLlmHierarchyTree(raw) {
  const parsed = parseLlmJson(raw);
  if (!parsed) return null;

  let roots = null;
  if (Array.isArray(parsed)) {
    roots = parsed;
  } else if (parsed && typeof parsed === "object") {
    const tree = /** @type {Record<string, unknown>} */ (parsed).tree;
    roots = Array.isArray(tree) ? tree : [parsed];
  }
  if (!roots) return null;
  return normalizeParsedNodes(roots);
}

/**
 * @param {string} raw
 * @returns {unknown | null}
 */
function parseLlmJson(raw) {
  const stripped = String(raw || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  if (!stripped) return null;
  try {
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} value
 * @returns {1|2|3|4|5}
 */
function clampDensity(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 3;
  return /** @type {1|2|3|4|5} */ (Math.min(5, Math.max(1, n)));
}

/**
 * @param {string} text
 * @param {number} maxWords
 */
function truncateWords(text, maxWords) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ");
}

/**
 * @param {unknown[]} nodes
 * @returns {import("./types.js").HierarchyNode[]}
 */
function normalizeParsedNodes(nodes) {
  return nodes.map((node) => {
    const n = /** @type {Record<string, unknown>} */ (node || {});
    const children = Array.isArray(n.children) ? normalizeParsedNodes(n.children) : [];
    return {
      title: String(n.title || "").trim() || "Untitled",
      level: Math.max(1, Math.floor(Number(n.level) || 1)),
      startOffset: Number(n.startOffset) || 0,
      endOffset: Number(n.endOffset) || 0,
      summary: typeof n.summary === "string" ? n.summary : undefined,
      children,
    };
  });
}

/**
 * @param {string} markdownText
 * @returns {boolean}
 */
export function hasMarkdownHeadings(markdownText) {
  HEADING_RE.lastIndex = 0;
  return HEADING_RE.test(String(markdownText ?? ""));
}

/**
 * Plain-text section markers (❖ L1, ➔/➢ L2) — pipeline lever L1.
 * @param {string} text
 */
export function hasDelimiterHeadings(text) {
  const raw = String(text ?? "");
  DELIMITER_L1_RE.lastIndex = 0;
  if (DELIMITER_L1_RE.test(raw)) return true;
  DELIMITER_L2_RE.lastIndex = 0;
  return DELIMITER_L2_RE.test(raw);
}

/**
 * @param {string} plainText
 * @returns {import("./types.js").HierarchyNode[]}
 */
export function buildDelimiterHierarchy(plainText) {
  const text = String(plainText ?? "");
  const textLength = text.length;
  /** @type {{ level: number, title: string, startOffset: number, endOffset?: number }[]} */
  const headings = [];

  const collect = (re, level) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const title = String(m[1] || "").trim();
      if (!title) continue;
      headings.push({ level, title, startOffset: m.index });
    }
  };

  collect(DELIMITER_L1_RE, 1);
  collect(DELIMITER_L2_RE, 2);

  if (!headings.length) {
    return buildTrivialHierarchy(text);
  }

  headings.sort((a, b) => a.startOffset - b.startOffset);

  for (let i = 0; i < headings.length; i += 1) {
    let endOffset = textLength;
    for (let j = i + 1; j < headings.length; j += 1) {
      if (headings[j].level <= headings[i].level) {
        endOffset = headings[j].startOffset;
        break;
      }
    }
    headings[i].endOffset = endOffset;
  }

  /** @type {import("./types.js").HierarchyNode[]} */
  const roots = [];
  /** @type {{ node: import("./types.js").HierarchyNode, level: number }[]} */
  const stack = [];

  for (const h of headings) {
    const node = {
      title: h.title,
      level: h.level,
      startOffset: h.startOffset,
      endOffset: h.endOffset,
      source: /** @type {const} */ ("heuristic"),
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }
    stack.push({ node, level: h.level });
  }

  return normalizeRootSpan(roots, textLength);
}

/**
 * Map HeadingCandidate.source → HierarchyNode.source (spec R6).
 * @param {string} headingSource
 * @param {boolean} hasToc
 * @returns {'toc'|'heuristic'|'heuristic-unlisted'}
 */
export function hierarchySourceFromHeading(headingSource, hasToc) {
  if (headingSource === "outline") return "toc";
  if (headingSource === "heuristic-unlisted") return "heuristic-unlisted";
  return hasToc ? "heuristic-unlisted" : "heuristic";
}

/**
 * Apply HeadingCandidate provenance onto a deterministic hierarchy tree (R6).
 * Matches by normalized title in document order; unmatched nodes keep existing source.
 *
 * @param {import("./types.js").HierarchyNode[]} tree
 * @param {{ label: string, source: string }[]} headings
 * @returns {import("./types.js").HierarchyNode[]}
 */
export function applyHierarchySourcesFromHeadings(tree, headings) {
  const list = Array.isArray(headings) ? headings : [];
  const hasToc = list.some((h) => h.source === "outline" || h.source === "heuristic-unlisted");
  /** @type {Map<string, string[]>} */
  const byTitle = new Map();
  for (const h of list) {
    const key = String(h.label || "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(h.source);
  }

  /** @param {import("./types.js").HierarchyNode[]} nodes */
  const walk = (nodes) => {
    for (const node of nodes || []) {
      const key = String(node.title || "")
        .trim()
        .toLowerCase();
      const queue = byTitle.get(key);
      if (queue?.length) {
        node.source = hierarchySourceFromHeading(queue.shift(), hasToc);
      } else if (!node.source) {
        node.source = hasToc ? "heuristic-unlisted" : "heuristic";
      }
      if (node.children?.length) walk(node.children);
    }
  };

  walk(tree);
  return tree;
}

/**
 * @param {string} markdownText
 * @returns {import("./types.js").HierarchyNode[]}
 */
export function buildTrivialHierarchy(markdownText) {
  const text = String(markdownText ?? "");
  const title = inferDocumentTitle(text) || "Document";
  return [
    {
      title,
      level: 1,
      startOffset: 0,
      endOffset: text.length,
      source: /** @type {const} */ ("heuristic"),
      children: [],
    },
  ];
}

/**
 * @param {string} markdownText
 * @returns {import("./types.js").HierarchyNode[]}
 */
export function buildDeterministicHierarchy(markdownText) {
  const text = String(markdownText ?? "");
  const textLength = text.length;
  /** @type {{ level: number, title: string, startOffset: number, endOffset?: number }[]} */
  const headings = [];

  HEADING_RE.lastIndex = 0;
  let m;
  while ((m = HEADING_RE.exec(text)) !== null) {
    const title = String(m[2] || "").trim();
    if (!title) continue;
    headings.push({
      level: m[1].length,
      title,
      startOffset: m.index,
    });
  }

  if (headings.length === 0) {
    return buildTrivialHierarchy(text);
  }

  for (let i = 0; i < headings.length; i++) {
    let endOffset = textLength;
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= headings[i].level) {
        endOffset = headings[j].startOffset;
        break;
      }
    }
    headings[i].endOffset = endOffset;
  }

  /** @type {import("./types.js").HierarchyNode[]} */
  const roots = [];
  /** @type {{ node: import("./types.js").HierarchyNode, level: number }[]} */
  const stack = [];

  for (const h of headings) {
    const node = {
      title: h.title,
      level: h.level,
      startOffset: h.startOffset,
      endOffset: h.endOffset,
      source: /** @type {const} */ ("heuristic"),
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }
    stack.push({ node, level: h.level });
  }

  return normalizeRootSpan(roots, textLength);
}

/**
 * @param {unknown} tree
 * @param {number} textLength
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateHierarchy(tree, textLength) {
  const errors = [];
  const len = Number(textLength);
  if (!Number.isFinite(len) || len < 0) {
    return { valid: false, errors: ["textLength must be a non-negative number"] };
  }
  if (!Array.isArray(tree) || tree.length === 0) {
    return { valid: false, errors: ["tree must be a non-empty array"] };
  }

  const roots = /** @type {import("./types.js").HierarchyNode[]} */ (tree);
  validateSiblingGroup(roots, len, "root", errors);

  const first = roots[0];
  const last = roots[roots.length - 1];
  if (first.startOffset !== 0) {
    errors.push("first root startOffset must be 0");
  }
  const endTolerance = len === 0 ? 0 : 1;
  if (Math.abs(last.endOffset - len) > endTolerance) {
    errors.push(`last root endOffset must be textLength (±${endTolerance})`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * @param {import("./types.js").HierarchyNode[]} tree
 * @param {number} [maxLevel]
 * @returns {import("./types.js").HierarchyNode[]}
 */
export function flattenHierarchy(tree, maxLevel = 2) {
  const cap = Math.max(1, Number(maxLevel) || 2);
  /** @type {import("./types.js").HierarchyNode[]} */
  const out = [];
  /** @type {import("./types.js").HierarchyNode[]} */
  const queue = [...(Array.isArray(tree) ? tree : [])];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) continue;
    if (node.level <= cap) {
      out.push({
        title: node.title,
        level: node.level,
        startOffset: node.startOffset,
        endOffset: node.endOffset,
        summary: node.summary,
        children: [],
      });
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        queue.push(child);
      }
    }
  }
  return out;
}

/**
 * @param {import("./types.js").HierarchyNode[]} tree
 * @param {string} markdownText
 * @param {number} [maxChunkSize]
 * @returns {{ title: string, text: string, startOffset: number, endOffset: number }[]}
 */
export function getChunksFromHierarchy(tree, markdownText, maxChunkSize = 12000) {
  const text = String(markdownText ?? "");
  const textLength = text.length;
  const maxSize = Math.max(1, Number(maxChunkSize) || 12000);
  const sections = collectLeafSections(tree);

  if (sections.length === 0) {
    return [
      {
        title: inferDocumentTitle(text) || "Document",
        text,
        startOffset: 0,
        endOffset: textLength,
      },
    ];
  }

  /** @type {{ title: string, text: string, startOffset: number, endOffset: number }[]} */
  const merged = [];
  /** @type {{ title: string, startOffset: number, endOffset: number } | null} */
  let current = null;

  for (const section of sections) {
    const size = section.endOffset - section.startOffset;
    if (size > maxSize) {
      if (current) {
        merged.push(finishChunk(current, text));
        current = null;
      }
      merged.push(...splitOversizedSection(section, text, maxSize));
      continue;
    }

    if (!current) {
      current = { ...section };
      continue;
    }

    const combinedSize = section.endOffset - current.startOffset;
    if (combinedSize <= maxSize) {
      current.title = `${current.title} / ${section.title}`;
      current.endOffset = section.endOffset;
    } else {
      merged.push(finishChunk(current, text));
      current = { ...section };
    }
  }

  if (current) {
    merged.push(finishChunk(current, text));
  }

  return fillCoverageGaps(merged, text, maxSize);
}

function inferDocumentTitle(text) {
  const firstLine = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  if (!firstLine) return "";
  return firstLine.replace(/^#+\s*/, "").slice(0, 80);
}

/**
 * @param {import("./types.js").HierarchyNode[]} roots
 * @param {number} textLength
 */
function normalizeRootSpan(roots, textLength) {
  if (!roots.length) {
    return buildTrivialHierarchy("".padEnd(textLength));
  }

  if (roots[0].startOffset > 0) {
    roots.unshift({
      title: "Preamble",
      level: 1,
      startOffset: 0,
      endOffset: roots[0].startOffset,
      source: /** @type {const} */ ("heuristic"),
      children: [],
    });
  }

  const last = roots[roots.length - 1];
  if (last.endOffset < textLength) {
    last.endOffset = textLength;
  }

  if (roots.length > 1 && roots[0].title === "Preamble" && roots[0].level === 1) {
    // keep preamble as sibling
  }

  return roots.map((node) => ({
    ...node,
    level: Math.max(1, Math.floor(Number(node.level) || 1)),
    children: Array.isArray(node.children) ? node.children : [],
  }));
}

/**
 * @param {import("./types.js").HierarchyNode[]} nodes
 * @param {number} textLength
 * @param {string} path
 * @param {string[]} errors
 */
function validateSiblingGroup(nodes, textLength, path, errors) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    errors.push(`${path}: empty sibling group`);
    return;
  }

  let expectedStart = nodes[0].startOffset;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nodePath = `${path}[${i}]`;

    if (!node || typeof node !== "object") {
      errors.push(`${nodePath}: invalid node`);
      continue;
    }
    if (!String(node.title || "").trim()) {
      errors.push(`${nodePath}: title required`);
    }
    const level = Number(node.level);
    if (!Number.isInteger(level) || level < 1) {
      errors.push(`${nodePath}: level must be an integer >= 1`);
    }

    const start = Number(node.startOffset);
    const end = Number(node.endOffset);
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      errors.push(`${nodePath}: offsets must be integers`);
    } else {
      if (start < 0 || end <= start || end > textLength) {
        errors.push(`${nodePath}: offsets out of range`);
      }
      if (i > 0 && start !== expectedStart) {
        errors.push(`${nodePath}: siblings must be contiguous`);
      }
      expectedStart = end;
    }

    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length > 0) {
      validateSiblingGroup(children, textLength, `${nodePath}.children`, errors);
      const firstChild = children[0];
      const lastChild = children[children.length - 1];
      if (firstChild.startOffset < start || lastChild.endOffset > end) {
        errors.push(`${nodePath}: children exceed parent span`);
      }
    }
  }
}

/**
 * @param {import("./types.js").HierarchyNode[]} tree
 * @returns {{ title: string, startOffset: number, endOffset: number, children?: import("./types.js").HierarchyNode[] }[]}
 */
function collectLeafSections(tree) {
  /** @type {{ title: string, startOffset: number, endOffset: number, children?: import("./types.js").HierarchyNode[] }[]} */
  const leaves = [];

  function walk(nodes) {
    for (const node of nodes) {
      const children = Array.isArray(node.children) ? node.children : [];
      if (children.length === 0) {
        leaves.push(node);
      } else {
        walk(children);
      }
    }
  }

  walk(Array.isArray(tree) ? tree : []);
  leaves.sort((a, b) => a.startOffset - b.startOffset);
  return leaves;
}

/**
 * @param {{ title: string, startOffset: number, endOffset: number }} section
 * @param {string} text
 * @param {number} maxSize
 */
function splitOversizedSection(section, text, maxSize) {
  const children = Array.isArray(section.children) ? section.children : [];
  if (children.length > 0) {
  /** @type {{ title: string, startOffset: number, endOffset: number }[]} */
    const childLeaves = [];
    for (const child of children) {
      childLeaves.push(...collectLeafSections([child]));
    }
    if (childLeaves.length > 0) {
      return childLeaves.flatMap((leaf) => {
        const size = leaf.endOffset - leaf.startOffset;
        if (size <= maxSize) {
          return [finishChunk(leaf, text)];
        }
        return hardSplit(leaf, text, maxSize);
      });
    }
  }
  return hardSplit(section, text, maxSize);
}

/**
 * @param {{ title: string, startOffset: number, endOffset: number }} section
 * @param {string} text
 * @param {number} maxSize
 */
function hardSplit(section, text, maxSize) {
  /** @type {{ title: string, text: string, startOffset: number, endOffset: number }[]} */
  const chunks = [];
  let start = section.startOffset;
  const end = section.endOffset;
  let part = 1;

  while (start < end) {
    let chunkEnd = Math.min(start + maxSize, end);
    if (chunkEnd < end) {
      const snapped = snapToSentenceBoundary(text, chunkEnd, "start");
      if (snapped > start && snapped < end) chunkEnd = snapped;
    }
    chunks.push({
      title: part === 1 ? section.title : `${section.title} (part ${part})`,
      text: text.slice(start, chunkEnd),
      startOffset: start,
      endOffset: chunkEnd,
    });
    start = chunkEnd;
    part += 1;
  }
  return chunks;
}

/**
 * @param {{ title: string, startOffset: number, endOffset: number }} section
 * @param {string} text
 */
function finishChunk(section, text) {
  return {
    title: section.title,
    text: text.slice(section.startOffset, section.endOffset),
    startOffset: section.startOffset,
    endOffset: section.endOffset,
  };
}

/**
 * @param {{ title: string, text: string, startOffset: number, endOffset: number }[]} chunks
 * @param {string} text
 * @param {number} maxSize
 */
function fillCoverageGaps(chunks, text, maxSize) {
  if (!chunks.length) {
    return [{ title: "Document", text, startOffset: 0, endOffset: text.length }];
  }

  chunks.sort((a, b) => a.startOffset - b.startOffset);
  /** @type {{ title: string, text: string, startOffset: number, endOffset: number }[]} */
  const out = [];
  let cursor = 0;

  for (const chunk of chunks) {
    if (chunk.startOffset > cursor) {
      const gapText = text.slice(cursor, chunk.startOffset);
      out.push({
        title: "Untitled",
        text: gapText,
        startOffset: cursor,
        endOffset: chunk.startOffset,
      });
    }
    out.push(chunk);
    cursor = chunk.endOffset;
  }

  if (cursor < text.length) {
    out.push({
      title: "Untitled",
      text: text.slice(cursor),
      startOffset: cursor,
      endOffset: text.length,
    });
  }

  return out;
}

export const _internals = {
  MIN_LLM_CHARS,
  HEADING_RE,
};
