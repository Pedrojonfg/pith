/**
 * Emit normalized markdown with headings (#–######).
 */

/** @typedef {import("./types.js").TextBlock} TextBlock */
/** @typedef {import("./types.js").HeadingCandidate} HeadingCandidate */

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
      let text = block.text.trim();
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
  return { markdown, headings: withOffsets };
}
