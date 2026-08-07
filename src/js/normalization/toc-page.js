/**
 * Text-TOC page + HTML TOC extraction (spec R18–R19).
 */

/** EN/ES TOC page title patterns (spec §8 / R18.1). */
export const TOC_TEXT_PAGE_TITLE_PATTERNS = [
  /^(contents|table of contents)$/i,
  /^(índice|indice|sumario)$/i,
];

const TOC_ENTRY_DOT_LEADER =
  /^(.+?)\s*(?:\.{2,}|\u2026+)\s*(\d+)\s*$/;
const TOC_ENTRY_TAB_OR_SPACES = /^(.+?)\s{2,}(\d+)\s*$/;
const TOC_ENTRY_TAB = /^(.+?)\t+(\d+)\s*$/;

/**
 * @param {string} text
 */
export function isTocPageTitle(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  return TOC_TEXT_PAGE_TITLE_PATTERNS.some((re) => re.test(t));
}

/**
 * @param {string} line
 * @returns {{ title: string, pageNumber: number } | null}
 */
export function parseTocEntryLine(line) {
  const raw = String(line || "").trim();
  if (!raw || isTocPageTitle(raw)) return null;
  let m =
    TOC_ENTRY_DOT_LEADER.exec(raw) ||
    TOC_ENTRY_TAB.exec(raw) ||
    TOC_ENTRY_TAB_OR_SPACES.exec(raw);
  if (!m) {
    m = /^(.+?)\s+(\d+)\s*$/.exec(raw);
    if (m) {
      const title = m[1].trim();
      const words = title.split(/\s+/).filter(Boolean).length;
      if (words > 12 || title.length < 2) return null;
    }
  }
  if (!m) return null;
  const title = String(m[1] || "")
    .trim()
    .replace(/\s*[.\u2026]+$/, "")
    .trim();
  const pageNumber = Number(m[2]);
  if (!title || !Number.isFinite(pageNumber) || pageNumber < 1) return null;
  if (isTocPageTitle(title)) return null;
  return { title, pageNumber };
}

/**
 * Infer outline level from numbering / indentation cues.
 * @param {string} title
 * @param {number} [indentSpaces]
 */
function levelFromTocTitle(title, indentSpaces = 0) {
  const t = String(title || "").trim();
  const nums = t.match(/^(\d+(?:\.\d+)*)/);
  if (nums) {
    const depth = nums[1].split(".").filter(Boolean).length;
    return Math.min(Math.max(depth, 1), 6);
  }
  if (/^[IVXLC]+\.\s+\S/i.test(t)) return 1;
  if (indentSpaces >= 4) return 3;
  if (indentSpaces >= 2) return 2;
  return 1;
}

/**
 * Parse TOC entries from blocks starting at a Contents/Índice page.
 * Spans the title page and immediately following pages while entries continue.
 *
 * @param {import("./types.js").TextBlock[]} blocks
 * @returns {{ title: string, pageNumber: number, level: number }[]}
 */
export function parseTextTocEntries(blocks) {
  const list = Array.isArray(blocks) ? blocks : [];
  const titleIdx = list.findIndex((b) => isTocPageTitle(b?.text));
  if (titleIdx < 0) return [];

  const startPage = Number(list[titleIdx].pageIndex) || 0;
  /** @type {{ title: string, pageNumber: number, level: number }[]} */
  const entries = [];
  let lastEntryPage = startPage;

  for (let i = titleIdx + 1; i < list.length; i++) {
    const block = list[i];
    if (!block || block.kind === "artifact") continue;
    const page = Number(block.pageIndex) || 0;
    if (page > lastEntryPage + 1 && entries.length > 0) break;
    if (page > startPage + 3 && entries.length === 0) break;

    const text = String(block.text || "");
    const lines = text.split(/\r?\n/);
    let gotEntryOnBlock = false;
    for (const line of lines) {
      const leading = /^(\s*)/.exec(line)?.[1].length || 0;
      const parsed = parseTocEntryLine(line);
      if (!parsed) continue;
      entries.push({
        title: parsed.title,
        pageNumber: parsed.pageNumber,
        level: levelFromTocTitle(parsed.title, leading),
      });
      gotEntryOnBlock = true;
      lastEntryPage = page;
    }
    if (!gotEntryOnBlock && entries.length > 0 && page > lastEntryPage) {
      // non-entry body after TOC region
      if (page > lastEntryPage) break;
    }
  }

  return entries;
}

/**
 * Adapter for matchOutlineToBlocks — 1-based printed page → 0-based pageIndex.
 * @param {{ title: string, pageNumber: number, level?: number }[]} entries
 * @returns {{ title: string, pageIndex: number, level: number }[]}
 */
export function textTocEntriesToOutline(entries) {
  return (entries || []).map((e) => ({
    title: e.title,
    pageIndex: Math.max(0, Number(e.pageNumber) - 1),
    level: Math.min(Math.max(Number(e.level) || 1, 1), 6),
  }));
}

/**
 * Extract HTML TOC `<a>` entries from nav / #toc / .toc before body drop.
 * pageIndex is always 0 (no printed page numbers) for matchOutlineToBlocks.
 *
 * @param {string} html
 * @returns {{ title: string, pageIndex: number, level: number }[]}
 */
export function extractHtmlTocOutline(html) {
  const raw = String(html || "");
  if (!raw.trim() || typeof DOMParser === "undefined") return [];

  let doc;
  try {
    doc = new DOMParser().parseFromString(raw, "text/html");
  } catch {
    return [];
  }
  if (!doc?.body) return [];

  const roots = [
    ...doc.querySelectorAll("nav"),
    ...doc.querySelectorAll("#toc, .toc"),
  ];
  /** @type {Element[]} */
  const unique = [];
  const seen = new Set();
  for (const el of roots) {
    if (!el || seen.has(el)) continue;
    // skip nested duplicates
    if (unique.some((u) => u.contains(el))) continue;
    seen.add(el);
    unique.push(el);
  }

  /** @type {{ title: string, pageIndex: number, level: number }[]} */
  const outline = [];
  const seenTitles = new Set();

  for (const root of unique) {
    const links = root.querySelectorAll("a");
    for (const a of links) {
      const title = String(a.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!title || title.length < 2) continue;
      const key = title.toLowerCase();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      let depth = 0;
      let p = a.parentElement;
      while (p && p !== root) {
        if (/^(ul|ol)$/i.test(String(p.tagName || ""))) depth += 1;
        p = p.parentElement;
      }
      outline.push({
        title,
        pageIndex: 0,
        level: Math.min(Math.max(depth || 1, 1), 6),
      });
    }
  }

  return outline;
}
