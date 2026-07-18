/**
 * Shared heading label normalization (HTML + markdown + PDF inference).
 */

/** Normalize unicode punctuation in heading labels for stable matching. */
export function normalizeHeadingLabel(text) {
  const raw = String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
  const leadDash = raw.match(/^([\u2014\u2013])\s+(.*)$/s);
  if (leadDash) {
    return `${leadDash[1]} ${normalizeHeadingLabelInner(leadDash[2])}`;
  }
  return normalizeHeadingLabelInner(raw);
}

/** @param {string} text */
function normalizeHeadingLabelInner(text) {
  return String(text || "")
    .replace(/\u2212|\u2013|\u2014/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\bL\s+1\s*:\s*T\s*-\s*1\b/gi, "L_1:T-1")
    .replace(/\bL\s+T\b/g, "L_T")
    .replace(/\bL\s+0\b/g, "L_0")
    .replace(/,\s*and\s+L\s+0$/i, ", and L_0")
    .replace(/\band\s+L_0\b/i, "and L_0")
    .replace(/,\s*reverse process decoder,\s*and\s+L_0/i, ", reverse process decoder, and L_0")
    .trim();
}

/** Short PDF top-level section title (e.g. "4 Experiments"), not a prose list item. */
export function isValidPdfTopLevelLabel(label) {
  const t = String(label || "").trim();
  if (!/^\d+\.\s+[A-Z\p{Lu}]/u.test(t) || /^\d+\.\d+/.test(t)) return false;
  if (t.split(/\s+/).filter(Boolean).length > 6) return false;
  if (/[(),;=≈]/.test(t.replace(/^\d+\.\s+/, ""))) return false;
  return true;
}

/** @param {string} label */
export function parseSectionNumber(label) {
  const m = String(label || "").match(/^(\d+(?:\.\d+)*)/);
  if (!m) return null;
  return m[1].split(".").map((n) => parseInt(n, 10));
}

/** @param {string} a @param {string} b */
export function compareHeadingLabels(a, b) {
  const ta = String(a || "").trim().toLowerCase();
  const tb = String(b || "").trim().toLowerCase();
  if (ta === "abstract") return tb === "abstract" ? 0 : -1;
  if (tb === "abstract") return 1;

  const pa = parseSectionNumber(a);
  const pb = parseSectionNumber(b);
  if (pa && pb) {
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
      const diff = (pa[i] || 0) - (pb[i] || 0);
      if (diff) return diff;
    }
    return 0;
  }
  if (pa) return -1;
  if (pb) return 1;

  if (/^[a-z]\s/.test(ta) && !/^[a-z]\s/.test(tb)) return 1;
  if (/^[a-z]\s/.test(tb) && !/^[a-z]\s/.test(ta)) return -1;
  return ta.localeCompare(tb);
}

/**
 * Swap heading blocks into numeric section order while keeping body blocks in place.
 * @param {import("./types.js").TextBlock[]} blocks
 * @param {import("./types.js").HeadingCandidate[]} headings
 */
export function reorderBlocksForHeadingSequence(blocks, headings) {
  const headingByBlock = new Map(headings.map((h) => [h.blockId, h]));
  /** @type {number[]} */
  const headingIndices = [];
  for (let i = 0; i < blocks.length; i++) {
    if (headingByBlock.has(blocks[i].id)) headingIndices.push(i);
  }
  if (headingIndices.length < 2) return blocks;

  const sortedBlocks = headingIndices
    .map((i) => blocks[i])
    .sort((a, b) =>
      compareHeadingLabels(headingByBlock.get(a.id).label, headingByBlock.get(b.id).label),
    );

  const result = [...blocks];
  for (let k = 0; k < headingIndices.length; k++) {
    result[headingIndices[k]] = sortedBlocks[k];
  }
  return result;
}

/**
 * Extract heading text without edit/anchor chrome (MediaWiki, Smashing Magazine, etc.).
 * @param {Element} el
 */
export function extractHeadingTextFromElement(el) {
  const clone = el.cloneNode(true);
  for (const node of clone.querySelectorAll?.(".mw-editsection, [class*='editsection']") || []) {
    node.remove();
  }
  for (const node of clone.querySelectorAll?.("a.anchor, .anchor") || []) {
    const linkText = (node.textContent || "").trim();
    node.replaceWith(clone.ownerDocument.createTextNode(linkText ? ` ${linkText}` : ""));
  }
  const text = (clone.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const normalized = normalizeHeadingLabel(text);
  if (fullPageChromeHeadingContext(clone) && /^[\u2014\u2013]?\s*Comments\b/i.test(normalized)) {
    return "Comments";
  }
  return normalized;
}

/** @param {Element} el */
function fullPageChromeHeadingContext(el) {
  const doc = el.ownerDocument;
  return Boolean(doc?.querySelector(".global-header, header.subnav__header"));
}

/**
 * Serialize element text, preserving chemistry-style <sub>/<sup> tags.
 * @param {Element} el
 */
/**
 * @param {Element} sup
 */
function shouldPreserveUnitSuperscript(sup) {
  const inner = (sup.textContent || "").replace(/\s+/g, " ").trim();
  if (!/^[−\-–]?\d+(?:\/\d+)?$/.test(inner)) return false;
  let prev = "";
  const prevNode = sup.previousSibling;
  if (prevNode?.nodeType === Node.TEXT_NODE) {
    prev = String(prevNode.textContent || "").slice(-4);
  } else if (prevNode?.nodeType === Node.ELEMENT_NODE) {
    prev = String(/** @type {Element} */ (prevNode).textContent || "").slice(-4);
  }
  return /(?:\/|·|mol|cm|\^)$/i.test(prev);
}

/**
 * Flatten Wikipedia-style citation superscripts to plain text (keep chemistry sub/sup).
 * @param {Element} el
 */
export function flattenCitationSupMarkers(el) {
  const clone = /** @type {Element} */ (el.cloneNode(true));
  for (const sup of clone.querySelectorAll("sup")) {
    const inner = (sup.textContent || "").replace(/\s+/g, " ").trim();
    const cls = String(sup.className || "");
    const isCitation =
      !shouldPreserveUnitSuperscript(sup) &&
      (/\bmw-ref\b/i.test(cls) ||
        /\breference\b/i.test(cls) ||
        /^(\[\w+\]|\d{1,3})$/.test(inner) ||
        /^\[[^\]]{1,120}\]$/.test(inner) ||
        /^[a-z]$/i.test(inner) ||
        /^\d{1,2}$/.test(inner) ||
        /citation needed|источник|source not/i.test(inner));
    if (isCitation) {
      sup.replaceWith(clone.ownerDocument.createTextNode(inner));
    }
  }
  return clone;
}

