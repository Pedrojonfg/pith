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



function proportionalWordRange(blockIndex, blockCount, totalWords, targetWords) {

  const i = Math.max(0, Math.floor(Number(blockIndex)));

  const wStart = Math.floor((i * totalWords) / blockCount);

  const wEnd = Math.min(totalWords, Math.max(wStart + 1, Math.floor(((i + 1) * totalWords) / blockCount)));

  return {

    wStart,

    wEnd: Math.max(wStart + 1, Math.min(totalWords, wStart + targetWords, wEnd)),

  };

}



const OVERVIEW_TITLE_RE = /^(overview|course map)/i;



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

]);



function normalizeForMatch(text) {

  return String(text || "")

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .toLowerCase();

}



function tokenizeSignificant(text, minLen = 3) {

  return normalizeForMatch(text)

    .split(/[^a-z0-9]+/i)

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



function normalizeUsedWordRanges(usedWordRanges) {

  if (!Array.isArray(usedWordRanges)) return [];

  return usedWordRanges

    .map((r) => ({

      wordStart: Number(r?.wordStart),

      wordEnd: Number(r?.wordEnd),

      blockId: r?.blockId,

    }))

    .filter((r) => Number.isFinite(r.wordStart) && Number.isFinite(r.wordEnd) && r.wordEnd > r.wordStart);

}



function countWordOverlap(wStart, wEnd, usedWordRanges) {

  const ranges = normalizeUsedWordRanges(usedWordRanges);

  if (!ranges.length) return 0;

  let count = 0;

  for (let w = wStart; w < wEnd; w += 1) {

    for (const range of ranges) {

      if (w >= range.wordStart && w < range.wordEnd) {

        count += 1;

        break;

      }

    }

  }

  return count;

}



function wordRangeOverlapRatio(wStart, wEnd, usedWordRanges) {

  const windowSize = Math.max(0, wEnd - wStart);

  if (!windowSize) return 0;

  const overlapWords = countWordOverlap(wStart, wEnd, usedWordRanges);

  return overlapWords / windowSize;

}



const OVERLAP_PENALTY_TERM_THRESHOLD = 0.4;

const DEFAULT_MIN_CHUNK_WORDS = 400;



function penalizedScore(hits, wStart, wEnd, targetWords, usedWordRanges, penalizeOverlap, penaltyThreshold = OVERLAP_PENALTY_TERM_THRESHOLD) {

  if (!penalizeOverlap || !normalizeUsedWordRanges(usedWordRanges).length) return hits;

  const overlapRatio = wordRangeOverlapRatio(wStart, wEnd, usedWordRanges);

  if (overlapRatio >= penaltyThreshold) return Math.floor(hits * 0.3);

  const overlapWords = countWordOverlap(wStart, wEnd, usedWordRanges);

  return hits - Math.floor((overlapWords / targetWords) * hits);

}



function expandToMinChunkWords(wStart, wEnd, words, totalWords, sections, minWords) {

  const min = Math.max(50, Math.floor(Number(minWords) || DEFAULT_MIN_CHUNK_WORDS));

  if (wEnd - wStart >= min) return { wStart, wEnd };

  let newEnd = Math.min(totalWords, wStart + min);

  if (sections.length && Array.isArray(words) && words.length) {

    for (const sec of sections) {

      const idx = charRangeToWordIndices(words, sec.start, sec.end);

      if (newEnd <= idx.wEnd) {

        newEnd = Math.min(totalWords, idx.wEnd);

        break;

      }

    }

  }

  return { wStart, wEnd: Math.max(wStart + 1, newEnd) };

}



function findLeastOverlappingWindow(totalWords, targetWords, step, usedWordRanges, preferredStart) {

  let bestStart = Math.max(0, Math.min(preferredStart, totalWords - 1));

  let bestRatio = wordRangeOverlapRatio(

    bestStart,

    Math.min(totalWords, bestStart + targetWords),

    usedWordRanges,

  );



  for (let wStart = 0; wStart < totalWords; wStart += step) {

    const wEnd = Math.min(totalWords, wStart + targetWords);

    const ratio = wordRangeOverlapRatio(wStart, wEnd, usedWordRanges);

    if (ratio < bestRatio - 1e-9 || (Math.abs(ratio - bestRatio) <= 1e-9 && wStart > bestStart)) {

      bestRatio = ratio;

      bestStart = wStart;

    }

  }



  return {

    wStart: bestStart,

    wEnd: Math.min(totalWords, bestStart + targetWords),

    overlapRatio: bestRatio,

  };

}



function buildAlignedBlockResult(block, chunk, anchor_quality, chunk_match_terms, wStart, wEnd) {

  return {

    ...block,

    chunk,

    anchor_quality,

    chunk_match_terms,

    chunk_word_start: wStart,

    chunk_word_end: wEnd,

  };

}



function assignSingleAlignedChunk(

  block,

  blockOrdinal,

  blockCount,

  ctx,

  inventory,

  opts,

) {

  const { words, text, totalWords, targetWords, step, sections, proportional, usedWordRanges, penalizeOverlap } =

    ctx;

  const i = blockOrdinal;



  const title = String(block?.title || "").trim();

  const isOverview = Number(block?.id) === 1 && OVERVIEW_TITLE_RE.test(title);



  if (isOverview) {

    const wStart = 0;

    const wEnd = Math.min(totalWords, targetWords);

    const chunk = sliceByWordRange(text, wStart, wEnd, words);

    return buildAlignedBlockResult(block, chunk, "strong", ["overview_intro"], wStart, wEnd);

  }



  const terms = collectSearchTerms(block, inventory);

  const propRange = proportionalWordRange(i, blockCount, totalWords, targetWords);

  const propChunk = proportional[i] || sliceByWordRange(text, propRange.wStart, propRange.wEnd, words);



  if (!terms.length) {

    const least = findLeastOverlappingWindow(

      totalWords,

      targetWords,

      step,

      usedWordRanges,

      propRange.wStart,

    );

    const overlapRatio = least.overlapRatio;

    const chunk = sliceByWordRange(text, least.wStart, least.wEnd, words);

    return buildAlignedBlockResult(

      block,

      chunk || propChunk,

      overlapRatio >= 0.25 ? "weak" : "proportional_fallback",

      [],

      least.wStart,

      least.wEnd,

    );

  }



  let bestScore = -1;

  let bestStart = 0;

  let bestMatched = [];

  let bestRawHits = 0;



  for (let wStart = 0; wStart < totalWords; wStart += step) {

    const wEnd = Math.min(totalWords, wStart + targetWords);

    const charStart = words[wStart].start;

    const charEnd = words[wEnd - 1].end;

    const windowText = text.slice(charStart, charEnd);

    const { hits, matched } = countTermHits(windowText, terms);

    const effectiveScore = penalizedScore(hits, wStart, wEnd, targetWords, usedWordRanges, penalizeOverlap);

    if (effectiveScore > bestScore) {

      bestScore = effectiveScore;

      bestStart = wStart;

      bestMatched = matched;

      bestRawHits = hits;

    }

  }



  if (bestScore <= 0) {

    const least = findLeastOverlappingWindow(

      totalWords,

      targetWords,

      step,

      usedWordRanges,

      propRange.wStart,

    );

    const overlapRatio = least.overlapRatio;

    const chunk = sliceByWordRange(text, least.wStart, least.wEnd, words);

    return buildAlignedBlockResult(

      block,

      chunk || propChunk,

      overlapRatio >= 0.25 ? "weak" : "proportional_fallback",

      [],

      least.wStart,

      least.wEnd,

    );

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



  const minChunkWords = Number(opts?.minChunkWords) || DEFAULT_MIN_CHUNK_WORDS;

  if (sections.length) {

    const expanded = expandToMinChunkWords(wStart, wEnd, words, totalWords, sections, minChunkWords);

    wStart = expanded.wStart;

    wEnd = expanded.wEnd;

  }



  const chunk = sliceByWordRange(text, wStart, wEnd, words);

  const phraseBonus = terms.some((t) => t.startsWith("__phrase__:")) && bestRawHits >= 2;

  let anchor_quality =

    bestRawHits >= 2 || phraseBonus ? "strong" : bestRawHits === 1 ? "weak" : "proportional_fallback";

  if (penalizeOverlap) {

    const overlapRatio = wordRangeOverlapRatio(wStart, wEnd, usedWordRanges);

    if (overlapRatio >= 0.25 && anchor_quality === "strong") anchor_quality = "weak";

  }



  return buildAlignedBlockResult(

    block,

    chunk,

    anchor_quality,

    bestMatched.slice(0, 12),

    wStart,

    wEnd,

  );

}



/**

 * Assign chunks sequentially, accumulating usedWordRanges in block id order.

 *

 * @param {string} materialText

 * @param {object[]} blockIndex

 * @param {object[]} inventory

 * @param {{ docHierarchy?: object, usedWordRanges?: object[], penalizeOverlap?: boolean }} opts

 * @returns {{ blocks: object[], allocationMeta: { usedWordRanges: object[] } }}

 */

export function assignAlignedChunksSequential(materialText, blockIndex, inventory, opts = {}) {

  const material = String(materialText || "").trim();

  const blocks = Array.isArray(blockIndex) ? blockIndex : [];

  const inv = Array.isArray(inventory) ? inventory : [];

  if (!material || !blocks.length) {

    return { blocks, allocationMeta: { usedWordRanges: normalizeUsedWordRanges(opts.usedWordRanges) } };

  }



  const { words, text } = wordsWithOffsets(material);

  const totalWords = words.length;

  if (!totalWords) {

    return { blocks, allocationMeta: { usedWordRanges: normalizeUsedWordRanges(opts.usedWordRanges) } };

  }



  const penalizeOverlap = opts.penalizeOverlap !== false;

  const blockCount = blocks.length;

  const targetWords = Math.max(50, Math.ceil(totalWords / blockCount));

  const step = Math.max(50, Math.floor(targetWords / 4));

  const sections = getSectionBoundaries(opts.docHierarchy);

  const proportional = splitMaterialIntoBlockChunks(material, blockCount);

  const usedWordRanges = normalizeUsedWordRanges(opts.usedWordRanges);

  const sorted = [...blocks].sort((a, b) => Number(a.id) - Number(b.id));

  const ordinalById = new Map(blocks.map((b, idx) => [b.id, idx]));

  const byId = new Map();



  const ctx = {

    words,

    text,

    totalWords,

    targetWords,

    step,

    sections,

    proportional,

    usedWordRanges,

    penalizeOverlap,

  };



  for (const block of sorted) {

    const aligned = assignSingleAlignedChunk(

      block,

      ordinalById.get(block.id) ?? 0,

      blockCount,

      ctx,

      inv,

      opts,

    );

    byId.set(block.id, aligned);

    if (Number.isFinite(aligned.chunk_word_start) && Number.isFinite(aligned.chunk_word_end)) {

      usedWordRanges.push({

        wordStart: aligned.chunk_word_start,

        wordEnd: aligned.chunk_word_end,

        blockId: block.id,

      });

    }

  }



  return {

    blocks: blocks.map((b) => byId.get(b.id) ?? b),

    allocationMeta: { usedWordRanges },

  };

}



/**

 * @param {string} materialText

 * @param {object[]} blockIndex

 * @param {object[]} inventory

 * @param {{ docHierarchy?: object, usedWordRanges?: object[], penalizeOverlap?: boolean }} opts

 */

export function assignAlignedChunks(materialText, blockIndex, inventory, opts = {}) {

  const blocks = Array.isArray(blockIndex) ? blockIndex : [];

  if (!blocks.length) return blocks;



  const penalizeOverlap = opts.penalizeOverlap !== false;

  if (blocks.length === 1 || penalizeOverlap) {

    return assignAlignedChunksSequential(materialText, blocks, inventory, opts).blocks;

  }



  const material = String(materialText || "").trim();

  const inv = Array.isArray(inventory) ? inventory : [];

  if (!material) return blocks;



  const { words, text } = wordsWithOffsets(material);

  const totalWords = words.length;

  if (!totalWords) return blocks;



  const blockCount = blocks.length;

  const targetWords = Math.max(50, Math.ceil(totalWords / blockCount));

  const step = Math.max(50, Math.floor(targetWords / 4));

  const sections = getSectionBoundaries(opts.docHierarchy);

  const proportional = splitMaterialIntoBlockChunks(material, blockCount);

  const usedWordRanges = normalizeUsedWordRanges(opts.usedWordRanges);



  const ctx = {

    words,

    text,

    totalWords,

    targetWords,

    step,

    sections,

    proportional,

    usedWordRanges,

    penalizeOverlap: false,

  };



  return blocks.map((block, i) =>

    assignSingleAlignedChunk(block, i, blockCount, ctx, inv, { ...opts, penalizeOverlap: false }),

  );

}


