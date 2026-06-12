/**
 * Semantic chunk alignment for RSVP blocks — Phase B of 20260613-source-fidelity.
 */

function splitMaterialIntoBlockChunks(text, nBlocks) {
  const raw = String(text || "").trim();
  const n = Math.max(0, Math.floor(Number(nBlocks)));
  if (!raw || n <= 0) return [];
  const words = raw.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const chunks = [];
  for (let i = 0; i < n; i += 1) {
    const start = Math.floor((i * words.length) / n);
    const end = Math.floor(((i + 1) * words.length) / n);
    const chunk = words.slice(start, Math.max(end, start + 1)).join(" ").trim();
    chunks.push(chunk || raw);
  }
  return chunks;
}

const OVERVIEW_TITLE_RE = /^(overview|mapa del curso|course map)/i;

const STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "been",
  "before",
  "being",
  "between",
  "both",
  "could",
  "each",
  "from",
  "have",
  "into",
  "more",
  "most",
  "other",
  "over",
  "same",
  "some",
  "such",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
  "para",
  "como",
  "esta",
  "este",
  "esto",
  "pero",
  "porque",
  "sobre",
  "tiene",
  "todos",
  "todas",
  "mismo",
  "misma",
]);

function normalizeForMatch(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenizeSignificant(text, minLen = 3) {
  return normalizeForMatch(text)
    .split(/[^a-z0-9áéíóúüñ]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= minLen && !STOPWORDS.has(t));
}

function wordsWithOffsets(text) {
  const raw = String(text || "").trim();
  if (!raw) return { words: [], text: "" };
  const words = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    words.push({ word: m[0], start: m.index, end: m.index + m[0].length });
  }
  return { words, text: raw };
}

function sliceByWordRange(text, wordStart, wordEnd, words) {
  if (!words.length) return "";
  const s = Math.max(0, Math.min(wordStart, words.length - 1));
  const e = Math.max(s + 1, Math.min(wordEnd, words.length));
  const charStart = words[s].start;
  const charEnd = words[e - 1].end;
  return text.slice(charStart, charEnd).trim();
}

function collectSearchTerms(block, inventory) {
  const terms = new Set();
  const title = String(block?.title || "").trim();
  for (const t of tokenizeSignificant(title, 4)) terms.add(t);

  const sig = block?.signature;
  if (Array.isArray(sig)) {
    for (const s of sig) {
      for (const t of tokenizeSignificant(String(s || ""), 3)) terms.add(t);
    }
  } else if (typeof sig === "string") {
    for (const t of tokenizeSignificant(sig, 3)) terms.add(t);
  }

  const conceptIds = Array.isArray(block?.concept_ids) ? block.concept_ids : [];
  const inv = Array.isArray(inventory) ? inventory : [];
  for (const cid of conceptIds) {
    const item = inv.find((c) => String(c?.id || "") === String(cid));
    if (!item) continue;
    for (const t of tokenizeSignificant(String(item.title || ""), 3)) terms.add(t);
    const phrase = String(item.source_phrase || "").trim();
    if (phrase) terms.add(`__phrase__:${phrase}`);
  }
  return [...terms];
}

function countTermHits(windowText, terms) {
  const norm = normalizeForMatch(windowText);
  let hits = 0;
  const matched = [];
  for (const term of terms) {
    if (term.startsWith("__phrase__:")) {
      const phrase = term.slice("__phrase__:".length);
      if (phrase && normalizeForMatch(windowText).includes(normalizeForMatch(phrase))) {
        hits += 2;
        matched.push(phrase.slice(0, 40));
      }
      continue;
    }
    if (norm.includes(term)) {
      hits += 1;
      matched.push(term);
    }
  }
  return { hits, matched: [...new Set(matched)] };
}

function getSectionBoundaries(docHierarchy) {
  const tree = docHierarchy?.tree;
  if (!Array.isArray(tree) || !tree.length) return [];
  /** @type {{ start: number, end: number }[]} */
  const bounds = [];
  const walk = (nodes) => {
    for (const n of nodes) {
      if (!n || typeof n !== "object") continue;
      const start = Number(n.startOffset);
      const end = Number(n.endOffset);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        bounds.push({ start, end });
      }
      if (Array.isArray(n.children)) walk(n.children);
    }
  };
  walk(tree);
  return bounds.sort((a, b) => a.start - b.start);
}

