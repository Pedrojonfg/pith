/**
 * Emit normalized markdown with headings (#–######).
 */

/** @typedef {import("./types.js").TextBlock} TextBlock */
/** @typedef {import("./types.js").HeadingCandidate} HeadingCandidate */

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
  console.debug("[emit-markdown.emitMarkdown] Done:", {
    charCount: markdown.length,
    headingsWithOffsets: withOffsets.length,
  }); // [debug-enrich]
  return { markdown, headings: withOffsets };
}
