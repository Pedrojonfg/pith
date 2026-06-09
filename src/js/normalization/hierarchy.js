/**
 * Document hierarchy pre-index: deterministic tree, validation, flatten, chunks.
 */

import {
  getCachedHierarchy,
  hashText,
  setCachedHierarchy,
} from "./hierarchy-cache.js";

const HEADING_RE = /^(#{1,3})\s+(.+)$/gm;
const MIN_LLM_CHARS = 3000;
const SUMMARY_MIN_CHARS = 8000;

/**
 * @param {string} markdownText
 * @param {((args: { systemPrompt: string, userPrompt: string, temperature: number, maxTokens: number, signal?: AbortSignal }) => Promise<string>) | null} llmFn
 * @param {{ useCache?: boolean, textHash?: string, minLlmChars?: number, includeSummary?: boolean, signal?: AbortSignal }} [options]
 * @returns {Promise<{ method: 'llm'|'deterministic'|'trivial', tree: import("./types.js").HierarchyNode[], textHash: string, generatedAt: number, fromCache?: boolean } | null>}
 */
export async function buildDocumentHierarchy(markdownText, llmFn, options = {}) {
  const text = String(markdownText ?? "");
  const textHash = options.textHash ?? hashText(text);
  const minLlmChars = Number(options.minLlmChars) || MIN_LLM_CHARS;
  const useCache = options.useCache !== false;
  const includeSummary = options.includeSummary ?? text.length >= SUMMARY_MIN_CHARS;
  const generatedAt = Date.now();

  if (hasMarkdownHeadings(text)) {
    return {
      method: "deterministic",
      tree: buildDeterministicHierarchy(text),
      textHash,
      generatedAt,
    };
  }

  if (text.length < minLlmChars) {
    return {
      method: "trivial",
      tree: buildTrivialHierarchy(text),
      textHash,
      generatedAt,
    };
  }

  if (typeof llmFn !== "function") {
    return null;
  }

  if (useCache) {
    const cached = getCachedHierarchy(textHash);
    if (cached) {
      return {
        method: /** @type {'llm'} */ (cached.method || "llm"),
        tree: /** @type {import("./types.js").HierarchyNode[]} */ (cached.tree),
        textHash,
        generatedAt,
        fromCache: true,
      };
    }
  }

  const userPrompt = buildHierarchyUserPrompt(text, { includeSummary });
  let raw = "";
  try {
    raw = await llmFn({
      systemPrompt: HIERARCHY_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0,
      maxTokens: 2000,
      signal: options.signal,
    });
  } catch {
    return {
      method: "deterministic",
      tree: buildDeterministicHierarchy(text),
      textHash,
      generatedAt,
    };
  }

  const tree = parseLlmHierarchyTree(raw);
  if (!tree) {
    return {
      method: "deterministic",
      tree: buildDeterministicHierarchy(text),
      textHash,
      generatedAt,
    };
  }

  const validation = validateHierarchy(tree, text.length);
  if (!validation.valid) {
    return {
      method: "deterministic",
      tree: buildDeterministicHierarchy(text),
      textHash,
      generatedAt,
    };
  }

  if (useCache) {
    setCachedHierarchy(textHash, { tree, method: "llm" });
  }

  return { method: "llm", tree, textHash, generatedAt };
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
- level 1 = sección principal, level 2 = subsección, máximo level 3.
- Si el texto no tiene estructura clara, devuelve un solo nodo raíz con el título inferido del contenido.
${summaryRule}

TEXTO (longitud: ${text.length} chars):
${text}

RESPUESTA (solo JSON):`;
}

/**
 * @param {string} raw
 * @returns {import("./types.js").HierarchyNode[] | null}
 */
export function parseLlmHierarchyTree(raw) {
  const stripped = String(raw || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  if (!stripped) return null;

  let parsed;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }

  const roots = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? [parsed] : null;
  if (!roots) return null;
  return normalizeParsedNodes(roots);
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
      level: Math.min(3, Math.max(1, Number(n.level) || 1)),
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
    level: Math.min(3, Math.max(1, node.level)),
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
    if (!Number.isInteger(level) || level < 1 || level > 3) {
      errors.push(`${nodePath}: level must be 1..3`);
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
    const chunkEnd = Math.min(start + maxSize, end);
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