function snapToSectionBounds(charStart, charEnd, textLen, sections, targetLen) {
  if (!sections.length) return { charStart, charEnd };
  const margin = Math.floor(targetLen * 0.15);
  let bestStart = charStart;
  let bestEnd = charEnd;
  for (const sec of sections) {
    if (Math.abs(sec.start - charStart) <= margin) bestStart = sec.start;
    if (Math.abs(sec.end - charEnd) <= margin) bestEnd = sec.end;
  }
  bestStart = Math.max(0, Math.min(bestStart, textLen - 1));
  bestEnd = Math.max(bestStart + 1, Math.min(bestEnd, textLen));
  return { charStart: bestStart, charEnd: bestEnd };
}

function charRangeToWordIndices(words, charStart, charEnd) {
  let wStart = 0;
  let wEnd = words.length;
  for (let i = 0; i < words.length; i += 1) {
    if (words[i].end > charStart) {
      wStart = i;
      break;
    }
  }
  for (let i = wStart; i < words.length; i += 1) {
    if (words[i].start >= charEnd) {
      wEnd = i;
      break;
    }
  }
  return { wStart, wEnd: Math.max(wStart + 1, wEnd) };
}

/**
 * @param {string} materialText
 * @param {object[]} blockIndex
 * @param {object[]} inventory
 * @param {{ docHierarchy?: object }} opts
 */
export function assignAlignedChunks(materialText, blockIndex, inventory, opts = {}) {
  const material = String(materialText || "").trim();
  const blocks = Array.isArray(blockIndex) ? blockIndex : [];
  const inv = Array.isArray(inventory) ? inventory : [];
  if (!material || !blocks.length) return blocks;

  const { words, text } = wordsWithOffsets(material);
  const totalWords = words.length;
  if (!totalWords) return blocks;

  const blockCount = blocks.length;
  const targetWords = Math.max(50, Math.ceil(totalWords / blockCount));
  const step = Math.max(50, Math.floor(targetWords / 4));
  const sections = getSectionBoundaries(opts.docHierarchy);
  const proportional = splitMaterialIntoBlockChunks(material, blockCount);

  return blocks.map((block, i) => {
    const title = String(block?.title || "").trim();
    const isOverview = Number(block?.id) === 1 && OVERVIEW_TITLE_RE.test(title);

    if (isOverview) {
      const chunk = sliceByWordRange(text, 0, targetWords, words);
      return {
        ...block,
        chunk,
        anchor_quality: "strong",
        chunk_match_terms: ["overview_intro"],
      };
    }

    const terms = collectSearchTerms(block, inv);
    if (!terms.length) {
      return {
        ...block,
        chunk: proportional[i] || "",
        anchor_quality: "proportional_fallback",
        chunk_match_terms: [],
      };
    }

    let bestScore = -1;
    let bestStart = 0;
    let bestMatched = [];

    for (let wStart = 0; wStart < totalWords; wStart += step) {
      const wEnd = Math.min(totalWords, wStart + targetWords);
      const charStart = words[wStart].start;
      const charEnd = words[wEnd - 1].end;
      const windowText = text.slice(charStart, charEnd);
      const { hits, matched } = countTermHits(windowText, terms);
      if (hits > bestScore) {
        bestScore = hits;
        bestStart = wStart;
        bestMatched = matched;
      }
    }

    if (bestScore <= 0) {
      return {
        ...block,
        chunk: proportional[i] || "",
        anchor_quality: "proportional_fallback",
        chunk_match_terms: [],
      };
    }

    let wStart = bestStart;
    let wEnd = Math.min(totalWords, wStart + targetWords);
    const centerStart = words[wStart].start;
    const centerEnd = words[wEnd - 1].end;
    const snapped = snapToSectionBounds(
      centerStart,
      centerEnd,
      text.length,
      sections,
      targetWords * 8,
    );
    if (sections.length) {
      const idx = charRangeToWordIndices(words, snapped.charStart, snapped.charEnd);
      wStart = idx.wStart;
      wEnd = idx.wEnd;
    }

    const chunk = sliceByWordRange(text, wStart, wEnd, words);
    const phraseBonus = terms.some((t) => t.startsWith("__phrase__:")) && bestScore >= 2;
    const anchor_quality =
      bestScore >= 2 || phraseBonus ? "strong" : bestScore === 1 ? "weak" : "proportional_fallback";

    return {
      ...block,
      chunk,
      anchor_quality,
      chunk_match_terms: bestMatched.slice(0, 12),
    };
  });
}
