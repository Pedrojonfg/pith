/**
 * Mechanical source-file provenance for multi-file uploads.
 * @module source-provenance
 */

export const MAX_SOURCE_FILES = 5;

/** HTML comment sentinel between concatenated files. */
export const SOURCE_FILE_SENTINEL_RE = /<!--\s*source:\s*(f\d+)\s*-->/gi;

/**
 * @param {number} index 1-based
 * @returns {string}
 */
export function sourceFileIdFromIndex(index) {
  return `f${Math.max(1, Math.floor(Number(index) || 1))}`;
}

/**
 * @param {File[]} files
 * @returns {import('./session-types.js').SourceFileMeta[]}
 */
export function assignSourceFileIds(files) {
  const list = Array.isArray(files) ? files : [];
  const now = Date.now();
  return list.slice(0, MAX_SOURCE_FILES).map((file, i) => ({
    fileId: sourceFileIdFromIndex(i + 1),
    fileName: String(file?.name || "").trim() || `file-${i + 1}`,
    originalFormat: String(file?.name || "").split(".").pop()?.toLowerCase() || "txt",
    sizeBytes: Math.max(0, Number(file?.size) || 0),
    addedAt: now,
  }));
}

/**
 * Hard section break inserted between normalized file bodies.
 * @param {string} fileId
 */
export function buildSourceFileBreak(fileId) {
  const id = String(fileId || "").trim() || "f1";
  return `\n\n---\n\n<!-- source: ${id} -->\n\n`;
}

/**
 * @param {string} markdown
 * @returns {{ fileId: string, start: number, end: number }[]}
 */
export function parseSourceFileRegions(markdown) {
  const text = String(markdown || "");
  if (!text.trim()) return [];

  const markers = [];
  let match;
  const re = new RegExp(SOURCE_FILE_SENTINEL_RE.source, "gi");
  while ((match = re.exec(text)) !== null) {
    const fileId = String(match[1] || "").trim();
    if (!fileId) continue;
    markers.push({ fileId, index: match.index, length: match[0].length });
  }

  if (!markers.length) {
    return [{ fileId: "f1", start: 0, end: text.length }];
  }

  const regions = [];
  let cursor = 0;
  let currentId = "f1";

  for (const m of markers) {
    const end = m.index;
    if (end > cursor) {
      regions.push({ fileId: currentId, start: cursor, end });
    }
    cursor = m.index + m.length;
    currentId = m.fileId;
  }

  if (cursor < text.length) {
    regions.push({ fileId: currentId, start: cursor, end: text.length });
  }

  return regions.filter((r) => r.end > r.start);
}

/**
 * Char positions where packing must not cross (sentinel boundaries).
 * @param {string} markdown
 * @returns {number[]}
 */
export function getSourceFileBoundaryCharPositions(markdown) {
  const text = String(markdown || "");
  const positions = [];
  let match;
  const re = new RegExp(SOURCE_FILE_SENTINEL_RE.source, "gi");
  while ((match = re.exec(text)) !== null) {
    positions.push(match.index);
    positions.push(match.index + match[0].length);
  }
  return [...new Set(positions)].sort((a, b) => a - b);
}

/**
 * @param {string} markdown
 * @param {string} fileId
 * @returns {string}
 */
export function sliceMarkdownForSourceFile(markdown, fileId) {
  const id = String(fileId || "").trim();
  const regions = parseSourceFileRegions(markdown);
  const region = regions.find((r) => r.fileId === id) || regions[0];
  if (!region) return String(markdown || "");
  return stripSourceSentinels(String(markdown || "").slice(region.start, region.end));
}

/** Remove sentinel comments from display text. */
export function stripSourceSentinels(text) {
  return String(text || "").replace(new RegExp(SOURCE_FILE_SENTINEL_RE.source, "gi"), "").trim();
}

/**
 * @param {string} markdown
 * @param {string} excerpt
 * @returns {string|undefined}
 */
export function resolveSourceFileIdForExcerpt(markdown, excerpt) {
  const sample = String(excerpt || "").trim();
  if (!sample) return undefined;
  const text = String(markdown || "");
  const regions = parseSourceFileRegions(text);
  if (!regions.length) return undefined;

  const needle = sample.slice(0, Math.min(80, sample.length)).toLowerCase();
  if (!needle) return undefined;

  for (const region of regions) {
    const slice = stripSourceSentinels(text.slice(region.start, region.end)).toLowerCase();
    if (slice.includes(needle)) return region.fileId;
  }

  const idx = text.toLowerCase().indexOf(needle);
  if (idx < 0) return undefined;
  for (const region of regions) {
    if (idx >= region.start && idx < region.end) return region.fileId;
  }
  return undefined;
}

/**
 * @param {string} markdown
 * @param {number} charStart
 * @param {number} charEnd
 * @returns {string[]}
 */
export function resolveSourceFileIdsForRange(markdown, charStart, charEnd) {
  const start = Math.max(0, Math.floor(Number(charStart) || 0));
  const end = Math.max(start, Math.floor(Number(charEnd) || 0));
  const regions = parseSourceFileRegions(markdown);
  const ids = new Set();
  for (const region of regions) {
    const overlaps = start < region.end && end > region.start;
    if (overlaps) ids.add(region.fileId);
  }
  return [...ids];
}

/**
 * @param {object[]} blocks
 * @param {string} materialText
 * @returns {object[]}
 */
export function annotateBlocksWithSourceFileIds(blocks, materialText) {
  const material = String(materialText || "");
  const regions = parseSourceFileRegions(material);
  const multiFile = regions.length > 1 || (regions[0] && regions[0].fileId !== "f1");
  if (!material || !multiFile) {
    return blocks;
  }
  return (Array.isArray(blocks) ? blocks : []).map((block) => {
    if (!block || typeof block !== "object") return block;
    const chunk = String(block.chunk || "").trim();
    if (!chunk) return block;
    const fileId = resolveSourceFileIdForExcerpt(material, chunk);
    if (!fileId) return block;
    return { ...block, sourceFileIds: [fileId] };
  });
}

/**
 * Prevent char range from crossing a source boundary.
 * @param {number} charStart
 * @param {number} charEnd
 * @param {number} textLen
 * @param {number[]} boundaries
 */
export function clampRangeToSourceBoundaries(charStart, charEnd, textLen, boundaries) {
  let start = Math.max(0, Math.min(charStart, textLen - 1));
  let end = Math.max(start + 1, Math.min(charEnd, textLen));
  const bounds = Array.isArray(boundaries) ? boundaries : [];
  for (const b of bounds) {
    const pos = Math.floor(Number(b));
    if (!Number.isFinite(pos) || pos <= 0 || pos >= textLen) continue;
    if (start < pos && end > pos) {
      end = pos;
    }
  }
  return { charStart: start, charEnd: Math.max(start + 1, end) };
}
