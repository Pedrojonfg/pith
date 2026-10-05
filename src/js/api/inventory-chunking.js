import { snapInteriorCharOffsets } from "../text-boundaries.js";

export const INVENTORY_MAP_REDUCE_WORD_THRESHOLD = 8000;
export const INVENTORY_TARGET_CHUNK_WORDS = 2500;
export const INVENTORY_MAX_PARALLEL_CALLS = 8;

/** Char-window fallback slice when hierarchy cannot split (20260705-dpp-inventory-llm-optimization). */
export const INVENTORY_CHAR_FALLBACK_SLICE_CHARS = 24000;

/** Max bisect depth per chunk on truncation (each level halves slice size). */
export const INVENTORY_CHUNK_BISECT_MAX_DEPTH = 2;

/** Minimum chars per char-fallback slice after boundary refinement. */
export const INVENTORY_CHAR_FALLBACK_MIN_CHARS = 4000;

/** One LLM call to nudge mechanical slice boundaries (~8 cuts × context). */
export const CHAR_BOUNDARY_REFINE_MAX_TOKENS = 2048;

/** Max interior boundary shift when refining char slices. */
export const CHAR_BOUNDARY_REFINE_WINDOW = 2000;

export function countInventoryWords(text) {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

/**
 * Chunk inventory material by hierarchy section offsets.
 * Callers must pass hierarchy whose offsets match `rawMarkdown`
 * (mini-tree × scopedMarkdown when scope is a section subset).
 * @param {{ tree?: { title?: string, startOffset?: number, endOffset?: number, children?: object[] }[] }} docHierarchy
 * @param {string} rawMarkdown
 * @returns {{ label: string, text: string, wordCount: number }[] | null}
 */
export function buildInventoryChunks(docHierarchy, rawMarkdown) {
  const tree = docHierarchy?.tree;
  if (!Array.isArray(tree) || !tree.length) return null;
  const material = String(rawMarkdown || "");
  const TARGET = INVENTORY_TARGET_CHUNK_WORDS;

  /** @type {{ label: string, text: string, wordCount: number }[]} */
  const chunks = [];
  /** @type {{ sections: object[], wordCount: number }} */
  let pending = { sections: [], wordCount: 0 };

  function extractSectionText(node) {
    const start = Number(node?.startOffset) || 0;
    const end = Number(node?.endOffset) || material.length;
    return material.slice(start, end).trim();
  }

  function flushPending() {
    if (!pending.sections.length) return;
    const first = pending.sections[0];
    const label =
      pending.sections.length > 1
        ? `${String(first?.title || "Section")} + ${pending.sections.length - 1} more`
        : String(first?.title || "Section");
    const text = pending.sections.map(extractSectionText).join("\n\n");
    chunks.push({ label, text, wordCount: countInventoryWords(text) });
    pending = { sections: [], wordCount: 0 };
  }

  for (const section of tree) {
    const sectionText = extractSectionText(section);
    const sectionWords = countInventoryWords(sectionText);

    if (sectionWords > TARGET * 2) {
      flushPending();
      const children = Array.isArray(section.children) ? section.children : [];
      if (children.length) {
        for (const child of children) {
          const childText = extractSectionText(child);
          chunks.push({
            label: `${String(section.title || "Section")} / ${String(child.title || "Part")}`,
            text: childText,
            wordCount: countInventoryWords(childText),
          });
        }
      } else {
        chunks.push({
          label: String(section.title || "Section"),
          text: sectionText,
          wordCount: sectionWords,
        });
      }
    } else if (pending.wordCount + sectionWords > TARGET && pending.sections.length > 0) {
      flushPending();
      pending = { sections: [section], wordCount: sectionWords };
    } else {
      pending.sections.push(section);
      pending.wordCount += sectionWords;
    }
  }
  flushPending();

  if (chunks.length < 2) return null;
  return chunks;
}

/** Char-window chunks when hierarchy cannot split (large docs, flat structure). */
export function buildCharFallbackInventoryChunks(rawMarkdown, charCount = 0) {
  const material = String(rawMarkdown || "");
  const chars = Math.max(0, Number(charCount) || material.length);
  if (chars < 50000) return null;
  const offsets = snapInteriorCharOffsets(material, mechanicalCharFallbackOffsets(material.length));
  return buildCharFallbackInventoryChunksFromOffsets(material, offsets);
}

/**
 * @param {number} materialLength
 * @param {number} [sliceChars]
 * @returns {number[]}
 */
export function mechanicalCharFallbackOffsets(
  materialLength,
  sliceChars = INVENTORY_CHAR_FALLBACK_SLICE_CHARS,
) {
  const total = Math.max(0, Number(materialLength) || 0);
  if (total <= 0) return [0, 0];
  const slice = Math.max(1000, Number(sliceChars) || INVENTORY_CHAR_FALLBACK_SLICE_CHARS);
  /** @type {number[]} */
  const offsets = [0];
  for (let start = slice; start < total; start += slice) {
    offsets.push(start);
  }
  offsets.push(total);
  return offsets;
}

/**
 * @param {string} rawMarkdown
 * @param {number[]} offsets — sorted, includes 0 and material.length
 * @returns {{ label: string, text: string, wordCount: number }[] | null}
 */
export function buildCharFallbackInventoryChunksFromOffsets(rawMarkdown, offsets) {
  const material = String(rawMarkdown || "");
  const sorted = (Array.isArray(offsets) ? offsets : [])
    .map((n) => Math.floor(Number(n) || 0))
    .filter((n, i, arr) => i === 0 || n > arr[i - 1]);
  if (sorted.length < 2 || sorted[0] !== 0 || sorted[sorted.length - 1] > material.length) {
    return null;
  }
  /** @type {{ label: string, text: string, wordCount: number }[]} */
  const chunks = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const text = material.slice(sorted[i], sorted[i + 1]).trim();
    if (!text) continue;
    chunks.push({
      label: `Part ${chunks.length + 1}`,
      text,
      wordCount: countInventoryWords(text),
    });
  }
  return chunks.length >= 2 ? chunks : null;
}

/**
 * @param {number[]} offsets
 * @param {number} totalLen
 * @param {number} maxSlice
 * @param {number} minSlice
 */
export function validateCharFallbackOffsets(offsets, totalLen, maxSlice, minSlice) {
  if (!Array.isArray(offsets) || offsets.length < 2) return false;
  if (offsets[0] !== 0 || offsets[offsets.length - 1] !== totalLen) return false;
  for (let i = 0; i < offsets.length - 1; i += 1) {
    const len = offsets[i + 1] - offsets[i];
    if (len > maxSlice + 500) return false;
    const isTail = i === offsets.length - 2;
    if (!isTail && len < minSlice) return false;
  }
  return true;
}

/** @param {string} material @param {number} offset @param {number} [window] */
export function snapOffsetToParagraph(material, offset, window = CHAR_BOUNDARY_REFINE_WINDOW) {
  const total = material.length;
  const o = Math.max(0, Math.min(total, Math.floor(Number(offset) || 0)));
  const lo = Math.max(0, o - window);
  const hi = Math.min(total, o + window);
  let splitAt = material.lastIndexOf("\n\n", o);
  if (splitAt < lo) splitAt = material.indexOf("\n\n", o);
  if (splitAt < lo || splitAt > hi) return o;
  return splitAt;
}
