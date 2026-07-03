/**
 * Emit normalized markdown with headings (#–######).
 */

/** @typedef {import("./types.js").TextBlock} TextBlock */
/** @typedef {import("./types.js").HeadingCandidate} HeadingCandidate */

/** [debug-enrich] instrumentation-only */
function dppNormDbg() {
  return globalThis.__dppNormalizationDebug;
}

/** [debug-enrich] math-notation diagnostics: confirm formulas survive end-to-end emission */
const MATH_INDICATOR_CHARS = new Set(
  [
    "α",
    "β",
    "γ",
    "δ",
    "ε",
    "θ",
    "λ",
    "μ",
    "π",
    "ρ",
    "σ",
    "τ",
    "φ",
    "ω",
    "Δ",
    "Θ",
    "Λ",
    "Π",
    "Σ",
    "Φ",
    "Ω",
    "√",
    "∫",
    "±",
    "≤",
    "≥",
    "∂",
    "∇",
  ],
); // [debug-enrich]

/** [debug-enrich] */
function countMathIndicators(text) {
  const s = String(text || "");
  let hits = 0;
  for (const ch of s) {
    if (MATH_INDICATOR_CHARS.has(ch)) hits += 1;
  }
  hits += (s.match(/\\(frac|sum|int|sqrt|alpha|beta|gamma|theta|sigma|Sigma)\b/g) || []).length;
  hits += (s.match(/\^\{|\_\{/g) || []).length;
  return hits;
}

/** [debug-enrich] */
function countReplacementChars(text) {
  const s = String(text || "");
  let count = 0;
  for (const ch of s) {
    if ((ch.codePointAt(0) || 0) === 0xfffd) count += 1;
  }
  return count;
}

/** [debug-enrich] */
function sampleForLog(text, maxLen) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 3))}...`;
}

/** [debug-enrich] pick windows with highest math-indicator density */
function pickMathDenseSnippets(text, { windowChars = 220, snippets = 3, snippetChars = 100 } = {}) {
  const s = String(text || "");
  if (!s.trim()) return [];

  /** @type {{ start: number, end: number, hits: number }[]} */
  const windows = [];
  const step = Math.max(40, Math.floor(windowChars / 2));
  for (let start = 0; start < s.length; start += step) {
    const end = Math.min(s.length, start + windowChars);
    const slice = s.slice(start, end);
    const hits = countMathIndicators(slice);
    if (hits > 0) windows.push({ start, end, hits });
  }
  windows.sort((a, b) => b.hits - a.hits);

  /** @type {{ start: number, end: number, hits: number }[]} */
  const chosen = [];
  for (const w of windows) {
    if (chosen.length >= snippets) break;
    const overlaps = chosen.some((c) => !(w.end <= c.start || w.start >= c.end));
    if (overlaps) continue;
    chosen.push(w);
  }

  return chosen.map((w) => {
    const center = Math.floor((w.start + w.end) / 2);
    const half = Math.floor(snippetChars / 2);
    const a = Math.max(0, center - half);
    const b = Math.min(s.length, a + snippetChars);
    return sampleForLog(s.slice(a, b), snippetChars);
  });
}

/** Count markdown tables by header separator row. */
function countMarkdownTables(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  let count = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!/^\|\s*[-: ]+\|\s*([-: ]+\|\s*)+$/.test(line)) continue;
    const prev = (lines[i - 1] || "").trim();
    if (/^\|/.test(prev)) count += 1;
  }
  return count;
}

const TABLE_DETECTION_CEILING_CHARS_PER_TABLE = 2000; // placeholder: calibrate post-launch

/**
 * Join hyphenated line breaks within words (FIX-07).
 * Preserves names like Korsgaard-\nMueller (uppercase after break).
 * @param {string} text
 */
export function dehyphenate(text) {
  return String(text || "").replace(/(\w)-\n([a-z])/gu, "$1$2");
}

/**
 * @param {TextBlock[]} blocks
 * @param {HeadingCandidate[]} headings
 * @param {{ preserveNumbers?: boolean }} [opts]
 * @returns {{ markdown: string, headings: HeadingCandidate[] }}
 */
export function emitMarkdown(blocks, headings, opts = {}) {
  void opts;
  const headingByBlock = new Map(headings.map((h) => [h.blockId, h]));
  const parts = [];
  /** @type {HeadingCandidate[]} */
  const withOffsets = [];
  let offset = 0;

  const activeBlocks = blocks.filter((b) => b.kind !== "artifact" && b.text.trim());

  // [debug-enrich] open question: no dedicated table-to-markdown-table path exists in this emitter
  console.debug("[emit-markdown.emitMarkdown] Start:", {
    activeBlockCount: activeBlocks.length,
    headingCount: headings.length,
    tableNote: "no table detection/emission step — cells pass through as plain paragraphs",
  }); // [debug-enrich]

  for (const block of activeBlocks) {
    const heading = headingByBlock.get(block.id);
    if (heading) {
      const prefix = `${"#".repeat(heading.level)} ${heading.label}`;
      if (parts.length) {
        parts.push("");
        offset += 1;
      }
      parts.push(prefix);
      const start = offset;
      offset += prefix.length;
      const end = offset;
      withOffsets.push({ ...heading, charStart: start, charEnd: end });
      parts.push("");
      offset += 1;
    } else {
      let text = dehyphenate(block.text.trim());
      if (!text) continue;
      if (block.kind === "list-item") {
        text = `- ${text}`;
      }
      if (parts.length) {
        parts.push("");
        offset += 1;
      }
      parts.push(text);
      offset += text.length;
    }
  }

  const markdown = parts.join("\n");

  const tableCount = countMarkdownTables(markdown); // [debug-enrich]
  const bagTables = dppNormDbg(); // [debug-enrich]
  if (bagTables) {
    if (bagTables.tablesDetected > 0) {
      bagTables.tablesEmittedOk = tableCount;
    }
  }
  if (bagTables?.tablesDetected > 0 && tableCount === 0) {
    console.warn("[emit-markdown.emitMarkdown] Tables detected but none emitted as markdown tables:", {
      tablesDetected: bagTables.tablesDetected,
      tablesEmittedOk: tableCount,
    }); // [debug-enrich]
  }
  if (bagTables?.tablesDetected > 0) {
    const ceiling = Math.max(
      1,
      Math.ceil((markdown.length || 0) / TABLE_DETECTION_CEILING_CHARS_PER_TABLE),
    );
    if (bagTables.tablesDetected > ceiling) {
      console.warn("[emit-markdown.emitMarkdown] Suspiciously high table detection count:", {
        tablesDetected: bagTables.tablesDetected,
        ceiling,
        charCount: markdown.length,
        charsPerTable: TABLE_DETECTION_CEILING_CHARS_PER_TABLE,
      }); // [debug-enrich]
    }
  }

  // [debug-enrich] final-output math integrity scan (counts + short snippets only)
  const mathIndicatorsFound = countMathIndicators(markdown); // [debug-enrich]
  const replacementCharsFound = countReplacementChars(markdown); // [debug-enrich]
  const sampleSnippets = pickMathDenseSnippets(markdown, { snippets: 3, snippetChars: 100 }); // [debug-enrich]
  console.info("[emit-markdown.emitMarkdown] Math diagnostics:", {
    mathIndicatorsFound,
    replacementCharsFound,
    sampleSnippets,
  }); // [debug-enrich]
  const bagPre = dppNormDbg(); // [debug-enrich]
  const upstreamMathIndicators = bagPre?.mathIndicatorsFound ?? null; // [debug-enrich]
  const upstreamSuspiciousUnicodePages = bagPre?.pagesWithSuspiciousUnicode ?? null; // [debug-enrich]
  const shouldWarnNearZero =
    mathIndicatorsFound === 0 &&
    ((upstreamMathIndicators != null && upstreamMathIndicators > 0) ||
      (upstreamSuspiciousUnicodePages != null && upstreamSuspiciousUnicodePages > 0)); // [debug-enrich]
  if (replacementCharsFound > 0 || shouldWarnNearZero) {
    console.warn("[emit-markdown.emitMarkdown] Potential math extraction loss:", {
      mathIndicatorsFound,
      replacementCharsFound,
      note:
        replacementCharsFound > 0
          ? "U+FFFD replacement chars present in final markdown"
          : "Near-zero math indicators in final markdown despite upstream math/suspicious unicode signals",
    }); // [debug-enrich]
  }

  const bag = dppNormDbg();
  if (bag) {
    bag.finalMarkdownMathIndicatorsFound = mathIndicatorsFound;
    bag.finalMarkdownReplacementCharsFound = replacementCharsFound;
    bag.finalMarkdownSampleSnippets = sampleSnippets;
  }

  console.debug("[emit-markdown.emitMarkdown] Done:", {
    charCount: markdown.length,
    headingsWithOffsets: withOffsets.length,
  }); // [debug-enrich]
  return { markdown, headings: withOffsets };
}