export function elementTextPreservingSubSup(el) {
  const normalized = flattenCitationSupMarkers(el);
  if (!normalized?.querySelector?.("sub, sup")) {
    return (normalized.innerText || normalized.textContent || "").replace(/\s+/g, " ").trim();
  }
  /** @param {Node} node */
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = String(/** @type {Element} */ (node).tagName || "").toLowerCase();
    if (tag === "sub" || tag === "sup") {
      const inner = Array.from(node.childNodes).map(walk).join("");
      return `<${tag}>${inner}</${tag}>`;
    }
    return Array.from(node.childNodes).map(walk).join("");
  };
  return walk(normalized).replace(/\s+/g, " ").trim();
}

/** @param {Element} body */
export function resolveHtmlContentRoot(body) {
  if (!body) return body;
  return (
    body.querySelector("article[role='main']") ||
    body.querySelector("article") ||
    body.querySelector("[role='main']") ||
    body.querySelector("main") ||
    body.querySelector("#article__content") ||
    body.querySelector(".article__content") ||
    body
  );
}

/** @param {Element} el */
export function isHtmlBoilerplateElement(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = String(el.tagName || "").toLowerCase();
  if (tag === "nav" || tag === "footer") return true;
  const cls = String(el.className || "");
  const id = String(el.id || "");
  if (id === "toc" || /\btoc\b/i.test(cls)) return true;
  if (el.closest?.("#toc, .toc")) return true;
  if (/cookie-banner|site-footer|global-nav|page-footer|global-header|site-header/i.test(cls)) {
    return true;
  }
  if (el.closest?.(".cookie-banner")) return true;
  return false;
}

/** Reject PDF lines mis-inferred as headings (letterhead, run-in labels). */
export function isPdfHeadingNoise(text) {
  const t = String(text || "").trim();
  if (!t) return true;
  if (/^phone:/i.test(t)) return true;
  if (/^extension:/i.test(t)) return true;
  if (/^room \d+/i.test(t)) return true;
  if (/,\s*[A-Za-z]{2}\.\s*\d{5}\b/.test(t)) return true;
  if (/@/.test(t) && t.length < 100) return true;
  if (/^[A-Z][A-Z0-9\s]{2,}:/.test(t)) return true;
  if (/^teacher:/i.test(t)) return true;
  if (/^Table\s+\d+\./i.test(t)) return true;
  if (/^\([+\-]?\d/.test(t)) return true;
  if (/\bpercent\)\.?$/i.test(t)) return true;
  if (/\bwww\.\S+/i.test(t)) return true;
  if (/\(\s*See table \d+/i.test(t)) return true;
  if (/^[a-z(]/.test(t) && /\.$/.test(t) && t.split(/\s+/).length <= 14) return true;
  if (/^For release \d/i.test(t)) return true;
  if (/^Technical information:/i.test(t)) return true;
  if (/^Media contact:/i.test(t)) return true;
  if (isOcrGarbageHeadingText(t)) return true;
  return false;
}

/**
 * Poor OCR often invents "headings" from control chars, entities, and glyph noise.
 * @param {string} text
 */
export function isOcrGarbageHeadingText(text) {
  const t = String(text || "").trim();
  if (!t) return true;
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(t)) return true;
  if (/&#\d+;|&[a-z]+;/i.test(t)) return true;
  if (/\uFFFD/.test(t)) return true;
  const letters = (t.match(/\p{L}/gu) || []).length;
  const weird = (t.match(/[^\p{L}\p{N}\s.,;:'"?!()\-/–—]/gu) || []).length;
  if (t.length >= 6 && letters > 0 && weird / t.length > 0.22) return true;
  if (t.length >= 8 && letters / t.length < 0.35) return true;
  // Merged OCR tokens with almost no word spaces look like shouty headings.
  if (t.length >= 20 && !/\s/.test(t) && /[A-Za-z]{12,}/.test(t)) return true;
  return false;
}

/** Collapse PDF small-caps spacing artifacts (e.g. "C OUNTY E MPLOYMENT"). */
export function collapsePdfSpacedTitle(text) {
  const t = String(text || "").trim();
  if (!/\b[A-Z]\s+[A-Z]/.test(t)) return t;
  let collapsed = t.replace(/\b([A-Z])\s+(?=[A-Z])/g, "$1");
  collapsed = collapsed.replace(/\s+/g, " ").trim();
  if (!/[a-z]/.test(collapsed)) {
    collapsed = collapsed
      .toLowerCase()
      .replace(/\b([a-z])/g, (m) => m.toUpperCase())
      .replace(/\b(And|Or|The|Of|In|To|A|An)\b/g, (m) => m.toLowerCase());
  }
  return collapsed.replace(/\u2013|\u2014/g, "-");
}
